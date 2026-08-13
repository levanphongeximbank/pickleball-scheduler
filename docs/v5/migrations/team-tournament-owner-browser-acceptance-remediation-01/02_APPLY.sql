-- team-tournament-owner-browser-acceptance-remediation-01 / 02_APPLY
-- LOCAL ONLY. Do not apply without Owner GO.
-- Forward-only after lifecycle-01. NEVER re-run lifecycle 02_APPLY.
-- A) update_setup_config = lifecycle Staging body + scoringMode/scoringSystem whitelist
-- B) new referee competition athlete directory RPC

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
  v_scoring_mode text;
  v_mode_raw text;
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
          'targetPoints', 'targetScore', 'winBy', 'changeEndsAt', 'freezeAt',
          'scoringMode', 'scoringSystem'
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

      -- Normalize scoringMode to rally|traditional (aliases accepted).
      v_mode_raw := lower(trim(coalesce(
        nullif(trim(coalesce(v_entry->>'scoringMode', '')), ''),
        nullif(trim(coalesce(v_entry->>'scoringSystem', '')), ''),
        'rally'
      )));
      if v_mode_raw in ('traditional', 'side_out', 'sideout') then
        v_scoring_mode := 'traditional';
      elsif v_mode_raw in ('rally', 'direct') then
        v_scoring_mode := 'rally';
      else
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'scoringMode must be rally or traditional'
        )::json;
      end if;

      v_entry_norm := jsonb_build_object(
        'scoringMode', v_scoring_mode,
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

-- ---------------------------------------------------------------------------
-- R1: competition-scoped athlete directory for referee portal
-- Authority: team_tournament_team_members + athletes + profiles(user_id)
-- NO club_list_members. NO profiles.player_id.
-- ---------------------------------------------------------------------------
create or replace function public.team_tournament_referee_competition_athlete_directory(
  p_tournament_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_allowed boolean := false;
  v_athletes jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'cross_tenant_denied');
  end;

  if public.team_tournament_can_manage()
     or public.team_tournament_can_manage_results() then
    v_allowed := true;
  elsif to_regclass('public.referee_assignments') is not null then
    select exists (
      select 1
      from public.referee_assignments ra
      where ra.tenant_id = v_header.tenant_id
        and ra.tournament_id = v_header.tournament_id
        and ra.referee_user_id = auth.uid()
        and ra.revoked_at is null
    ) into v_allowed;
  end if;

  if not coalesce(v_allowed, false) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t."displayName", t."athleteId"), '[]'::jsonb)
    into v_athletes
  from (
    select distinct on (m.player_id)
      m.player_id as "athleteId",
      coalesce(
        nullif(trim(p.display_name), ''),
        nullif(trim(a.display_name), ''),
        m.player_id
      ) as "displayName",
      case
        when lower(trim(coalesce(p.gender, ''))) in ('male', 'm', 'nam') then 'male'
        when lower(trim(coalesce(p.gender, ''))) in ('female', 'f', 'nu', 'nữ') then 'female'
        when nullif(trim(coalesce(p.gender, '')), '') is null then null
        else lower(trim(p.gender))
      end as gender
    from public.team_tournament_team_members m
    join public.team_tournament_teams tm
      on tm.id = m.team_id
     and tm.team_tournament_id = v_header.id
    left join public.athletes a
      on a.id::text = m.player_id
     and a.tenant_id = v_header.tenant_id
    left join public.profiles p
      on p.id = a.user_id
    where nullif(trim(coalesce(m.player_id, '')), '') is not null
    order by m.player_id, m.created_at nulls last
  ) t;

  return jsonb_build_object(
    'ok', true,
    'athletes', coalesce(v_athletes, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.team_tournament_referee_competition_athlete_directory(text)
  from public, anon;
grant execute on function public.team_tournament_referee_competition_athlete_directory(text)
  to authenticated;
