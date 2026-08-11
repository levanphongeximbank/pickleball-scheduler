-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-submatch-score-revision-cas-01
-- Workstream: TEAM-TOURNAMENT-PR412-SUBMATCH-SCORE-REVISION-CAS-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only inventory. No mutation.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_missing text[] := '{}';
  v_save_count int;
  v_confirm_count int;
  v_save_def text;
  v_confirm_cas_def text;
begin
  if to_regclass('public.team_tournament_sub_matches') is null then
    v_missing := array_append(v_missing, 'team_tournament_sub_matches');
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_tournament_sub_matches'
      and column_name = 'version'
  ) then
    v_missing := array_append(v_missing, 'team_tournament_sub_matches.version');
  end if;

  if to_regprocedure('public.team_tournament_version_conflict(text,integer,integer)') is null then
    v_missing := array_append(v_missing, 'team_tournament_version_conflict(text,integer,integer)');
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_begin_command'
  ) then
    v_missing := array_append(v_missing, 'team_tournament_begin_command');
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_finish_command'
  ) then
    v_missing := array_append(v_missing, 'team_tournament_finish_command');
  end if;

  if to_regprocedure('public.team_tournament_sub_match_score_ops(public.team_tournaments,public.team_tournament_matchups,public.team_tournament_sub_matches)') is null
     and not exists (
       select 1 from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'team_tournament_sub_match_score_ops'
     ) then
    v_missing := array_append(v_missing, 'team_tournament_sub_match_score_ops');
  end if;

  select count(*)::int into v_save_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'team_tournament_save_sub_match_draft';

  select count(*)::int into v_confirm_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'team_tournament_confirm_sub_match';

  if v_save_count < 1 then
    v_missing := array_append(v_missing, 'team_tournament_save_sub_match_draft');
  end if;
  if v_confirm_count < 1 then
    v_missing := array_append(v_missing, 'team_tournament_confirm_sub_match');
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception 'PRECHECK_FAIL: missing dependencies: %', array_to_string(v_missing, ', ');
  end if;

  select pg_get_functiondef(p.oid) into v_save_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_save_sub_match_draft'
    and pg_get_function_identity_arguments(p.oid)
      = 'p_tournament_id text, p_matchup_id text, p_sub_match_id text, p_score jsonb';

  if v_save_def is null then
    raise notice 'PRECHECK_WARN: legacy 4-arg save_sub_match_draft not found (may already be remediated)';
  else
    if position('p_expected_version' in v_save_def) = 0
       and position('version = version + 1' in v_save_def) = 0
       and position('version_conflict' in lower(v_save_def)) = 0 then
      raise notice 'PRECHECK_OK: legacy save lacks CAS / version bump (expected pre-state)';
    else
      raise notice 'PRECHECK_WARN: legacy save body already contains CAS markers';
    end if;
  end if;

  select pg_get_functiondef(p.oid) into v_confirm_cas_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_confirm_sub_match'
    and pg_get_function_identity_arguments(p.oid)
      = 'p_tournament_id text, p_matchup_id text, p_sub_match_id text, p_score jsonb, p_winner_team_id text, p_expected_version integer, p_idempotency_key text';

  if v_confirm_cas_def is null then
    raise exception 'PRECHECK_FAIL: versioned confirm_sub_match (7-arg) missing';
  end if;

  if position('v_sub_match.version' in v_confirm_cas_def) = 0
     or position('version_conflict' in lower(v_confirm_cas_def)) = 0 then
    raise exception 'PRECHECK_FAIL: versioned confirm lacks subMatch CAS markers';
  end if;

  if to_regprocedure('public.team_tournament_confirm_sub_match(text,text,text,jsonb,text)') is not null then
    raise notice 'PRECHECK_OK: legacy versionless confirm overload present (to be dropped)';
  else
    raise notice 'PRECHECK_WARN: legacy 5-arg confirm already absent';
  end if;

  raise notice 'PRECHECK_OK: submatch-score-revision-cas-01 prerequisites present';
  raise notice 'SAVE_DRAFT_OVERLOAD_COUNT_BEFORE=%', v_save_count;
  raise notice 'CONFIRM_OVERLOAD_COUNT_BEFORE=%', v_confirm_count;
end $$;

select
  'save_draft_overload_count_before' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_save_sub_match_draft'
  ) as value;

select
  'confirm_overload_count_before' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_confirm_sub_match'
  ) as value;

select
  'save_signatures_before' as check_item,
  pg_get_function_identity_arguments(p.oid) as signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'team_tournament_save_sub_match_draft'
order by signature;

select
  'confirm_signatures_before' as check_item,
  pg_get_function_identity_arguments(p.oid) as signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'team_tournament_confirm_sub_match'
order by signature;

select
  'grants_before' as check_item,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_save_sub_match_draft(text,text,text,jsonb)',
    'EXECUTE'
  ) as save_legacy_auth_exec,
  has_function_privilege(
    'anon',
    'public.team_tournament_save_sub_match_draft(text,text,text,jsonb)',
    'EXECUTE'
  ) as save_legacy_anon_exec,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_confirm_sub_match(text,text,text,jsonb,text,integer,text)',
    'EXECUTE'
  ) as confirm_cas_auth_exec,
  has_function_privilege(
    'anon',
    'public.team_tournament_confirm_sub_match(text,text,text,jsonb,text,integer,text)',
    'EXECUTE'
  ) as confirm_cas_anon_exec;
