import pgserver, tempfile, psycopg2, json, uuid, sys
srv = pgserver.get_server(tempfile.mkdtemp())
conn = psycopg2.connect(srv.get_uri()); conn.autocommit = True
cur = conn.cursor()

# --- Stubs mínimos del entorno Supabase ---
cur.execute("""
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create table profiles (id uuid primary key references auth.users(id), business_name text, plan text not null default 'lite', created_at timestamptz default now());
create table cash_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, kind text, method text, currency text,
  amount numeric(14,2), category text, note text, created_at timestamptz default now());
""")
sql = open('/home/claude/fintech-app/supabase/migrations/20261021000000_fintech_wallet.sql', encoding='utf-8').read()
cur.execute(sql)
print("✔ migración aplicada")

def user(name):
    cur.execute("insert into auth.users (email) values (%s) returning id", (f"{name}@x.com",)); uid = cur.fetchone()[0]
    cur.execute("insert into profiles (id, username) values (%s, %s)", (uid, name)); return uid
ana, bob, us = user("ana"), user("bob"), user("sender_us")
cur.execute("select count(*) from wallets"); assert cur.fetchone()[0] == 3; print("✔ wallet creada por trigger al crear perfil")

def call(fn, *args):
    cur.execute(f"select {fn}({','.join(['%s']*len(args))})", args); r = cur.fetchone()[0]; return r
def bal(u): cur.execute("select usdc_balance from wallets where user_id=%s", (u,)); return float(cur.fetchone()[0])
def expect_err(msg, fn, *args):
    try: call(fn, *args); print("✘ no falló:", msg); sys.exit(1)
    except psycopg2.Error as e:
        assert msg in str(e), (msg, str(e)); print(f"✔ rechaza: {msg}")

# --- On-ramp ---
cur.execute("insert into onramp_sessions (sender_id, receiver_id, provider, amount_usd) values (%s,%s,'mock',100) returning id", (us, ana))
sess = cur.fetchone()[0]
r = call("credit_onramp", sess, 'mock', 'evt1', 'x', 99.5, '0xabc', json.dumps({"a":1}))
assert r["status"] == "credited" and bal(ana) == 99.5; print("✔ depósito acreditado:", bal(ana))
r = call("credit_onramp", sess, 'mock', 'evt1', 'x', 99.5, '0xabc', json.dumps({"a":1}))
assert r["status"] == "duplicate" and bal(ana) == 99.5; print("✔ mismo evento reenviado → duplicate, saldo intacto")
r = call("credit_onramp", sess, 'mock', 'evt2', 'x', 99.5, '0xabc', json.dumps({}))
assert r["status"] == "already_completed" and bal(ana) == 99.5; print("✔ otro evento para sesión completada → ignorado")
cur.execute("select count(*), sum(amount) from cash_entries where user_id=%s", (ana,)); c, s = cur.fetchone()
assert c == 1 and float(s) == 99.5; print("✔ reflejado en cash_entries (Caja):", c, "fila,", s)
cur.execute("insert into onramp_sessions (sender_id, receiver_id, provider, amount_usd) values (%s,%s,'mock',50) returning id", (us, ana)); s2 = cur.fetchone()[0]
expect_err("AMOUNT_EXCEEDS_SESSION", "credit_onramp", s2, 'mock', 'evt3', 'x', 500, None, json.dumps({}))
assert bal(ana) == 99.5; print("✔ el rechazo no dejó saldo parcial (rollback)")

# --- P2P ---
r = call("transfer_internal", ana, bob, 40, 'idem-0001', 'hola'); assert r["status"] == "completed"
assert bal(ana) == 59.5 and bal(bob) == 40; print("✔ P2P: ana", bal(ana), "bob", bal(bob))
r = call("transfer_internal", ana, bob, 40, 'idem-0001', 'hola'); assert r["status"] == "duplicate" and bal(bob) == 40; print("✔ misma Idempotency-Key → no duplica")
expect_err("INSUFFICIENT_FUNDS", "transfer_internal", ana, bob, 1000, 'idem-0002', None)
expect_err("SELF_TRANSFER", "transfer_internal", ana, ana, 1, 'idem-0003', None)
expect_err("INVALID_AMOUNT", "transfer_internal", ana, bob, -5, 'idem-0004', None)
cur.execute("select count(*) from cash_entries where user_id=%s and method='USDC P2P'", (bob,)); assert cur.fetchone()[0] == 1; print("✔ P2P recibido también aparece en la Caja de bob")

# --- Retiros ---
r = call("request_withdrawal", bob, 30, '0x'+'a'*40, 'base', 'w-0001', 500); tx = r["transaction_id"]
assert r["status"] == "pending" and bal(bob) == 10; print("✔ retiro solicitado: saldo descontado →", bal(bob))
assert call("request_withdrawal", bob, 30, '0x'+'a'*40, 'base', 'w-0001', 500)["status"] == "duplicate" and bal(bob) == 10; print("✔ retiro idempotente")
expect_err("DAILY_LIMIT_EXCEEDED", "request_withdrawal", bob, 5, '0x'+'a'*40, 'base', 'w-0002', 32)
assert call("fail_withdrawal", tx, 'rechazado')["status"] == "refunded" and bal(bob) == 40; print("✔ retiro rechazado → reembolso:", bal(bob))
assert call("fail_withdrawal", tx, 'otra vez')["status"] == "not_pending" and bal(bob) == 40; print("✔ no se reembolsa dos veces")
r = call("request_withdrawal", bob, 10, '0x'+'b'*40, 'polygon', 'w-0003', 500)
assert call("complete_withdrawal", r["transaction_id"], '0xhash')["status"] == "completed"
assert call("fail_withdrawal", r["transaction_id"], 'tarde')["status"] == "not_pending" and bal(bob) == 30; print("✔ retiro completado no se puede reembolsar")

# --- Invariante: el dinero total cuadra ---
cur.execute("select sum(usdc_balance) from wallets"); total = float(cur.fetchone()[0])
cur.execute("select coalesce(sum(amount),0) from transactions where transaction_type='ONRAMP_DEPOSIT' and status='COMPLETED'"); dep = float(cur.fetchone()[0])
cur.execute("select coalesce(sum(amount),0) from transactions where transaction_type='EXTERNAL_WITHDRAWAL' and status in ('PENDING','COMPLETED')"); wd = float(cur.fetchone()[0])
assert abs(total - (dep - wd)) < 1e-9, (total, dep, wd); print(f"✔ invariante: saldos {total} = depósitos {dep} − retiros {wd}")

# --- Seguridad: clientes no pueden ejecutar funciones ni tocar saldos ---
cur.execute("set role authenticated"); cur.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(ana),))
for q in ("select transfer_internal(%s,%s,1,'hack-0001',null)", ):
    try: cur.execute(q, (ana, bob)); print("✘ authenticated pudo ejecutar transfer_internal"); sys.exit(1)
    except psycopg2.Error: print("✔ authenticated NO puede ejecutar transfer_internal")
cur.execute("update wallets set usdc_balance = 999999 where user_id=%s", (ana,)); assert cur.rowcount == 0
cur.execute("delete from wallets where user_id=%s", (ana,)); assert cur.rowcount == 0
cur.execute("insert into wallets (user_id) values (gen_random_uuid())") if False else None
try: cur.execute("insert into transactions (sender_id, receiver_id, amount, transaction_type) values (%s,%s,5,'INTERNAL_P2P')", (ana, bob)); print("✘ insert directo permitido"); sys.exit(1)
except psycopg2.Error: print("✔ authenticated NO puede insertar transacciones")
print("✔ authenticated: UPDATE/DELETE sobre wallets afectan 0 filas (RLS)")
cur.execute("select count(*) from wallets"); assert cur.fetchone()[0] == 1; print("✔ RLS: ana solo ve su propia wallet")
cur.execute("select count(*) from transactions"); n = cur.fetchone()[0]; print("✔ RLS: ana ve solo sus", n, "movimientos")
try: cur.execute("update profiles set plan='full' where id=%s", (ana,)); print("✘ pudo cambiar su plan"); sys.exit(1)
except psycopg2.Error: print("✔ authenticated NO puede cambiarse el plan")
cur.execute("update profiles set full_name='Ana P' where id=%s", (ana,)); print("✔ sí puede editar su nombre")
print("\nTODO OK")
