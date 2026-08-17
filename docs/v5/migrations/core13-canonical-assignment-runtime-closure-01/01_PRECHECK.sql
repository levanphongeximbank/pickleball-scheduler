-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: core13-canonical-assignment-runtime-closure-01
-- LOCAL PACKAGE ONLY. Do NOT apply on Staging/Production without Owner GO.
-- SQL_DESIGN_AND_MIGRATION_AUTHORING_GO=YES · SQL_EXECUTION_GO=NO
-- READ ONLY. No INSERT/UPDATE/DELETE. No ALTER. No DROP. No business mutation.
-- Fail closed if unique-index apply would be unsafe, or authz prerequisites missing.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_missing text[] := '{}';
  v_fail text[] := '{}';
  v_dup_scopes bigint := 0;
  v_invalid_scope bigint := 0;
  v_invalid_version bigint := 0;
  v_index_compat text := 'ABSENT_WILL_CREATE';
  v_indexdef text := null;
  v_has_version boolean := false;
  v_fn_name text;
  v_expected_fn text;
begin
  if to_regclass('public.referee_assignments') is null then
    v_missing := array_append(v_missing, 'referee_assignments');
  end if;

  if to_regclass('public.canonical_tournaments') is null then
    v_missing := array_append(v_missing, 'canonical_tournaments');
  end if;

  if to_regclass('public.match_live_states') is null then
    v_missing := array_append(v_missing, 'match_live_states');
  end if;

  if to_regclass('public.profiles') is null then
    v_missing := array_append(v_missing, 'profiles');
  end if;

  if to_regclass('public.team_tournaments') is null then
    v_missing := array_append(v_missing, 'team_tournaments');
  end if;

  if to_regprocedure('public.user_venue_id()') is null then
    v_missing := array_append(v_missing, 'user_venue_id()');
  end if;

  if to_regprocedure('public.user_has_permission(text)') is null then
    v_missing := array_append(v_missing, 'user_has_permission(text)');
  end if;

  if to_regprocedure('public.is_super_admin()') is null then
    v_missing := array_append(v_missing, 'is_super_admin()');
  end if;

  if to_regprocedure('public.canonical_tournament_assert_tenant(text)') is null then
    v_missing := array_append(v_missing, 'canonical_tournament_assert_tenant(text)');
  end if;

  if to_regprocedure('public.canonical_tournament_assert_permission(text)') is null then
    v_missing := array_append(
      v_missing,
      'canonical_tournament_assert_permission(text)'
    );
  end if;

  if to_regprocedure('public.team_tournament_assert_tenant(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_assert_tenant(text)');
  end if;

  if to_regprocedure('public.team_tournament_can_manage()') is null then
    v_missing := array_append(v_missing, 'team_tournament_can_manage()');
  end if;

  if to_regprocedure('public.team_tournament_resolve_header(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_resolve_header(text)');
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception
      'PRECHECK_FAIL missing=% — refuse package; do not invent a parallel assignment table or a new tenant authority',
      array_to_string(v_missing, ',');
  end if;

  -- A) Duplicate active rows for the future unique-index scope.
  --    Do NOT list tenant/match identifiers (avoid leaking business data).
  --    Do NOT mutate or auto-clean duplicates.
  select count(*) into v_dup_scopes
  from (
    select ra.tenant_id, ra.tournament_id, ra.match_id, ra.role
    from public.referee_assignments ra
    where ra.status = 'active'
    group by ra.tenant_id, ra.tournament_id, ra.match_id, ra.role
    having count(*) > 1
  ) dup;

  raise notice 'ACTIVE_DUPLICATE_SCOPE_COUNT=%', v_dup_scopes;
  if v_dup_scopes > 0 then
    v_fail := array_append(
      v_fail,
      format('active_duplicate_scopes=%s', v_dup_scopes)
    );
  end if;

  -- B) Null/blank identifiers would not be protected by UNIQUE (NULL is distinct).
  select count(*) into v_invalid_scope
  from public.referee_assignments ra
  where ra.status = 'active'
    and (
      nullif(trim(coalesce(ra.tenant_id, '')), '') is null
      or nullif(trim(coalesce(ra.tournament_id, '')), '') is null
      or nullif(trim(coalesce(ra.match_id, '')), '') is null
      or nullif(trim(coalesce(ra.role, '')), '') is null
    );

  raise notice 'INVALID_SCOPE_ACTIVE_ROW_COUNT=%', v_invalid_scope;
  if v_invalid_scope > 0 then
    v_fail := array_append(
      v_fail,
      format('invalid_scope_active_rows=%s', v_invalid_scope)
    );
  end if;

  -- C) Incompatible existing version values.
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'referee_assignments'
      and column_name = 'version'
  ) into v_has_version;

  if v_has_version then
    execute
      'select count(*) from public.referee_assignments where version is null or version < 0'
      into v_invalid_version;
    raise notice 'PRECHECK_NOTE referee_assignments.version present';
  else
    v_invalid_version := 0;
    raise notice 'PRECHECK_NOTE referee_assignments.version missing — APPLY will add additively';
  end if;

  raise notice 'INVALID_VERSION_ROW_COUNT=%', v_invalid_version;
  if v_invalid_version > 0 then
    v_fail := array_append(
      v_fail,
      format('invalid_version_rows=%s', v_invalid_version)
    );
  end if;

  -- D) Existing unique index / function signature compatibility.
  select i.indexdef into v_indexdef
  from pg_indexes i
  where i.schemaname = 'public'
    and i.indexname = 'competition_referee_assignments_active_match_role_uq';

  if v_indexdef is null then
    v_index_compat := 'ABSENT_WILL_CREATE';
  elsif v_indexdef ilike '%UNIQUE%'
    and v_indexdef ilike '%tenant_id%'
    and v_indexdef ilike '%tournament_id%'
    and v_indexdef ilike '%match_id%'
    and v_indexdef ilike '%role%'
    and v_indexdef ilike '%status%'
    and v_indexdef ilike '%active%' then
    v_index_compat := 'COMPATIBLE';
  else
    v_index_compat := 'INCOMPATIBLE';
    v_fail := array_append(v_fail, 'index_incompatible');
  end if;

  raise notice 'INDEX_COMPATIBILITY=%', v_index_compat;

  foreach v_expected_fn in array array[
    'public.competition_assign_referee(text,text,text,uuid,text,integer,text,uuid,text,text,jsonb)',
    'public.competition_replace_referee(text,text,text,uuid,text,integer,text,uuid,text,text,boolean,jsonb)',
    'public.competition_unassign_referee(text,text,text,text,integer,text,uuid,text,text,jsonb)'
  ]
  loop
    v_fn_name := split_part(split_part(v_expected_fn, '.', 2), '(', 1);
    if exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = v_fn_name
    ) and to_regprocedure(v_expected_fn) is null then
      v_fail := array_append(v_fail, format('incompatible_signature.%s', v_fn_name));
    end if;
  end loop;

  if to_regclass('public.competition_referee_assignment_audit') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'competition_referee_assignment_audit'
        and column_name = 'actor_id'
    ) then
      v_fail := array_append(v_fail, 'audit_table_incompatible');
    end if;
  end if;

  if to_regclass('public.competition_referee_assignment_idempotency') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'competition_referee_assignment_idempotency'
        and column_name = 'payload_hash'
    ) then
      v_fail := array_append(v_fail, 'idempotency_table_incompatible');
    end if;
  end if;

  if array_length(v_fail, 1) is not null then
    raise notice 'PRECHECK_FINAL=FAIL';
    raise exception
      'PRECHECK_FAIL % — refuse APPLY; do not auto-clean assignment rows',
      array_to_string(v_fail, ',');
  end if;

  raise notice 'PRECHECK_FINAL=PASS';
  raise notice 'PRECHECK_PASS core13 canonical assignment runtime + unique-index data safety';
end;
$$;

select
  'referee_assignments_present' as check_name,
  (to_regclass('public.referee_assignments') is not null) as ok
union all
select
  'canonical_tournament_assert_tenant',
  (to_regprocedure('public.canonical_tournament_assert_tenant(text)') is not null)
union all
select
  'canonical_tournament_assert_permission',
  (to_regprocedure('public.canonical_tournament_assert_permission(text)') is not null)
union all
select
  'user_venue_id',
  (to_regprocedure('public.user_venue_id()') is not null)
union all
select
  'team_tournament_can_manage',
  (to_regprocedure('public.team_tournament_can_manage()') is not null);
