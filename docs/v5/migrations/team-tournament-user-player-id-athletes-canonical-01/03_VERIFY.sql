-- team-tournament-user-player-id-athletes-canonical-01 / 03_VERIFY
-- LOCAL ONLY. Do not apply without Owner GO.
-- Functional proofs use auth.uid() simulation via request.jwt.claim.sub.
-- Does not mutate fixture rows.

do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.team_tournament_user_player_id()'::regprocedure);

  if position('from public.athletes' in lower(v_def)) = 0 then
    raise exception 'VERIFY_FAIL: helper must read public.athletes';
  end if;

  if position('a.user_id = auth.uid()' in lower(v_def)) = 0 then
    raise exception 'VERIFY_FAIL: helper must resolve athletes.user_id = auth.uid()';
  end if;

  if position('p.player_id' in lower(v_def)) > 0
     or position('from public.profiles' in lower(v_def)) > 0 then
    raise exception 'VERIFY_FAIL: legacy profiles.player_id authority still present';
  end if;

  raise notice 'VERIFY_PASS: team_tournament_user_player_id definition athletes-canonical';
end $$;

-- Auth-simulated identity + authorization matrix (Owner TT412 seeds when present).
do $$
declare
  v_got text;
  v_expected text;
  v_profile_alias text;
  v_fixture text := '7d1fe5a0-f312-4e4e-9869-53eff9383c54';
  v_dash jsonb;
  v_portal json;
  v_assert json;
  v_header public.team_tournaments;
  v_team_id text;
  v_guard json;
  v_ref_uses_helper boolean;
begin
  -- M01 captain: resolves athletes.id (not empty).
  perform set_config('request.jwt.claim.sub', 'c412a001-7e57-4000-8000-000000000001', true);
  select a.id::text into v_expected
  from public.athletes a
  where a.user_id = 'c412a001-7e57-4000-8000-000000000001'::uuid
  order by a.updated_at desc nulls last, a.created_at desc nulls last
  limit 1;
  if v_expected is null then
    raise exception 'VERIFY_FAIL: M01 athlete fixture missing';
  end if;
  v_got := public.team_tournament_user_player_id();
  if v_got is distinct from v_expected then
    raise exception 'VERIFY_FAIL: M01 helper got % expected %', v_got, v_expected;
  end if;

  v_dash := public.team_tournament_get_dashboard(v_fixture);
  if coalesce((v_dash->>'ok')::boolean, false) is not true then
    raise exception 'VERIFY_FAIL: M01 dashboard not authorized (%)', v_dash->>'code';
  end if;

  select t.external_team_id into v_team_id
  from public.team_tournament_teams t
  join public.team_tournaments h on h.id = t.team_tournament_id
  where h.tournament_id = v_fixture
    and t.captain_player_id = v_expected
  limit 1;
  if v_team_id is null then
    raise exception 'VERIFY_FAIL: M01 captain team missing on fixture';
  end if;

  v_assert := public.team_tournament_assert_captain_portal_access(v_fixture, v_team_id);
  if coalesce((v_assert->>'ok')::boolean, false) is not true then
    raise exception 'VERIFY_FAIL: M01 captain portal assert failed (%)', v_assert->>'code';
  end if;

  v_portal := public.team_tournament_get_captain_portal(v_fixture, null);
  if v_portal is null then
    raise exception 'VERIFY_FAIL: M01 captain portal returned null';
  end if;

  select * into v_header
  from public.team_tournaments
  where tournament_id = v_fixture
  limit 1;
  v_guard := public.team_tournament_guard_captain_portal_write(v_header, v_team_id);
  if coalesce((v_guard->>'ok')::boolean, false) is not true then
    raise exception 'VERIFY_FAIL: M01 save/submit guard not authorized (%)', v_guard->>'code';
  end if;

  -- M04 captain: resolves athletes.id.
  perform set_config('request.jwt.claim.sub', 'c412a001-7e57-4000-8000-000000000004', true);
  select a.id::text into v_expected
  from public.athletes a
  where a.user_id = 'c412a001-7e57-4000-8000-000000000004'::uuid
  order by a.updated_at desc nulls last, a.created_at desc nulls last
  limit 1;
  if v_expected is null then
    raise exception 'VERIFY_FAIL: M04 athlete fixture missing';
  end if;
  v_got := public.team_tournament_user_player_id();
  if v_got is distinct from v_expected then
    raise exception 'VERIFY_FAIL: M04 helper got % expected %', v_got, v_expected;
  end if;

  v_dash := public.team_tournament_get_dashboard(v_fixture);
  if coalesce((v_dash->>'ok')::boolean, false) is not true then
    raise exception 'VERIFY_FAIL: M04 dashboard not authorized (%)', v_dash->>'code';
  end if;

  -- M05 ordinary athlete: profiles.player_id is legacy alias ≠ athletes.id.
  -- Helper must return athletes.id (canonical), never qa-tt412-seed-m05.
  perform set_config('request.jwt.claim.sub', 'c412a001-7e57-4000-8000-000000000005', true);
  select a.id::text into v_expected
  from public.athletes a
  where a.user_id = 'c412a001-7e57-4000-8000-000000000005'::uuid
  order by a.updated_at desc nulls last, a.created_at desc nulls last
  limit 1;
  select nullif(trim(p.player_id), '') into v_profile_alias
  from public.profiles p
  where p.id = 'c412a001-7e57-4000-8000-000000000005'::uuid;
  if v_expected is null then
    raise exception 'VERIFY_FAIL: M05 athlete fixture missing';
  end if;
  if v_profile_alias is not null and v_profile_alias = v_expected then
    raise exception 'VERIFY_FAIL: M05 fixture no longer diverges (need alias≠athlete proof)';
  end if;
  v_got := public.team_tournament_user_player_id();
  if v_got is distinct from v_expected then
    raise exception 'VERIFY_FAIL: M05 helper got % expected athlete % (alias was %)',
      v_got, v_expected, v_profile_alias;
  end if;
  if v_profile_alias is not null and v_got = v_profile_alias then
    raise exception 'VERIFY_FAIL: M05 still resolving profiles.player_id alias';
  end if;

  -- Unknown user / no athlete → fail closed empty string.
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000099', true);
  v_got := public.team_tournament_user_player_id();
  if nullif(trim(coalesce(v_got, '')), '') is not null then
    raise exception 'VERIFY_FAIL: unknown user must fail closed, got %', v_got;
  end if;

  -- Referee identity path must remain user_id-scoped (not helper) for assignments.
  select position('team_tournament_user_player_id' in
    pg_get_functiondef('public.team_tournament_list_my_referee_assignments(text)'::regprocedure)
  ) = 0 into v_ref_uses_helper;
  if not v_ref_uses_helper then
    raise exception 'VERIFY_FAIL: referee list must not depend on team_tournament_user_player_id';
  end if;

  -- Matchup participant helper still callable (inherits athletes-canonical via helper).
  if to_regprocedure('public.team_tournament_is_matchup_participant(uuid)') is null then
    raise exception 'VERIFY_FAIL: team_tournament_is_matchup_participant missing';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);

  raise notice 'VERIFY_PASS: team_tournament_user_player_id functional athletes-canonical matrix';
end $$;

select
  'helper_grants' as check_name,
  has_function_privilege('authenticated', 'public.team_tournament_user_player_id()', 'execute') as authenticated_execute,
  not has_function_privilege('anon', 'public.team_tournament_user_player_id()', 'execute') as anon_denied;
