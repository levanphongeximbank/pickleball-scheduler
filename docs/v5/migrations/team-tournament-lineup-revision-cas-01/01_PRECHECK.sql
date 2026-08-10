-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-lineup-revision-cas-01
-- Workstream: TEAM-TOURNAMENT-PR412-LINEUP-REVISION-CAS-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_missing text[] := '{}';
  v_save_def text;
  v_submit_def text;
begin
  if to_regprocedure('public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)');
  end if;
  if to_regprocedure('public.team_tournament_submit_lineup(text,text,text,jsonb,integer,text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_submit_lineup(text,text,text,jsonb,integer,text)');
  end if;
  if to_regprocedure('public.team_tournament_save_lineup_draft_legacy(text,text,text,jsonb)') is null then
    v_missing := array_append(v_missing, 'team_tournament_save_lineup_draft_legacy(text,text,text,jsonb)');
  end if;
  if to_regprocedure('public.team_tournament_version_conflict(text,integer,integer)') is null then
    v_missing := array_append(v_missing, 'team_tournament_version_conflict(text,integer,integer)');
  end if;
  if to_regprocedure('public.team_tournament_begin_command(text,text,text,text,jsonb)') is null
     and to_regprocedure('public.team_tournament_begin_command(text,text,text,text,jsonb)') is null then
    if not exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'team_tournament_begin_command'
    ) then
      v_missing := array_append(v_missing, 'team_tournament_begin_command');
    end if;
  end if;
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_finish_command'
  ) then
    v_missing := array_append(v_missing, 'team_tournament_finish_command');
  end if;
  if to_regclass('public.team_tournament_lineups') is null then
    v_missing := array_append(v_missing, 'team_tournament_lineups');
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception 'PRECHECK_FAIL: missing dependencies: %', array_to_string(v_missing, ', ');
  end if;

  select pg_get_functiondef(p.oid) into v_save_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_save_lineup_draft'
    and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text';

  if v_save_def is null or position('team_tournament_save_lineup_draft_legacy' in v_save_def) = 0 then
    raise notice 'PRECHECK_WARN: save_lineup_draft may already be remediated or body unexpected';
  elsif position('team_tournament_save_lineup_draft_legacy' in v_save_def)
        < position('version_conflict' in lower(v_save_def)) then
    raise notice 'PRECHECK_OK: save_lineup_draft currently exhibits write-before-CAS anti-pattern';
  end if;

  select pg_get_functiondef(p.oid) into v_submit_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_submit_lineup'
    and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text';

  if v_submit_def is not null
     and position('team_tournament_save_lineup_draft(' in v_submit_def) > 0 then
    raise notice 'PRECHECK_OK: submit_lineup currently delegates write before independent CAS';
  end if;

  raise notice 'PRECHECK_OK: lineup-revision-cas-01 prerequisites present';
end $$;

select
  'save_lineup_draft_overload_count' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_save_lineup_draft'
  ) as value;

select
  'submit_lineup_overload_count' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_submit_lineup'
  ) as value;

select
  'grants_before' as check_item,
  has_function_privilege('authenticated', 'public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)', 'EXECUTE') as save_auth_exec,
  has_function_privilege('anon', 'public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)', 'EXECUTE') as save_anon_exec,
  has_function_privilege('authenticated', 'public.team_tournament_submit_lineup(text,text,text,jsonb,integer,text)', 'EXECUTE') as submit_auth_exec,
  has_function_privilege('anon', 'public.team_tournament_submit_lineup(text,text,text,jsonb,integer,text)', 'EXECUTE') as submit_anon_exec;

select
  'write_before_cas_evidence' as check_item,
  (
    select position('team_tournament_save_lineup_draft_legacy' in pg_get_functiondef(p.oid)) > 0
      and position('version_conflict' in lower(pg_get_functiondef(p.oid))) >
          position('team_tournament_save_lineup_draft_legacy' in pg_get_functiondef(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_save_lineup_draft'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text'
  ) as save_write_before_cas,
  (
    select position('team_tournament_save_lineup_draft(' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_lineup'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text'
  ) as submit_delegates_save_before_cas;
