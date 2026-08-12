-- team-tournament-post-lineup-complete-lifecycle-01 / 02_APPLY
-- LOCAL ONLY. Do not apply without Owner GO.
-- B01 close readiness from canonical matchups
-- B02 do not trust client awards/standings/summary as result authority
-- B03 organizer referee candidate search (profiles identity; no role eligibility)
-- B04 harden stageScoringPolicy field/range validation
-- Does NOT change matchup.stage coarse taxonomy (group|knockout).

-- ---------------------------------------------------------------------------
-- Close readiness: derive from persisted matchups / results (server authority)
-- ---------------------------------------------------------------------------
create or replace function public.team_tournament_assert_close_readiness(
  p_team_tournament_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_gc integer;
  v_group_total integer := 0;
  v_group_incomplete integer := 0;
  v_ko_total integer := 0;
  v_ko_incomplete integer := 0;
  v_final public.team_tournament_matchups;
  v_champion text := null;
  v_rank1_count integer := 0;
begin
  select * into v_header
  from public.team_tournaments
  where id = p_team_tournament_id;

  if v_header.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Tournament not found');
  end if;

  v_gc := greatest(
    1,
    coalesce(nullif(trim(coalesce(v_header.settings->>'groupCount', '')), '')::int, 1)
  );

  select
    count(*)::int,
    count(*) filter (
      where m.status is distinct from 'completed'
         or nullif(trim(coalesce(m.result->>'winnerTeamId', '')), '') is null
    )::int
  into v_group_total, v_group_incomplete
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and coalesce(nullif(trim(coalesce(m.schedule_meta->>'stage', '')), ''), 'group')
        is distinct from 'knockout';

  if v_group_total < 1 then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_STAGE_INCOMPLETE',
      'error', 'Required group round-robin matchups are missing',
      'groupCount', v_gc,
      'groupMatchupCount', v_group_total
    );
  end if;

  if v_group_incomplete > 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_STAGE_INCOMPLETE',
      'error', 'Required group matchups are not all completed',
      'groupCount', v_gc,
      'groupMatchupCount', v_group_total,
      'incompleteGroupMatchups', v_group_incomplete
    );
  end if;

  if v_gc <= 1 then
    -- One-group: no knockout required. Champion = deterministic standings rank 1
    -- (recompute is caller's responsibility before reading standings; here we
    -- validate completion is enough to resolve via existing ranking order).
    select count(*)::int into v_rank1_count
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id;

    if v_rank1_count < 1 then
      return jsonb_build_object(
        'ok', false,
        'code', 'CHAMPION_UNRESOLVED',
        'error', 'No teams available to resolve champion from group standings',
        'groupCount', v_gc
      );
    end if;

    -- Deterministic champion from completed group results (same order as standings cache).
    with scored as (
      select
        t.external_team_id as team_id,
        coalesce(sum(case
          when m.status = 'completed'
           and nullif(trim(coalesce(m.result->>'winnerTeamId','')), '') = t.external_team_id
          then 1 else 0 end), 0) as wins,
        coalesce(sum(case
          when m.status = 'completed'
           and m.team_a_id = t.external_team_id
          then coalesce((m.result->>'teamAWins')::int, 0)
             - coalesce((m.result->>'teamBWins')::int, 0)
          when m.status = 'completed'
           and m.team_b_id = t.external_team_id
          then coalesce((m.result->>'teamBWins')::int, 0)
             - coalesce((m.result->>'teamAWins')::int, 0)
          else 0 end), 0) as sub_diff,
        coalesce(sum(case
          when m.status = 'completed' and m.team_a_id = t.external_team_id
            then coalesce((m.result->>'teamAPoints')::int, 0)
          when m.status = 'completed' and m.team_b_id = t.external_team_id
            then coalesce((m.result->>'teamBPoints')::int, 0)
          else 0 end), 0) as points_scored
      from public.team_tournament_teams t
      left join public.team_tournament_matchups m
        on m.team_tournament_id = t.team_tournament_id
       and coalesce(nullif(trim(coalesce(m.schedule_meta->>'stage', '')), ''), 'group')
           is distinct from 'knockout'
       and (m.team_a_id = t.external_team_id or m.team_b_id = t.external_team_id)
      where t.team_tournament_id = v_header.id
      group by t.external_team_id
    )
    select team_id into v_champion
    from scored
    order by wins desc, sub_diff desc, points_scored desc, team_id
    limit 1;

    if nullif(trim(coalesce(v_champion, '')), '') is null then
      return jsonb_build_object(
        'ok', false,
        'code', 'CHAMPION_UNRESOLVED',
        'error', 'Champion could not be resolved from completed group results',
        'groupCount', v_gc
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'groupCount', v_gc,
      'mode', 'one_group',
      'championTeamId', v_champion,
      'championSource', 'group_standings_derived'
    );
  end if;

  -- Multi-group: elimination bracket required; final must be completed.
  select
    count(*)::int,
    count(*) filter (
      where m.status is distinct from 'completed'
         or nullif(trim(coalesce(m.result->>'winnerTeamId', '')), '') is null
    )::int
  into v_ko_total, v_ko_incomplete
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and coalesce(nullif(trim(coalesce(m.schedule_meta->>'stage', '')), ''), 'group') = 'knockout';

  if v_ko_total < 1 then
    return jsonb_build_object(
      'ok', false,
      'code', 'ELIMINATION_INCOMPLETE',
      'error', 'Required elimination bracket is missing',
      'groupCount', v_gc,
      'knockoutMatchupCount', v_ko_total
    );
  end if;

  if v_ko_incomplete > 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'ELIMINATION_INCOMPLETE',
      'error', 'Required elimination matchups are not all completed',
      'groupCount', v_gc,
      'knockoutMatchupCount', v_ko_total,
      'incompleteKnockoutMatchups', v_ko_incomplete
    );
  end if;

  select m.* into v_final
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and coalesce(nullif(trim(coalesce(m.schedule_meta->>'stage', '')), ''), 'group') = 'knockout'
    and public.team_tournament_resolve_competition_stage(m) = 'final'
  order by m.updated_at desc nulls last
  limit 1;

  if v_final.id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'FINAL_NOT_COMPLETED',
      'error', 'Canonical final matchup not found',
      'groupCount', v_gc
    );
  end if;

  if v_final.status is distinct from 'completed'
     or nullif(trim(coalesce(v_final.result->>'winnerTeamId', '')), '') is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'FINAL_NOT_COMPLETED',
      'error', 'Canonical final matchup is not completed with a winner',
      'groupCount', v_gc,
      'finalMatchupId', v_final.external_matchup_id
    );
  end if;

  v_champion := nullif(trim(coalesce(v_final.result->>'winnerTeamId', '')), '');
  if v_champion is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'CHAMPION_UNRESOLVED',
      'error', 'Champion could not be resolved from final winner',
      'groupCount', v_gc,
      'finalMatchupId', v_final.external_matchup_id
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'groupCount', v_gc,
    'mode', 'multi_group',
    'championTeamId', v_champion,
    'championSource', 'final_winner',
    'finalMatchupId', v_final.external_matchup_id
  );
end;
$$;

revoke all on function public.team_tournament_assert_close_readiness(uuid) from public, anon;
grant execute on function public.team_tournament_assert_close_readiness(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Close: readiness gate → dual-write completed (ignore client result payloads)
-- ---------------------------------------------------------------------------
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
  v_ready jsonb;
  v_standings jsonb;
  v_now timestamptz := now();
  v_actor uuid := auth.uid();
  v_champion text;
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

  -- B01: fail closed unless canonical competition state is ready.
  v_ready := public.team_tournament_assert_close_readiness(v_header.id);
  if not coalesce((v_ready->>'ok')::boolean, false) then
    return v_ready::json;
  end if;

  v_champion := nullif(trim(coalesce(v_ready->>'championTeamId', '')), '');
  if v_champion is null then
    return json_build_object(
      'ok', false,
      'code', 'CHAMPION_UNRESOLVED',
      'error', 'Champion unresolved after readiness check'
    );
  end if;

  -- Refresh standings cache from persisted results (server authority).
  if to_regprocedure('public.team_tournament_recompute_standings_cache(uuid)') is not null then
    v_standings := public.team_tournament_recompute_standings_cache(v_header.id);
  end if;

  -- B02: lifecycle + existing closing metadata only.
  -- Client summary/awardsSheet/frozenStandings are NEVER trusted as result authority.
  -- Optional non-authoritative presentation snapshot is server-derived only.
  v_closing := jsonb_build_object(
    'closed', true,
    'closedAt', to_jsonb(v_now),
    'closedBy', to_jsonb(v_actor::text),
    'resultsLocked', true,
    'championTeamId', to_jsonb(v_champion),
    'closingSnapshot', jsonb_build_object(
      'authoritative', false,
      'note', 'Presentation/audit only; champion/status derive from canonical matchups/results',
      'championTeamId', v_champion,
      'championSource', v_ready->>'championSource',
      'mode', v_ready->>'mode',
      'derivedAt', v_now,
      'standingsRecomputeOk', coalesce((v_standings->>'ok')::boolean, false)
    )
  );

  -- Explicitly ignore client result payloads even if present.
  if v_payload ? 'summary'
     or v_payload ? 'awardsSheet'
     or v_payload ? 'frozenStandings'
     or v_payload ? 'championTeamId' then
    null; -- discarded: CLIENT_RESULT_PAYLOAD_TRUSTED_AS_AUTHORITY=NO
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
    public.team_tournament_setup_norm_projection(v_header.id, p_tournament_id, v_new_version)
      || jsonb_build_object(
        'championTeamId', v_champion,
        'closeReadiness', v_ready
      ),
    (v_prepare->>'actor_id')::uuid);
end;
$$;

revoke all on function public.team_tournament_close_tournament(text, jsonb, integer, text)
  from public, anon;
grant execute on function public.team_tournament_close_tournament(text, jsonb, integer, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- B03: practical referee candidate search for organizers (no profiles.role gate)
-- Eligibility for assign remains create_referee_assignment: profiles row exists.
-- ---------------------------------------------------------------------------
create or replace function public.team_tournament_search_referee_candidates(
  p_tournament_id text,
  p_search text default '',
  p_limit integer default 20
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
  v_rows json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'cross_tenant_denied');
  end;

  -- Candidate source = profiles identity directory (display + email).
  -- No profiles.role filter: existing create assignment treats profile existence
  -- as sufficient identity; assignment table is runtime authority.
  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_rows
  from (
    select
      p.id as "userId",
      coalesce(nullif(trim(p.display_name), ''), split_part(coalesce(p.email, ''), '@', 1), 'Referee')
        as "displayName",
      coalesce(p.email, '') as email,
      coalesce(p.status, '') as status
    from public.profiles p
    where coalesce(p.status, 'active') is distinct from 'disabled'
      and (
        v_q is null
        or p.email ilike '%' || v_q || '%'
        or p.display_name ilike '%' || v_q || '%'
        or coalesce(p.phone, '') ilike '%' || v_q || '%'
      )
    order by
      case when v_q is not null and p.email ilike v_q || '%' then 0 else 1 end,
      p.display_name nulls last,
      p.email
    limit v_limit
  ) t;

  return json_build_object(
    'ok', true,
    'candidates', coalesce(v_rows, '[]'::json),
    'eligibilityNote', 'profiles identity only; create_referee_assignment is authority'
  );
end;
$$;

revoke all on function public.team_tournament_search_referee_candidates(text, text, integer)
  from public, anon;
grant execute on function public.team_tournament_search_referee_candidates(text, text, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Extend setup config whitelist (preserve #416 stageTieBreakPolicy behavior).
-- ---------------------------------------------------------------------------
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
  v_entry jsonb;
  v_entry_norm jsonb;
  v_key text;
  v_val text;
  v_old text;
  v_new text;
  v_locked text[];
  v_q integer;
  v_gc integer;
  v_total integer;
  v_target integer;
  v_win_by integer;
  v_change_ends integer;
  v_freeze integer;
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
      v_entry := v_scoring->v_key;
      if jsonb_typeof(v_entry) <> 'object' then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'stage scoring entry must be object'
        )::json;
      end if;

      -- Reject unknown fields (canonical scoring engine aliases only).
      if exists (
        select 1
        from jsonb_object_keys(v_entry) k(key)
        where k.key not in (
          'targetPoints', 'targetScore', 'winBy', 'changeEndsAt', 'freezeAt'
        )
      ) then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'Unsupported stage scoring field'
        )::json;
      end if;

      begin
        v_target := coalesce(
          nullif(v_entry->>'targetPoints', '')::int,
          nullif(v_entry->>'targetScore', '')::int
        );
      exception when others then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'targetPoints/targetScore must be integer'
        )::json;
      end;
      begin
        v_win_by := nullif(v_entry->>'winBy', '')::int;
      exception when others then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'winBy must be integer'
        )::json;
      end;
      begin
        v_change_ends := nullif(v_entry->>'changeEndsAt', '')::int;
      exception when others then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'changeEndsAt must be integer or null'
        )::json;
      end;
      begin
        v_freeze := nullif(v_entry->>'freezeAt', '')::int;
      exception when others then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'freezeAt must be integer or null'
        )::json;
      end;

      if v_target is null or v_target < 1 or v_target > 99 then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'targetPoints must be between 1 and 99'
        )::json;
      end if;
      if v_win_by is null or v_win_by < 1 or v_win_by > 20 then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'winBy must be between 1 and 20'
        )::json;
      end if;
      if v_change_ends is not null and (v_change_ends < 1 or v_change_ends > 99) then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'changeEndsAt out of range'
        )::json;
      end if;
      if v_freeze is not null and (v_freeze < 1 or v_freeze > 99) then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'freezeAt out of range'
        )::json;
      end if;

      v_entry_norm := jsonb_build_object(
        'targetPoints', v_target,
        'winBy', v_win_by,
        'changeEndsAt', to_jsonb(v_change_ends),
        'freezeAt', to_jsonb(v_freeze)
      );
      v_scoring_norm := v_scoring_norm || jsonb_build_object(v_key, v_entry_norm);
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
