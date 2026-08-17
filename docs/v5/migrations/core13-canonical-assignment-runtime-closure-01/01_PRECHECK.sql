-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: core13-canonical-assignment-runtime-closure-01
-- LOCAL PACKAGE ONLY. Do NOT apply on Staging/Production without Owner GO.
-- SQL_DESIGN_AND_MIGRATION_AUTHORING_GO=YES · SQL_EXECUTION_GO=NO
-- Read-only. No business DML. PRODUCTION_MUTATIONS=0.
-- Fail closed if secure-authorization prerequisites are missing.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_missing text[] := '{}';
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

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'referee_assignments'
      and column_name = 'version'
  ) then
    raise notice 'PRECHECK_NOTE referee_assignments.version missing — APPLY will add additively';
  else
    raise notice 'PRECHECK_NOTE referee_assignments.version present';
  end if;

  raise notice 'PRECHECK_PASS core13 canonical assignment runtime + authz prerequisites present';
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
