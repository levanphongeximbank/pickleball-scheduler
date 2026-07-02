-- Phase 11E — integration_audit_logs persistence
-- Idempotent migration for Supabase staging
-- Prerequisite: docs/supabase-sprint10.sql (+ phase11a-rls recommended)
-- Optional prior: docs/supabase-sprint10-phase11b-persistence.sql (legacy action/meta columns)
-- Rollback indexes only: docs/supabase-sprint10-phase11e-rollback.sql
-- Production: DO NOT APPLY until Phase 11E staging QA PASS.

-- ─── integration_audit_logs (create or evolve) ─────────────────────
create table if not exists public.integration_audit_logs (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  tenant_id text,
  api_client_id text,
  api_key_id text,
  key_prefix text,
  event_type text not null,
  route text,
  method text,
  status_code integer,
  result_code text,
  scope_required text,
  scopes_granted jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.integration_audit_logs
  add column if not exists request_id text;

alter table public.integration_audit_logs
  add column if not exists tenant_id text;

alter table public.integration_audit_logs
  add column if not exists api_client_id text;

alter table public.integration_audit_logs
  add column if not exists api_key_id text;

alter table public.integration_audit_logs
  add column if not exists key_prefix text;

alter table public.integration_audit_logs
  add column if not exists event_type text;

alter table public.integration_audit_logs
  add column if not exists route text;

alter table public.integration_audit_logs
  add column if not exists method text;

alter table public.integration_audit_logs
  add column if not exists status_code integer;

alter table public.integration_audit_logs
  add column if not exists result_code text;

alter table public.integration_audit_logs
  add column if not exists scope_required text;

alter table public.integration_audit_logs
  add column if not exists scopes_granted jsonb default '[]'::jsonb;

alter table public.integration_audit_logs
  add column if not exists metadata jsonb default '{}'::jsonb;

alter table public.integration_audit_logs
  add column if not exists created_at timestamptz default now();

-- Legacy Phase 11B columns: action, actor_id, meta (left in place if present).
-- Backfill new shape from legacy when upgrading from 11B.
do $backfill$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'integration_audit_logs'
      and column_name = 'action'
  ) then
    update public.integration_audit_logs
    set event_type = action
    where event_type is null and action is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'integration_audit_logs'
      and column_name = 'meta'
  ) then
    update public.integration_audit_logs
    set metadata = meta
    where (metadata is null or metadata = '{}'::jsonb)
      and meta is not null
      and meta <> '{}'::jsonb;
  end if;
end $backfill$;

-- Phase 11E inserts use event_type/metadata only — legacy action/meta must be nullable.
do $legacy_nullable$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'integration_audit_logs'
      and column_name = 'action'
  ) then
    update public.integration_audit_logs
    set action = coalesce(action, event_type, 'unknown')
    where action is null;

    alter table public.integration_audit_logs
      alter column action drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'integration_audit_logs'
      and column_name = 'meta'
  ) then
    update public.integration_audit_logs
    set meta = coalesce(meta, metadata, '{}'::jsonb)
    where meta is null;

    alter table public.integration_audit_logs
      alter column meta drop not null;
  end if;
end $legacy_nullable$;

update public.integration_audit_logs
set event_type = coalesce(event_type, 'unknown')
where event_type is null;

update public.integration_audit_logs
set metadata = coalesce(metadata, '{}'::jsonb)
where metadata is null;

update public.integration_audit_logs
set scopes_granted = coalesce(scopes_granted, '[]'::jsonb)
where scopes_granted is null;

alter table public.integration_audit_logs
  alter column tenant_id drop not null;

alter table public.integration_audit_logs
  alter column event_type set not null;

alter table public.integration_audit_logs
  alter column metadata set default '{}'::jsonb;

alter table public.integration_audit_logs
  alter column scopes_granted set default '[]'::jsonb;

alter table public.integration_audit_logs
  alter column created_at set default now();

alter table public.integration_audit_logs
  alter column created_at set not null;

-- ─── indexes ───────────────────────────────────────────────────────
create index if not exists integration_audit_logs_created_at_idx
  on public.integration_audit_logs (created_at desc);

create index if not exists integration_audit_logs_tenant_created_at_idx
  on public.integration_audit_logs (tenant_id, created_at desc);

create index if not exists integration_audit_logs_request_id_idx
  on public.integration_audit_logs (request_id);

create index if not exists integration_audit_logs_event_created_at_idx
  on public.integration_audit_logs (event_type, created_at desc);

create index if not exists integration_audit_logs_key_prefix_created_at_idx
  on public.integration_audit_logs (key_prefix, created_at desc);

-- ─── RLS (service role bypasses for serverless audit insert) ───────
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
      tenant_id is not null
      and tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
      and public.is_venue_staff()
    )
  );

drop policy if exists integration_audit_logs_manage_admin on public.integration_audit_logs;
create policy integration_audit_logs_manage_admin on public.integration_audit_logs
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

comment on table public.integration_audit_logs is
  'Integration/API audit trail (Phase 11E). No raw API keys or hashed_key in rows.';

comment on column public.integration_audit_logs.event_type is
  'e.g. api_key.used, api_key.denied, api_key.scope_denied, webhook.read, webhook.write';

comment on column public.integration_audit_logs.metadata is
  'Safe JSON only — no secrets, no raw/hashed API keys.';
