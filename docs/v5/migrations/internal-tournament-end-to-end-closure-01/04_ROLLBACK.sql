-- ═══════════════════════════════════════════════════════════════════
-- 04_ROLLBACK.sql
-- Package: internal-tournament-end-to-end-closure-01
-- Restores pre-CAS update/create bodies from tournament-canonical-runtime-cutover-01.
-- Drops version column and helper. Team callers that never sent expected_version
-- continue to work after rollback.
-- DO NOT APPLY without Owner GO.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.canonical_tournament_create(
  p_tenant_id text,
  p_club_id text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid := gen_random_uuid();
  ext_key text;
  row_data public.canonical_tournaments%ROWTYPE;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.create');

  ext_key := COALESCE(nullif(trim(p_payload->>'external_key'), ''), 'tournament-' || new_id::text);

  INSERT INTO public.canonical_tournaments (
    id, tenant_id, club_id, external_key, name, mode, status, season_id, league_id, payload, engine_v4
  ) VALUES (
    new_id,
    p_tenant_id,
    p_club_id,
    ext_key,
    COALESCE(nullif(trim(p_payload->>'name'), ''), 'Giải mới'),
    COALESCE(nullif(trim(p_payload->>'mode'), ''), 'internal_tournament'),
    COALESCE(nullif(trim(p_payload->>'status'), ''), 'draft'),
    nullif(trim(p_payload->>'season_id'), ''),
    nullif(trim(p_payload->>'league_id'), ''),
    COALESCE(p_payload->'payload', '{}'::jsonb) || jsonb_build_object('id', new_id::text),
    COALESCE(p_payload->'engine_v4', '{}'::jsonb)
  )
  RETURNING * INTO row_data;

  RETURN jsonb_build_object('ok', true, 'tournament', to_jsonb(row_data));
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN jsonb_build_object('ok', false, 'code', SQLERRM);
    END IF;
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_tournament_update(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data public.canonical_tournaments%ROWTYPE;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');

  UPDATE public.canonical_tournaments t
  SET
    name = COALESCE(nullif(trim(p_patch->>'name'), ''), t.name),
    status = COALESCE(nullif(trim(p_patch->>'status'), ''), t.status),
    season_id = CASE WHEN p_patch ? 'season_id' THEN nullif(trim(p_patch->>'season_id'), '') ELSE t.season_id END,
    league_id = CASE WHEN p_patch ? 'league_id' THEN nullif(trim(p_patch->>'league_id'), '') ELSE t.league_id END,
    payload = CASE WHEN p_patch ? 'payload' THEN p_patch->'payload' ELSE t.payload END,
    engine_v4 = CASE WHEN p_patch ? 'engine_v4' THEN p_patch->'engine_v4' ELSE t.engine_v4 END,
    updated_at = now()
  WHERE t.id = p_tournament_id AND t.tenant_id = p_tenant_id AND t.club_id = p_club_id
  RETURNING * INTO row_data;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('ok', true, 'tournament', to_jsonb(row_data));
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN jsonb_build_object('ok', false, 'code', SQLERRM);
    END IF;
    RAISE;
END;
$$;

DROP FUNCTION IF EXISTS public.canonical_tournament_assert_internal_completion_eligible(text, text, text, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.canonical_tournament_assert_internal_completion_eligible(text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.canonical_tournament_assert_internal_status_transition(text, text, text, boolean);

ALTER TABLE public.canonical_tournaments DROP COLUMN IF EXISTS version;

GRANT EXECUTE ON FUNCTION public.canonical_tournament_create(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.canonical_tournament_create(text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_tournament_create(text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb) FROM anon;
