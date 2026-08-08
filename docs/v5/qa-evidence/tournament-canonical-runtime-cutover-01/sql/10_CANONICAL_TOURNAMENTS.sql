-- TOURNAMENT-CANONICAL-RUNTIME-CUTOVER-01
-- Local package ONLY — DO NOT APPLY without Owner GO.
-- Creates dedicated canonical tournament authority (organizer list/create/update),
-- separate from competition_ssot_* (match finalize) and team_tournaments (TT).

BEGIN;

CREATE TABLE IF NOT EXISTS public.canonical_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL CHECK (length(trim(tenant_id)) > 0 AND tenant_id NOT IN ('default-tenant', 'default')),
  club_id text NOT NULL CHECK (length(trim(club_id)) > 0),
  external_key text NOT NULL,
  name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('daily_play', 'internal_tournament', 'official_tournament', 'team_tournament')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'registration', 'ready', 'active', 'completed', 'cancelled')),
  season_id text,
  league_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  engine_v4 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_key)
);

CREATE INDEX IF NOT EXISTS canonical_tournaments_club_idx
  ON public.canonical_tournaments (tenant_id, club_id, updated_at DESC);

ALTER TABLE public.canonical_tournaments ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated same-tenant read/write (Owner GO required before live apply).
DROP POLICY IF EXISTS canonical_tournaments_select ON public.canonical_tournaments;
CREATE POLICY canonical_tournaments_select ON public.canonical_tournaments
  FOR SELECT TO authenticated
  USING (tenant_id = public.user_venue_id());

DROP POLICY IF EXISTS canonical_tournaments_write ON public.canonical_tournaments;
CREATE POLICY canonical_tournaments_write ON public.canonical_tournaments
  FOR ALL TO authenticated
  USING (tenant_id = public.user_venue_id())
  WITH CHECK (tenant_id = public.user_venue_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.canonical_tournaments TO authenticated;

CREATE OR REPLACE FUNCTION public.canonical_tournament_list(
  p_tenant_id text,
  p_club_id text,
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows jsonb;
BEGIN
  IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) = 0 OR p_tenant_id IN ('default-tenant', 'default') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_MISSING_TENANT', 'tournaments', '[]'::jsonb);
  END IF;
  IF p_tenant_id IS DISTINCT FROM public.user_venue_id() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_FORBIDDEN', 'tournaments', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.updated_at DESC), '[]'::jsonb)
    INTO rows
  FROM public.canonical_tournaments t
  WHERE t.tenant_id = p_tenant_id
    AND t.club_id = p_club_id;

  RETURN jsonb_build_object('ok', true, 'tournaments', rows);
END;
$$;

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
  IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) = 0 OR p_tenant_id IN ('default-tenant', 'default') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_MISSING_TENANT');
  END IF;
  IF p_tenant_id IS DISTINCT FROM public.user_venue_id() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_FORBIDDEN');
  END IF;

  ext_key := COALESCE(nullif(trim(p_payload->>'external_key'), ''), 'tournament-' || new_id::text);

  INSERT INTO public.canonical_tournaments (
    id, tenant_id, club_id, external_key, name, mode, status, season_id, league_id, payload
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
    COALESCE(p_payload->'payload', '{}'::jsonb)
  )
  RETURNING * INTO row_data;

  RETURN jsonb_build_object('ok', true, 'tournament', to_jsonb(row_data));
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_tournament_get(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data public.canonical_tournaments%ROWTYPE;
BEGIN
  IF p_tenant_id IS NULL OR p_tenant_id IN ('default-tenant', 'default') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_MISSING_TENANT');
  END IF;
  IF p_tenant_id IS DISTINCT FROM public.user_venue_id() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_FORBIDDEN');
  END IF;

  SELECT * INTO row_data
  FROM public.canonical_tournaments
  WHERE id = p_tournament_id AND tenant_id = p_tenant_id AND club_id = p_club_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('ok', true, 'tournament', to_jsonb(row_data));
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
  IF p_tenant_id IS NULL OR p_tenant_id IN ('default-tenant', 'default') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_MISSING_TENANT');
  END IF;
  IF p_tenant_id IS DISTINCT FROM public.user_venue_id() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_FORBIDDEN');
  END IF;

  UPDATE public.canonical_tournaments t
  SET
    name = COALESCE(nullif(trim(p_patch->>'name'), ''), t.name),
    status = COALESCE(nullif(trim(p_patch->>'status'), ''), t.status),
    payload = CASE WHEN p_patch ? 'payload' THEN p_patch->'payload' ELSE t.payload END,
    engine_v4 = CASE WHEN p_patch ? 'engine_v4' THEN p_patch->'engine_v4' ELSE t.engine_v4 END,
    updated_at = now()
  WHERE t.id = p_tournament_id AND t.tenant_id = p_tenant_id AND t.club_id = p_club_id
  RETURNING * INTO row_data;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('ok', true, 'tournament', to_jsonb(row_data));
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_tournament_delete(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tenant_id IS NULL OR p_tenant_id IN ('default-tenant', 'default') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_MISSING_TENANT');
  END IF;
  IF p_tenant_id IS DISTINCT FROM public.user_venue_id() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_FORBIDDEN');
  END IF;

  DELETE FROM public.canonical_tournaments
  WHERE id = p_tournament_id AND tenant_id = p_tenant_id AND club_id = p_club_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_tournament_list_mine(
  p_tenant_id text,
  p_club_id text,
  p_player_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Initial cutover: same list; player filtering remains application-side until roster tables land.
  RETURN public.canonical_tournament_list(p_tenant_id, p_club_id, jsonb_build_object('player_id', p_player_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_tournament_apply_engine_state(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_engine_state jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.canonical_tournament_update(
    p_tenant_id,
    p_club_id,
    p_tournament_id,
    jsonb_build_object('engine_v4', COALESCE(p_engine_state, '{}'::jsonb))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.canonical_tournament_list(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_create(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_get(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_delete(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_list_mine(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_apply_engine_state(text, text, uuid, jsonb) TO authenticated;

COMMIT;
