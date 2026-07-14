-- ============================================================================
-- PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql
-- Private Pairing Rules Engine V2 — Database / RLS / RPC / Audit
-- Branch: feature/private-pairing-rules-v2
-- Status: STAGING/LOCAL ONLY — DO NOT apply Production
-- Feature flags remain OFF by default
-- ============================================================================
-- Design notes:
--   * tenant_id / scope_id / player ids use TEXT to match profiles.venue_id and
--     club/tournament player id conventions (not all are UUID).
--   * Activate uses trusted preflight (app runs PR-2 conflict detector) +
--     content hash verification in RPC (architecture A — preferred).
--   * Realtime: tables intentionally NOT added to supabase_realtime.
--   * Soft-delete only; audit append-only.
-- ============================================================================

-- ─── 0) Extensions ─────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ─── 1) Permissions (catalog) ──────────────────────────────────────
insert into public.permissions (id, module, action, description)
select v.id, v.module, v.action, v.description
from (values
  ('pairing.private_rules.view', 'pairing', 'private_rules.view', 'View private pairing rules (SUPER_ADMIN)'),
  ('pairing.private_rules.manage', 'pairing', 'private_rules.manage', 'Manage private pairing rules (SUPER_ADMIN)'),
  ('pairing.private_rules.audit', 'pairing', 'private_rules.audit', 'View private pairing audit logs (SUPER_ADMIN)'),
  ('pairing.private_rules.simulate', 'pairing', 'private_rules.simulate', 'Simulate private pairing (SUPER_ADMIN)')
) as v(id, module, action, description)
where not exists (select 1 from public.permissions p where p.id = v.id);

-- Grant ONLY to SUPER_ADMIN / PLATFORM_ADMIN role rows (if present).
-- Do NOT grant to SYSTEM_TECHNICIAN / club / venue / player roles.
insert into public.role_permissions (role_id, permission_id)
select r.role_id, p.permission_id
from (values ('SUPER_ADMIN'), ('PLATFORM_ADMIN')) as r(role_id)
cross join (values
  ('pairing.private_rules.view'),
  ('pairing.private_rules.manage'),
  ('pairing.private_rules.audit'),
  ('pairing.private_rules.simulate')
) as p(permission_id)
where exists (select 1 from public.roles ro where ro.id = r.role_id)
  and exists (select 1 from public.permissions pe where pe.id = p.permission_id)
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.role_id and rp.permission_id = p.permission_id
  );

-- Explicitly ensure TECHNICIAN is not granted (idempotent delete if mis-seeded elsewhere)
delete from public.role_permissions
where permission_id like 'pairing.private_rules.%'
  and role_id in (
    'SYSTEM_TECHNICIAN', 'TECHNICIAN', 'TOURNAMENT_DIRECTOR', 'TOURNAMENT_MANAGER',
    'COURT_OWNER', 'VENUE_OWNER', 'VENUE_MANAGER', 'COURT_MANAGER',
    'CLUB_OWNER', 'CLUB_MANAGER', 'COACH', 'REFEREE', 'PLAYER', 'STAFF',
    'CASHIER', 'ACCOUNTANT', 'CUSTOMER', 'SUPPORT', 'TENANT_OWNER', 'TEAM_CAPTAIN'
  );

-- ─── 2) Tables ─────────────────────────────────────────────────────

create table if not exists public.private_pairing_rule_sets (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  logical_id uuid not null default gen_random_uuid(),
  name text not null,
  description text,
  scope_type text not null,
  scope_id text,
  version integer not null,
  status text not null default 'draft',
  content_hash text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint private_pairing_rule_sets_status_chk
    check (status in ('draft', 'active', 'archived')),
  constraint private_pairing_rule_sets_version_chk
    check (version > 0),
  constraint private_pairing_rule_sets_scope_type_chk
    check (scope_type in (
      'GLOBAL','TENANT','CLUB','VENUE','TOURNAMENT','TOURNAMENT_EVENT',
      'DAILY_PLAY_SESSION','ROUND','MATCH_DAY'
    )),
  constraint private_pairing_rule_sets_scope_id_chk
    check (
      scope_type = 'GLOBAL'
      or (scope_id is not null and length(trim(scope_id)) > 0)
    ),
  constraint private_pairing_rule_sets_version_unique
    unique (tenant_id, logical_id, version)
);

create unique index if not exists private_pairing_rule_sets_one_active_uidx
  on public.private_pairing_rule_sets (tenant_id, logical_id)
  where status = 'active';

create index if not exists private_pairing_rule_sets_tenant_scope_idx
  on public.private_pairing_rule_sets (tenant_id, scope_type, scope_id);

create index if not exists private_pairing_rule_sets_status_idx
  on public.private_pairing_rule_sets (tenant_id, status);

create table if not exists public.private_pairing_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  rule_set_id uuid not null references public.private_pairing_rule_sets (id) on delete cascade,
  primary_player_id text,
  constraint_type text not null,
  severity text not null,
  weight integer,
  priority text,
  relation_mode text,
  reason_category text,
  reason_text text,
  visibility text not null default 'private',
  start_at timestamptz,
  end_at timestamptz,
  active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  constraint private_pairing_rules_severity_chk
    check (severity in ('hard', 'soft')),
  constraint private_pairing_rules_relation_mode_chk
    check (relation_mode is null or relation_mode in ('ANY_OF', 'ALL_OF')),
  constraint private_pairing_rules_visibility_chk
    check (visibility in ('private', 'disclosed', 'public')),
  constraint private_pairing_rules_priority_chk
    check (priority is null or priority in ('low', 'medium', 'high', 'critical')),
  constraint private_pairing_rules_weight_chk
    check (
      (severity = 'soft' and weight is not null and weight between 1 and 100)
      or (severity = 'hard' and weight is null)
    ),
  constraint private_pairing_rules_time_chk
    check (start_at is null or end_at is null or start_at < end_at),
  constraint private_pairing_rules_constraint_type_chk
    check (constraint_type in (
      'prefer_partner','must_partner','avoid_partner','must_not_partner',
      'prefer_opponent','must_opponent','avoid_opponent','must_not_opponent',
      'max_partner_repeat','max_opponent_repeat','min_partner_repeat','min_opponent_repeat',
      'same_group','different_group','same_team','different_team'
    )),
  constraint private_pairing_rules_other_reason_chk
    check (
      reason_category is distinct from 'OTHER'
      or (reason_text is not null and length(trim(reason_text)) > 0)
    )
);

create index if not exists private_pairing_rules_rule_set_idx
  on public.private_pairing_rules (rule_set_id)
  where deleted_at is null;

create index if not exists private_pairing_rules_tenant_idx
  on public.private_pairing_rules (tenant_id, active);

create table if not exists public.private_pairing_rule_targets (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  rule_id uuid not null references public.private_pairing_rules (id) on delete cascade,
  target_player_id text not null,
  created_at timestamptz not null default now(),
  constraint private_pairing_rule_targets_unique unique (rule_id, target_player_id)
);

create index if not exists private_pairing_rule_targets_rule_idx
  on public.private_pairing_rule_targets (rule_id);

create table if not exists public.private_pairing_rule_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  actor_id uuid not null,
  actor_role text,
  action text not null,
  rule_set_id uuid,
  rule_id uuid,
  scope_type text,
  scope_id text,
  reason text,
  before_data jsonb,
  after_data jsonb,
  request_id uuid,
  session_reference text,
  created_at timestamptz not null default now(),
  constraint private_pairing_rule_audit_action_chk
    check (action in (
      'CREATE_RULE_SET','ACTIVATE_RULE_SET','ARCHIVE_RULE_SET','ROLLBACK_RULE_SET',
      'CREATE_PRIVATE_PAIRING_RULE','UPDATE_PRIVATE_PAIRING_RULE',
      'DISABLE_PRIVATE_PAIRING_RULE','DELETE_PRIVATE_PAIRING_RULE',
      'ADD_RULE_TARGET','REMOVE_RULE_TARGET',
      'SIMULATE_PRIVATE_PAIRING','APPLY_PRIVATE_PAIRING_RULESET'
    ))
);

create index if not exists private_pairing_rule_audit_tenant_created_idx
  on public.private_pairing_rule_audit_logs (tenant_id, created_at desc);

create index if not exists private_pairing_rule_audit_rule_set_idx
  on public.private_pairing_rule_audit_logs (rule_set_id, created_at desc);

create index if not exists private_pairing_rule_audit_rule_idx
  on public.private_pairing_rule_audit_logs (rule_id, created_at desc);

-- ─── 3) Helpers ────────────────────────────────────────────────────

create or replace function public.private_pairing_current_tenant_id()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select nullif(trim(coalesce(public.user_venue_id(), '')), '');
$$;

create or replace function public.private_pairing_can(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and public.is_super_admin()
    and public.user_has_permission(p_permission);
$$;

-- Tenant access: SUPER_ADMIN platform may cross-tenant via is_super_admin()
-- (existing platform helper). Tenant-scoped SA with venue_id still matches rows.
create or replace function public.private_pairing_tenant_visible(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_super_admin()
    and (
      public.private_pairing_current_tenant_id() is null
      or public.private_pairing_current_tenant_id() = p_tenant_id
      or public.private_pairing_current_tenant_id() = ''
    );
$$;

create or replace function public.private_pairing_err(p_code text, p_message text default null)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'ok', false,
    'code', p_code,
    'message', coalesce(p_message, p_code)
  );
$$;

create or replace function public.private_pairing_ok(p_data jsonb default '{}'::jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object('ok', true) || coalesce(p_data, '{}'::jsonb);
$$;

create or replace function public.private_pairing_compute_rule_set_hash(p_rule_set_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_payload text;
begin
  select coalesce(string_agg(chunk, '|' order by chunk), '')
    into v_payload
  from (
    select
      r.id::text || ':' || r.constraint_type || ':' || r.severity || ':' ||
      coalesce(r.primary_player_id, '') || ':' || coalesce(r.relation_mode, '') || ':' ||
      coalesce(r.weight::text, '') || ':' || coalesce(r.visibility, '') || ':' ||
      coalesce((
        select string_agg(t.target_player_id, ',' order by t.target_player_id)
        from public.private_pairing_rule_targets t
        where t.rule_id = r.id
      ), '') as chunk
    from public.private_pairing_rules r
    where r.rule_set_id = p_rule_set_id
      and r.deleted_at is null
      and r.active = true
  ) s;

  return encode(digest(v_payload, 'sha256'), 'hex');
end;
$$;

create or replace function public.private_pairing_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists private_pairing_rule_sets_touch_trg on public.private_pairing_rule_sets;
create trigger private_pairing_rule_sets_touch_trg
  before update on public.private_pairing_rule_sets
  for each row execute function public.private_pairing_touch_updated_at();

drop trigger if exists private_pairing_rules_touch_trg on public.private_pairing_rules;
create trigger private_pairing_rules_touch_trg
  before update on public.private_pairing_rules
  for each row execute function public.private_pairing_touch_updated_at();

-- Block hard DELETE on rules (force soft delete path)
create or replace function public.private_pairing_block_hard_delete_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'HARD_DELETE_FORBIDDEN'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists private_pairing_rules_no_hard_delete_trg on public.private_pairing_rules;
create trigger private_pairing_rules_no_hard_delete_trg
  before delete on public.private_pairing_rules
  for each row execute function public.private_pairing_block_hard_delete_rules();

-- Audit append-only
create or replace function public.private_pairing_block_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'AUDIT_APPEND_ONLY'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists private_pairing_audit_no_update_trg on public.private_pairing_rule_audit_logs;
create trigger private_pairing_audit_no_update_trg
  before update on public.private_pairing_rule_audit_logs
  for each row execute function public.private_pairing_block_audit_mutation();

drop trigger if exists private_pairing_audit_no_delete_trg on public.private_pairing_rule_audit_logs;
create trigger private_pairing_audit_no_delete_trg
  before delete on public.private_pairing_rule_audit_logs
  for each row execute function public.private_pairing_block_audit_mutation();

create or replace function public.private_pairing_write_audit(
  p_tenant_id text,
  p_action text,
  p_rule_set_id uuid,
  p_rule_id uuid,
  p_scope_type text,
  p_scope_id text,
  p_reason text,
  p_before jsonb,
  p_after jsonb,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_role text;
begin
  v_role := public.user_role();
  insert into public.private_pairing_rule_audit_logs (
    tenant_id, actor_id, actor_role, action, rule_set_id, rule_id,
    scope_type, scope_id, reason, before_data, after_data, request_id
  ) values (
    p_tenant_id, auth.uid(), v_role, p_action, p_rule_set_id, p_rule_id,
    p_scope_type, p_scope_id, p_reason, p_before, p_after, coalesce(p_request_id, gen_random_uuid())
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Prevent self-target via trigger on targets insert
create or replace function public.private_pairing_validate_target_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_primary text;
begin
  select r.primary_player_id into v_primary
  from public.private_pairing_rules r
  where r.id = new.rule_id;

  if v_primary is not null and v_primary = new.target_player_id then
    raise exception 'SELF_TARGET_NOT_ALLOWED'
      using errcode = 'P0001';
  end if;

  if new.tenant_id is distinct from (
    select r.tenant_id from public.private_pairing_rules r where r.id = new.rule_id
  ) then
    raise exception 'CROSS_TENANT_ACCESS'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists private_pairing_targets_validate_trg on public.private_pairing_rule_targets;
create trigger private_pairing_targets_validate_trg
  before insert or update on public.private_pairing_rule_targets
  for each row execute function public.private_pairing_validate_target_insert();

-- ─── 4) RLS ────────────────────────────────────────────────────────
alter table public.private_pairing_rule_sets enable row level security;
alter table public.private_pairing_rules enable row level security;
alter table public.private_pairing_rule_targets enable row level security;
alter table public.private_pairing_rule_audit_logs enable row level security;

-- Deny-by-default: no open policies for anon
revoke all on public.private_pairing_rule_sets from anon, authenticated;
revoke all on public.private_pairing_rules from anon, authenticated;
revoke all on public.private_pairing_rule_targets from anon, authenticated;
revoke all on public.private_pairing_rule_audit_logs from anon, authenticated;

grant select on public.private_pairing_rule_sets to authenticated;
grant select on public.private_pairing_rules to authenticated;
grant select on public.private_pairing_rule_targets to authenticated;
grant select on public.private_pairing_rule_audit_logs to authenticated;
-- Writes go through SECURITY DEFINER RPCs only (no direct insert/update/delete grants)

drop policy if exists private_pairing_rule_sets_select on public.private_pairing_rule_sets;
create policy private_pairing_rule_sets_select
  on public.private_pairing_rule_sets
  for select to authenticated
  using (
    public.private_pairing_can('pairing.private_rules.view')
    and public.private_pairing_tenant_visible(tenant_id)
  );

drop policy if exists private_pairing_rules_select on public.private_pairing_rules;
create policy private_pairing_rules_select
  on public.private_pairing_rules
  for select to authenticated
  using (
    public.private_pairing_can('pairing.private_rules.view')
    and public.private_pairing_tenant_visible(tenant_id)
  );

drop policy if exists private_pairing_targets_select on public.private_pairing_rule_targets;
create policy private_pairing_targets_select
  on public.private_pairing_rule_targets
  for select to authenticated
  using (
    public.private_pairing_can('pairing.private_rules.view')
    and public.private_pairing_tenant_visible(tenant_id)
  );

drop policy if exists private_pairing_audit_select on public.private_pairing_rule_audit_logs;
create policy private_pairing_audit_select
  on public.private_pairing_rule_audit_logs
  for select to authenticated
  using (
    public.private_pairing_can('pairing.private_rules.audit')
    and public.private_pairing_tenant_visible(tenant_id)
  );

-- No insert/update/delete policies for authenticated → blocked even if grants added later

-- ─── 5) RPCs (SECURITY DEFINER, search_path fixed) ─────────────────

create or replace function public.private_pairing_list_rule_sets(
  p_scope_type text default null,
  p_scope_id text default null,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows jsonb;
begin
  if auth.uid() is null then
    return public.private_pairing_err('PERMISSION_DENIED');
  end if;
  if not public.private_pairing_can('pairing.private_rules.view') then
    return public.private_pairing_err('PERMISSION_DENIED');
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.updated_at desc), '[]'::jsonb)
    into v_rows
  from public.private_pairing_rule_sets s
  where public.private_pairing_tenant_visible(s.tenant_id)
    and (p_scope_type is null or s.scope_type = p_scope_type)
    and (p_scope_id is null or s.scope_id is not distinct from p_scope_id)
    and (p_status is null or s.status = p_status);

  return public.private_pairing_ok(jsonb_build_object('rule_sets', v_rows));
end;
$$;

create or replace function public.private_pairing_get_rule_set(p_rule_set_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_set public.private_pairing_rule_sets%rowtype;
  v_rules jsonb;
begin
  if auth.uid() is null or not public.private_pairing_can('pairing.private_rules.view') then
    return public.private_pairing_err('PERMISSION_DENIED');
  end if;

  select * into v_set from public.private_pairing_rule_sets where id = p_rule_set_id;
  if not found then
    return public.private_pairing_err('NOT_FOUND');
  end if;
  if not public.private_pairing_tenant_visible(v_set.tenant_id) then
    return public.private_pairing_err('CROSS_TENANT_ACCESS');
  end if;

  select coalesce(jsonb_agg(
    to_jsonb(r) || jsonb_build_object(
      'target_player_ids', coalesce((
        select jsonb_agg(t.target_player_id order by t.target_player_id)
        from public.private_pairing_rule_targets t where t.rule_id = r.id
      ), '[]'::jsonb)
    )
    order by r.created_at
  ), '[]'::jsonb)
  into v_rules
  from public.private_pairing_rules r
  where r.rule_set_id = v_set.id and r.deleted_at is null;

  return public.private_pairing_ok(jsonb_build_object(
    'rule_set', to_jsonb(v_set),
    'rules', v_rules
  ));
end;
$$;

create or replace function public.private_pairing_create_rule_set(
  p_name text,
  p_description text default null,
  p_scope_type text default 'CLUB',
  p_scope_id text default null,
  p_tenant_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_reason text default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant text;
  v_row public.private_pairing_rule_sets%rowtype;
begin
  if auth.uid() is null or not public.private_pairing_can('pairing.private_rules.manage') then
    return public.private_pairing_err('PERMISSION_DENIED');
  end if;

  -- Never trust client tenant without visibility check; prefer profile venue.
  v_tenant := coalesce(nullif(trim(public.private_pairing_current_tenant_id()), ''), nullif(trim(p_tenant_id), ''));
  if v_tenant is null then
    return public.private_pairing_err('SCOPE_ID_REQUIRED', 'tenant_id required');
  end if;
  if not public.private_pairing_tenant_visible(v_tenant) then
    return public.private_pairing_err('CROSS_TENANT_ACCESS');
  end if;
  if p_scope_type is distinct from 'GLOBAL' and (p_scope_id is null or length(trim(p_scope_id)) = 0) then
    return public.private_pairing_err('SCOPE_ID_REQUIRED');
  end if;

  insert into public.private_pairing_rule_sets (
    tenant_id, name, description, scope_type, scope_id, version, status, created_by, metadata
  ) values (
    v_tenant, trim(p_name), p_description, p_scope_type, p_scope_id, 1, 'draft', auth.uid(), coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_row;

  perform public.private_pairing_write_audit(
    v_tenant, 'CREATE_RULE_SET', v_row.id, null, v_row.scope_type, v_row.scope_id,
    p_reason, null, to_jsonb(v_row), p_request_id
  );

  return public.private_pairing_ok(jsonb_build_object('rule_set', to_jsonb(v_row)));
exception when others then
  return public.private_pairing_err(coalesce(nullif(sqlerrm, ''), 'RULE_VALIDATION_FAILED'));
end;
$$;

create or replace function public.private_pairing_create_rule(
  p_rule_set_id uuid,
  p_primary_player_id text,
  p_constraint_type text,
  p_severity text,
  p_weight integer default null,
  p_priority text default 'medium',
  p_relation_mode text default 'ANY_OF',
  p_target_player_ids text[] default '{}',
  p_reason_category text default 'OTHER',
  p_reason_text text default null,
  p_visibility text default 'private',
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb,
  p_reason text default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_set public.private_pairing_rule_sets%rowtype;
  v_rule public.private_pairing_rules%rowtype;
  v_targets text[];
  v_tid text;
begin
  if auth.uid() is null or not public.private_pairing_can('pairing.private_rules.manage') then
    return public.private_pairing_err('PERMISSION_DENIED');
  end if;

  select * into v_set from public.private_pairing_rule_sets where id = p_rule_set_id;
  if not found then
    return public.private_pairing_err('NOT_FOUND');
  end if;
  if not public.private_pairing_tenant_visible(v_set.tenant_id) then
    return public.private_pairing_err('CROSS_TENANT_ACCESS');
  end if;
  if v_set.status is distinct from 'draft' then
    return public.private_pairing_err('RULE_SET_NOT_EDITABLE');
  end if;

  if p_primary_player_id is null or length(trim(p_primary_player_id)) = 0 then
    return public.private_pairing_err('MISSING_PRIMARY_PLAYER');
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_targets
  from unnest(coalesce(p_target_player_ids, '{}')) as x
  where length(trim(x)) > 0;

  if coalesce(array_length(v_targets, 1), 0) = 0 then
    return public.private_pairing_err('EMPTY_TARGET_LIST');
  end if;
  if p_primary_player_id = any (v_targets) then
    return public.private_pairing_err('SELF_TARGET_NOT_ALLOWED');
  end if;
  if coalesce(array_length(p_target_player_ids, 1), 0) <> coalesce(array_length(v_targets, 1), 0) then
    return public.private_pairing_err('DUPLICATE_TARGET');
  end if;
  if p_severity = 'soft' and (p_weight is null or p_weight < 1 or p_weight > 100) then
    return public.private_pairing_err('SOFT_WEIGHT_REQUIRED');
  end if;
  if p_severity = 'hard' and p_weight is not null then
    return public.private_pairing_err('HARD_WEIGHT_NOT_ALLOWED');
  end if;
  if p_start_at is not null and p_end_at is not null and p_start_at >= p_end_at then
    return public.private_pairing_err('INVALID_TIME_RANGE');
  end if;

  insert into public.private_pairing_rules (
    tenant_id, rule_set_id, primary_player_id, constraint_type, severity, weight, priority,
    relation_mode, reason_category, reason_text, visibility, start_at, end_at, created_by, metadata
  ) values (
    v_set.tenant_id, v_set.id, trim(p_primary_player_id), p_constraint_type, p_severity,
    case when p_severity = 'soft' then p_weight else null end,
    p_priority, p_relation_mode, p_reason_category, p_reason_text, p_visibility,
    p_start_at, p_end_at, auth.uid(), coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_rule;

  foreach v_tid in array v_targets loop
    insert into public.private_pairing_rule_targets (tenant_id, rule_id, target_player_id)
    values (v_set.tenant_id, v_rule.id, v_tid);
  end loop;

  perform public.private_pairing_write_audit(
    v_set.tenant_id, 'CREATE_PRIVATE_PAIRING_RULE', v_set.id, v_rule.id,
    v_set.scope_type, v_set.scope_id, p_reason, null,
    to_jsonb(v_rule) || jsonb_build_object('target_player_ids', to_jsonb(v_targets)),
    p_request_id
  );

  return public.private_pairing_ok(jsonb_build_object(
    'rule', to_jsonb(v_rule),
    'target_player_ids', to_jsonb(v_targets)
  ));
exception when others then
  return public.private_pairing_err(coalesce(nullif(sqlerrm, ''), 'RULE_VALIDATION_FAILED'));
end;
$$;

create or replace function public.private_pairing_update_rule(
  p_rule_id uuid,
  p_reason text,
  p_primary_player_id text default null,
  p_constraint_type text default null,
  p_severity text default null,
  p_weight integer default null,
  p_priority text default null,
  p_relation_mode text default null,
  p_target_player_ids text[] default null,
  p_reason_category text default null,
  p_reason_text text default null,
  p_visibility text default null,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_clear_time_range boolean default false,
  p_metadata jsonb default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.private_pairing_rules%rowtype;
  v_after public.private_pairing_rules%rowtype;
  v_set public.private_pairing_rule_sets%rowtype;
  v_targets text[];
  v_tid text;
  v_severity text;
  v_weight integer;
  v_start timestamptz;
  v_end timestamptz;
begin
  if auth.uid() is null or not public.private_pairing_can('pairing.private_rules.manage') then
    return public.private_pairing_err('PERMISSION_DENIED');
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    return public.private_pairing_err('REASON_TEXT_REQUIRED');
  end if;

  select * into v_before from public.private_pairing_rules where id = p_rule_id;
  if not found then
    return public.private_pairing_err('NOT_FOUND');
  end if;
  if not public.private_pairing_tenant_visible(v_before.tenant_id) then
    return public.private_pairing_err('CROSS_TENANT_ACCESS');
  end if;

  select * into v_set from public.private_pairing_rule_sets where id = v_before.rule_set_id;
  if v_set.status is distinct from 'draft' then
    return public.private_pairing_err('RULE_SET_NOT_EDITABLE');
  end if;

  v_severity := coalesce(p_severity, v_before.severity);
  v_weight := case
    when p_severity = 'hard' then null
    when p_weight is not null then p_weight
    when p_severity = 'soft' then v_before.weight
    else v_before.weight
  end;
  if v_severity = 'soft' and (v_weight is null or v_weight < 1 or v_weight > 100) then
    return public.private_pairing_err('SOFT_WEIGHT_REQUIRED');
  end if;
  if v_severity = 'hard' and v_weight is not null then
    return public.private_pairing_err('HARD_WEIGHT_NOT_ALLOWED');
  end if;

  if p_clear_time_range then
    v_start := null;
    v_end := null;
  else
    v_start := coalesce(p_start_at, v_before.start_at);
    v_end := coalesce(p_end_at, v_before.end_at);
  end if;
  if v_start is not null and v_end is not null and v_start >= v_end then
    return public.private_pairing_err('INVALID_TIME_RANGE');
  end if;

  update public.private_pairing_rules
  set primary_player_id = coalesce(nullif(trim(p_primary_player_id), ''), primary_player_id),
      constraint_type = coalesce(p_constraint_type, constraint_type),
      severity = v_severity,
      weight = case when v_severity = 'hard' then null else v_weight end,
      priority = coalesce(p_priority, priority),
      relation_mode = coalesce(p_relation_mode, relation_mode),
      reason_category = coalesce(p_reason_category, reason_category),
      reason_text = coalesce(p_reason_text, reason_text),
      visibility = coalesce(p_visibility, visibility),
      start_at = v_start,
      end_at = v_end,
      metadata = coalesce(p_metadata, metadata),
      updated_by = auth.uid()
  where id = p_rule_id
  returning * into v_after;

  if p_target_player_ids is not null then
    select coalesce(array_agg(distinct x), '{}') into v_targets
    from unnest(p_target_player_ids) as x
    where length(trim(x)) > 0;

    if coalesce(array_length(v_targets, 1), 0) = 0 then
      return public.private_pairing_err('EMPTY_TARGET_LIST');
    end if;
    if v_after.primary_player_id = any (v_targets) then
      return public.private_pairing_err('SELF_TARGET_NOT_ALLOWED');
    end if;

    delete from public.private_pairing_rule_targets where rule_id = p_rule_id;
    foreach v_tid in array v_targets loop
      insert into public.private_pairing_rule_targets (tenant_id, rule_id, target_player_id)
      values (v_after.tenant_id, p_rule_id, v_tid);
    end loop;
  else
    select coalesce(array_agg(t.target_player_id order by t.target_player_id), '{}')
      into v_targets
    from public.private_pairing_rule_targets t
    where t.rule_id = p_rule_id;
  end if;

  perform public.private_pairing_write_audit(
    v_before.tenant_id, 'UPDATE_PRIVATE_PAIRING_RULE', v_before.rule_set_id, p_rule_id,
    v_set.scope_type, v_set.scope_id, p_reason,
    to_jsonb(v_before),
    to_jsonb(v_after) || jsonb_build_object('target_player_ids', to_jsonb(v_targets)),
    p_request_id
  );

  return public.private_pairing_ok(jsonb_build_object(
    'rule', to_jsonb(v_after),
    'target_player_ids', to_jsonb(v_targets)
  ));
exception when others then
  return public.private_pairing_err(coalesce(nullif(sqlerrm, ''), 'RULE_VALIDATION_FAILED'));
end;
$$;

create or replace function public.private_pairing_disable_rule(
  p_rule_id uuid,
  p_reason text,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.private_pairing_rules%rowtype;
  v_after public.private_pairing_rules%rowtype;
  v_set public.private_pairing_rule_sets%rowtype;
begin
  if auth.uid() is null or not public.private_pairing_can('pairing.private_rules.manage') then
    return public.private_pairing_err('PERMISSION_DENIED');
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    return public.private_pairing_err('REASON_TEXT_REQUIRED');
  end if;

  select * into v_before from public.private_pairing_rules where id = p_rule_id;
  if not found then
    return public.private_pairing_err('NOT_FOUND');
  end if;
  if not public.private_pairing_tenant_visible(v_before.tenant_id) then
    return public.private_pairing_err('CROSS_TENANT_ACCESS');
  end if;

  select * into v_set from public.private_pairing_rule_sets where id = v_before.rule_set_id;
  if v_set.status is distinct from 'draft' then
    return public.private_pairing_err('RULE_SET_NOT_EDITABLE');
  end if;

  update public.private_pairing_rules
  set active = false,
      deleted_at = now(),
      deleted_by = auth.uid(),
      updated_by = auth.uid()
  where id = p_rule_id
  returning * into v_after;

  perform public.private_pairing_write_audit(
    v_before.tenant_id, 'DISABLE_PRIVATE_PAIRING_RULE', v_before.rule_set_id, p_rule_id,
    v_set.scope_type, v_set.scope_id, p_reason, to_jsonb(v_before), to_jsonb(v_after), p_request_id
  );

  return public.private_pairing_ok(jsonb_build_object('rule', to_jsonb(v_after)));
end;
$$;

create or replace function public.private_pairing_clone_rule_set_version(
  p_source_rule_set_id uuid,
  p_reason text default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_src public.private_pairing_rule_sets%rowtype;
  v_new public.private_pairing_rule_sets%rowtype;
  v_next int;
  r record;
  v_new_rule_id uuid;
begin
  if auth.uid() is null or not public.private_pairing_can('pairing.private_rules.manage') then
    return public.private_pairing_err('PERMISSION_DENIED');
  end if;

  select * into v_src from public.private_pairing_rule_sets where id = p_source_rule_set_id;
  if not found then
    return public.private_pairing_err('NOT_FOUND');
  end if;
  if not public.private_pairing_tenant_visible(v_src.tenant_id) then
    return public.private_pairing_err('CROSS_TENANT_ACCESS');
  end if;

  select coalesce(max(version), 0) + 1 into v_next
  from public.private_pairing_rule_sets
  where tenant_id = v_src.tenant_id and logical_id = v_src.logical_id;

  insert into public.private_pairing_rule_sets (
    tenant_id, logical_id, name, description, scope_type, scope_id, version, status,
    created_by, metadata
  ) values (
    v_src.tenant_id, v_src.logical_id, v_src.name, v_src.description, v_src.scope_type, v_src.scope_id,
    v_next, 'draft', auth.uid(), coalesce(v_src.metadata, '{}'::jsonb)
  )
  returning * into v_new;

  for r in
    select * from public.private_pairing_rules
    where rule_set_id = v_src.id and deleted_at is null
  loop
    insert into public.private_pairing_rules (
      tenant_id, rule_set_id, primary_player_id, constraint_type, severity, weight, priority,
      relation_mode, reason_category, reason_text, visibility, start_at, end_at, active,
      created_by, metadata
    ) values (
      r.tenant_id, v_new.id, r.primary_player_id, r.constraint_type, r.severity, r.weight, r.priority,
      r.relation_mode, r.reason_category, r.reason_text, r.visibility, r.start_at, r.end_at, r.active,
      auth.uid(), r.metadata
    )
    returning id into v_new_rule_id;

    insert into public.private_pairing_rule_targets (tenant_id, rule_id, target_player_id)
    select r.tenant_id, v_new_rule_id, t.target_player_id
    from public.private_pairing_rule_targets t
    where t.rule_id = r.id;
  end loop;

  perform public.private_pairing_write_audit(
    v_src.tenant_id, 'CREATE_RULE_SET', v_new.id, null, v_new.scope_type, v_new.scope_id,
    coalesce(p_reason, 'clone'), to_jsonb(v_src), to_jsonb(v_new), p_request_id
  );

  return public.private_pairing_ok(jsonb_build_object('rule_set', to_jsonb(v_new)));
end;
$$;

create or replace function public.private_pairing_activate_rule_set(
  p_rule_set_id uuid,
  p_reason text,
  p_preflight_ok boolean,
  p_content_hash text,
  p_validation_report jsonb default '{}'::jsonb,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_set public.private_pairing_rule_sets%rowtype;
  v_hash text;
  v_before jsonb;
begin
  if auth.uid() is null or not public.private_pairing_can('pairing.private_rules.manage') then
    return public.private_pairing_err('PERMISSION_DENIED');
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    return public.private_pairing_err('REASON_TEXT_REQUIRED');
  end if;
  if p_preflight_ok is distinct from true then
    return public.private_pairing_err('RULE_SET_CONFLICT', 'preflight_ok required from PR-2 conflict detector');
  end if;

  select * into v_set from public.private_pairing_rule_sets where id = p_rule_set_id for update;
  if not found then
    return public.private_pairing_err('NOT_FOUND');
  end if;
  if not public.private_pairing_tenant_visible(v_set.tenant_id) then
    return public.private_pairing_err('CROSS_TENANT_ACCESS');
  end if;
  if v_set.status is distinct from 'draft' then
    return public.private_pairing_err('RULE_SET_NOT_EDITABLE');
  end if;

  v_hash := public.private_pairing_compute_rule_set_hash(v_set.id);
  if p_content_hash is null or p_content_hash is distinct from v_hash then
    return public.private_pairing_err('RULE_SET_CONFLICT', 'content_hash mismatch');
  end if;
  if coalesce((p_validation_report->>'fatalCount')::int, 0) > 0 then
    return public.private_pairing_err('RULE_SET_CONFLICT');
  end if;

  v_before := to_jsonb(v_set);

  update public.private_pairing_rule_sets
  set status = 'archived',
      archived_at = now(),
      updated_by = auth.uid()
  where tenant_id = v_set.tenant_id
    and logical_id = v_set.logical_id
    and status = 'active';

  update public.private_pairing_rule_sets
  set status = 'active',
      activated_at = now(),
      content_hash = v_hash,
      updated_by = auth.uid()
  where id = v_set.id
  returning * into v_set;

  perform public.private_pairing_write_audit(
    v_set.tenant_id, 'ACTIVATE_RULE_SET', v_set.id, null, v_set.scope_type, v_set.scope_id,
    p_reason, v_before, to_jsonb(v_set) || jsonb_build_object('validation_report', p_validation_report),
    p_request_id
  );

  return public.private_pairing_ok(jsonb_build_object('rule_set', to_jsonb(v_set)));
end;
$$;

create or replace function public.private_pairing_rollback_rule_set(
  p_source_rule_set_id uuid,
  p_reason text,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clone jsonb;
  v_new_id uuid;
  v_activate jsonb;
  v_hash text;
begin
  if auth.uid() is null or not public.private_pairing_can('pairing.private_rules.manage') then
    return public.private_pairing_err('PERMISSION_DENIED');
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    return public.private_pairing_err('REASON_TEXT_REQUIRED');
  end if;

  v_clone := public.private_pairing_clone_rule_set_version(p_source_rule_set_id, p_reason, p_request_id);
  if coalesce((v_clone->>'ok')::boolean, false) is not true then
    return v_clone;
  end if;

  v_new_id := (v_clone->'rule_set'->>'id')::uuid;
  v_hash := public.private_pairing_compute_rule_set_hash(v_new_id);
  v_activate := public.private_pairing_activate_rule_set(
    v_new_id, p_reason, true, v_hash,
    jsonb_build_object('fatalCount', 0, 'source', 'rollback'),
    p_request_id
  );

  perform public.private_pairing_write_audit(
    (v_clone->'rule_set'->>'tenant_id'),
    'ROLLBACK_RULE_SET',
    v_new_id,
    null,
    v_clone->'rule_set'->>'scope_type',
    v_clone->'rule_set'->>'scope_id',
    p_reason,
    jsonb_build_object('source_rule_set_id', p_source_rule_set_id),
    v_activate,
    p_request_id
  );

  return v_activate;
end;
$$;

create or replace function public.private_pairing_list_audit_logs(
  p_rule_set_id uuid default null,
  p_rule_id uuid default null,
  p_action text default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows jsonb;
begin
  if auth.uid() is null or not public.private_pairing_can('pairing.private_rules.audit') then
    return public.private_pairing_err('PERMISSION_DENIED');
  end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb)
    into v_rows
  from public.private_pairing_rule_audit_logs a
  where public.private_pairing_tenant_visible(a.tenant_id)
    and (p_rule_set_id is null or a.rule_set_id = p_rule_set_id)
    and (p_rule_id is null or a.rule_id = p_rule_id)
    and (p_action is null or a.action = p_action)
    and (p_from is null or a.created_at >= p_from)
    and (p_to is null or a.created_at <= p_to);

  return public.private_pairing_ok(jsonb_build_object('audit_logs', v_rows));
end;
$$;

create or replace function public.private_pairing_get_active_rules_for_scope(
  p_scope_type text,
  p_scope_id text default null,
  p_tenant_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant text;
  v_set public.private_pairing_rule_sets%rowtype;
  v_payload jsonb;
begin
  if auth.uid() is null or not public.private_pairing_can('pairing.private_rules.view') then
    return public.private_pairing_err('PERMISSION_DENIED');
  end if;

  v_tenant := coalesce(nullif(trim(p_tenant_id), ''), public.private_pairing_current_tenant_id());
  if v_tenant is null then
    return public.private_pairing_err('SCOPE_ID_REQUIRED');
  end if;
  if not public.private_pairing_tenant_visible(v_tenant) then
    return public.private_pairing_err('CROSS_TENANT_ACCESS');
  end if;

  select * into v_set
  from public.private_pairing_rule_sets s
  where s.tenant_id = v_tenant
    and s.scope_type = p_scope_type
    and s.scope_id is not distinct from p_scope_id
    and s.status = 'active'
  order by s.version desc
  limit 1;

  if not found then
    return public.private_pairing_ok(jsonb_build_object('rule_set', null, 'rules', '[]'::jsonb));
  end if;

  v_payload := public.private_pairing_get_rule_set(v_set.id);
  return v_payload;
end;
$$;

-- Grants: execute RPCs only
grant execute on function public.private_pairing_list_rule_sets(text, text, text) to authenticated;
grant execute on function public.private_pairing_get_rule_set(uuid) to authenticated;
grant execute on function public.private_pairing_create_rule_set(text, text, text, text, text, jsonb, text, uuid) to authenticated;
grant execute on function public.private_pairing_create_rule(uuid, text, text, text, integer, text, text, text[], text, text, text, timestamptz, timestamptz, jsonb, text, uuid) to authenticated;
grant execute on function public.private_pairing_update_rule(uuid, text, text, text, text, integer, text, text, text[], text, text, text, timestamptz, timestamptz, boolean, jsonb, uuid) to authenticated;
grant execute on function public.private_pairing_disable_rule(uuid, text, uuid) to authenticated;
grant execute on function public.private_pairing_clone_rule_set_version(uuid, text, uuid) to authenticated;
grant execute on function public.private_pairing_activate_rule_set(uuid, text, boolean, text, jsonb, uuid) to authenticated;
grant execute on function public.private_pairing_rollback_rule_set(uuid, text, uuid) to authenticated;
grant execute on function public.private_pairing_list_audit_logs(uuid, uuid, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.private_pairing_get_active_rules_for_scope(text, text, text) to authenticated;

-- Explicit realtime off note (no ALTER PUBLICATION)
comment on table public.private_pairing_rule_sets is
  'Private Pairing Rules V2 — NOT published to supabase_realtime';
comment on table public.private_pairing_rules is
  'Private Pairing Rules V2 — NOT published to supabase_realtime';
comment on table public.private_pairing_rule_targets is
  'Private Pairing Rules V2 — NOT published to supabase_realtime';
comment on table public.private_pairing_rule_audit_logs is
  'Private Pairing Rules V2 audit append-only — NOT published to supabase_realtime';
