-- team-tournament-close-uuid-type-remediation-01 / 02_APPLY
-- LOCAL ONLY. Apply once after Owner GO.
-- Forward-only: replace close dual-write uuid=text WHERE only.
-- Do NOT re-run lifecycle-01 or owner-browser-acceptance-01.

-- ---------------------------------------------------------------------------
-- Close: readiness gate → dual-write completed (ignore client result payloads)
-- Source: team-tournament-post-lineup-complete-lifecycle-01/02_APPLY.sql
--         (team_tournament_close_tournament) with cast-safe dual-write WHERE.
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

  -- uuid/text-safe dual-write (remediation vs lifecycle bare id = text)
  update public.canonical_tournaments
     set status = 'completed',
         updated_at = v_now
   where id = nullif(btrim(coalesce(v_header.tournament_id, '')), '')::uuid
      or id = nullif(btrim(coalesce(p_tournament_id, '')), '')::uuid
      or external_key = nullif(btrim(coalesce(v_header.tournament_id, '')), '')
      or external_key = nullif(btrim(coalesce(p_tournament_id, '')), '');

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
