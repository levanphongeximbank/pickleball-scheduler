-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: core13-canonical-assignment-runtime-closure-01
-- LOCAL PACKAGE ONLY. Do NOT apply on Staging/Production without Owner GO.
-- SQL_DESIGN_AND_MIGRATION_AUTHORING_GO=YES · SQL_EXECUTION_GO=NO
-- Read-only. No business DML. PRODUCTION_MUTATIONS=0.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_missing text[] := '{}';
begin
  if to_regclass('public.referee_assignments') is null then
    v_missing := array_append(v_missing, 'referee_assignments');
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception
      'PRECHECK_FAIL missing=% — refuse package; do not invent a parallel assignment table',
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

  raise notice 'PRECHECK_PASS core13 canonical assignment runtime prerequisites present';
end;
$$;

select
  'referee_assignments_present' as check_name,
  (to_regclass('public.referee_assignments') is not null) as ok;
