-- Phase 11B — tenant integration persistence (staging/dev only)
-- Prerequisite: docs/supabase-sprint10.sql + docs/supabase-sprint10-phase11a-rls.sql
-- Rollback: docs/supabase-sprint10-phase11b-rollback.sql
-- Production: DO NOT APPLY until Phase 11C QA complete.

-- ─── tenant_integration_settings ───────────────────────────────────
create table if not exists public.tenant_integration_settings (
  tenant_id text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

do $fk$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenant_integration_settings_tenant_id_fkey'
  ) then
    alter table public.tenant_integration_settings
      add constraint tenant_integration_settings_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end $fk$;

comment on table public.tenant_integration_settings is
  'Per-venue integration toggles/config (JSON). No provider secrets — env/server only.';

comment on column public.tenant_integration_settings.settings is
  'App shape from createDefaultTenantSettings(); secrets must not be stored here.';

alter table public.tenant_integration_settings enable row level security;

drop policy if exists tenant_integration_settings_select on public.tenant_integration_settings;
create policy tenant_integration_settings_select on public.tenant_integration_settings
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists tenant_integration_settings_manage on public.tenant_integration_settings;
create policy tenant_integration_settings_manage on public.tenant_integration_settings
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

-- ─── integration_audit_logs ────────────────────────────────────────
create table if not exists public.integration_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  action text not null,
  actor_id uuid references auth.users(id),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $fk$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'integration_audit_logs_tenant_id_fkey'
  ) then
    alter table public.integration_audit_logs
      add constraint integration_audit_logs_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;
end $fk$;

create index if not exists idx_integration_audit_logs_tenant_created
  on public.integration_audit_logs (tenant_id, created_at desc);

comment on table public.integration_audit_logs is
  'Integration/API audit trail per tenant (no raw API keys or provider secrets).';

alter table public.integration_audit_logs enable row level security;

drop policy if exists integration_audit_logs_select on public.integration_audit_logs;
create policy integration_audit_logs_select on public.integration_audit_logs
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists integration_audit_logs_insert on public.integration_audit_logs;
create policy integration_audit_logs_insert on public.integration_audit_logs
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
      and public.is_venue_staff()
    )
  );

drop policy if exists integration_audit_logs_manage_admin on public.integration_audit_logs;
create policy integration_audit_logs_manage_admin on public.integration_audit_logs
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
