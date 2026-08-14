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
