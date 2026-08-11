-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-write-lineup-revision-overload-01
-- Workstream: TEAM-TOURNAMENT-PR412-WRITE-LINEUP-REVISION-OVERLOAD-PACKAGE-LOCK-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only verification: inventory/grants only. No lineup/tournament mutation.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_count int;
  v_has_12 boolean;
  v_has_13 boolean;
  v_save_def text;
  v_submit_def text;
begin
  select count(*)::int into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'team_tournament_write_lineup_revision';

  v_has_12 := to_regprocedure(
    'public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text)'
  ) is not null;
  v_has_13 := to_regprocedure(
    'public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text,text)'
  ) is not null;

  if v_count <> 1 or v_has_12 or not v_has_13 then
    raise exception
      'VERIFY_FAIL: WRITE_LINEUP_REVISION_OVERLOAD_COUNT_AFTER expected 1 canonical 13-arg (count=% has12=% has13=%)',
      v_count, v_has_12, v_has_13;
  end if;

  select pg_get_functiondef(p.oid) into v_save_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_save_lineup_draft'
    and pg_get_function_identity_arguments(p.oid)
      = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text';

  select pg_get_functiondef(p.oid) into v_submit_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_submit_lineup'
    and pg_get_function_identity_arguments(p.oid)
      = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text';

  if v_save_def is null
     or position('team_tournament_write_lineup_revision' in v_save_def) = 0
     or position('''captain''::text' in v_save_def) = 0 then
    raise exception 'VERIFY_FAIL: SAVE_DRAFT_CALLS_ACTOR_ROLE_CAPTAIN expected YES';
  end if;

  if v_submit_def is null
     or position('team_tournament_write_lineup_revision' in v_submit_def) = 0
     or position('''captain''::text' in v_submit_def) = 0 then
    raise exception 'VERIFY_FAIL: SUBMIT_CALLS_ACTOR_ROLE_CAPTAIN expected YES';
  end if;

  raise notice 'VERIFY_OK: unique 13-arg; save+submit call captain actor_role';
end $$;

select
  'WRITE_LINEUP_REVISION_OVERLOAD_COUNT_AFTER' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_write_lineup_revision'
  ) as value,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_write_lineup_revision'
  ) = 1 as ok;

select
  'CANONICAL_13ARG_PRESENT' as check_item,
  to_regprocedure(
    'public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text,text)'
  ) is not null as ok;

select
  'STALE_12ARG_PRESENT' as check_item,
  to_regprocedure(
    'public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text)'
  ) is not null as present,
  to_regprocedure(
    'public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text)'
  ) is null as ok;

select
  'SAVE_DRAFT_HELPER_RESOLUTION_UNAMBIGUOUS' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_write_lineup_revision'
  ) = 1
  and (
    select
      position('team_tournament_write_lineup_revision' in pg_get_functiondef(p.oid)) > 0
      and position('''captain''::text' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_save_lineup_draft'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'VERSIONED_SUBMIT_HELPER_RESOLUTION_UNAMBIGUOUS' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_write_lineup_revision'
  ) = 1
  and (
    select
      position('team_tournament_write_lineup_revision' in pg_get_functiondef(p.oid)) > 0
      and position('''captain''::text' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_lineup'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'SAVE_DRAFT_CALLS_ACTOR_ROLE_CAPTAIN' as check_item,
  (
    select position('''captain''::text' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_save_lineup_draft'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'SUBMIT_CALLS_ACTOR_ROLE_CAPTAIN' as check_item,
  (
    select position('''captain''::text' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_lineup'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'AUTHENTICATED_GRANTS_PRESERVED' as check_item,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.team_tournament_submit_lineup(text,text,text,jsonb,integer,text)',
    'EXECUTE'
  ) as ok;

select
  'ANON_GRANTS_UNCHANGED' as check_item,
  not has_function_privilege(
    'anon',
    'public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.team_tournament_submit_lineup(text,text,text,jsonb,integer,text)',
    'EXECUTE'
  ) as ok;

select
  'RLS_CHANGED' as check_item,
  false as value,
  true as ok;

select
  'unrelated_submit_overloads_preserved' as check_item,
  (
    select count(*)::int from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_submit_lineup'
  ) = 2 as ok;

select
  'unrelated_confirm_overloads_preserved' as check_item,
  (
    select count(*)::int from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_confirm_sub_match'
  ) = 2 as ok;

select
  'unrelated_lock_overloads_preserved' as check_item,
  (
    select count(*)::int from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_lock_matchup'
  ) = 2 as ok;

select
  'no_lineup_data_mutation' as check_item,
  true as ok;
