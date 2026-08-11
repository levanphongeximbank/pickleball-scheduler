-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-stage-tiebreak-policy-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
--
-- Adds settings.stageTieBreakPolicy (JSONB, no new column) and branches
-- matchup winner resolution: DREAMBREAKER (existing) vs
-- TOTAL_SUBMATCH_POINTS (sum normal child points; Dreambreaker off).
-- Secondary total-points tie remains UNDEFINED (no winner invented).
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_tournament_resolve_competition_stage(
  p_matchup public.team_tournament_matchups
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_stored text;
  v_stage text;
  v_next text;
  v_hops int := 0;
  v_current public.team_tournament_matchups;
  v_seen text[] := '{}';
begin
  if p_matchup.id is null then
    return 'group';
  end if;

  v_stored := nullif(trim(coalesce(p_matchup.schedule_meta->>'competitionStage', '')), '');
  if v_stored in ('group', 'round_of_16', 'quarterfinal', 'semifinal', 'final') then
    return v_stored;
  end if;

  v_stage := nullif(trim(coalesce(p_matchup.schedule_meta->>'stage', '')), '');
  if v_stage is distinct from 'knockout' then
    return 'group';
  end if;

  v_current := p_matchup;
  loop
    v_next := nullif(trim(coalesce(v_current.schedule_meta->>'nextMatchupId', '')), '');
    if v_next is null then
      exit;
    end if;
    if v_current.external_matchup_id is not null
       and v_current.external_matchup_id = any (v_seen) then
      return '';
    end if;
    if v_current.external_matchup_id is not null then
      v_seen := array_append(v_seen, v_current.external_matchup_id);
    end if;
    v_hops := v_hops + 1;
    if v_hops > 8 then
      return '';
    end if;
    select * into v_current
    from public.team_tournament_matchups m
    where m.team_tournament_id = p_matchup.team_tournament_id
      and m.external_matchup_id = v_next;
    exit when v_current.id is null;
  end loop;

  if v_hops = 0 then return 'final'; end if;
  if v_hops = 1 then return 'semifinal'; end if;
  if v_hops = 2 then return 'quarterfinal'; end if;
  if v_hops = 3 then return 'round_of_16'; end if;
  return '';
end;
$$;

create or replace function public.team_tournament_resolve_stage_tiebreak_policy(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_stage text;
  v_value text;
begin
  v_stage := public.team_tournament_resolve_competition_stage(p_matchup);
  v_value := upper(nullif(trim(coalesce(
    p_header.settings->'stageTieBreakPolicy'->>v_stage,
    ''
  )), ''));
  if v_value = 'TOTAL_SUBMATCH_POINTS' then
    return 'TOTAL_SUBMATCH_POINTS';
  end if;
  return 'DREAMBREAKER';
end;
$$;

create or replace function public.team_tournament_stage_tiebreak_locked_stages(
  p_team_tournament_id uuid
)
returns text[]
language plpgsql
stable
set search_path = public
as $$
declare
  v_locked text[] := '{}';
  v_row public.team_tournament_matchups;
  v_stage text;
  v_started boolean;
begin
  for v_row in
    select * from public.team_tournament_matchups
    where team_tournament_id = p_team_tournament_id
  loop
    v_started :=
      v_row.status in ('in_progress', 'completed')
      or exists (
        select 1
        from public.team_tournament_sub_matches sm
        where sm.matchup_id = v_row.id
          and sm.status in ('playing', 'completed', 'forfeit')
      )
      or exists (
        select 1
        from public.team_tournament_dreambreaker_states db
        where db.matchup_id = v_row.id
          and db.status is distinct from 'pending'
      );
    if not v_started then
      continue;
    end if;
    v_stage := coalesce(
      nullif(public.team_tournament_resolve_competition_stage(v_row), ''),
      'group'
    );
    if v_stage in ('group', 'round_of_16', 'quarterfinal', 'semifinal', 'final')
       and not (v_stage = any (v_locked)) then
      v_locked := array_append(v_locked, v_stage);
    end if;
  end loop;
  return v_locked;
end;
$$;

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
  v_policy jsonb;
  v_policy_norm jsonb := '{}'::jsonb;
  v_existing_policy jsonb;
  v_merged_policy jsonb;
  v_key text;
  v_val text;
  v_old text;
  v_new text;
  v_locked text[];
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
  if v_payload ? 'stageTieBreakPolicy' then
    v_policy := v_payload->'stageTieBreakPolicy';
    if jsonb_typeof(v_policy) <> 'object' then
      return jsonb_build_object(
        'ok', false,
        'code', 'INVALID_STAGE_TIEBREAK_POLICY',
        'error', 'stageTieBreakPolicy must be an object'
      )::json;
    end if;
    for v_key in select jsonb_object_keys(v_policy)
    loop
      if v_key not in ('group', 'round_of_16', 'quarterfinal', 'semifinal', 'final') then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_TIEBREAK_POLICY',
          'error', 'Unknown competition stage key'
        )::json;
      end if;
      v_val := upper(trim(coalesce(v_policy->>v_key, '')));
      if v_val not in ('DREAMBREAKER', 'TOTAL_SUBMATCH_POINTS') then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_TIEBREAK_POLICY',
          'error', 'Invalid stage tie-break policy value'
        )::json;
      end if;
      v_policy_norm := v_policy_norm || jsonb_build_object(v_key, v_val);
    end loop;
    v_existing_policy := coalesce(v_header.settings->'stageTieBreakPolicy', '{}'::jsonb);
    v_merged_policy := v_existing_policy || v_policy_norm;
    v_locked := public.team_tournament_stage_tiebreak_locked_stages(v_header.id);
    foreach v_key in array array['group', 'round_of_16', 'quarterfinal', 'semifinal', 'final']
    loop
      v_old := coalesce(nullif(trim(coalesce(v_existing_policy->>v_key, '')), ''), 'DREAMBREAKER');
      v_new := coalesce(nullif(trim(coalesce(v_merged_policy->>v_key, '')), ''), 'DREAMBREAKER');
      if v_old is distinct from v_new and v_key = any (v_locked) then
        return jsonb_build_object(
          'ok', false,
          'code', 'STAGE_TIEBREAK_POLICY_LOCKED',
          'error', 'Cannot change tie-break policy after that stage has started',
          'lockedStages', to_jsonb(v_locked)
        )::json;
      end if;
    end loop;
    v_patch := v_patch || jsonb_build_object('stageTieBreakPolicy', v_merged_policy);
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
  v_policy text := 'DREAMBREAKER';
  v_tie_status text := null;
begin
  select * into v_matchup from public.team_tournament_matchups where id = p_matchup_id;
  if v_matchup.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_header
  from public.team_tournaments t
  where t.id = v_matchup.team_tournament_id;

  v_db_enabled := coalesce((v_header.settings->>'dreambreakerEnabled')::boolean, true);
  v_policy := public.team_tournament_resolve_stage_tiebreak_policy(v_header, v_matchup);

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

  if v_policy = 'TOTAL_SUBMATCH_POINTS'
     and v_all_main_finalized
     and v_team_a_wins = v_team_b_wins then
    v_needs_db := false;
    if v_team_a_points > v_team_b_points then
      v_winner := v_matchup.team_a_id;
      v_tie_status := 'points';
    elsif v_team_b_points > v_team_a_points then
      v_winner := v_matchup.team_b_id;
      v_tie_status := 'points';
    else
      v_winner := null;
      v_tie_status := 'secondary_tie_unresolved';
    end if;
  else
    v_needs_db :=
      v_policy = 'DREAMBREAKER'
      and v_db_enabled
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
  end if;

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
    v_tie_status := 'dreambreaker';
  end if;

  update public.team_tournament_matchups set
    result = jsonb_strip_nulls(jsonb_build_object(
      'teamAWins', v_team_a_wins,
      'teamBWins', v_team_b_wins,
      'teamAPoints', v_team_a_points,
      'teamBPoints', v_team_b_points,
      'winnerTeamId', v_winner,
      'needsDreambreaker', v_needs_db,
      'tieBreakPolicy', v_policy,
      'tieBreakStatus', v_tie_status
    )),
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
    'tieBreakPolicy', v_policy,
    'tieBreakStatus', v_tie_status,
    'matchupCompleted', v_winner is not null and not v_needs_db and v_all_main_finalized
  );
end;
$$;

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
  v_policy text := 'DREAMBREAKER';
begin
  if p_header.id is null or p_matchup.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'activated', false);
  end if;

  v_policy := public.team_tournament_resolve_stage_tiebreak_policy(p_header, p_matchup);
  if v_policy is distinct from 'DREAMBREAKER' then
    return jsonb_build_object(
      'ok', true,
      'activated', false,
      'code', 'STAGE_POLICY_NOT_DREAMBREAKER',
      'policy', v_policy
    );
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
      'needsDreambreaker', true,
      'tieBreakPolicy', 'DREAMBREAKER'
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

revoke all on function public.team_tournament_resolve_competition_stage(public.team_tournament_matchups)
  from public, anon;
revoke all on function public.team_tournament_resolve_stage_tiebreak_policy(public.team_tournaments, public.team_tournament_matchups)
  from public, anon;
revoke all on function public.team_tournament_stage_tiebreak_locked_stages(uuid)
  from public, anon;
revoke all on function public.team_tournament_maybe_activate_dreambreaker(public.team_tournaments, public.team_tournament_matchups)
  from public, anon;

comment on function public.team_tournament_resolve_stage_tiebreak_policy(public.team_tournaments, public.team_tournament_matchups) is
  'Resolve DREAMBREAKER|TOTAL_SUBMATCH_POINTS for a matchup. Missing settings default DREAMBREAKER.';
