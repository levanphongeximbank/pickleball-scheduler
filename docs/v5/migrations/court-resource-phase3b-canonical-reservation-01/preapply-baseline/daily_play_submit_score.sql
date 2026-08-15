CREATE OR REPLACE FUNCTION public.daily_play_submit_score(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_score_a integer, p_score_b integer, p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_t public.canonical_tournaments%ROWTYPE; v_s jsonb; v_cmd jsonb; v_result jsonb;
  v_actual int; v_matches jsonb; v_m jsonb; v_mid text:=nullif(trim(coalesce(p_match_id,'')),'');
  v_denied jsonb;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  SELECT * INTO v_t FROM public.canonical_tournaments WHERE id=p_tournament_id
    AND tenant_id=p_tenant_id AND club_id=p_club_id AND mode='daily_play' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','TOURNAMENT_NOT_FOUND'); END IF;
  v_cmd:=public.daily_play_begin_command(p_tenant_id,p_tournament_id,'submit_score',p_idempotency_key);
  IF NOT coalesce((v_cmd->>'ok')::boolean,false) THEN RETURN v_cmd; END IF;
  IF (v_cmd->>'replay')::boolean THEN RETURN v_cmd->'result'; END IF;
  v_denied := public.daily_play_session_write_denied(v_t.status);
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  IF p_score_a IS NULL OR p_score_b IS NULL OR p_score_a<0 OR p_score_b<0 OR p_score_a=p_score_b
    THEN RETURN jsonb_build_object('ok',false,'code','INVALID_SCORE'); END IF;
  v_s:=coalesce(v_t.payload#>'{settings,dailyPlay}','{}'); v_actual:=coalesce(
    CASE WHEN (v_s->>'revision')~'^[0-9]+$' THEN (v_s->>'revision')::int END,0);
  v_matches:=CASE WHEN jsonb_typeof(v_s->'matches')='array' THEN v_s->'matches' ELSE '[]' END;
  SELECT value INTO v_m FROM jsonb_array_elements(v_matches) WHERE coalesce(value->>'id',value->>'matchId')=v_mid;
  IF v_m IS NULL THEN RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_FOUND'); END IF;
  IF v_m->>'status'='completed' THEN
    IF v_m->>'scoreA'=p_score_a::text AND v_m->>'scoreB'=p_score_b::text THEN
      v_result:=jsonb_build_object('ok',true,'revision',v_actual,'match',v_m,'replay',true);
      PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'submit_score',p_idempotency_key,v_result);
      RETURN v_result;
    END IF;
    RETURN jsonb_build_object('ok',false,'code','SCORE_CONFLICT');
  END IF;
  IF v_m->>'status' IS DISTINCT FROM 'playing' THEN
    RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_PLAYING');
  END IF;
  IF p_expected_version IS DISTINCT FROM v_actual THEN RETURN public.daily_play_version_conflict(p_expected_version,v_actual); END IF;
  v_m:=jsonb_set(v_m,'{scoreA}',to_jsonb(p_score_a),true);
  v_m:=jsonb_set(v_m,'{scoreB}',to_jsonb(p_score_b),true);
  v_m:=jsonb_set(v_m,'{winner}',to_jsonb(CASE WHEN p_score_a>p_score_b THEN 'A' ELSE 'B' END),true);
  v_m:=jsonb_set(v_m,'{status}','"completed"',true);
  v_m:=jsonb_set(v_m,'{completedAt}',to_jsonb(now()),true);
  UPDATE public.daily_play_court_leases SET status='released',released_at=now()
  WHERE tenant_id=p_tenant_id AND club_id=p_club_id AND tournament_id=p_tournament_id
    AND match_id=v_mid AND status='active';
  v_s:=jsonb_set(v_s,'{matches}',public.daily_play_replace_match(v_matches,v_mid,v_m),true);
  v_s:=jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result:=jsonb_build_object('ok',true,'revision',v_actual+1,'match',v_m);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'submit_score',p_idempotency_key,v_result);
  RETURN v_result;
END
$$;
