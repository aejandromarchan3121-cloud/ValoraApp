-- =====================================================================
-- ValoraApp · Recarga con tarjeta (SANDBOX), aporte automático al fondo de
-- emergencia e historial de tasas para el gráfico de velas.
-- Requiere haber aplicado 20261021000000_fintech_wallet.sql.
-- =====================================================================

-- 1) RECARGA CON TARJETA (solo pruebas) ---------------------------------------
-- Nuevo tipo de movimiento
alter table transactions drop constraint if exists transactions_transaction_type_check;
alter table transactions add constraint transactions_transaction_type_check
  check (transaction_type in ('ONRAMP_DEPOSIT','INTERNAL_P2P','EXTERNAL_WITHDRAWAL','FIAT_CASHOUT','CARD_TOPUP'));

-- Acredita USDC 1:1 por un cobro SIMULADO. Nunca recibe datos de tarjeta.
-- Solo service_role; el backend además la bloquea con SANDBOX_TOPUP_ENABLED=false (por defecto).
-- ⚠️ ELIMINAR antes de producción:  drop function sandbox_topup(uuid, numeric, text);
create or replace function sandbox_topup(p_user uuid, p_amount numeric, p_idem text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_existing uuid; v_tx uuid; v_balance numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  select id into v_existing from transactions where sender_id = p_user and idempotency_key = p_idem;
  if found then return jsonb_build_object('status', 'duplicate', 'transaction_id', v_existing); end if;

  update wallets set usdc_balance = usdc_balance + p_amount, updated_at = now()
   where user_id = p_user and status = 'ACTIVE' returning usdc_balance into v_balance;
  if not found then raise exception 'WALLET_UNAVAILABLE'; end if;

  insert into transactions (sender_id, receiver_id, amount, currency, transaction_type, status,
                            idempotency_key, metadata)
  values (p_user, p_user, p_amount, 'USDC', 'CARD_TOPUP', 'COMPLETED', p_idem,
          jsonb_build_object('sandbox', true, 'amount_usd', p_amount))
  returning id into v_tx;

  return jsonb_build_object('status', 'completed', 'transaction_id', v_tx, 'balance', v_balance);
end $$;
revoke all on function sandbox_topup(uuid, numeric, text) from public, anon, authenticated;
grant execute on function sandbox_topup(uuid, numeric, text) to service_role;

-- 2) APORTE AUTOMÁTICO AL FONDO DE EMERGENCIA ----------------------------------
alter table emergency_fund
  add column if not exists contribution_pct numeric(5,2) not null default 0
  check (contribution_pct >= 0 and contribution_pct <= 100);

-- Equivalente en USD de cada ingreso (el frontend lo calcula con la tasa del momento para Bs/EUR/COP)
alter table cash_entries
  add column if not exists usd_equiv numeric(14,2) check (usd_equiv is null or usd_equiv >= 0);

create table if not exists emergency_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  cash_entry_id uuid not null references cash_entries(id) on delete cascade,
  pct numeric(5,2) not null,
  amount_usd numeric(14,2) not null check (amount_usd > 0),
  created_at timestamptz not null default now()
);
create unique index if not exists emergency_contributions_entry on emergency_contributions (cash_entry_id);
create index if not exists emergency_contributions_user on emergency_contributions (user_id, created_at desc);
alter table emergency_contributions enable row level security;
do $$ begin
  create policy "contributions: leer propias" on emergency_contributions for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Al registrar un ingreso: aparta pct % (solo USD o con usd_equiv)
create or replace function apply_emergency_contribution() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pct numeric; v_usd numeric; v_add numeric;
begin
  v_usd := coalesce(new.usd_equiv, case when new.currency = 'USD' then new.amount end);
  if v_usd is null or v_usd <= 0 then return new; end if;

  select contribution_pct into v_pct from emergency_fund where user_id = new.user_id;
  if v_pct is null or v_pct <= 0 then return new; end if;

  v_add := round(v_usd * v_pct / 100, 2);
  if v_add <= 0 then return new; end if;

  update emergency_fund set balance_usd = balance_usd + v_add, updated_at = now() where user_id = new.user_id;
  insert into emergency_contributions (user_id, cash_entry_id, pct, amount_usd)
  values (new.user_id, new.id, v_pct, v_add);
  return new;
end $$;
drop trigger if exists cash_entries_emergency_contribution on cash_entries;
create trigger cash_entries_emergency_contribution after insert on cash_entries
  for each row execute function apply_emergency_contribution();

-- Si borras un ingreso, se revierte lo que había apartado
create or replace function revert_emergency_contribution() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_amt numeric;
begin
  select amount_usd into v_amt from emergency_contributions where cash_entry_id = old.id;
  if found then
    update emergency_fund set balance_usd = greatest(0, balance_usd - v_amt), updated_at = now()
     where user_id = old.user_id;
  end if;
  return old;
end $$;
drop trigger if exists cash_entries_revert_contribution on cash_entries;
create trigger cash_entries_revert_contribution before delete on cash_entries
  for each row execute function revert_emergency_contribution();

-- Aportes/retiros manuales RELATIVOS (el cliente ya no pisa el saldo con un valor viejo)
create or replace function adjust_emergency_fund(p_delta numeric) returns numeric
language plpgsql security invoker set search_path = public as $$
declare v numeric;
begin
  insert into emergency_fund (user_id, balance_usd) values (auth.uid(), greatest(0, p_delta))
  on conflict (user_id) do update
    set balance_usd = greatest(0, emergency_fund.balance_usd + p_delta), updated_at = now()
  returning balance_usd into v;
  return v;
end $$;
grant execute on function adjust_emergency_fund(numeric) to authenticated;

-- 3) HISTORIAL DE TASAS + VELAS -------------------------------------------------
create table if not exists rate_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  bcv numeric(14,4) not null check (bcv > 0),
  p2p numeric(14,4) not null check (p2p > 0),
  created_at timestamptz not null default now()
);
create index if not exists rate_snapshots_user_time on rate_snapshots (user_id, created_at desc);
alter table rate_snapshots enable row level security;
do $$ begin
  create policy "snapshots: leer propios" on rate_snapshots for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "snapshots: insertar propios" on rate_snapshots for insert with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Velas OHLC por hora o día (hora de Caracas). Corre con los permisos de quien llama → RLS aplica.
create or replace function rate_candles(p_bucket text default 'day', p_metric text default 'gap', p_days int default 30)
returns table (bucket timestamptz, open numeric, high numeric, low numeric, close numeric, samples int)
language sql stable as $$
  with s as (
    select
      (date_trunc(case when p_bucket = 'hour' then 'hour' else 'day' end,
                  created_at at time zone 'America/Caracas') at time zone 'America/Caracas') as b,
      created_at,
      case p_metric when 'bcv' then bcv when 'p2p' then p2p else round((p2p / bcv - 1) * 100, 2) end as v
    from rate_snapshots
    where user_id = auth.uid()
      and created_at >= now() - make_interval(days => least(greatest(p_days, 1), 365))
  )
  select b,
         (array_agg(v order by created_at asc))[1],
         max(v), min(v),
         (array_agg(v order by created_at desc))[1],
         count(*)::int
  from s group by b order by b;
$$;
grant execute on function rate_candles(text, text, int) to authenticated;
