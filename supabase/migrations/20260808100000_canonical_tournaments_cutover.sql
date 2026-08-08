-- TOURNAMENT-CANONICAL-RUNTIME-CUTOVER-01
-- Canonical organizer Tournament SSOT (cloud only).
-- DO NOT APPLY without Owner GO. No legacy blob migration (Owner hard-cutover reset).
-- Depends on: public.user_venue_id(), public.user_has_permission(text), public.is_super_admin()

BEGIN;

CREATE TABLE IF NOT EXISTS public.canonical_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL
    CHECK (length(trim(tenant_id)) > 0 AND tenant_id NOT IN ('default-tenant', 'default')),
  club_id text NOT NULL CHECK (length(trim(club_id)) > 0),
  external_key text NOT NULL,
  name text NOT NULL,
  mode text NOT NULL
    CHECK (mode IN ('daily_play', 'internal_tournament', 'official_tournament', 'team_tournament')),
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

DROP POLICY IF EXISTS canonical_tournaments_select ON public.canonical_tournaments;
CREATE POLICY canonical_tournaments_select ON public.canonical_tournaments
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      tenant_id = public.user_venue_id()
      AND public.user_has_permission('tournament.view')
    )
  );

DROP POLICY IF EXISTS canonical_tournaments_write ON public.canonical_tournaments;
CREATE POLICY canonical_tournaments_write ON public.canonical_tournaments
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      tenant_id = public.user_venue_id()
      AND (
        public.user_has_permission('tournament.update')
        OR public.user_has_permission('tournament.create')
        OR public.user_has_permission('tournament.delete')
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      tenant_id = public.user_venue_id()
      AND (
        public.user_has_permission('tournament.update')
        OR public.user_has_permission('tournament.create')
        OR public.user_has_permission('tournament.delete')
      )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.canonical_tournaments TO authenticated;

CREATE OR REPLACE FUNCTION public.canonical_tournament_assert_tenant(p_tenant_id text)
RETURNS void
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_tenant_id IS NULL
     OR length(trim(p_tenant_id)) = 0
     OR p_tenant_id IN ('default-tenant', 'default') THEN
    RAISE EXCEPTION 'TOURNAMENT_MISSING_TENANT' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.user_venue_id() THEN
    RAISE EXCEPTION 'TOURNAMENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_tournament_assert_permission(p_permission text)
RETURNS void
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF public.is_super_admin() THEN
    RETURN;
  END IF;
  IF NOT public.user_has_permission(p_permission) THEN
    RAISE EXCEPTION 'TOURNAMENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_tournament_is_mine(p_payload jsonb, p_player_id text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  pid text := nullif(trim(COALESCE(p_player_id, '')), '');
BEGIN
  IF pid IS NULL THEN
    RETURN false;
  END IF;
  IF COALESCE(p_payload->>'createdBy', '') = pid THEN
    RETURN true;
  END IF;
  IF COALESCE(p_payload->>'ownerPlayerId', '') = pid THEN
    RETURN true;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_payload->'events', '[]'::jsonb)) AS ev(event)
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ev.event->'entries', '[]'::jsonb)) AS en(entry)
    WHERE COALESCE(en.entry->>'playerId', en.entry->>'id', '') = pid
  ) THEN
    RETURN true;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_payload#>'{teamData,teams}', '[]'::jsonb)) AS tm(team)
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(tm.team->'members', '[]'::jsonb)) AS mb(member)
    WHERE COALESCE(mb.member->>'playerId', mb.member->>'id', '') = pid
  ) THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

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
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.view');

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.updated_at DESC), '[]'::jsonb)
    INTO rows
  FROM public.canonical_tournaments t
  WHERE t.tenant_id = p_tenant_id
    AND t.club_id = p_club_id;

  RETURN jsonb_build_object('ok', true, 'tournaments', rows);
EXCEPTION
  WHEN insufficient_privilege THEN
    RETURN jsonb_build_object('ok', false, 'code', SQLERRM, 'tournaments', '[]'::jsonb);
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN jsonb_build_object('ok', false, 'code', SQLERRM, 'tournaments', '[]'::jsonb);
    END IF;
    RAISE;
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
DECLARE
  rows jsonb;
  pid text := nullif(trim(COALESCE(p_player_id, '')), '');
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.view');
  IF pid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_FORBIDDEN', 'tournaments', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.updated_at DESC), '[]'::jsonb)
    INTO rows
  FROM public.canonical_tournaments t
  WHERE t.tenant_id = p_tenant_id
    AND t.club_id = p_club_id
    AND public.canonical_tournament_is_mine(t.payload, pid);

  RETURN jsonb_build_object('ok', true, 'tournaments', rows);
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN jsonb_build_object('ok', false, 'code', SQLERRM, 'tournaments', '[]'::jsonb);
    END IF;
    RAISE;
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
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.view');

  SELECT * INTO row_data
  FROM public.canonical_tournaments
  WHERE id = p_tournament_id AND tenant_id = p_tenant_id AND club_id = p_club_id;

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
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.delete');

  DELETE FROM public.canonical_tournaments
  WHERE id = p_tournament_id AND tenant_id = p_tenant_id AND club_id = p_club_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN jsonb_build_object('ok', false, 'code', SQLERRM);
    END IF;
    RAISE;
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
  -- Engine apply is a Tournament update (director/organizer).
  RETURN public.canonical_tournament_update(
    p_tenant_id,
    p_club_id,
    p_tournament_id,
    jsonb_build_object('engine_v4', COALESCE(p_engine_state, '{}'::jsonb))
  );
END;
$$;

-- Fail-closed EXECUTE: revoke PUBLIC/anon, grant authenticated only.
REVOKE ALL ON FUNCTION public.canonical_tournament_assert_tenant(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_tournament_assert_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_tournament_is_mine(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_tournament_list(text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_tournament_list_mine(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_tournament_get(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_tournament_create(text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_tournament_delete(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_tournament_apply_engine_state(text, text, uuid, jsonb) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.canonical_tournament_list(text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.canonical_tournament_list_mine(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.canonical_tournament_get(text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.canonical_tournament_create(text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.canonical_tournament_delete(text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.canonical_tournament_apply_engine_state(text, text, uuid, jsonb) FROM anon;

GRANT EXECUTE ON FUNCTION public.canonical_tournament_list(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_list_mine(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_get(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_create(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_delete(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_apply_engine_state(text, text, uuid, jsonb) TO authenticated;

COMMIT;
