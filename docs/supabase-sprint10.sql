-- Sprint 10 — API, Marketplace, Payments, Notifications (additive)
-- tenant_id = venues.id (text). Sprint 2: tenantId === venueId — không bảng tenants uuid riêng.
-- Rollback: docs/supabase-sprint10-rollback.sql
-- Production: giữ VITE_API_ENABLED=false, VITE_MARKETPLACE_ENABLED=false cho đến khi QA xong.

-- ─── Sửa cột tenant_id uuid → text (idempotent, nếu đã chạy bản cũ lỗi một phần) ───
do $fix_tenant_id$
declare
  tbl text;
begin
  foreach tbl in array array[
    'api_clients', 'api_keys', 'api_logs',
    'marketplace_products', 'marketplace_orders', 'payment_transactions',
    'notification_logs', 'webhook_events'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = tbl
        and c.column_name = 'tenant_id'
        and c.udt_name = 'uuid'
    ) then
      execute format(
        'alter table public.%I alter column tenant_id type text using tenant_id::text',
        tbl
      );
    end if;
  end loop;
end $fix_tenant_id$;

-- ─── api_clients ───────────────────────────────────────────────────
create table if not exists public.api_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tenant_id text,
  status text not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $fk$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'api_clients_tenant_id_fkey'
  ) then
    alter table public.api_clients
      add constraint api_clients_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end $fk$;

comment on column public.api_clients.tenant_id is
  'Venue/tenant id (text). Alias venues.id per Sprint 2 multi-tenant.';

-- ─── api_keys ──────────────────────────────────────────────────────
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.api_clients(id) on delete cascade,
  tenant_id text,
  key_prefix text not null,
  hashed_key text not null,
  scopes text[] not null default '{}',
  status text not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

do $fk$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'api_keys_tenant_id_fkey'
  ) then
    alter table public.api_keys
      add constraint api_keys_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end $fk$;

comment on column public.api_keys.tenant_id is
  'Venue/tenant id (text). Denormalized from api_clients for query/index.';

-- ─── api_logs ──────────────────────────────────────────────────────
create table if not exists public.api_logs (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  tenant_id text,
  api_client_id uuid,
  method text not null,
  path text not null,
  status_code int not null,
  duration_ms int not null default 0,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- ─── marketplace_products ──────────────────────────────────────────
create table if not exists public.marketplace_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  vendor_id uuid,
  name text not null,
  description text,
  category text not null,
  price numeric not null default 0,
  currency text not null default 'VND',
  billing_type text not null default 'one_time',
  status text not null default 'draft',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── marketplace_orders ────────────────────────────────────────────
create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  buyer_user_id uuid,
  total_amount numeric not null,
  currency text not null default 'VND',
  status text not null default 'pending',
  payment_provider text,
  payment_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── payment_transactions ──────────────────────────────────────────
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  order_id uuid,
  provider text not null,
  amount numeric not null,
  currency text not null default 'VND',
  status text not null default 'pending',
  provider_transaction_id text,
  provider_payment_url text,
  idempotency_key text unique,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── notification_logs ─────────────────────────────────────────────
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  channel text not null,
  template_key text,
  status text not null,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- ─── webhook_events ────────────────────────────────────────────────
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  provider text not null,
  event_type text not null,
  payload jsonb not null default '{}',
  signature text,
  idempotency_key text,
  status text not null default 'received',
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ─── Indexes ───────────────────────────────────────────────────────
create index if not exists idx_api_logs_tenant_created
  on public.api_logs (tenant_id, created_at desc);
create index if not exists idx_payment_tx_tenant
  on public.payment_transactions (tenant_id, created_at desc);
create index if not exists idx_webhook_idempotency
  on public.webhook_events (idempotency_key);
create index if not exists idx_marketplace_products_tenant
  on public.marketplace_products (tenant_id);
create index if not exists idx_marketplace_orders_tenant
  on public.marketplace_orders (tenant_id, created_at desc);
create index if not exists idx_notification_logs_tenant
  on public.notification_logs (tenant_id, created_at desc);

-- ─── RLS (enabled; policies bổ sung khi bật API/Marketplace) ───────
alter table public.api_clients enable row level security;
alter table public.api_keys enable row level security;
alter table public.api_logs enable row level security;
alter table public.marketplace_products enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.notification_logs enable row level security;
alter table public.webhook_events enable row level security;
