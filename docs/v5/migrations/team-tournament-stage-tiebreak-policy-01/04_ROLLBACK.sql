-- ═══════════════════════════════════════════════════════════════════
-- 04_ROLLBACK.sql
-- Package: team-tournament-stage-tiebreak-policy-01
-- Restores prior update_setup_config + recompute/maybe_activate.
-- Leaves settings.stageTieBreakPolicy JSON keys in place (harmless).
-- DO NOT APPLY without Owner GO.
-- ═══════════════════════════════════════════════════════════════════

drop function if exists public.team_tournament_resolve_competition_stage(public.team_tournament_matchups);
drop function if exists public.team_tournament_resolve_stage_tiebreak_policy(public.team_tournaments, public.team_tournament_matchups);
drop function if exists public.team_tournament_stage_tiebreak_locked_stages(uuid);

-- 2) Merge Format & Venue + Group config into settings JSONB (whitelist only).
create or replace function public.team_tournament_update_setup_config(
  p_tournament_id text,
  p_envelope jsonb,
  p_expected_version integer default null,
  p_idempotency_key text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prepare json;
  v_header public.team_tournaments;
  v_envelope jsonb;
  v_payload jsonb;
  v_patch jsonb := '{}'::jsonb;
  v_new_version integer;
  v_roster jsonb;
  v_courts jsonb;
begin
  v_prepare := public.team_tournament_setup_mutation_prepare(
    p_tournament_id, p_envelope, 'tournament.update_setup_config',
    p_expected_version, p_idempotency_key);
  if not coalesce((v_prepare->>'ok')::boolean, false) then
    return v_prepare;
  end if;
  if coalesce((v_prepare->>'replay')::boolean, false) then
    return (
      coalesce((v_prepare->'result')::jsonb, jsonb_build_object('ok', true))
      || jsonb_build_object('replayed', true, 'replay', true)
    )::json;
  end if;

  select * into v_header
  from jsonb_populate_record(null::public.team_tournaments, (v_prepare->'header')::jsonb);
  v_envelope := v_prepare->'envelope';
  v_payload := coalesce(v_envelope->'payload', '{}'::jsonb);

  if v_payload ? 'formatPreset' then
    v_patch := v_patch || jsonb_build_object('formatPreset', v_payload->'formatPreset');
  end if;
  if v_payload ? 'dreambreakerEnabled' then
    v_patch := v_patch || jsonb_build_object('dreambreakerEnabled', v_payload->'dreambreakerEnabled');
  end if;
  if v_payload ? 'groupMode' then
    v_patch := v_patch || jsonb_build_object('groupMode', v_payload->'groupMode');
  end if;
  if v_payload ? 'groupCount' then
    v_patch := v_patch || jsonb_build_object('groupCount', v_payload->'groupCount');
  end if;
  if v_payload ? 'qualificationCount' then
    v_patch := v_patch || jsonb_build_object('qualificationCount', v_payload->'qualificationCount');
  end if;
  if v_payload ? 'knockoutFormat' then
    v_patch := v_patch || jsonb_build_object('knockoutFormat', v_payload->'knockoutFormat');
  end if;
  if v_payload ? 'teamsPerGroup' then
    v_patch := v_patch || jsonb_build_object('teamsPerGroup', v_payload->'teamsPerGroup');
  end if;
  if v_payload ? 'rosterRules' then
    v_roster := coalesce(v_payload->'rosterRules', '{}'::jsonb);
    v_patch := v_patch || jsonb_build_object('rosterRules', v_roster);
  end if;
  if v_payload ? 'selectedCourtIds' then
    v_courts := coalesce(v_payload->'selectedCourtIds', '[]'::jsonb);
    v_patch := v_patch || jsonb_build_object('selectedCourtIds', v_courts);
  end if;

  if v_patch = '{}'::jsonb then
    return jsonb_build_object(
      'ok', false,
      'code', 'EMPTY_SETUP_CONFIG',
      'error', 'No whitelisted Format/Venue/Group settings keys in payload'
    )::json;
  end if;

  update public.team_tournaments
     set settings = coalesce(settings, '{}'::jsonb) || v_patch,
         updated_at = now(),
         updated_by = auth.uid()
   where id = v_header.id;

  v_new_version := public.team_tournament_setup_mutation_bump_version(v_header.id, v_header.version);

  return public.team_tournament_setup_mutation_finalize(
    v_header.tenant_id, p_tournament_id, v_header.id, v_new_version,
    v_envelope, v_prepare->>'payload_hash', v_prepare->>'command_payload_hash',
    public.team_tournament_setup_norm_projection(v_header.id, p_tournament_id, v_new_version),
    (v_prepare->>'actor_id')::uuid);
end;
$$;

revoke all on function public.team_tournament_update_setup_config(text, jsonb, integer, text)
  from public, anon;
grant execute on function public.team_tournament_update_setup_config(text, jsonb, integer, text)
  to authenticated;

-- Restore pre-policy recompute + maybe_activate

-- â”€â”€â”€ Recompute: main disciplines only; never complete without winner â”€
create or replace function public.team_tournament_recompute_matchup_result(
  p_matchup_id uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_matchup public.team_tournament_matchups;
  v_header public.team_tournaments;
  v_team_a_wins int := 0;
  v_team_b_wins int := 0;
  v_team_a_points int := 0;
  v_team_b_points int := 0;
  v_winner text := null;
  v_all_main_finalized boolean := true;
  v_main_total int := 0;
  v_main_finalized int := 0;
  v_needs_db boolean := false;
  v_db_enabled boolean := true;
begin
  select * into v_matchup from public.team_tournament_matchups where id = p_matchup_id;
  if v_matchup.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_header
  from public.team_tournaments t
  where t.id = v_matchup.team_tournament_id;

  v_db_enabled := coalesce((v_header.settings->>'dreambreakerEnabled')::boolean, true);

  select
    count(*) filter (
      where sm.status in ('completed', 'forfeit') and sm.winner_team_id = v_matchup.team_a_id
    ),
    count(*) filter (
      where sm.status in ('completed', 'forfeit') and sm.winner_team_id = v_matchup.team_b_id
    ),
    coalesce(sum((sm.score->>'teamA')::int) filter (where sm.status in ('completed', 'forfeit')), 0),
    coalesce(sum((sm.score->>'teamB')::int) filter (where sm.status in ('completed', 'forfeit')), 0),
    count(*),
    count(*) filter (where sm.status in ('completed', 'forfeit'))
  into v_team_a_wins, v_team_b_wins, v_team_a_points, v_team_b_points, v_main_total, v_main_finalized
  from public.team_tournament_sub_matches sm
  left join public.team_tournament_disciplines d
    on d.team_tournament_id = v_matchup.team_tournament_id
   and d.external_discipline_id = sm.discipline_external_id
  where sm.matchup_id = p_matchup_id
    and coalesce(lower(d.name), '') not like '%dreambreaker%'
    and coalesce(lower(d.external_discipline_id), '') not like '%dreambreaker%'
    and coalesce(lower(d.discipline_kind), '') not like '%dreambreaker%'
    and coalesce(lower(d.activation_rule), '') <> 'dreambreaker'
    and not exists (
      select 1
      from public.team_tournament_dreambreaker_states db
      where db.matchup_id = p_matchup_id
        and nullif(trim(coalesce(db.sub_match_external_id, '')), '') = sm.external_sub_match_id
    );

  v_all_main_finalized := v_main_total > 0 and v_main_finalized = v_main_total;

  v_needs_db :=
    v_db_enabled
    and v_all_main_finalized
    and v_team_a_wins = 2
    and v_team_b_wins = 2;

  if not v_needs_db then
    if v_team_a_wins > v_team_b_wins then
      v_winner := v_matchup.team_a_id;
    elsif v_team_b_wins > v_team_a_wins then
      v_winner := v_matchup.team_b_id;
    end if;
  end if;

  -- Dreambreaker sub-match winner overrides when completed
  if exists (
    select 1
    from public.team_tournament_dreambreaker_states db
    join public.team_tournament_sub_matches sm
      on sm.matchup_id = db.matchup_id
     and sm.external_sub_match_id = db.sub_match_external_id
    where db.matchup_id = p_matchup_id
      and db.status = 'completed'
      and nullif(trim(coalesce(db.winner_team_id, '')), '') is not null
  ) then
    select db.winner_team_id into v_winner
    from public.team_tournament_dreambreaker_states db
    where db.matchup_id = p_matchup_id;
    v_needs_db := false;
  end if;

  update public.team_tournament_matchups set
    result = jsonb_build_object(
      'teamAWins', v_team_a_wins,
      'teamBWins', v_team_b_wins,
      'teamAPoints', v_team_a_points,
      'teamBPoints', v_team_b_points,
      'winnerTeamId', v_winner,
      'needsDreambreaker', v_needs_db
    ),
    status = case
      when v_winner is not null and (v_all_main_finalized or not v_needs_db)
           and not v_needs_db
        then 'completed'
      when status = 'published' then 'in_progress'
      when v_needs_db then 'in_progress'
      else status
    end,
    standings_recalc_required = true,
    updated_at = now()
  where id = p_matchup_id;

  return jsonb_build_object(
    'ok', true,
    'teamAWins', v_team_a_wins,
    'teamBWins', v_team_b_wins,
    'teamAPoints', v_team_a_points,
    'teamBPoints', v_team_b_points,
    'winnerTeamId', v_winner,
    'needsDreambreaker', v_needs_db,
    'matchupCompleted', v_winner is not null and not v_needs_db and v_all_main_finalized
  );
end;
$$;

-- â”€â”€â”€ Durable Dreambreaker activation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create or replace function public.team_tournament_maybe_activate_dreambreaker(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_existing public.team_tournament_dreambreaker_states;
  v_lock_at timestamptz;
  v_enabled boolean := true;
begin
  if p_header.id is null or p_matchup.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'activated', false);
  end if;

  v_enabled := coalesce((p_header.settings->>'dreambreakerEnabled')::boolean, true);
  if not v_enabled then
    return jsonb_build_object('ok', true, 'activated', false, 'code', 'DISABLED');
  end if;

  v_result := public.team_tournament_recompute_matchup_result(p_matchup.id);
  if not coalesce((v_result->>'needsDreambreaker')::boolean, false) then
    return jsonb_build_object(
      'ok', true,
      'activated', false,
      'matchupId', p_matchup.external_matchup_id,
      'matchupResult', v_result
    );
  end if;

  select * into v_existing
  from public.team_tournament_dreambreaker_states
  where matchup_id = p_matchup.id;

  if v_existing.id is not null then
    update public.team_tournament_matchups set
      status = 'in_progress',
      result = (result - 'winnerTeamId') || jsonb_build_object('winnerTeamId', null, 'needsDreambreaker', true),
      updated_at = now()
    where id = p_matchup.id;

    return jsonb_build_object(
      'ok', true,
      'activated', false,
      'alreadyActive', true,
      'code', 'DREAMBREAKER_REQUIRED',
      'status', v_existing.status,
      'matchupId', p_matchup.external_matchup_id,
      'version', v_existing.version,
      'matchupResult', v_result
    );
  end if;

  v_lock_at := now() + interval '10 minutes';

  insert into public.team_tournament_dreambreaker_states (
    tenant_id, tournament_id, matchup_id, status,
    team_a_order, team_b_order, team_a_score, team_b_score,
    order_lock_at, rotation, version, updated_by
  ) values (
    p_header.tenant_id, p_header.tournament_id, p_matchup.id, 'lineup_open',
    '[]'::jsonb, '[]'::jsonb, 0, 0,
    v_lock_at,
    jsonb_build_object('segmentIndex', 0, 'pointsInSegment', 0, 'pointHistory', '[]'::jsonb, 'injurySkips', '[]'::jsonb),
    1,
    auth.uid()
  )
  returning * into v_existing;

  update public.team_tournament_matchups set
    status = 'in_progress',
    result = jsonb_build_object(
      'teamAWins', (v_result->>'teamAWins')::int,
      'teamBWins', (v_result->>'teamBWins')::int,
      'teamAPoints', (v_result->>'teamAPoints')::int,
      'teamBPoints', (v_result->>'teamBPoints')::int,
      'winnerTeamId', null,
      'needsDreambreaker', true
    ),
    updated_at = now(),
    updated_by = auth.uid()
  where id = p_matchup.id;

  perform public.team_tournament_write_audit(
    p_header.tenant_id, p_header.tournament_id,
    'team.match.dreambreaker.activate', p_matchup.external_matchup_id,
    jsonb_build_object('status', 'lineup_open', 'code', 'DREAMBREAKER_REQUIRED')
  );

  return jsonb_build_object(
    'ok', true,
    'activated', true,
    'code', 'DREAMBREAKER_REQUIRED',
    'status', 'lineup_open',
    'matchupId', p_matchup.external_matchup_id,
    'version', v_existing.version,
    'orderLockAt', v_lock_at,
    'matchupResult', v_result
  );
end;
$$;
