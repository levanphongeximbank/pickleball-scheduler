-- Phase 11A — Sprint 10 RLS + webhook_endpoints (staging/dev only)
-- Prerequisite: docs/supabase-sprint10.sql applied
-- Rollback: docs/supabase-sprint10-phase11a-rollback.sql
-- Production: DO NOT APPLY until Phase 11B QA complete.

-- ─── webhook_endpoints (Phase 11A foundation) ─────────────────────
create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  url text not null,
  description text,
  event_types text[] not null default '{}',
  signing_mode text not null default 'generic_hmac_sha256',
  secret_ref text,
  status text not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $fk$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'webhook_endpoints_tenant_id_fkey'
  ) then
    alter table public.webhook_endpoints
      add constraint webhook_endpoints_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end $fk$;

create index if not exists idx_webhook_endpoints_tenant
  on public.webhook_endpoints (tenant_id);

comment on column public.webhook_endpoints.secret_ref is
  'Reference to server-side secret (env/vault key name). Never store raw signing secret.';

alter table public.webhook_endpoints enable row level security;

-- ─── Helper: tenant match for authenticated user ───────────────────
-- Uses profiles.venue_id = tenant_id (Sprint 2 / Phase 10E mapping).

-- ─── api_clients ───────────────────────────────────────────────────
drop policy if exists api_clients_select on public.api_clients;
create policy api_clients_select on public.api_clients
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists api_clients_manage on public.api_clients;
create policy api_clients_manage on public.api_clients
  for all to authenticated
  using (
    public.is_super_admin()
    or (
      tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
      and public.is_venue_staff()
    )
  )
  with check (
    public.is_super_admin()
    or (
      tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
      and public.is_venue_staff()
    )
  );

-- ─── api_keys (hashed_key never exposed cross-tenant via RLS) ──────
drop policy if exists api_keys_select on public.api_keys;
create policy api_keys_select on public.api_keys
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists api_keys_manage on public.api_keys;
create policy api_keys_manage on public.api_keys
  for all to authenticated
  using (
    public.is_super_admin()
    or (
      tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
      and public.is_venue_staff()
    )
  )
  with check (
    public.is_super_admin()
    or (
      tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
      and public.is_venue_staff()
    )
  );

-- ─── api_logs ──────────────────────────────────────────────────────
drop policy if exists api_logs_select on public.api_logs;
create policy api_logs_select on public.api_logs
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists api_logs_insert on public.api_logs;
create policy api_logs_insert on public.api_logs
  for insert to authenticated
  with check (public.is_super_admin());

-- ─── marketplace_products ──────────────────────────────────────────
drop policy if exists marketplace_products_select on public.marketplace_products;
create policy marketplace_products_select on public.marketplace_products
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists marketplace_products_manage on public.marketplace_products;
create policy marketplace_products_manage on public.marketplace_products
  for all to authenticated
  using (
    public.is_super_admin()
    or (
      tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
      and public.is_venue_staff()
    )
  )
  with check (
    public.is_super_admin()
    or (
      tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
      and public.is_venue_staff()
    )
  );

-- ─── marketplace_orders ────────────────────────────────────────────
drop policy if exists marketplace_orders_select on public.marketplace_orders;
create policy marketplace_orders_select on public.marketplace_orders
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists marketplace_orders_manage on public.marketplace_orders;
create policy marketplace_orders_manage on public.marketplace_orders
  for all to authenticated
  using (
    public.is_super_admin()
    or (
      tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
      and public.is_venue_staff()
    )
  )
  with check (
    public.is_super_admin()
    or (
      tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
      and public.is_venue_staff()
    )
  );

-- ─── payment_transactions ────────────────────────────────────────────
drop policy if exists payment_transactions_select on public.payment_transactions;
create policy payment_transactions_select on public.payment_transactions
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists payment_transactions_manage on public.payment_transactions;
create policy payment_transactions_manage on public.payment_transactions
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ─── notification_logs ─────────────────────────────────────────────
drop policy if exists notification_logs_select on public.notification_logs;
create policy notification_logs_select on public.notification_logs
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists notification_logs_insert on public.notification_logs;
create policy notification_logs_insert on public.notification_logs
  for insert to authenticated
  with check (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

-- ─── webhook_events ────────────────────────────────────────────────
drop policy if exists webhook_events_select on public.webhook_events;
create policy webhook_events_select on public.webhook_events
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists webhook_events_manage on public.webhook_events;
create policy webhook_events_manage on public.webhook_events
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ─── webhook_endpoints ─────────────────────────────────────────────
drop policy if exists webhook_endpoints_select on public.webhook_endpoints;
create policy webhook_endpoints_select on public.webhook_endpoints
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists webhook_endpoints_manage on public.webhook_endpoints;
create policy webhook_endpoints_manage on public.webhook_endpoints
  for all to authenticated
  using (
    public.is_super_admin()
    or (
      tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
      and public.is_venue_staff()
    )
  )
  with check (
    public.is_super_admin()
    or (
      tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
      and public.is_venue_staff()
    )
  );

comment on table public.webhook_endpoints is 'Phase 11A outbound webhook subscription per tenant (no raw secrets).';
