-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-dreambreaker-referee-start-canonical-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-REFEREE-START-CANONICAL-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only inventory. No Dreambreaker start. No data mutation.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_count int;
  v_def text;
  v_status text;
  v_version int;
  v_a int;
  v_b int;
  v_disc int;
begin
  select count(*)::int into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_start_dreambreaker';

  if v_count <> 1 then
    raise exception 'PRECHECK_FAIL: START_RPC_OVERLOAD_COUNT_BEFORE expected 1, found %', v_count;
  end if;

  if to_regprocedure(
    'public.team_tournament_start_dreambreaker(text,text,integer,text)'
  ) is null then
    raise exception 'PRECHECK_FAIL: START_RPC_SIGNATURE_MATCH expected YES';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_start_dreambreaker'
    and pg_get_function_identity_arguments(p.oid) =
      'p_tournament_id text, p_matchup_id text, p_expected_version integer, p_idempotency_key text';

  if v_def is null then
    raise exception 'PRECHECK_FAIL: cannot load start Dreambreaker definition';
  end if;

  if position('security definer' in lower(v_def)) = 0 then
    raise exception 'PRECHECK_FAIL: expected SECURITY DEFINER';
  end if;

  if position('activation_rule,'')) = ''dreambreaker''' in v_def) = 0
     and position('activation_rule,'''') = ''dreambreaker''' in v_def) = 0
     and position('= ''dreambreaker''' in v_def) = 0 then
    raise exception 'PRECHECK_FAIL: CURRENT_DREAMBREAKER_MATCHER expected present';
  end if;

  if position('tie_at_2_2' in v_def) > 0 then
    raise exception 'PRECHECK_FAIL: CURRENT_TIE_AT_2_2_MATCHER expected missing';
  end if;

  if position('Thiếu nội dung Dreambreaker.' in v_def) = 0 then
    raise exception 'PRECHECK_FAIL: CURRENT_MISSING_CONTENT_ERROR expected YES';
  end if;

  if position('team_tournament_version_conflict' in v_def) = 0 then
    raise exception 'PRECHECK_FAIL: CURRENT_CAS_BEHAVIOR expected present';
  end if;

  if position('p_team_a_order' in v_def) > 0 or position('p_team_b_order' in v_def) > 0 then
    raise exception 'PRECHECK_FAIL: start RPC must not take client order payload';
  end if;

  select db.status, db.version,
    case when jsonb_typeof(coalesce(db.team_a_order, '[]'::jsonb)) = 'array'
      then jsonb_array_length(coalesce(db.team_a_order, '[]'::jsonb)) else 0 end,
    case when jsonb_typeof(coalesce(db.team_b_order, '[]'::jsonb)) = 'array'
      then jsonb_array_length(coalesce(db.team_b_order, '[]'::jsonb)) else 0 end
  into v_status, v_version, v_a, v_b
  from public.team_tournament_dreambreaker_states db
  join public.team_tournament_matchups m on m.id = db.matchup_id
  join public.team_tournaments t on t.id = m.team_tournament_id
  where t.tournament_id = 'team-tournament-4zllu71z'
    and m.external_matchup_id = 'matchup-ilj0220c';

  if v_status is null then
    raise exception 'PRECHECK_FAIL: READY fixture team-tournament-4zllu71z / matchup-ilj0220c not found';
  end if;
  if v_status <> 'ready' then
    raise exception 'PRECHECK_FAIL: READY fixture status expected ready, found %', v_status;
  end if;
  if v_a <> 4 or v_b <> 4 then
    raise exception 'PRECHECK_FAIL: READY fixture orders expected 4/4, found %/%', v_a, v_b;
  end if;

  select count(*)::int into v_disc
  from public.team_tournament_disciplines d
  join public.team_tournaments t on t.id = d.team_tournament_id
  where t.tournament_id = 'team-tournament-4zllu71z'
    and (
      lower(coalesce(d.discipline_kind, '')) = 'dreambreaker'
      or lower(coalesce(d.activation_rule, '')) in ('tie_at_2_2', 'dreambreaker')
      or lower(coalesce(d.name, '')) like '%dreambreaker%'
      or lower(coalesce(d.external_discipline_id, '')) like '%dreambreaker%'
    );

  if v_disc <> 0 then
    raise exception 'PRECHECK_FAIL: CURRENT_DISCIPLINE_ROW_ABSENT expected YES, found %', v_disc;
  end if;

  raise notice 'PRECHECK_OK: unique start RPC; no tie_at_2_2 matcher; READY 4/4; no catalog row; zero mutation';
end $$;

select
  'START_RPC_OVERLOAD_COUNT_BEFORE' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_start_dreambreaker'
  ) as value,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_start_dreambreaker'
  ) = 1 as ok;

select
  'START_RPC_SIGNATURE_MATCH' as check_item,
  to_regprocedure(
    'public.team_tournament_start_dreambreaker(text,text,integer,text)'
  ) is not null as ok;

select
  'CURRENT_TIE_AT_2_2_MATCHER_MISSING' as check_item,
  (
    select position('tie_at_2_2' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_start_dreambreaker'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'CURRENT_MISSING_CONTENT_ERROR' as check_item,
  (
    select position('Thiếu nội dung Dreambreaker.' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_start_dreambreaker'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'READY_FIXTURE_STATE' as check_item,
  db.status as dreambreaker_status,
  db.version as dreambreaker_version,
  jsonb_array_length(coalesce(db.team_a_order, '[]'::jsonb)) as team_a_order_count,
  jsonb_array_length(coalesce(db.team_b_order, '[]'::jsonb)) as team_b_order_count,
  db.status = 'ready'
    and jsonb_array_length(coalesce(db.team_a_order, '[]'::jsonb)) = 4
    and jsonb_array_length(coalesce(db.team_b_order, '[]'::jsonb)) = 4 as ok
from public.team_tournament_dreambreaker_states db
join public.team_tournament_matchups m on m.id = db.matchup_id
join public.team_tournaments t on t.id = m.team_tournament_id
where t.tournament_id = 'team-tournament-4zllu71z'
  and m.external_matchup_id = 'matchup-ilj0220c';

select
  'CURRENT_DISCIPLINE_ROW_ABSENT' as check_item,
  (
    select count(*)::int
    from public.team_tournament_disciplines d
    join public.team_tournaments t on t.id = d.team_tournament_id
    where t.tournament_id = 'team-tournament-4zllu71z'
      and (
        lower(coalesce(d.discipline_kind, '')) = 'dreambreaker'
        or lower(coalesce(d.activation_rule, '')) in ('tie_at_2_2', 'dreambreaker')
        or lower(coalesce(d.name, '')) like '%dreambreaker%'
        or lower(coalesce(d.external_discipline_id, '')) like '%dreambreaker%'
      )
  ) = 0 as ok;

select
  'GRANTS_BASELINE_CAPTURED' as check_item,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_start_dreambreaker(text,text,integer,text)',
    'EXECUTE'
  ) as auth_exec,
  has_function_privilege(
    'anon',
    'public.team_tournament_start_dreambreaker(text,text,integer,text)',
    'EXECUTE'
  ) as anon_exec,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_start_dreambreaker(text,text,integer,text)',
    'EXECUTE'
  ) as ok;

select
  'no_data_mutation' as check_item,
  true as ok;
