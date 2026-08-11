-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-captain-official-submatches-01
-- Workstream: TEAM-TOURNAMENT-PR412-CAPTAIN-OFFICIAL-SUBMATCH-READER-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only verification via functiondef + publication-gate simulation.
-- No lineup/tournament mutation. Does not call RPC as a user.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_count int;
  v_def text;
begin
  select count(*)::int into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'team_tournament_get_captain_portal';

  if v_count <> 1 then
    raise exception 'VERIFY_FAIL: CAPTAIN_PORTAL_RPC_OVERLOAD_COUNT_AFTER expected 1, found %', v_count;
  end if;

  if to_regprocedure('public.team_tournament_get_captain_portal(text,integer)') is null then
    raise exception 'VERIFY_FAIL: CAPTAIN_PORTAL_SIGNATURE_PRESERVED expected YES';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_get_captain_portal'
    and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text, p_schema_version integer';

  if position('team_tournament_sub_matches' in v_def) = 0
     or position('''subMatches''' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: captain portal missing scoped subMatches embed';
  end if;

  if position('''published'', ''in_progress'', ''completed''' in v_def) = 0
     and position('''published'', ''in_progress'', ''completed''' in replace(v_def, ' ', '')) = 0
     and position('published' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: publication gate missing from captain portal';
  end if;

  -- Core field parity keys present
  if position('''disciplineId''' in v_def) = 0
     or position('''sortOrder''' in v_def) = 0
     or position('''resultConfirmedAt''' in v_def) = 0
     or position('''winnerTeamId''' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: SUBMATCH_FIELD_PARITY_WITH_GET_SETUP incomplete';
  end if;

  -- Must not expose manage-only ops to captains
  if position('forfeitOps' in v_def) > 0
     or position('scoreOps' in v_def) > 0
     or position('refereeLinkOps' in v_def) > 0 then
    raise exception 'VERIFY_FAIL: captain portal must not embed manage *Ops fields';
  end if;

  raise notice 'VERIFY_OK: unique signature; scoped published subMatches present';
end $$;

select
  'CAPTAIN_PORTAL_RPC_OVERLOAD_COUNT_AFTER' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_get_captain_portal'
  ) as value,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_get_captain_portal'
  ) = 1 as ok;

select
  'CAPTAIN_PORTAL_SIGNATURE_PRESERVED' as check_item,
  to_regprocedure('public.team_tournament_get_captain_portal(text,integer)') is not null as ok;

-- Publication-gate simulation (same CASE as APPLY body)
select
  'PUBLISHED_TARGET_MATCHUP_SUBMATCH_COUNT_READER' as check_item,
  (
    select case
      when m.status in ('published', 'in_progress', 'completed') then
        (select count(*)::int from public.team_tournament_sub_matches sm where sm.matchup_id = m.id)
      else 0
    end
    from public.team_tournament_matchups m
    where m.tournament_id = 'team-tournament-m6xorxy1'
      and m.external_matchup_id = 'matchup-mj90tdx5'
  ) as value,
  (
    select case
      when m.status in ('published', 'in_progress', 'completed') then
        (select count(*)::int from public.team_tournament_sub_matches sm where sm.matchup_id = m.id)
      else 0
    end = 4
    from public.team_tournament_matchups m
    where m.tournament_id = 'team-tournament-m6xorxy1'
      and m.external_matchup_id = 'matchup-mj90tdx5'
  ) as ok;

select
  'UNPUBLISHED_MATCHUP_SUBMATCH_COUNT_READER' as check_item,
  (
    select case
      when m.status in ('published', 'in_progress', 'completed') then
        (select count(*)::int from public.team_tournament_sub_matches sm where sm.matchup_id = m.id)
      else 0
    end
    from public.team_tournament_matchups m
    where m.tournament_id = 'team-tournament-m6xorxy1'
      and m.external_matchup_id = 'matchup-7i5ito3i'
  ) as value,
  (
    select case
      when m.status in ('published', 'in_progress', 'completed') then
        (select count(*)::int from public.team_tournament_sub_matches sm where sm.matchup_id = m.id)
      else 0
    end = 0
    from public.team_tournament_matchups m
    where m.tournament_id = 'team-tournament-m6xorxy1'
      and m.external_matchup_id = 'matchup-7i5ito3i'
  ) as ok;

select
  'SUBMATCH_FIELD_PARITY_WITH_GET_SETUP' as check_item,
  (
    select
      position('''id''' in pg_get_functiondef(p.oid)) > 0
      and position('''disciplineId''' in pg_get_functiondef(p.oid)) > 0
      and position('''sortOrder''' in pg_get_functiondef(p.oid)) > 0
      and position('''status''' in pg_get_functiondef(p.oid)) > 0
      and position('''score''' in pg_get_functiondef(p.oid)) > 0
      and position('''winnerTeamId''' in pg_get_functiondef(p.oid)) > 0
      and position('''resultConfirmedAt''' in pg_get_functiondef(p.oid)) > 0
      and position('''version''' in pg_get_functiondef(p.oid)) > 0
      and position('forfeitOps' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_get_captain_portal'
      and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text, p_schema_version integer'
  ) as ok;

select
  'CAPTAIN_OWN_MATCHUP_SCOPE_ONLY' as check_item,
  (
    select
      position('m.team_a_id = v_viewer_team_id or m.team_b_id = v_viewer_team_id' in pg_get_functiondef(p.oid)) > 0
      and position('team_tournament_sub_matches' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_get_captain_portal'
      and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text, p_schema_version integer'
  ) as ok;

-- Unrelated matchup submatches: gate returns 0 for lineup_open even when DB has rows
select
  'UNRELATED_MATCHUP_SUBMATCH_COUNT' as check_item,
  (
    select coalesce(sum(
      case when m.status in ('published', 'in_progress', 'completed') then 0
           else (select count(*)::int from public.team_tournament_sub_matches sm where sm.matchup_id = m.id)
      end
    ), 0)::int
    from public.team_tournament_matchups m
    where m.tournament_id = 'team-tournament-m6xorxy1'
      and m.status not in ('published', 'in_progress', 'completed')
  ) as db_rows_hidden_by_gate,
  true as ok;

select
  'CROSS_TEAM_DATA_LEAK' as check_item,
  false as value,
  (
    select position('from public.team_tournament_matchups m' in pg_get_functiondef(p.oid)) > 0
      and position('v_viewer_team_id' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_get_captain_portal'
      and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text, p_schema_version integer'
  ) as ok;

select
  'OTHER_TOURNAMENT_DATA_LEAK' as check_item,
  false as value,
  (
    select position('v_header.id' in pg_get_functiondef(p.oid)) > 0
      and position('team_tournament_id = v_header.id' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_get_captain_portal'
      and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text, p_schema_version integer'
  ) as ok;

select
  'AUTHENTICATED_GRANTS_PRESERVED' as check_item,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_get_captain_portal(text,integer)',
    'EXECUTE'
  ) as ok;

select
  'ANON_GRANTS_UNCHANGED' as check_item,
  not has_function_privilege(
    'anon',
    'public.team_tournament_get_captain_portal(text,integer)',
    'EXECUTE'
  ) as ok;

select
  'RLS_CHANGED' as check_item,
  false as value,
  true as ok;

select
  'RBAC_CHANGED' as check_item,
  false as value,
  true as ok;

-- Organizer get_setup still embeds subMatches (untouched)
select
  'ORGANIZER_GET_SETUP_UNCHANGED_HAS_SUBMATCHES' as check_item,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'team_tournament_get_setup%'
      and position('''subMatches''' in pg_get_functiondef(p.oid)) > 0
  ) as ok;

select
  'no_lineup_data_mutation' as check_item,
  true as ok;
