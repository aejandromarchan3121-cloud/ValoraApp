import pgserver, tempfile, psycopg2, json, sys
srv = pgserver.get_server(tempfile.mkdtemp())
conn = psycopg2.connect(srv.get_uri()); conn.autocommit = True
cur = conn.cursor()
cur.execute("""
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role anon nologin; create role authenticated nologin; create role service_role nologin;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create table profiles (id uuid primary key references auth.users(id), business_name text, plan text not null default 'lite', created_at timestamptz default now());
create table cash_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, kind text, method text, currency text,
  amount numeric(14,2), category text, note text, created_at timestamptz default now());
create table emergency_fund (user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  target_usd numeric(14,2) not null default 1000, balance_usd numeric(14,2) not null default 0, updated_at timestamptz default now());
alter table emergency_fund enable row level security;
create policy "own rows" on emergency_fund for all using (user_id = auth.uid()) with check (user_id = auth.uid());
""")
for f in ("20261021000000_fintech_wallet.sql", "20261023000000_topup_emergency_candles.sql"):
    cur.execute(open(f"/home/claude/fintech-app/supabase/migrations/{f}", encoding="utf-8").read())
print("✔ ambas migraciones aplicadas en orden")
cur.execute("select pg_get_constraintdef(oid) from pg_constraint where conname='transactions_transaction_type_check'")
assert "CARD_TOPUP" in cur.fetchone()[0]; print("✔ tipo CARD_TOPUP permitido")

def user(name):
    cur.execute("insert into auth.users (email) values (%s) returning id", (f"{name}@x.com",)); u = cur.fetchone()[0]
    cur.execute("insert into profiles (id, username) values (%s,%s)", (u, name)); return u
ana, bob = user("ana"), user("bob")
def call(fn, *a): cur.execute(f"select {fn}({','.join(['%s']*len(a))})", a); return cur.fetchone()[0]
def bal(u): cur.execute("select usdc_balance from wallets where user_id=%s", (u,)); return float(cur.fetchone()[0])
def fund(u): cur.execute("select balance_usd, contribution_pct from emergency_fund where user_id=%s", (u,)); r = cur.fetchone(); return (float(r[0]), float(r[1])) if r else None
def entry(u, amt, cur_='USD', usd=None):
    cur.execute("insert into cash_entries (user_id, kind, method, currency, amount, usd_equiv) values (%s,'digital','x',%s,%s,%s) returning id", (u, cur_, amt, usd)); return cur.fetchone()[0]

# --- Recarga sandbox ---
r = call("sandbox_topup", ana, 50, "topup-0001"); assert r["status"] == "completed" and bal(ana) == 50
assert call("sandbox_topup", ana, 50, "topup-0001")["status"] == "duplicate" and bal(ana) == 50; print("✔ recarga acredita 1:1 y es idempotente")
cur.execute("select count(*) from cash_entries where user_id=%s", (ana,)); assert cur.fetchone()[0] == 0; print("✔ la recarga propia NO cuenta como ingreso en Caja")
try: call("sandbox_topup", ana, -1, "topup-0002"); sys.exit(1)
except psycopg2.Error as e: assert "INVALID_AMOUNT" in str(e); print("✔ rechaza monto inválido")
cur.execute("set role authenticated")
try: cur.execute("select sandbox_topup(%s,10,'hack-0001')", (ana,)); print("✘ authenticated pudo recargar"); sys.exit(1)
except psycopg2.Error: print("✔ authenticated NO puede ejecutar sandbox_topup")
cur.execute("reset role")

# --- Aporte automático ---
entry(ana, 100); assert fund(ana) is None; print("✔ sin fila de fondo no hay aporte (y no falla)")
cur.execute("insert into emergency_fund (user_id, contribution_pct) values (%s, 10)", (ana,))
e1 = entry(ana, 100);                      assert fund(ana) == (10.0, 10.0); print("✔ 10 % de 100 USD → +10")
e2 = entry(ana, 5000, 'VES', usd=5.0);     assert fund(ana)[0] == 10.5;      print("✔ VES con usd_equiv=5 → +0,50")
entry(ana, 5000, 'VES', usd=None);         assert fund(ana)[0] == 10.5;      print("✔ VES sin usd_equiv se omite (sin tasa no se inventa)")
entry(ana, 0.04);                          assert fund(ana)[0] == 10.5;      print("✔ aportes < 0,01 no generan fila")
cur.execute("delete from cash_entries where id=%s", (e1,)); assert fund(ana)[0] == 0.5; print("✔ borrar el ingreso revierte el aporte")
cur.execute("select count(*) from emergency_contributions where cash_entry_id=%s", (e1,)); assert cur.fetchone()[0] == 0
cur.execute("update emergency_fund set contribution_pct = 0 where user_id=%s", (ana,))
entry(ana, 100); assert fund(ana)[0] == 0.5; print("✔ con 0 % no aparta nada")
cur.execute("update emergency_fund set contribution_pct = 25.5 where user_id=%s", (ana,))
entry(ana, 200); assert fund(ana)[0] == 0.5 + 51.0; print("✔ porcentaje exacto con decimales (25,5 % de 200 = 51)")
try: cur.execute("update emergency_fund set contribution_pct = 101 where user_id=%s", (ana,)); sys.exit(1)
except psycopg2.Error: print("✔ el CHECK rechaza > 100 %")
# integración con depósito On-Ramp (flujo de la migración 1)
cur.execute("update emergency_fund set balance_usd=0, contribution_pct=10 where user_id=%s", (ana,))
cur.execute("insert into onramp_sessions (sender_id, receiver_id, provider, amount_usd) values (%s,%s,'mock',100) returning id", (bob, ana)); s = cur.fetchone()[0]
call("credit_onramp", s, 'mock', 'e1', 'x', 100, '0x', json.dumps({})); assert fund(ana)[0] == 10.0; print("✔ un depósito On-Ramp también aparta su porcentaje")

# --- Ajuste relativo (RLS invoker) ---
cur.execute("set role authenticated"); cur.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(ana),))
assert float(call("adjust_emergency_fund", 20)) == 30.0
assert float(call("adjust_emergency_fund", -500)) == 0.0; print("✔ ajuste relativo suma y nunca baja de 0")
cur.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(bob),))
assert float(call("adjust_emergency_fund", 5)) == 5.0
cur.execute("select count(*) from emergency_fund"); assert cur.fetchone()[0] == 1; print("✔ cada usuario ve/ajusta solo su fondo")
cur.execute("reset role")

# --- Velas ---
cur.execute("""insert into rate_snapshots (user_id, bcv, p2p, created_at) values
 (%s,880,1000,'2026-10-20 12:00:00+00'),(%s,882,1010,'2026-10-20 15:00:00+00'),(%s,884,995,'2026-10-20 17:00:00+00'),(%s,886,1003,'2026-10-20 20:00:00+00'),
 (%s,886,1020,'2026-10-21 14:00:00+00'),(%s,887,1030,'2026-10-21 16:00:00+00'),(%s,890,900,'2026-10-20 13:00:00+00')""", (ana,)*6 + (bob,))
cur.execute("update rate_snapshots set created_at = created_at + (now()::date - '2026-10-21'::date) * interval '1 day'")  # mover a ventana reciente
cur.execute("set role authenticated"); cur.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(ana),))
cur.execute("select open, high, low, close, samples from rate_candles('day','p2p',60) order by bucket"); rows = cur.fetchall()
assert len(rows) == 2, rows; o,h,l,c,n = rows[0]
assert (float(o), float(h), float(l), float(c), n) == (1000, 1010, 995, 1003, 4), rows[0]
assert tuple(float(x) for x in rows[1][:4]) == (1020, 1030, 1020, 1030); print("✔ velas diarias OHLC correctas:", [tuple(map(float, r[:4])) for r in rows])
cur.execute("select open, close from rate_candles('day','gap',60) order by bucket limit 1"); o,c = cur.fetchone()
assert float(o) == round((1000/880-1)*100, 2) and float(c) == round((1003/886-1)*100, 2); print("✔ métrica 'gap' = (P2P/BCV−1)×100:", float(o), "→", float(c))
cur.execute("select sum(samples) from rate_candles('hour','p2p',60)"); assert cur.fetchone()[0] == 6; print("✔ velas por hora; no mezcla datos de otros usuarios (6, no 7)")
try: cur.execute("insert into rate_snapshots (user_id,bcv,p2p) values (%s,1,1)", (bob,)); sys.exit(1)
except psycopg2.Error: print("✔ no se puede insertar snapshots a nombre de otro usuario")
print("\nTODO OK")
