-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: core13-canonical-assignment-runtime-closure-01
-- LOCAL PACKAGE ONLY. Do NOT apply on Staging/Production without Owner GO.
-- Read-only. No business DML.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_fail text[] := '{}';
begin
  if to_regclass('public.referee_assignments') is null then
    v_fail := array_append(v_fail, 'missing.referee_assignments');
  end if;

  if to_regclass('public.competition_referee_assignment_audit') is null then
    v_fail := array_append(v_fail, 'missing.competition_referee_assignment_audit');
  end if;

  if to_regclass('public.competition_referee_assignment_idempotency') is null then
    v_fail := array_append(v_fail, 'missing.competition_referee_assignment_idempotency');
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'referee_assignments'
      and column_name = 'version'
  ) then
    v_fail := array_append(v_fail, 'missing.referee_assignments.version');
  end if;

  if to_regprocedure(
    'public.competition_assign_referee(text,text,text,uuid,text,integer,text,uuid,text,text,jsonb)'
  ) is null then
    v_fail := array_append(v_fail, 'missing.competition_assign_referee');
  end if;

  if to_regprocedure(
    'public.competition_replace_referee(text,text,text,uuid,text,integer,text,uuid,text,text,boolean,jsonb)'
  ) is null then
    v_fail := array_append(v_fail, 'missing.competition_replace_referee');
  end if;

  if to_regprocedure(
    'public.competition_unassign_referee(text,text,text,text,integer,text,uuid,text,text,jsonb)'
  ) is null then
    v_fail := array_append(v_fail, 'missing.competition_unassign_referee');
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'competition_referee_assignments_active_match_role_uq'
  ) then
    v_fail := array_append(v_fail, 'missing.active_match_role_uq');
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'competition_referee_assignment_audit_scope_idx'
  ) then
    v_fail := array_append(v_fail, 'missing.audit_scope_idx');
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'competition_referee_assignment_audit_idempotency_idx'
  ) then
    v_fail := array_append(v_fail, 'missing.audit_idempotency_idx');
  end if;

  if array_length(v_fail, 1) is not null then
    raise exception 'VERIFY_FAIL %', array_to_string(v_fail, ',');
  end if;

  raise notice 'VERIFY_PASS core13-canonical-assignment-runtime-closure-01';
end;
$$;

select
  'competition_assign_referee' as object_name,
  (to_regprocedure(
    'public.competition_assign_referee(text,text,text,uuid,text,integer,text,uuid,text,text,jsonb)'
  ) is not null) as ok
union all
select
  'competition_replace_referee',
  (to_regprocedure(
    'public.competition_replace_referee(text,text,text,uuid,text,integer,text,uuid,text,text,boolean,jsonb)'
  ) is not null)
union all
select
  'competition_unassign_referee',
  (to_regprocedure(
    'public.competition_unassign_referee(text,text,text,text,integer,text,uuid,text,text,jsonb)'
  ) is not null)
union all
select
  'competition_referee_assignment_audit',
  (to_regclass('public.competition_referee_assignment_audit') is not null)
union all
select
  'competition_referee_assignment_idempotency',
  (to_regclass('public.competition_referee_assignment_idempotency') is not null);
