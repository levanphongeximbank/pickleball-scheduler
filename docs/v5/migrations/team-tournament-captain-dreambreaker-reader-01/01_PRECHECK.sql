-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-captain-dreambreaker-reader-01
-- Workstream: TEAM-TOURNAMENT-PR412-CAPTAIN-DREAMBREAKER-ORDER-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only inventory. No data mutation. No Dreambreaker order write.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_count int;
  v_def text;
  v_status text;
  v_a_len int;
  v_b_len int;
begin
  select count(*)::int into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'team_tournament_get_captain_portal';

  if v_count <> 1 then
    raise exception 'PRECHECK_FAIL: CAPTAIN_PORTAL_RPC_OVERLOAD_COUNT_BEFORE expected 1, found %', v_count;
  end if;

  if to_regprocedure('public.team_tournament_get_captain_portal(text,integer)') is null then
    raise exception 'PRECHECK_FAIL: CAPTAIN_PORTAL_SIGNATURE_MATCH expected YES';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_get_captain_portal'
    and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text, p_schema_version integer';

  if v_def is null then
    raise exception 'PRECHECK_FAIL: cannot load captain portal definition';
  end if;

  if position('security definer' in lower(v_def)) = 0 then
    raise exception 'PRECHECK_FAIL: expected SECURITY DEFINER';
  end if;

  if position('team_tournament_sub_matches' in v_def) = 0
     or position('''subMatches''' in v_def) = 0 then
    raise exception 'PRECHECK_FAIL: published subMatches support missing (prerequisite)';
  end if;

  if position('team_tournament_dreambreaker_states' in v_def) > 0
     or position('''ownOrder''' in v_def) > 0
     or position('''canSubmitOwnOrder''' in v_def) > 0 then
    raise exception 'PRECHECK_FAIL: CURRENT_CAPTAIN_READER_RETURNS_DREAMBREAKER expected NO';
  end if;

  if to_regclass('public.team_tournament_dreambreaker_states') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_dreambreaker_states missing';
  end if;

  select d.status,
         case
           when jsonb_typeof(coalesce(d.team_a_order, '[]'::jsonb)) = 'array'
           then jsonb_array_length(coalesce(d.team_a_order, '[]'::jsonb))
           else 0
         end,
         case
           when jsonb_typeof(coalesce(d.team_b_order, '[]'::jsonb)) = 'array'
           then jsonb_array_length(coalesce(d.team_b_order, '[]'::jsonb))
           else 0
         end
    into v_status, v_a_len, v_b_len
  from public.team_tournament_dreambreaker_states d
  join public.team_tournament_matchups m on m.id = d.matchup_id
  where d.tournament_id = 'team-tournament-ikae8fpk'
    and m.external_matchup_id = 'matchup-1o9rud3t';

  if not found then
    raise exception 'PRECHECK_FAIL: TARGET_DREAMBREAKER_ROW_EXISTS expected YES';
  end if;

  if v_status is distinct from 'lineup_open' then
    raise exception 'PRECHECK_FAIL: TARGET_DREAMBREAKER_STATUS expected lineup_open, found %', v_status;
  end if;

  if v_a_len <> 0 then
    raise exception 'PRECHECK_FAIL: TARGET_TEAM_A_ORDER_COUNT expected 0, found %', v_a_len;
  end if;

  if v_b_len <> 0 then
    raise exception 'PRECHECK_FAIL: TARGET_TEAM_B_ORDER_COUNT expected 0, found %', v_b_len;
  end if;

  raise notice 'PRECHECK_OK: unique captain portal omits Dreambreaker; target lineup_open 0/4 + 0/4';
end $$;

select
  'CAPTAIN_PORTAL_RPC_OVERLOAD_COUNT_BEFORE' as check_item,
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
  'CAPTAIN_PORTAL_SIGNATURE_MATCH' as check_item,
  to_regprocedure('public.team_tournament_get_captain_portal(text,integer)') is not null as ok;

select
  'TARGET_DREAMBREAKER_ROW_EXISTS' as check_item,
  exists (
    select 1
    from public.team_tournament_dreambreaker_states d
    join public.team_tournament_matchups m on m.id = d.matchup_id
    where d.tournament_id = 'team-tournament-ikae8fpk'
      and m.external_matchup_id = 'matchup-1o9rud3t'
  ) as ok;

select
  'TARGET_DREAMBREAKER_STATUS' as check_item,
  d.status as value,
  d.status = 'lineup_open' as ok
from public.team_tournament_dreambreaker_states d
join public.team_tournament_matchups m on m.id = d.matchup_id
where d.tournament_id = 'team-tournament-ikae8fpk'
  and m.external_matchup_id = 'matchup-1o9rud3t';

select
  'TARGET_TEAM_A_ORDER_COUNT' as check_item,
  case
    when jsonb_typeof(coalesce(d.team_a_order, '[]'::jsonb)) = 'array'
    then jsonb_array_length(coalesce(d.team_a_order, '[]'::jsonb))
    else 0
  end as value,
  (
    case
      when jsonb_typeof(coalesce(d.team_a_order, '[]'::jsonb)) = 'array'
      then jsonb_array_length(coalesce(d.team_a_order, '[]'::jsonb))
      else 0
    end
  ) = 0 as ok
from public.team_tournament_dreambreaker_states d
join public.team_tournament_matchups m on m.id = d.matchup_id
where d.tournament_id = 'team-tournament-ikae8fpk'
  and m.external_matchup_id = 'matchup-1o9rud3t';

select
  'TARGET_TEAM_B_ORDER_COUNT' as check_item,
  case
    when jsonb_typeof(coalesce(d.team_b_order, '[]'::jsonb)) = 'array'
    then jsonb_array_length(coalesce(d.team_b_order, '[]'::jsonb))
    else 0
  end as value,
  (
    case
      when jsonb_typeof(coalesce(d.team_b_order, '[]'::jsonb)) = 'array'
      then jsonb_array_length(coalesce(d.team_b_order, '[]'::jsonb))
      else 0
    end
  ) = 0 as ok
from public.team_tournament_dreambreaker_states d
join public.team_tournament_matchups m on m.id = d.matchup_id
where d.tournament_id = 'team-tournament-ikae8fpk'
  and m.external_matchup_id = 'matchup-1o9rud3t';

select
  'CURRENT_CAPTAIN_READER_RETURNS_DREAMBREAKER' as check_item,
  false as value,
  (
    select
      position('team_tournament_dreambreaker_states' in pg_get_functiondef(p.oid)) = 0
      and position('''ownOrder''' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_get_captain_portal'
      and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text, p_schema_version integer'
  ) as ok;

select
  'GRANTS_BASELINE_CAPTURED' as check_item,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_get_captain_portal(text,integer)',
    'EXECUTE'
  ) as auth_exec,
  has_function_privilege(
    'anon',
    'public.team_tournament_get_captain_portal(text,integer)',
    'EXECUTE'
  ) as anon_exec,
  true as ok;

select
  'no_data_mutation' as check_item,
  true as ok;
