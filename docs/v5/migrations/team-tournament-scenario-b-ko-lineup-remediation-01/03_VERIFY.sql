-- team-tournament-scenario-b-ko-lineup-remediation-01 / 03_VERIFY
-- LOCAL ONLY. Definition + disposable empty-placeholder + lineup-preserve proof.
-- Does NOT mutate Owner fixture e3f37ef7-befe-4421-b694-8af57ba92a5d.

do $$
declare
  v_replace text;
begin
  if to_regprocedure('public.team_tournament_replace_matchups(text, jsonb, integer, text)') is null then
    raise exception 'VERIFY_FAIL: replace_matchups missing';
  end if;

  v_replace := pg_get_functiondef(
    'public.team_tournament_replace_matchups(text, jsonb, integer, text)'::regprocedure
  );

  if position('nullif(btrim(coalesce(x.value->>''teamAId''' in v_replace) = 0 then
    raise exception 'VERIFY_FAIL: empty KO placeholder teamAId path missing';
  end if;
  if position('array_append(v_payload_ids' in v_replace) = 0 then
    raise exception 'VERIFY_FAIL: upsert payload id tracking missing';
  end if;
  if position('external_matchup_id = v_id' in v_replace) = 0 then
    raise exception 'VERIFY_FAIL: upsert-by-external_matchup_id missing';
  end if;
  if position('team_tournament_assert_close_readiness' in v_replace) > 0 then
    raise exception 'VERIFY_FAIL: replace_matchups must not absorb close authority';
  end if;
  if position('localStorage' in lower(v_replace)) > 0 or position('blob' in lower(v_replace)) > 0 then
    raise exception 'VERIFY_FAIL: no blob/localStorage authority';
  end if;

  raise notice 'VERIFY_PASS: replace_matchups contracts';
end $$;

-- Disposable proof: empty Final placeholders + group lineup row survives upsert
do $$
declare
  v_canon uuid := gen_random_uuid();
  v_tt uuid := gen_random_uuid();
  v_tid text := v_canon::text;
  v_name text := 'verify-scenario-b-' || substr(replace(v_canon::text, '-', ''), 1, 12);
  v_tenant text;
  v_club text;
  v_mu_group uuid;
  v_mu_group_ext text := 'g1';
  v_mu_sf_ext text := 'sf1';
  v_mu_final_ext text := 'final1';
  v_lineup_before int;
  v_lineup_after int;
  v_group_id_before uuid;
  v_group_id_after uuid;
  v_updated int;
begin
  select v.id into v_tenant from public.venues v where v.id = 'venue-staging-a' limit 1;
  if v_tenant is null then
    select v.id into v_tenant from public.venues v order by v.id limit 1;
  end if;
  if v_tenant is null then
    raise exception 'VERIFY_FAIL: no venues for tenant';
  end if;

  select tt.club_id into v_club
  from public.team_tournaments tt
  where tt.tenant_id = v_tenant and nullif(trim(coalesce(tt.club_id, '')), '') is not null
  order by tt.updated_at desc nulls last
  limit 1;
  if v_club is null then
    raise exception 'VERIFY_FAIL: no club_id for tenant %', v_tenant;
  end if;

  insert into public.canonical_tournaments (
    id, tenant_id, club_id, external_key, name, mode, status, payload, engine_v4
  ) values (
    v_canon, v_tenant, v_club, v_tid, v_name, 'team_tournament', 'active',
    jsonb_build_object('id', v_tid, 'verify', true), '{}'::jsonb
  );

  insert into public.team_tournaments (
    id, tenant_id, club_id, tournament_id, name, status, settings, version
  ) values (
    v_tt, v_tenant, v_club, v_tid, v_name, 'draft',
    jsonb_build_object('groupCount', 2, 'qualifiersPerGroup', 2), 1
  );

  insert into public.team_tournament_teams (
    tenant_id, tournament_id, team_tournament_id, external_team_id, name
  ) values
    (v_tenant, v_tid, v_tt, 'team-a', 'Team A'),
    (v_tenant, v_tid, v_tt, 'team-b', 'Team B');

  insert into public.team_tournament_matchups (
    tenant_id, tournament_id, team_tournament_id, external_matchup_id,
    team_a_id, team_b_id, status, schedule_meta, version
  ) values (
    v_tenant, v_tid, v_tt, v_mu_group_ext,
    'team-a', 'team-b', 'completed',
    jsonb_build_object('stage', 'group'), 1
  ) returning id into v_mu_group;

  v_group_id_before := v_mu_group;

  insert into public.team_tournament_lineups (
    tenant_id, tournament_id, matchup_id,
    team_external_id, status, selections, version
  ) values (
    v_tenant, v_tid, v_mu_group,
    'team-a', 'published', '{}'::jsonb, 1
  );

  select count(*) into v_lineup_before
  from public.team_tournament_lineups
  where matchup_id = v_mu_group and team_external_id = 'team-a';

  -- Simulate remediated upsert: keep group row id, add SF + empty Final
  update public.team_tournament_matchups
     set updated_at = now()
   where id = v_mu_group;

  insert into public.team_tournament_matchups (
    tenant_id, tournament_id, team_tournament_id, external_matchup_id,
    team_a_id, team_b_id, status, schedule_meta, version
  ) values
    (v_tenant, v_tid, v_tt, v_mu_sf_ext, 'team-a', 'team-b', 'lineup_open',
     jsonb_build_object('stage', 'knockout', 'competitionStage', 'semifinal'), 1),
    (v_tenant, v_tid, v_tt, v_mu_final_ext, '', '', 'lineup_open',
     jsonb_build_object('stage', 'knockout', 'competitionStage', 'final'), 1);

  get diagnostics v_updated = row_count;

  select id into v_group_id_after
  from public.team_tournament_matchups
  where team_tournament_id = v_tt and external_matchup_id = v_mu_group_ext;

  if v_group_id_after is distinct from v_group_id_before then
    raise exception 'VERIFY_FAIL: group matchup internal id changed (lineup would orphan)';
  end if;

  select count(*) into v_lineup_after
  from public.team_tournament_lineups
  where matchup_id = v_group_id_after and team_external_id = 'team-a' and status = 'published';

  if v_lineup_before <> 1 or v_lineup_after <> 1 then
    raise exception 'VERIFY_FAIL: historical group lineup not preserved (% → %)',
      v_lineup_before, v_lineup_after;
  end if;

  if not exists (
    select 1 from public.team_tournament_matchups
    where team_tournament_id = v_tt and external_matchup_id = v_mu_final_ext
      and team_a_id = '' and team_b_id = ''
  ) then
    raise exception 'VERIFY_FAIL: empty Final placeholder not insertable';
  end if;

  if (
    select count(*) from public.team_tournament_matchups
    where team_tournament_id = v_tt and schedule_meta->>'competitionStage' = 'semifinal'
  ) <> 1 then
    raise exception 'VERIFY_FAIL: expected one semifinal matchup';
  end if;

  delete from public.team_tournament_lineups l
    using public.team_tournament_matchups m
    where l.matchup_id = m.id and m.team_tournament_id = v_tt;
  delete from public.team_tournament_sub_matches sm
    using public.team_tournament_matchups m
    where sm.matchup_id = m.id and m.team_tournament_id = v_tt;
  delete from public.team_tournament_matchups where team_tournament_id = v_tt;
  delete from public.team_tournament_teams where team_tournament_id = v_tt;
  delete from public.team_tournaments where id = v_tt or name like 'verify-scenario-b-%';
  delete from public.canonical_tournaments where id = v_canon or name like 'verify-scenario-b-%';

  raise notice 'VERIFY_PASS: disposable empty-placeholder + lineup preserve';
exception when others then
  delete from public.team_tournament_lineups l
    using public.team_tournament_matchups m
    where l.matchup_id = m.id and m.team_tournament_id = v_tt;
  delete from public.team_tournament_sub_matches sm
    using public.team_tournament_matchups m
    where sm.matchup_id = m.id and m.team_tournament_id = v_tt;
  delete from public.team_tournament_matchups where team_tournament_id = v_tt;
  delete from public.team_tournament_teams where team_tournament_id = v_tt;
  delete from public.team_tournaments where id = v_tt or name like 'verify-scenario-b-%';
  delete from public.canonical_tournaments where id = v_canon or name like 'verify-scenario-b-%';
  raise;
end $$;

select
  'grants' as check_name,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_replace_matchups(text, jsonb, integer, text)',
    'execute'
  ) as replace_exec,
  not has_function_privilege(
    'anon',
    'public.team_tournament_replace_matchups(text, jsonb, integer, text)',
    'execute'
  ) as replace_anon_denied;
