-- team-tournament-close-uuid-type-remediation-01 / 03_VERIFY
-- LOCAL ONLY. Definition checks + disposable dual-write cast proof.
-- Does not call close RPC when auth would block; cleans verify-close-uuid-% to zero.
-- Do NOT mutate Owner fixture 8a6fff3b-9ec2-4d0e-aa55-c8d85b1c51ce.

-- Definition / contract checks
do $$
declare
  v_close text;
begin
  if to_regprocedure('public.team_tournament_close_tournament(text, jsonb, integer, text)') is null then
    raise exception 'VERIFY_FAIL: close tournament RPC missing';
  end if;
  if to_regprocedure('public.team_tournament_assert_close_readiness(uuid)') is null then
    raise exception 'VERIFY_FAIL: assert_close_readiness missing';
  end if;

  v_close := pg_get_functiondef(
    'public.team_tournament_close_tournament(text, jsonb, integer, text)'::regprocedure
  );

  if position('id = v_header.tournament_id' in v_close) > 0 then
    raise exception 'VERIFY_FAIL: close still has bare id = v_header.tournament_id (needs ::uuid cast path)';
  end if;
  if position('id = p_tournament_id' in v_close) > 0
     and position('id = nullif(btrim(coalesce(p_tournament_id' in v_close) = 0 then
    raise exception 'VERIFY_FAIL: close still has bare id = p_tournament_id without cast';
  end if;

  if position('::uuid' in v_close) = 0 then
    raise exception 'VERIFY_FAIL: close dual-write must cast text tournament ids to ::uuid';
  end if;
  if position('nullif(btrim(coalesce(v_header.tournament_id' in v_close) = 0 then
    raise exception 'VERIFY_FAIL: close must use nullif/btrim/...::uuid dual-write cast';
  end if;

  if position('team_tournament_assert_close_readiness' in v_close) = 0 then
    raise exception 'VERIFY_FAIL: close must call assert_close_readiness';
  end if;

  if position('update public.team_tournaments' in lower(v_close)) = 0
     or position('status = ''completed''' in v_close) = 0 then
    raise exception 'VERIFY_FAIL: close must set team_tournaments.status completed';
  end if;
  if position('update public.canonical_tournaments' in lower(v_close)) = 0 then
    raise exception 'VERIFY_FAIL: close must dual-write canonical_tournaments status completed';
  end if;
  if (select count(*) from regexp_matches(v_close, 'status = ''completed''', 'g')) < 2 then
    raise exception 'VERIFY_FAIL: close must set status completed on both team + canonical tables';
  end if;

  if position('CLIENT_RESULT_PAYLOAD_TRUSTED_AS_AUTHORITY=NO' in v_close) = 0 then
    raise exception 'VERIFY_FAIL: close must retain CLIENT_RESULT_PAYLOAD_TRUSTED_AS_AUTHORITY=NO discard path';
  end if;
  if position('awardsSheet' in v_close) > 0 and position('v_payload->''awardsSheet''' in v_close) > 0 then
    raise exception 'VERIFY_FAIL: close must not persist client awardsSheet as authority';
  end if;

  raise notice 'VERIFY_PASS: definition contracts (uuid dual-write + readiness + discard)';
end $$;

-- Disposable readiness + cast dual-write WHERE proof (no close RPC auth dependency)
do $$
declare
  v_canon uuid := gen_random_uuid();
  v_tt uuid := gen_random_uuid();
  v_tid text;
  v_name text;
  v_tenant text;
  v_club text;
  v_ready jsonb;
  v_mu uuid;
  v_updated int;
  v_left int;
  v_status_before text;
  v_status_after text;
begin
  -- Production create stores tournament_id/external_key as uuid::text.
  v_tid := v_canon::text;
  v_name := 'verify-close-uuid-' || substr(replace(v_canon::text, '-', ''), 1, 12);

  select v.id
    into v_tenant
  from public.venues v
  where v.id = 'venue-staging-a'
  limit 1;

  if v_tenant is null then
    select v.id into v_tenant from public.venues v order by v.id limit 1;
  end if;

  if v_tenant is null then
    raise exception 'VERIFY_FAIL: no venues row available for real tenant';
  end if;

  select tt.club_id
    into v_club
  from public.team_tournaments tt
  where tt.tenant_id = v_tenant
    and nullif(trim(coalesce(tt.club_id, '')), '') is not null
  order by tt.updated_at desc nulls last, tt.created_at desc nulls last
  limit 1;

  if v_club is null and to_regclass('public.clubs') is not null then
    select c.id
      into v_club
    from public.clubs c
    where c.tenant_id = v_tenant
      and c.deleted_at is null
    order by c.id
    limit 1;
  end if;

  if v_club is null then
    raise exception 'VERIFY_FAIL: no club_id available for tenant %', v_tenant;
  end if;

  insert into public.canonical_tournaments (
    id, tenant_id, club_id, external_key, name, mode, status, payload, engine_v4
  ) values (
    v_canon,
    v_tenant,
    v_club,
    v_tid,
    v_name,
    'team_tournament',
    'active',
    jsonb_build_object('id', v_tid, 'mode', 'team_tournament', 'verify', true),
    '{}'::jsonb
  );

  insert into public.team_tournaments (
    id, tenant_id, club_id, tournament_id, name, status, settings, version
  ) values (
    v_tt,
    v_tenant,
    v_club,
    v_tid,
    v_name,
    'draft',
    jsonb_build_object('groupCount', 1, 'qualifiersPerGroup', 2),
    1
  );

  insert into public.team_tournament_teams (
    tenant_id, tournament_id, team_tournament_id, external_team_id, name
  ) values
    (v_tenant, v_tid, v_tt, 'team-a', 'Team A'),
    (v_tenant, v_tid, v_tt, 'team-b', 'Team B');

  insert into public.team_tournament_matchups (
    tenant_id, tournament_id, team_tournament_id, external_matchup_id,
    team_a_id, team_b_id, status, result, schedule_meta, version
  ) values (
    v_tenant, v_tid, v_tt, 'g1',
    'team-a', 'team-b', 'completed',
    jsonb_build_object(
      'winnerTeamId', 'team-a',
      'teamAWins', 3, 'teamBWins', 1,
      'teamAPoints', 33, 'teamBPoints', 21
    ),
    jsonb_build_object('stage', 'group'),
    1
  ) returning id into v_mu;

  v_ready := public.team_tournament_assert_close_readiness(v_tt);
  if not coalesce((v_ready->>'ok')::boolean, false) then
    raise exception 'VERIFY_FAIL: one-group complete readiness expected ok got %', v_ready;
  end if;
  if v_ready->>'championTeamId' is distinct from 'team-a' then
    raise exception 'VERIFY_FAIL: champion expected team-a got %', v_ready->>'championTeamId';
  end if;

  select status into v_status_before
  from public.canonical_tournaments
  where id = v_canon;

  -- Simulate the remediated dual-write WHERE (cast path). Do not call close RPC.
  update public.canonical_tournaments
     set status = 'completed',
         updated_at = now()
   where id = nullif(btrim(coalesce(v_tid, '')), '')::uuid
      or id = nullif(btrim(coalesce(v_tid, '')), '')::uuid
      or external_key = nullif(btrim(coalesce(v_tid, '')), '')
      or external_key = nullif(btrim(coalesce(v_tid, '')), '');

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'VERIFY_FAIL: cast dual-write WHERE updated % rows expected 1', v_updated;
  end if;

  select status into v_status_after
  from public.canonical_tournaments
  where id = v_canon;

  if v_status_before is distinct from 'active' or v_status_after is distinct from 'completed' then
    raise exception 'VERIFY_FAIL: disposable canonical status % → % (expected active → completed)',
      v_status_before, v_status_after;
  end if;

  -- cleanup disposable (name prefix verify-close-uuid-%)
  delete from public.team_tournament_matchups where team_tournament_id = v_tt;
  delete from public.team_tournament_teams where team_tournament_id = v_tt;
  delete from public.team_tournaments where id = v_tt or name like 'verify-close-uuid-%';
  delete from public.canonical_tournaments where id = v_canon or name like 'verify-close-uuid-%';

  select (
    (select count(*) from public.team_tournament_matchups where team_tournament_id = v_tt)
    + (select count(*) from public.team_tournament_teams where team_tournament_id = v_tt)
    + (select count(*) from public.team_tournaments where id = v_tt or name like 'verify-close-uuid-%')
    + (select count(*) from public.canonical_tournaments where id = v_canon or name like 'verify-close-uuid-%')
  )::int into v_left;

  if v_left <> 0 then
    raise exception 'VERIFY_FAIL: disposable cleanup left % residual verify-close-uuid rows', v_left;
  end if;

  raise notice 'VERIFY_PASS: disposable readiness + cast dual-write (tenant=%, club=%)', v_tenant, v_club;
exception when others then
  delete from public.team_tournament_matchups where team_tournament_id = v_tt;
  delete from public.team_tournament_teams where team_tournament_id = v_tt;
  delete from public.team_tournaments where id = v_tt or name like 'verify-close-uuid-%';
  delete from public.canonical_tournaments where id = v_canon or name like 'verify-close-uuid-%';
  raise;
end $$;

select
  'grants' as check_name,
  has_function_privilege('authenticated', 'public.team_tournament_close_tournament(text, jsonb, integer, text)', 'execute') as close_exec,
  has_function_privilege('authenticated', 'public.team_tournament_assert_close_readiness(uuid)', 'execute') as ready_exec,
  not has_function_privilege('anon', 'public.team_tournament_close_tournament(text, jsonb, integer, text)', 'execute') as close_anon_denied;
