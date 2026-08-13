-- team-tournament-scenario-b-ko-lineup-remediation-01 / 02_APPLY
-- LOCAL ONLY. Apply once after Owner GO.
-- Surgical: rewrite team_tournament_replace_matchups only.
-- Does NOT recreate apply_domain_setup_mutation (other commands untouched).
-- Does NOT re-run lifecycle / owner-browser / close-uuid packages.

create or replace function public.team_tournament_replace_matchups(
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
  v_payload jsonb;
  v_envelope jsonb;
  v_item jsonb;
  v_sub jsonb;
  v_id text;
  v_team_a text;
  v_team_b text;
  v_new_version integer;
  v_match public.team_tournament_matchups;
  v_payload_ids text[];
begin
  v_prepare := public.team_tournament_setup_mutation_prepare(
    p_tournament_id, p_envelope, 'matchups.replace', p_expected_version, p_idempotency_key);
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
  v_payload := v_envelope->'payload';

  if nullif(btrim(v_envelope->>'rulesVersion'), '') is null then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'rulesVersion is required.');
  end if;

  if exists (
    select 1
    from public.team_tournament_matchups m
    where m.team_tournament_id = v_header.id
      and (
        public.team_tournament_matchup_is_started(m)
        or public.team_tournament_matchup_has_confirmed_result(m.id)
      )
  ) and not coalesce((v_envelope->>'confirmDestructive')::boolean, false) then
    return json_build_object('ok', false, 'code', 'CONFIRM_DESTRUCTIVE_REQUIRED');
  end if;

  -- B3: empty teamAId/teamBId allowed for unfilled KO placeholders (Final before SF winners).
  -- Non-empty ids must resolve to known teams. Never invent teams.
  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_payload->'matchups', '[]'::jsonb)) x
    where (
      nullif(btrim(coalesce(x.value->>'teamAId', '')), '') is not null
      and not exists (
        select 1
        from public.team_tournament_teams t
        where t.team_tournament_id = v_header.id
          and t.external_team_id = nullif(btrim(coalesce(x.value->>'teamAId', '')), '')
      )
    ) or (
      nullif(btrim(coalesce(x.value->>'teamBId', '')), '') is not null
      and not exists (
        select 1
        from public.team_tournament_teams t
        where t.team_tournament_id = v_header.id
          and t.external_team_id = nullif(btrim(coalesce(x.value->>'teamBId', '')), '')
      )
    )
  ) then
    return json_build_object('ok', false, 'code', 'UNKNOWN_TEAM');
  end if;

  v_payload_ids := '{}'::text[];

  -- B2: upsert by external_matchup_id so preserved group matchups keep internal uuid
  -- and historical lineups (ON DELETE CASCADE) are not wiped on KO generate.
  for v_item in select value from jsonb_array_elements(coalesce(v_payload->'matchups', '[]'::jsonb))
  loop
    v_id := coalesce(nullif(v_item->>'id', ''), gen_random_uuid()::text);
    v_payload_ids := array_append(v_payload_ids, v_id);
    v_team_a := coalesce(nullif(btrim(coalesce(v_item->>'teamAId', '')), ''), '');
    v_team_b := coalesce(nullif(btrim(coalesce(v_item->>'teamBId', '')), ''), '');

    update public.team_tournament_matchups
       set team_a_id = v_team_a,
           team_b_id = v_team_b,
           scheduled_at = nullif(v_item->>'scheduledAt', '')::timestamptz,
           lineup_lock_at = nullif(v_item->>'lineupLockAt', '')::timestamptz,
           court_label = nullif(v_item->>'courtLabel', ''),
           status = coalesce(v_item->>'status', status, 'lineup_open'),
           schedule_meta = coalesce(v_item->'scheduleMeta', '{}'::jsonb)
             || jsonb_strip_nulls(jsonb_build_object(
                  'groupId', v_item->>'groupId',
                  'roundNumber', v_item->'roundNumber',
                  'matchNumberInRound', v_item->'matchNumberInRound',
                  'stage', v_item->>'stage',
                  'nextMatchupId', v_item->>'nextMatchupId',
                  'competitionStage', v_item->>'competitionStage',
                  'bracketRoundLabel', v_item->>'bracketRoundLabel'
                )),
           updated_at = now(),
           updated_by = auth.uid()
     where team_tournament_id = v_header.id
       and external_matchup_id = v_id
    returning * into v_match;

    if not found then
      insert into public.team_tournament_matchups(
        tenant_id, tournament_id, team_tournament_id, external_matchup_id,
        team_a_id, team_b_id, scheduled_at, lineup_lock_at, court_label, status,
        schedule_meta, created_by, updated_by
      ) values (
        v_header.tenant_id, p_tournament_id, v_header.id, v_id,
        v_team_a, v_team_b,
        nullif(v_item->>'scheduledAt', '')::timestamptz,
        nullif(v_item->>'lineupLockAt', '')::timestamptz,
        nullif(v_item->>'courtLabel', ''),
        coalesce(v_item->>'status', 'lineup_open'),
        coalesce(v_item->'scheduleMeta', '{}'::jsonb)
          || jsonb_strip_nulls(jsonb_build_object(
               'groupId', v_item->>'groupId',
               'roundNumber', v_item->'roundNumber',
               'matchNumberInRound', v_item->'matchNumberInRound',
               'stage', v_item->>'stage',
               'nextMatchupId', v_item->>'nextMatchupId',
               'competitionStage', v_item->>'competitionStage',
               'bracketRoundLabel', v_item->>'bracketRoundLabel'
             )),
        auth.uid(), auth.uid()
      ) returning * into v_match;
    end if;

    delete from public.team_tournament_sub_matches where matchup_id = v_match.id;
    for v_sub in select value from jsonb_array_elements(coalesce(v_item->'subMatches', '[]'::jsonb))
    loop
      if not exists (
        select 1
        from public.team_tournament_disciplines d
        where d.team_tournament_id = v_header.id
          and d.external_discipline_id = coalesce(v_sub->>'disciplineId', v_sub->>'disciplineExternalId')
      ) then
        return json_build_object('ok', false, 'code', 'UNKNOWN_DISCIPLINE');
      end if;
      insert into public.team_tournament_sub_matches(
        tenant_id, tournament_id, matchup_id, external_sub_match_id,
        discipline_external_id, sort_order
      ) values (
        v_header.tenant_id, p_tournament_id, v_match.id,
        coalesce(v_sub->>'id', gen_random_uuid()::text),
        coalesce(v_sub->>'disciplineId', v_sub->>'disciplineExternalId'),
        coalesce((v_sub->>'sortOrder')::int, 1)
      );
    end loop;
  end loop;

  -- Remove matchups absent from payload (true deletions only).
  delete from public.team_tournament_matchups m
   where m.team_tournament_id = v_header.id
     and not (m.external_matchup_id = any (v_payload_ids));

  if exists (
    select 1
    from public.team_tournament_matchups a
    join public.team_tournament_matchups b
      on a.team_tournament_id = b.team_tournament_id
     and a.id < b.id
     and a.court_label = b.court_label
     and a.scheduled_at = b.scheduled_at
    where a.team_tournament_id = v_header.id
      and a.court_label is not null
      and a.scheduled_at is not null
  ) then
    return json_build_object('ok', false, 'code', 'COURT_CONFLICT');
  end if;

  v_new_version := public.team_tournament_setup_mutation_bump_version(v_header.id, v_header.version);
  return public.team_tournament_setup_mutation_finalize(
    v_header.tenant_id, p_tournament_id, v_header.id, v_new_version,
    v_envelope, v_prepare->>'payload_hash', v_prepare->>'command_payload_hash',
    public.team_tournament_setup_norm_projection(v_header.id, p_tournament_id, v_new_version),
    (v_prepare->>'actor_id')::uuid
  );
end;
$$;

revoke all on function public.team_tournament_replace_matchups(text, jsonb, integer, text)
  from public, anon;
grant execute on function public.team_tournament_replace_matchups(text, jsonb, integer, text)
  to authenticated;
