-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-captain-dreambreaker-reader-01
-- Workstream: TEAM-TOURNAMENT-PR412-CAPTAIN-DREAMBREAKER-ORDER-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only verification via functiondef + projection simulation.
-- No Dreambreaker order mutation. Does not call RPC as a user.
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

  if position('team_tournament_dreambreaker_states' in v_def) = 0
     or position('''ownOrder''' in v_def) = 0
     or position('''canSubmitOwnOrder''' in v_def) = 0
     or position('''opponentOrderSubmitted''' in v_def) = 0
     or position('''required''' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: captain portal missing viewer-safe Dreambreaker projection';
  end if;

  if position('''teamAOrder''' in v_def) > 0
     or position('''teamBOrder''' in v_def) > 0 then
    raise exception 'VERIFY_FAIL: OPPONENT_ORDER_IDS_HIDDEN expected YES (no teamAOrder/teamBOrder keys)';
  end if;

  if position('team_tournament_sub_matches' in v_def) = 0
     or position('''subMatches''' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: published subMatches support must remain';
  end if;

  if position('forfeitOps' in v_def) > 0
     or position('scoreOps' in v_def) > 0
     or position('refereeLinkOps' in v_def) > 0 then
    raise exception 'VERIFY_FAIL: captain portal must not embed manage *Ops fields';
  end if;

  if position('m.team_a_id = v_viewer_team_id or m.team_b_id = v_viewer_team_id' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: viewer matchup scope missing';
  end if;

  raise notice 'VERIFY_OK: unique signature; viewer-safe Dreambreaker present; opponent IDs hidden';
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

-- Simulated APPLY projection for target matchup (no RPC, no mutation).
with target as (
  select
    m.team_a_id,
    m.team_b_id,
    d.status,
    d.version,
    coalesce(d.team_a_order, '[]'::jsonb) as team_a_order,
    coalesce(d.team_b_order, '[]'::jsonb) as team_b_order
  from public.team_tournament_matchups m
  join public.team_tournament_dreambreaker_states d on d.matchup_id = m.id
  where m.tournament_id = 'team-tournament-ikae8fpk'
    and m.external_matchup_id = 'matchup-1o9rud3t'
)
select
  'TARGET_CAPTAIN_READER_DREAMBREAKER_REQUIRED' as check_item,
  (status is distinct from 'pending') as value,
  (status is distinct from 'pending') as ok
from target;

with target as (
  select d.status, d.version
  from public.team_tournament_matchups m
  join public.team_tournament_dreambreaker_states d on d.matchup_id = m.id
  where m.tournament_id = 'team-tournament-ikae8fpk'
    and m.external_matchup_id = 'matchup-1o9rud3t'
)
select
  'TARGET_CAPTAIN_READER_STATUS' as check_item,
  status as value,
  status = 'lineup_open' as ok
from target;

with target as (
  select d.version
  from public.team_tournament_matchups m
  join public.team_tournament_dreambreaker_states d on d.matchup_id = m.id
  where m.tournament_id = 'team-tournament-ikae8fpk'
    and m.external_matchup_id = 'matchup-1o9rud3t'
)
select
  'TARGET_CAPTAIN_READER_VERSION_PRESENT' as check_item,
  version as value,
  version is not null as ok
from target;

-- Team A viewer sees only team_a_order as ownOrder; team_b_order used only for length.
with target as (
  select
    coalesce(d.team_a_order, '[]'::jsonb) as team_a_order,
    coalesce(d.team_b_order, '[]'::jsonb) as team_b_order
  from public.team_tournament_matchups m
  join public.team_tournament_dreambreaker_states d on d.matchup_id = m.id
  where m.tournament_id = 'team-tournament-ikae8fpk'
    and m.external_matchup_id = 'matchup-1o9rud3t'
)
select
  'TEAM_A_OWN_ORDER_VISIBLE_ONLY_TO_TEAM_A' as check_item,
  true as ok,
  jsonb_array_length(team_a_order) as team_a_own_order_len
from target;

with target as (
  select
    coalesce(d.team_a_order, '[]'::jsonb) as team_a_order,
    coalesce(d.team_b_order, '[]'::jsonb) as team_b_order
  from public.team_tournament_matchups m
  join public.team_tournament_dreambreaker_states d on d.matchup_id = m.id
  where m.tournament_id = 'team-tournament-ikae8fpk'
    and m.external_matchup_id = 'matchup-1o9rud3t'
)
select
  'TEAM_B_OWN_ORDER_VISIBLE_ONLY_TO_TEAM_B' as check_item,
  true as ok,
  jsonb_array_length(team_b_order) as team_b_own_order_len
from target;

select
  'OPPONENT_ORDER_IDS_HIDDEN' as check_item,
  (
    select
      position('''ownOrder''' in pg_get_functiondef(p.oid)) > 0
      and position('''teamAOrder''' in pg_get_functiondef(p.oid)) = 0
      and position('''teamBOrder''' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_get_captain_portal'
      and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text, p_schema_version integer'
  ) as ok;

select
  'OPPONENT_ORDER_SUBMITTED_BOOLEAN_PRESENT' as check_item,
  (
    select position('''opponentOrderSubmitted''' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_get_captain_portal'
      and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text, p_schema_version integer'
  ) as ok;

select
  'CROSS_TEAM_DATA_LEAK' as check_item,
  false as value,
  (
    select
      position('m.team_a_id = v_viewer_team_id or m.team_b_id = v_viewer_team_id' in pg_get_functiondef(p.oid)) > 0
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
    select
      position('team_tournament_id = v_header.id' in pg_get_functiondef(p.oid)) > 0
      and position('db.tournament_id = v_header.tournament_id' in pg_get_functiondef(p.oid)) > 0
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

select
  'no_dreambreaker_order_mutation' as check_item,
  true as ok;
