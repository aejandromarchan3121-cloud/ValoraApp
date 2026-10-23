-- =====================================================================
-- ValoraApp · Módulo Fintech (On-Ramp USD → USDC, billetera, P2P interno)
-- Ejecutar en Supabase → SQL Editor (o `supabase db push`).
-- Reglas: el cliente (anon/authenticated) SOLO lee; todo movimiento de dinero
-- ocurre en funciones SECURITY DEFINER que solo puede invocar service_role (backend).
-- =====================================================================

-- 1) PROFILES: campos fintech -------------------------------------------------
alter table profiles
  add column if not exists full_name text,
  add column if not exists username text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists wallet_address text,
  add column if not exists bridge_customer_id text,
  add column if not exists is_verified boolean not null default false;

create unique index if not exists profiles_username_key on profiles (lower(username));
create unique index if not exists profiles_phone_key on profiles (phone) where phone is not null;

do $$ begin
  alter table profiles add constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_]{3,20}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table profiles add constraint profiles_phone_format
    check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');
exception when duplicate_object then null; end $$;

-- El usuario solo puede editar estos campos; plan/is_verified/bridge_customer_id/wallet_address no.
do $$ begin
  create policy "profiles: actualizar propio" on profiles for update
    using (id = auth.uid()) with check (id = auth.uid());
exception when duplicate_object then null; end $$;
revoke update on profiles from authenticated, anon;
grant update (full_name, username, phone) on profiles to authenticated;

-- Trigger de alta: ahora también guarda email y nombre
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, business_name, email, full_name)
  values (new.id, new.raw_user_meta_data->>'business_name', new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end $$;

update profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- 2) WALLETS ------------------------------------------------------------------
create table if not exists wallets (
  user_id uuid primary key references profiles(id) on delete cascade,
  usdc_balance numeric(20,6) not null default 0 check (usdc_balance >= 0),
  usdt_balance numeric(20,6) not null default 0 check (usdt_balance >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','FROZEN','CLOSED')),
  updated_at timestamptz not null default now()
);
alter table wallets enable row level security;
do $$ begin
  create policy "wallets: leer propia" on wallets for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

create or replace function create_wallet_for_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into wallets (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_profile_created_wallet on profiles;
create trigger on_profile_created_wallet after insert on profiles
  for each row execute function create_wallet_for_profile();
insert into wallets (user_id) select id from profiles on conflict do nothing;

-- 3) TRANSACTIONS (libro de movimientos) --------------------------------------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id),
  receiver_id uuid references profiles(id),
  amount numeric(20,6) not null check (amount > 0),
  currency text not null default 'USDC' check (currency in ('USDC','USDT','USD')),
  transaction_type text not null
    check (transaction_type in ('ONRAMP_DEPOSIT','INTERNAL_P2P','EXTERNAL_WITHDRAWAL','FIAT_CASHOUT')),
  status text not null default 'PENDING' check (status in ('PENDING','COMPLETED','FAILED','CANCELLED')),
  tx_hash text,
  idempotency_key text,
  provider_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists transactions_idem on transactions (sender_id, idempotency_key)
  where idempotency_key is not null;
create unique index if not exists transactions_provider_ref on transactions (provider_ref)
  where provider_ref is not null;
create index if not exists transactions_sender_created on transactions (sender_id, created_at desc);
create index if not exists transactions_receiver_created on transactions (receiver_id, created_at desc);
create index if not exists transactions_pending on transactions (status) where status = 'PENDING';

alter table transactions enable row level security;
do $$ begin
  create policy "transactions: leer propias" on transactions for select
    using (sender_id = auth.uid() or receiver_id = auth.uid());
exception when duplicate_object then null; end $$;

-- 4) ONRAMP_SESSIONS (una por intento de envío EE. UU. → Venezuela) -----------
create table if not exists onramp_sessions (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id),
  receiver_id uuid not null references profiles(id),
  provider text not null,
  provider_ref text,
  amount_usd numeric(20,2) not null check (amount_usd > 0),
  status text not null default 'CREATED'
    check (status in ('CREATED','AWAITING_FUNDS','COMPLETED','FAILED','EXPIRED')),
  instructions jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists onramp_sessions_provider_ref on onramp_sessions (provider_ref);
create index if not exists onramp_sessions_sender on onramp_sessions (sender_id, created_at desc);
alter table onramp_sessions enable row level security;
do $$ begin
  create policy "onramp: leer propias" on onramp_sessions for select using (sender_id = auth.uid());
exception when duplicate_object then null; end $$;

-- 5) WEBHOOK_EVENTS (idempotencia + auditoría; sin policies = solo service_role) ----
create table if not exists webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  event_type text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);
alter table webhook_events enable row level security;

-- 6) AI_USAGE (límite diario del asistente) ------------------------------------
create table if not exists ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_day on ai_usage (user_id, created_at desc);
alter table ai_usage enable row level security;
do $$ begin
  create policy "ai_usage: leer propio" on ai_usage for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- =====================================================================
-- FUNCIONES ATÓMICAS (toda la lógica de saldos vive aquí)
-- =====================================================================

-- A) Acreditar un depósito On-Ramp confirmado (idempotente por evento y por sesión)
create or replace function credit_onramp(
  p_session_id uuid, p_provider text, p_event_id text, p_event_type text,
  p_amount numeric, p_tx_hash text, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sess onramp_sessions;
  v_tx uuid;
  v_rows int;
begin
  insert into webhook_events (provider, event_id, event_type, payload)
  values (p_provider, p_event_id, p_event_type, p_payload)
  on conflict (provider, event_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return jsonb_build_object('status', 'duplicate'); end if;

  select * into v_sess from onramp_sessions where id = p_session_id for update;
  if not found then return jsonb_build_object('status', 'unknown_session'); end if;
  if v_sess.status = 'COMPLETED' then return jsonb_build_object('status', 'already_completed'); end if;

  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_amount > v_sess.amount_usd * 1.01 then raise exception 'AMOUNT_EXCEEDS_SESSION'; end if;

  update wallets set usdc_balance = usdc_balance + p_amount, updated_at = now()
   where user_id = v_sess.receiver_id and status = 'ACTIVE';
  if not found then raise exception 'WALLET_UNAVAILABLE'; end if;

  insert into transactions (sender_id, receiver_id, amount, currency, transaction_type, status,
                            tx_hash, provider_ref, metadata)
  values (v_sess.sender_id, v_sess.receiver_id, p_amount, 'USDC', 'ONRAMP_DEPOSIT', 'COMPLETED',
          p_tx_hash, p_provider || ':' || v_sess.id::text,
          jsonb_build_object('session_id', v_sess.id, 'amount_usd', v_sess.amount_usd))
  returning id into v_tx;

  -- Reflejo automático en la liquidez de Caja del receptor
  insert into cash_entries (user_id, kind, method, currency, amount, category, note)
  values (v_sess.receiver_id, 'digital', 'USDC On-Ramp', 'USD', p_amount, 'Remesas',
          'Depósito On-Ramp #' || left(v_tx::text, 8));

  update onramp_sessions set status = 'COMPLETED', updated_at = now() where id = v_sess.id;
  update webhook_events set processed_at = now() where provider = p_provider and event_id = p_event_id;

  return jsonb_build_object('status', 'credited', 'transaction_id', v_tx);
end $$;

-- B) Transferencia interna P2P (atómica, sin comisión, idempotente)
create or replace function transfer_internal(
  p_sender uuid, p_receiver uuid, p_amount numeric, p_idem text, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
  v_balance numeric;
  v_tx uuid;
  v_uname text;
begin
  if p_sender = p_receiver then raise exception 'SELF_TRANSFER'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  select id into v_existing from transactions where sender_id = p_sender and idempotency_key = p_idem;
  if found then return jsonb_build_object('status', 'duplicate', 'transaction_id', v_existing); end if;

  -- Bloqueo en orden determinista: evita deadlocks entre transferencias cruzadas
  perform 1 from wallets where user_id = least(p_sender, p_receiver) for update;
  perform 1 from wallets where user_id = greatest(p_sender, p_receiver) for update;

  select usdc_balance into v_balance from wallets where user_id = p_sender and status = 'ACTIVE';
  if not found then raise exception 'WALLET_UNAVAILABLE'; end if;
  if not exists (select 1 from wallets where user_id = p_receiver and status = 'ACTIVE') then
    raise exception 'WALLET_UNAVAILABLE';
  end if;
  if v_balance < p_amount then raise exception 'INSUFFICIENT_FUNDS'; end if;

  update wallets set usdc_balance = usdc_balance - p_amount, updated_at = now() where user_id = p_sender;
  update wallets set usdc_balance = usdc_balance + p_amount, updated_at = now() where user_id = p_receiver;

  insert into transactions (sender_id, receiver_id, amount, currency, transaction_type, status,
                            idempotency_key, metadata)
  values (p_sender, p_receiver, p_amount, 'USDC', 'INTERNAL_P2P', 'COMPLETED', p_idem,
          jsonb_build_object('note', p_note))
  returning id into v_tx;

  select username into v_uname from profiles where id = p_sender;
  insert into cash_entries (user_id, kind, method, currency, amount, category, note)
  values (p_receiver, 'digital', 'USDC P2P', 'USD', p_amount, 'Remesas',
          'Transferencia de @' || coalesce(v_uname, 'usuario') || coalesce(' · ' || p_note, ''));

  return jsonb_build_object('status', 'completed', 'transaction_id', v_tx);
end $$;

-- C) Solicitar retiro externo: descuenta de inmediato y deja la tx PENDING
create or replace function request_withdrawal(
  p_user uuid, p_amount numeric, p_address text, p_network text, p_idem text, p_daily_limit numeric
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
  v_balance numeric;
  v_today numeric;
  v_tx uuid;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  select id into v_existing from transactions where sender_id = p_user and idempotency_key = p_idem;
  if found then return jsonb_build_object('status', 'duplicate', 'transaction_id', v_existing); end if;

  select usdc_balance into v_balance from wallets where user_id = p_user and status = 'ACTIVE' for update;
  if not found then raise exception 'WALLET_UNAVAILABLE'; end if;
  if v_balance < p_amount then raise exception 'INSUFFICIENT_FUNDS'; end if;

  select coalesce(sum(amount), 0) into v_today from transactions
   where sender_id = p_user and transaction_type = 'EXTERNAL_WITHDRAWAL'
     and status in ('PENDING', 'COMPLETED') and created_at > now() - interval '24 hours';
  if v_today + p_amount > p_daily_limit then raise exception 'DAILY_LIMIT_EXCEEDED'; end if;

  update wallets set usdc_balance = usdc_balance - p_amount, updated_at = now() where user_id = p_user;
  insert into transactions (sender_id, amount, currency, transaction_type, status, idempotency_key, metadata)
  values (p_user, p_amount, 'USDC', 'EXTERNAL_WITHDRAWAL', 'PENDING', p_idem,
          jsonb_build_object('address', p_address, 'network', p_network))
  returning id into v_tx;

  return jsonb_build_object('status', 'pending', 'transaction_id', v_tx);
end $$;

-- D) Confirmar retiro enviado on-chain
create or replace function complete_withdrawal(p_tx uuid, p_tx_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update transactions set status = 'COMPLETED', tx_hash = p_tx_hash, updated_at = now()
   where id = p_tx and transaction_type = 'EXTERNAL_WITHDRAWAL' and status = 'PENDING';
  if not found then return jsonb_build_object('status', 'not_pending'); end if;
  return jsonb_build_object('status', 'completed');
end $$;

-- E) Rechazar retiro: devuelve el saldo (solo si sigue PENDING)
create or replace function fail_withdrawal(p_tx uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tx transactions;
begin
  select * into v_tx from transactions
   where id = p_tx and transaction_type = 'EXTERNAL_WITHDRAWAL' and status = 'PENDING' for update;
  if not found then return jsonb_build_object('status', 'not_pending'); end if;
  update wallets set usdc_balance = usdc_balance + v_tx.amount, updated_at = now() where user_id = v_tx.sender_id;
  update transactions set status = 'FAILED', updated_at = now(),
         metadata = metadata || jsonb_build_object('reason', p_reason)
   where id = p_tx;
  return jsonb_build_object('status', 'refunded');
end $$;

-- Solo el backend (service_role) puede ejecutar estas funciones
revoke all on function credit_onramp(uuid, text, text, text, numeric, text, jsonb) from public, anon, authenticated;
revoke all on function transfer_internal(uuid, uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function request_withdrawal(uuid, numeric, text, text, text, numeric) from public, anon, authenticated;
revoke all on function complete_withdrawal(uuid, text) from public, anon, authenticated;
revoke all on function fail_withdrawal(uuid, text) from public, anon, authenticated;
grant execute on function credit_onramp(uuid, text, text, text, numeric, text, jsonb) to service_role;
grant execute on function transfer_internal(uuid, uuid, numeric, text, text) to service_role;
grant execute on function request_withdrawal(uuid, numeric, text, text, text, numeric) to service_role;
grant execute on function complete_withdrawal(uuid, text) to service_role;
grant execute on function fail_withdrawal(uuid, text) to service_role;

-- Realtime: el frontend se actualiza solo cuando cambia el saldo (RLS aplica)
do $$ begin alter publication supabase_realtime add table wallets; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table transactions; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table cash_entries; exception when others then null; end $$;
