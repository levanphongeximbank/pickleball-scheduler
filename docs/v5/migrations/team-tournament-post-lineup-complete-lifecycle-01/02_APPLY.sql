-- team-tournament-post-lineup-complete-lifecycle-01 / 02_APPLY
-- LOCAL ONLY. Do not apply without Owner GO.
-- 1) Close tournament → dual-write status=completed (canonical + team)
-- 2) Whitelist qualifiersPerGroup + stageScoringPolicy on update_setup_config
-- Does NOT change matchup.stage coarse taxonomy (group|knockout).

create or replace function public.team_tournament_close_tournament(
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
  v_new_version integer;
  v_settings jsonb;
  v_closing jsonb;
  v_now timestamptz := now();
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_prepare := public.team_tournament_setup_mutation_prepare(
    p_tournament_id, p_envelope, 'tournament.close',
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

  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_header.status in ('completed', 'cancelled') then
    return json_build_object('ok', false, 'code', 'ALREADY_CLOSED',
      'error', 'Tournament already completed/cancelled');
  end if;

  v_envelope := v_prepare->'envelope';
  v_payload := coalesce(v_envelope->'payload', '{}'::jsonb);

  -- Reuse existing domain closing keys only (no invented fields).
  v_closing := jsonb_build_object(
    'closed', true,
    'closedAt', to_jsonb(v_now),
    'closedBy', to_jsonb(v_actor::text),
    'resultsLocked', true
  );
  if v_payload ? 'summary' then
    v_closing := v_closing || jsonb_build_object('summary', v_payload->'summary');
  end if;
  if v_payload ? 'awardsSheet' then
    v_closing := v_closing || jsonb_build_object('awardsSheet', v_payload->'awardsSheet');
  end if;
  if v_payload ? 'frozenStandings' then
    v_closing := v_closing || jsonb_build_object('frozenStandings', v_payload->'frozenStandings');
  end if;

  v_settings := coalesce(v_header.settings, '{}'::jsonb) || v_closing
    || jsonb_build_object('closing', coalesce(v_header.settings->'closing', '{}'::jsonb) || v_closing);

  update public.team_tournaments
     set status = 'completed',
         settings = v_settings,
         updated_at = v_now,
         updated_by = v_actor
   where id = v_header.id;

  update public.canonical_tournaments
     set status = 'completed',
         updated_at = v_now
   where id = v_header.tournament_id
      or id = p_tournament_id;

  v_new_version := public.team_tournament_setup_mutation_bump_version(v_header.id, v_header.version);

  return public.team_tournament_setup_mutation_finalize(
    v_header.tenant_id, p_tournament_id, v_header.id, v_new_version,
    v_envelope, v_prepare->>'payload_hash', v_prepare->>'command_payload_hash',
    public.team_tournament_setup_norm_projection(v_header.id, p_tournament_id, v_new_version),
    (v_prepare->>'actor_id')::uuid);
end;
$$;

revoke all on function public.team_tournament_close_tournament(text, jsonb, integer, text)
  from public, anon;
grant execute on function public.team_tournament_close_tournament(text, jsonb, integer, text)
  to authenticated;

-- Extend setup config whitelist (preserve #416 stageTieBreakPolicy behavior).
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
  v_scoring jsonb;
  v_scoring_norm jsonb := '{}'::jsonb;
  v_key text;
  v_val text;
  v_old text;
  v_new text;
  v_locked text[];
  v_q integer;
  v_gc integer;
  v_total integer;
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
  if v_payload ? 'qualifiersPerGroup' then
    v_q := greatest(1, coalesce((v_payload->>'qualifiersPerGroup')::int, 1));
    v_patch := v_patch || jsonb_build_object(
      'qualifiersPerGroup', v_q,
      'qualificationCount', v_q
    );
  elsif v_payload ? 'qualificationCount' then
    v_q := greatest(1, coalesce((v_payload->>'qualificationCount')::int, 1));
    v_patch := v_patch || jsonb_build_object(
      'qualificationCount', v_q,
      'qualifiersPerGroup', v_q
    );
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

  -- Fail closed non power-of-two qualification totals when multi-group.
  v_gc := coalesce(
    (v_patch->>'groupCount')::int,
    (v_header.settings->>'groupCount')::int,
    1
  );
  v_q := coalesce(
    (v_patch->>'qualifiersPerGroup')::int,
    (v_header.settings->>'qualifiersPerGroup')::int,
    (v_header.settings->>'qualificationCount')::int,
    2
  );
  if v_gc >= 2 then
    v_total := v_gc * v_q;
    if v_total not in (2, 4, 8, 16) then
      return jsonb_build_object(
        'ok', false,
        'code', 'INVALID_QUALIFICATION_TOTAL',
        'error', 'totalQualifiedTeams must be in {2,4,8,16}; cloud bye not supported',
        'groupCount', v_gc,
        'qualifiersPerGroup', v_q,
        'totalQualifiedTeams', v_total
      )::json;
    end if;
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

  if v_payload ? 'stageScoringPolicy' then
    v_scoring := v_payload->'stageScoringPolicy';
    if jsonb_typeof(v_scoring) <> 'object' then
      return jsonb_build_object(
        'ok', false,
        'code', 'INVALID_STAGE_SCORING_POLICY',
        'error', 'stageScoringPolicy must be an object'
      )::json;
    end if;
    for v_key in select jsonb_object_keys(v_scoring)
    loop
      if v_key not in ('group', 'round_of_16', 'quarterfinal', 'semifinal', 'final') then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'Unknown competition stage key'
        )::json;
      end if;
      if jsonb_typeof(v_scoring->v_key) <> 'object' then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'stage scoring entry must be object'
        )::json;
      end if;
      v_scoring_norm := v_scoring_norm || jsonb_build_object(v_key, v_scoring->v_key);
    end loop;
    v_patch := v_patch || jsonb_build_object(
      'stageScoringPolicy',
      coalesce(v_header.settings->'stageScoringPolicy', '{}'::jsonb) || v_scoring_norm
    );
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
