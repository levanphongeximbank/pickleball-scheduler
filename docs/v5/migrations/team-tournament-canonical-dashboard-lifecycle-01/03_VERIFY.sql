-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-canonical-dashboard-lifecycle-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_missing text[] := '{}';
  v_create_src text;
  v_dash_src text;
  v_mine_src text;
begin
  if to_regprocedure('public.team_tournament_create(text,text,text,text,text,text,jsonb)') is null then
    v_missing := array_append(v_missing, 'team_tournament_create');
  end if;
  if to_regprocedure('public.team_tournament_ensure_canonical(text,text,text,text,text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_ensure_canonical');
  end if;
  if to_regprocedure('public.team_tournament_get_dashboard(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_get_dashboard');
  end if;
  if to_regprocedure('public.team_tournament_list_my_referee_assignments(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_list_my_referee_assignments');
  end if;
  if to_regprocedure('public.team_tournament_status_is_athlete_visible(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_status_is_athlete_visible');
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception 'VERIFY_FAIL: missing functions: %', array_to_string(v_missing, ', ');
  end if;

  select pg_get_functiondef(p.oid) into v_create_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'team_tournament_create'
  limit 1;

  if v_create_src is null or v_create_src not like '%team_tournament%' or v_create_src not like '%draft%' then
    raise exception 'VERIFY_FAIL: team_tournament_create must persist draft on both tables';
  end if;
  if v_create_src not like '%canonical_tournaments%' then
    raise exception 'VERIFY_FAIL: team_tournament_create must write canonical_tournaments';
  end if;
  if v_create_src ilike '%on conflict%' or v_create_src ilike '%do update%' then
    raise exception 'VERIFY_FAIL: team_tournament_create must not merge via ON CONFLICT';
  end if;
  if v_create_src not like '%idempotencyKey%' then
    raise exception 'VERIFY_FAIL: team_tournament_create must honor idempotencyKey';
  end if;

  select pg_get_functiondef(p.oid) into v_dash_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'team_tournament_get_dashboard'
  limit 1;

  if v_dash_src not like '%DRAFT_NOT_VISIBLE%' then
    raise exception 'VERIFY_FAIL: dashboard must hide draft from non-organizers';
  end if;
  if v_dash_src like '%opponentOrder%' or v_dash_src like '%team_a_order%' then
    raise exception 'VERIFY_FAIL: dashboard leaked private captain order fields';
  end if;
  if v_dash_src not like '%stageTieBreakPolicy%' then
    raise exception 'VERIFY_FAIL: dashboard must display stage tie-break policy';
  end if;
  if v_dash_src not like '%myTeamId%' then
    raise exception 'VERIFY_FAIL: dashboard must return server myTeamId';
  end if;
  if v_dash_src like '%team_a_order%' or v_dash_src like '%team_b_order%' then
    raise exception 'VERIFY_FAIL: dashboard leaked dreambreaker order columns';
  end if;
  if v_dash_src like '%t.player_ids%' then
    raise exception 'VERIFY_FAIL: dashboard must not read non-existent team_tournament_teams.player_ids';
  end if;

  select pg_get_functiondef(p.oid) into v_mine_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'canonical_tournament_list_mine'
  limit 1;
  if v_mine_src not like '%team_tournament_team_members%' then
    raise exception 'VERIFY_FAIL: list_mine must include team members';
  end if;
  if v_mine_src not like '%team_tournament_can_manage()%'
     or v_mine_src not like '%draft%' then
    raise exception 'VERIFY_FAIL: list_mine must hide draft from non-managers';
  end if;

  select pg_get_functiondef(p.oid) into v_create_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'canonical_tournament_list'
  limit 1;
  if v_create_src is null
     or v_create_src not like '%team_tournament_can_manage()%'
     or v_create_src not like '%draft%' then
    raise exception 'VERIFY_FAIL: canonical_tournament_list must hide draft from non-managers';
  end if;

  if not has_function_privilege('authenticated', 'public.team_tournament_create(text,text,text,text,text,text,jsonb)', 'execute') then
    raise exception 'VERIFY_FAIL: authenticated cannot execute team_tournament_create';
  end if;
  if has_function_privilege('anon', 'public.team_tournament_create(text,text,text,text,text,text,jsonb)', 'execute') then
    raise exception 'VERIFY_FAIL: anon must not execute team_tournament_create';
  end if;
  if has_function_privilege('anon', 'public.team_tournament_get_dashboard(text)', 'execute') then
    raise exception 'VERIFY_FAIL: anon must not execute team_tournament_get_dashboard';
  end if;

  raise notice 'VERIFY_OK: team-tournament-canonical-dashboard-lifecycle-01';
end $$;

select 'VERIFY_OK' as status;
