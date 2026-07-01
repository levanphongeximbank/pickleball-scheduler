-- Phase 9 — Commercial SaaS Billing (additive)
-- tenant_id = venues.id (text). Chạy SAU supabase-rbac.sql + sprint2.
-- Rollback: docs/supabase-billing-phase9-rollback.sql
-- KHÔNG apply production cho đến khi staging QA xong.

-- ─── plans ─────────────────────────────────────────────────────────
create table if not exists public.plans (
  id text primary key,
  code text not null unique,
  name text not null,
  description text default '',
  price_monthly numeric not null default 0,
  price_yearly numeric not null default 0,
  currency text not null default 'VND',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── plan_limits ─────────────────────────────────────────────────────
create table if not exists public.plan_limits (
  id text primary key,
  plan_id text not null references public.plans(id) on delete restrict,
  max_venues int not null default 1,
  max_clubs int not null default 1,
  max_players int not null default 50,
  max_courts int not null default 4,
  max_tournaments_per_month int not null default 1,
  max_bookings_per_month int not null default 50,
  max_staff_users int not null default 2,
  max_referees int not null default 1,
  allow_mobile_app boolean not null default false,
  allow_ai_features boolean not null default false,
  allow_advanced_dashboard boolean not null default false,
  allow_payment_gateway boolean not null default false,
  allow_api_access boolean not null default false,
  allow_custom_branding boolean not null default false,
  allow_multi_venue boolean not null default false,
  allow_offline_mode boolean not null default false,
  allow_push_notification boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id)
);

-- ─── tenant_subscriptions ────────────────────────────────────────────
create table if not exists public.tenant_subscriptions (
  id text primary key,
  tenant_id text not null references public.venues(id) on delete cascade,
  plan_id text not null references public.plans(id) on delete restrict,
  status text not null default 'trialing'
    check (status in ('trialing','active','past_due','expired','cancelled','suspended')),
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly','yearly','manual')),
  start_date timestamptz not null default now(),
  end_date timestamptz,
  trial_start_date timestamptz,
  trial_end_date timestamptz,
  grace_period_until timestamptz,
  cancel_at timestamptz,
  cancelled_at timestamptz,
  auto_renew boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tenant_subscriptions_tenant
  on public.tenant_subscriptions (tenant_id);
create index if not exists idx_tenant_subscriptions_status
  on public.tenant_subscriptions (status);

-- ─── invoices ────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id text primary key,
  tenant_id text not null references public.venues(id) on delete cascade,
  subscription_id text references public.tenant_subscriptions(id) on delete set null,
  invoice_number text not null unique,
  status text not null default 'draft'
    check (status in ('draft','issued','paid','overdue','cancelled','refunded')),
  amount numeric not null default 0,
  currency text not null default 'VND',
  tax_amount numeric not null default 0,
  discount_amount numeric not null default 0,
  total_amount numeric not null default 0,
  issue_date timestamptz,
  due_date timestamptz,
  paid_at timestamptz,
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_tenant
  on public.invoices (tenant_id, created_at desc);

-- ─── invoice_items ───────────────────────────────────────────────────
create table if not exists public.invoice_items (
  id text primary key,
  tenant_id text not null references public.venues(id) on delete cascade,
  invoice_id text not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity int not null default 1,
  unit_amount numeric not null default 0,
  total_amount numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ─── payments ────────────────────────────────────────────────────────
create table if not exists public.payments (
  id text primary key,
  tenant_id text not null references public.venues(id) on delete cascade,
  invoice_id text references public.invoices(id) on delete set null,
  provider text not null
    check (provider in ('manual','bank_transfer','mock','vnpay','momo','stripe')),
  provider_transaction_id text,
  amount numeric not null default 0,
  currency text not null default 'VND',
  status text not null default 'pending'
    check (status in ('pending','succeeded','failed','cancelled','refunded')),
  paid_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_tenant
  on public.payments (tenant_id, created_at desc);

-- ─── billing_events ──────────────────────────────────────────────────
create table if not exists public.billing_events (
  id text primary key,
  tenant_id text references public.venues(id) on delete cascade,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  role text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ─── billing_audit_logs ──────────────────────────────────────────────
create table if not exists public.billing_audit_logs (
  id text primary key,
  tenant_id text references public.venues(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_audit_tenant
  on public.billing_audit_logs (tenant_id, created_at desc);

-- ─── Seed plans (idempotent) ─────────────────────────────────────────
insert into public.plans (id, code, name, description, price_monthly, price_yearly, sort_order)
values
  ('plan-TRIAL', 'TRIAL', 'Trial', 'Dùng thử 14 ngày', 0, 0, 1),
  ('plan-STARTER', 'STARTER', 'Starter', 'Gói khởi đầu', 990000, 9900000, 2),
  ('plan-PROFESSIONAL', 'PROFESSIONAL', 'Professional', 'Gói chuyên nghiệp', 1990000, 19900000, 3),
  ('plan-ENTERPRISE', 'ENTERPRISE', 'Enterprise', 'Gói doanh nghiệp', 3990000, 39900000, 4)
on conflict (code) do nothing;

insert into public.plan_limits (id, plan_id, max_venues, max_clubs, max_players, max_courts, max_tournaments_per_month, max_bookings_per_month, max_staff_users, max_referees, allow_mobile_app, allow_ai_features, allow_advanced_dashboard, allow_payment_gateway, allow_api_access, allow_custom_branding, allow_multi_venue, allow_offline_mode, allow_push_notification)
values
  ('limit-TRIAL', 'plan-TRIAL', 1, 1, 50, 4, 1, 50, 2, 1, false, false, false, false, false, false, false, false, false),
  ('limit-STARTER', 'plan-STARTER', 1, 2, 200, 8, 5, 200, 5, 2, true, false, false, true, false, false, false, false, true),
  ('limit-PROFESSIONAL', 'plan-PROFESSIONAL', 3, 5, 1000, 20, 20, 1000, 20, 10, true, true, true, true, true, false, true, true, true),
  ('limit-ENTERPRISE', 'plan-ENTERPRISE', 20, 20, 5000, 100, 100, 5000, 100, 50, true, true, true, true, true, true, true, true, true)
on conflict (plan_id) do nothing;

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.plans enable row level security;
alter table public.plan_limits enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.billing_events enable row level security;
alter table public.billing_audit_logs enable row level security;

-- Plans: active readable by authenticated; manage by super admin
drop policy if exists plans_select_active on public.plans;
create policy plans_select_active on public.plans
  for select to authenticated
  using (is_active = true or public.is_super_admin());

drop policy if exists plans_manage_admin on public.plans;
create policy plans_manage_admin on public.plans
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Plan limits: read with plan; manage admin
drop policy if exists plan_limits_select on public.plan_limits;
create policy plan_limits_select on public.plan_limits
  for select to authenticated
  using (true);

drop policy if exists plan_limits_manage_admin on public.plan_limits;
create policy plan_limits_manage_admin on public.plan_limits
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Tenant subscriptions: owner read own tenant; admin all; no owner update status
drop policy if exists tenant_subscriptions_select on public.tenant_subscriptions;
create policy tenant_subscriptions_select on public.tenant_subscriptions
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists tenant_subscriptions_manage_admin on public.tenant_subscriptions;
create policy tenant_subscriptions_manage_admin on public.tenant_subscriptions
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Invoices: tenant owner read; admin manage
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists invoices_manage_admin on public.invoices;
create policy invoices_manage_admin on public.invoices
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists invoices_update_admin on public.invoices;
create policy invoices_update_admin on public.invoices
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Invoice items
drop policy if exists invoice_items_select on public.invoice_items;
create policy invoice_items_select on public.invoice_items
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

-- Payments: tenant read; admin insert/update status; owner cannot update
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists payments_manage_admin on public.payments;
create policy payments_manage_admin on public.payments
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Billing events & audit
drop policy if exists billing_events_select on public.billing_events;
create policy billing_events_select on public.billing_events
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists billing_audit_select on public.billing_audit_logs;
create policy billing_audit_select on public.billing_audit_logs
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists billing_audit_insert on public.billing_audit_logs;
create policy billing_audit_insert on public.billing_audit_logs
  for insert to authenticated
  with check (public.is_super_admin() or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid()));

comment on table public.tenant_subscriptions is 'Phase 9 SaaS subscription per venue/tenant';
