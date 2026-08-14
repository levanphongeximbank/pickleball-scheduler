-- Daily Play canonical session close + Singles/Open match-shape remediation.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Additive function replace only. No new tables/columns. No Staging/Production apply.

BEGIN;

CREATE OR REPLACE FUNCTION public.daily_play_canonical_match_type(p_match_type text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE lower(trim(coalesce(p_match_type, '')))
    WHEN 'men_single' THEN 'men_single'
    WHEN 'women_single' THEN 'women_single'
    WHEN 'men_double' THEN 'men_double'
    WHEN 'women_double' THEN 'women_double'
    WHEN 'mixed_double' THEN 'mixed_double'
    WHEN 'open_double' THEN 'open_double'
    WHEN 'singles_men' THEN 'men_single'
    WHEN 'singles_women' THEN 'women_single'
    WHEN 'doubles_men' THEN 'men_double'
    WHEN 'doubles_women' THEN 'women_double'
    WHEN 'doubles_mixed' THEN 'mixed_double'
    WHEN 'open' THEN 'open_double'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.daily_play_match_shape(p_match_type text)
RETURNS jsonb
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE public.daily_play_canonical_match_type(p_match_type)
    WHEN 'men_single' THEN jsonb_build_object('playersPerMatch',2,'teamSize',1,'genderComposition','male','kind','singles','matchType','men_single')
    WHEN 'women_single' THEN jsonb_build_object('playersPerMatch',2,'teamSize',1,'genderComposition','female','kind','singles','matchType','women_single')
    WHEN 'men_double' THEN jsonb_build_object('playersPerMatch',4,'teamSize',2,'genderComposition','male','kind','doubles','matchType','men_double')
    WHEN 'women_double' THEN jsonb_build_object('playersPerMatch',4,'teamSize',2,'genderComposition','female','kind','doubles','matchType','women_double')
    WHEN 'mixed_double' THEN jsonb_build_object('playersPerMatch',4,'teamSize',2,'genderComposition','mixed','kind','doubles','matchType','mixed_double')
    WHEN 'open_double' THEN jsonb_build_object('playersPerMatch',4,'teamSize',2,'genderComposition','open','kind','doubles','matchType','open_double')
    ELSE CASE lower(trim(coalesce(p_match_type, '')))
      WHEN 'auto' THEN jsonb_build_object('playersPerMatch',4,'teamSize',2,'genderComposition','auto','kind','auto','matchType','auto')
      ELSE NULL
    END
  END
$$;

CREATE OR REPLACE FUNCTION public.daily_play_validate_match_shape(p_match jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_type text;
  v_shape jsonb;
  v_team_size int;
  v_need int;
  v_players jsonb;
  v_distinct int;
BEGIN
  v_type := public.daily_play_canonical_match_type(coalesce(
    nullif(trim(coalesce(p_match->>'matchType','')), ''),
    nullif(trim(coalesce(p_match->>'competitionType','')), '')
  ));
  IF v_type IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_TYPE');
  END IF;
  v_shape := public.daily_play_match_shape(v_type);
  v_team_size := coalesce((v_shape->>'teamSize')::int, 2);
  v_need := coalesce((v_shape->>'playersPerMatch')::int, 4);
  v_players := public.daily_play_match_player_ids(p_match);
  SELECT count(DISTINCT value #>> '{}') INTO v_distinct
  FROM jsonb_array_elements(v_players);
  IF v_distinct IS DISTINCT FROM v_need OR jsonb_array_length(v_players) IS DISTINCT FROM v_need THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_SHAPE');
  END IF;
  IF p_match ? 'teamAPlayerIds' THEN
    IF jsonb_typeof(p_match->'teamAPlayerIds') IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_match->'teamAPlayerIds') IS DISTINCT FROM v_team_size THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_SHAPE');
    END IF;
  END IF;
  IF p_match ? 'teamBPlayerIds' THEN
    IF jsonb_typeof(p_match->'teamBPlayerIds') IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_match->'teamBPlayerIds') IS DISTINCT FROM v_team_size THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_SHAPE');
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'playersPerMatch', v_need,
    'teamSize', v_team_size,
    'matchType', v_type,
    'playerIds', v_players
  );
END
$$;

CREATE OR REPLACE FUNCTION public.daily_play_athlete_gender_key(
  p_tenant_id text, p_club_id text, p_player_id text
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_gender text;
BEGIN
  BEGIN
    v_id := p_player_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN 'unknown';
  END;
  IF NOT public.daily_play_athlete_eligible_for_club(p_tenant_id, p_club_id, p_player_id) THEN
    RETURN NULL;
  END IF;
  SELECT public.team_tournament_normalize_gender_key(p.gender)
  INTO v_gender
  FROM public.athletes a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  WHERE a.id = v_id AND a.tenant_id = p_tenant_id
  LIMIT 1;
  RETURN coalesce(v_gender, 'unknown');
END
$$;

CREATE OR REPLACE FUNCTION public.daily_play_validate_match_gender(
  p_tenant_id text, p_club_id text, p_match jsonb, p_match_type text
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_type text := public.daily_play_canonical_match_type(p_match_type);
  v_team_a jsonb;
  v_team_b jsonb;
  v_all jsonb;
  v_pid text;
  v_key text;
  v_male int := 0;
  v_female int := 0;
  v_other int := 0;
  v_unknown int := 0;
  v_a_male int := 0;
  v_a_female int := 0;
  v_b_male int := 0;
  v_b_female int := 0;
BEGIN
  IF v_type IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_TYPE');
  END IF;
  v_team_a := CASE WHEN jsonb_typeof(p_match->'teamAPlayerIds') = 'array'
    THEN p_match->'teamAPlayerIds' ELSE '[]'::jsonb END;
  v_team_b := CASE WHEN jsonb_typeof(p_match->'teamBPlayerIds') = 'array'
    THEN p_match->'teamBPlayerIds' ELSE '[]'::jsonb END;
  v_all := v_team_a || v_team_b;

  FOR v_pid IN SELECT value #>> '{}' FROM jsonb_array_elements(v_all) LOOP
    v_key := public.daily_play_athlete_gender_key(p_tenant_id, p_club_id, v_pid);
    IF v_key IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'PLAYER_NOT_ELIGIBLE');
    END IF;
    IF v_key = 'male' THEN v_male := v_male + 1;
    ELSIF v_key = 'female' THEN v_female := v_female + 1;
    ELSIF v_key = 'other' THEN v_other := v_other + 1;
    ELSE v_unknown := v_unknown + 1;
    END IF;
  END LOOP;

  FOR v_pid IN SELECT value #>> '{}' FROM jsonb_array_elements(v_team_a) LOOP
    v_key := public.daily_play_athlete_gender_key(p_tenant_id, p_club_id, v_pid);
    IF v_key = 'male' THEN v_a_male := v_a_male + 1;
    ELSIF v_key = 'female' THEN v_a_female := v_a_female + 1;
    END IF;
  END LOOP;
  FOR v_pid IN SELECT value #>> '{}' FROM jsonb_array_elements(v_team_b) LOOP
    v_key := public.daily_play_athlete_gender_key(p_tenant_id, p_club_id, v_pid);
    IF v_key = 'male' THEN v_b_male := v_b_male + 1;
    ELSIF v_key = 'female' THEN v_b_female := v_b_female + 1;
    END IF;
  END LOOP;

  IF v_type = 'open_double' THEN
    RETURN jsonb_build_object('ok', true, 'matchType', v_type);
  END IF;

  IF v_type = 'men_single' THEN
    IF jsonb_array_length(v_team_a) IS DISTINCT FROM 1
       OR jsonb_array_length(v_team_b) IS DISTINCT FROM 1
       OR v_male IS DISTINCT FROM 2 OR v_female <> 0 OR v_other <> 0 OR v_unknown <> 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_GENDER_COMPOSITION');
    END IF;
    RETURN jsonb_build_object('ok', true, 'matchType', v_type);
  END IF;

  IF v_type = 'women_single' THEN
    IF jsonb_array_length(v_team_a) IS DISTINCT FROM 1
       OR jsonb_array_length(v_team_b) IS DISTINCT FROM 1
       OR v_female IS DISTINCT FROM 2 OR v_male <> 0 OR v_other <> 0 OR v_unknown <> 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_GENDER_COMPOSITION');
    END IF;
    RETURN jsonb_build_object('ok', true, 'matchType', v_type);
  END IF;

  IF v_type = 'men_double' THEN
    IF v_male IS DISTINCT FROM 4 OR v_female <> 0 OR v_other <> 0 OR v_unknown <> 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_GENDER_COMPOSITION');
    END IF;
    RETURN jsonb_build_object('ok', true, 'matchType', v_type);
  END IF;

  IF v_type = 'women_double' THEN
    IF v_female IS DISTINCT FROM 4 OR v_male <> 0 OR v_other <> 0 OR v_unknown <> 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_GENDER_COMPOSITION');
    END IF;
    RETURN jsonb_build_object('ok', true, 'matchType', v_type);
  END IF;

  IF v_type = 'mixed_double' THEN
    IF v_a_male IS DISTINCT FROM 1 OR v_a_female IS DISTINCT FROM 1
       OR v_b_male IS DISTINCT FROM 1 OR v_b_female IS DISTINCT FROM 1
       OR v_other <> 0 OR v_unknown <> 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_GENDER_COMPOSITION');
    END IF;
    RETURN jsonb_build_object('ok', true, 'matchType', v_type);
  END IF;

  RETURN jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_TYPE');
END
$$;

CREATE OR REPLACE FUNCTION public.daily_play_session_write_denied(p_status text)
RETURNS jsonb
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(nullif(trim(p_status), ''), '')) = 'completed' THEN
      jsonb_build_object('ok', false, 'code', 'SESSION_ALREADY_COMPLETED')
    WHEN lower(coalesce(nullif(trim(p_status), ''), '')) = 'cancelled' THEN
      jsonb_build_object('ok', false, 'code', 'SESSION_NOT_ACTIVE')
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.daily_play_snapshot(
  p_tenant_id text, p_club_id text, p_tournament_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_t public.canonical_tournaments%ROWTYPE;
  v_state jsonb;
  v_courts jsonb;
  v_leases jsonb;
  v_occupied jsonb;
BEGIN
  SELECT * INTO v_t FROM public.canonical_tournaments
  WHERE id = p_tournament_id AND tenant_id = p_tenant_id
    AND club_id = p_club_id AND mode = 'daily_play';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_FOUND');
  END IF;

  v_state := coalesce(v_t.payload#>'{settings,dailyPlay}', '{}'::jsonb);
  v_state := jsonb_set(v_state, '{revision}', to_jsonb(coalesce(
    CASE WHEN (v_state->>'revision') ~ '^[0-9]+$'
      THEN (v_state->>'revision')::integer END, 0
  )), true);
  v_state := jsonb_set(v_state, '{checkedInPlayerIds}',
    CASE WHEN jsonb_typeof(v_state->'checkedInPlayerIds') = 'array'
      THEN v_state->'checkedInPlayerIds' ELSE '[]'::jsonb END, true);
  v_state := jsonb_set(v_state, '{matches}',
    CASE WHEN jsonb_typeof(v_state->'matches') = 'array'
      THEN v_state->'matches' ELSE '[]'::jsonb END, true);

  v_courts := public.daily_play_read_courts(
    p_club_id,
    CASE WHEN v_state ? 'enabledCourtIds' THEN v_state->'enabledCourtIds' ELSE NULL END
  );
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'matchId', l.match_id, 'courtId', l.court_id, 'leasedAt', l.leased_at
  ) ORDER BY l.leased_at), '[]'::jsonb)
  INTO v_leases
  FROM public.daily_play_court_leases l
  WHERE l.tenant_id = p_tenant_id AND l.club_id = p_club_id
    AND l.tournament_id = p_tournament_id AND l.status = 'active';

  SELECT coalesce(jsonb_agg(l.court_id ORDER BY l.court_id), '[]'::jsonb)
  INTO v_occupied
  FROM public.daily_play_court_leases l
  WHERE l.tenant_id = p_tenant_id
    AND l.club_id = p_club_id
    AND l.status = 'active';

  RETURN jsonb_build_object(
    'ok', true, 'tournamentId', p_tournament_id,
    'tournamentStatus', v_t.status,
    'state', v_state,
    'courts', v_courts, 'activeLeases', v_leases,
    'occupiedCourtIds', v_occupied
  );
END
$$;

CREATE OR REPLACE FUNCTION public.daily_play_check_in(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_player_id text,
  p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_t public.canonical_tournaments%ROWTYPE; v_s jsonb; v_cmd jsonb; v_result jsonb;
  v_actual integer; v_ids jsonb; v_pid text := nullif(trim(coalesce(p_player_id, '')), '');
  v_denied jsonb;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  SELECT * INTO v_t FROM public.canonical_tournaments
  WHERE id=p_tournament_id AND tenant_id=p_tenant_id AND club_id=p_club_id AND mode='daily_play'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','TOURNAMENT_NOT_FOUND'); END IF;
  IF v_pid IS NULL THEN RETURN jsonb_build_object('ok',false,'code','PLAYER_ID_REQUIRED'); END IF;
  IF NOT public.daily_play_athlete_eligible_for_club(p_tenant_id,p_club_id,v_pid) THEN
    RETURN jsonb_build_object('ok',false,'code','PLAYER_NOT_ELIGIBLE');
  END IF;
  v_cmd := public.daily_play_begin_command(p_tenant_id,p_tournament_id,'check_in',p_idempotency_key);
  IF NOT coalesce((v_cmd->>'ok')::boolean,false) THEN RETURN v_cmd; END IF;
  IF (v_cmd->>'replay')::boolean THEN RETURN v_cmd->'result'; END IF;
  v_denied := public.daily_play_session_write_denied(v_t.status);
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  v_s := coalesce(v_t.payload#>'{settings,dailyPlay}','{}'::jsonb);
  v_actual := coalesce(CASE WHEN (v_s->>'revision')~'^[0-9]+$' THEN (v_s->>'revision')::int END,0);
  IF p_expected_version IS DISTINCT FROM v_actual THEN
    RETURN public.daily_play_version_conflict(p_expected_version,v_actual);
  END IF;
  v_ids := CASE WHEN jsonb_typeof(v_s->'checkedInPlayerIds')='array'
    THEN v_s->'checkedInPlayerIds' ELSE '[]'::jsonb END;
  IF NOT v_ids @> jsonb_build_array(v_pid) THEN v_ids := v_ids || jsonb_build_array(v_pid); END IF;
  v_s := jsonb_set(v_s,'{checkedInPlayerIds}',v_ids,true);
  v_s := jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result := jsonb_build_object('ok',true,'revision',v_actual+1,'state',v_s);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'check_in',p_idempotency_key,v_result);
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.daily_play_check_out(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_player_id text,
  p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_t public.canonical_tournaments%ROWTYPE; v_s jsonb; v_cmd jsonb; v_result jsonb;
  v_actual integer; v_ids jsonb; v_matches jsonb; v_pid text := nullif(trim(coalesce(p_player_id,'')),'');
  v_denied jsonb;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  SELECT * INTO v_t FROM public.canonical_tournaments
  WHERE id=p_tournament_id AND tenant_id=p_tenant_id AND club_id=p_club_id AND mode='daily_play'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','TOURNAMENT_NOT_FOUND'); END IF;
  IF v_pid IS NULL THEN RETURN jsonb_build_object('ok',false,'code','PLAYER_ID_REQUIRED'); END IF;
  v_cmd := public.daily_play_begin_command(p_tenant_id,p_tournament_id,'check_out',p_idempotency_key);
  IF NOT coalesce((v_cmd->>'ok')::boolean,false) THEN RETURN v_cmd; END IF;
  IF (v_cmd->>'replay')::boolean THEN RETURN v_cmd->'result'; END IF;
  v_denied := public.daily_play_session_write_denied(v_t.status);
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  v_s := coalesce(v_t.payload#>'{settings,dailyPlay}','{}'::jsonb);
  v_actual := coalesce(CASE WHEN (v_s->>'revision')~'^[0-9]+$' THEN (v_s->>'revision')::int END,0);
  IF p_expected_version IS DISTINCT FROM v_actual THEN
    RETURN public.daily_play_version_conflict(p_expected_version,v_actual);
  END IF;
  v_matches := CASE WHEN jsonb_typeof(v_s->'matches')='array' THEN v_s->'matches' ELSE '[]'::jsonb END;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_matches) m
    WHERE coalesce(m->>'status','waiting') IN ('waiting','assigned','playing')
      AND public.daily_play_match_player_ids(m) @> jsonb_build_array(v_pid)
  ) THEN RETURN jsonb_build_object('ok',false,'code','CHECKOUT_PLAYER_ACTIVE'); END IF;
  SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb) INTO v_ids
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_s->'checkedInPlayerIds')='array'
    THEN v_s->'checkedInPlayerIds' ELSE '[]'::jsonb END) WITH ORDINALITY x(value,ord)
  WHERE value #>> '{}' <> v_pid;
  v_s := jsonb_set(v_s,'{checkedInPlayerIds}',v_ids,true);
  v_s := jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result := jsonb_build_object('ok',true,'revision',v_actual+1,'state',v_s);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'check_out',p_idempotency_key,v_result);
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.daily_play_create_matches(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_matches jsonb,
  p_eligible_player_count integer, p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_t public.canonical_tournaments%ROWTYPE; v_s jsonb; v_cmd jsonb; v_result jsonb;
  v_actual integer; v_eligible_actual integer; v_existing jsonb; v_courts jsonb; v_new jsonb := '[]'::jsonb;
  v_m jsonb; v_nm jsonb; v_mid text; v_players jsonb; v_shape jsonb; v_need int := 0; v_denied jsonb;
  v_canonical text; v_gender jsonb;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  SELECT * INTO v_t FROM public.canonical_tournaments
  WHERE id=p_tournament_id AND tenant_id=p_tenant_id AND club_id=p_club_id AND mode='daily_play'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','TOURNAMENT_NOT_FOUND'); END IF;
  v_cmd := public.daily_play_begin_command(p_tenant_id,p_tournament_id,'create_matches',p_idempotency_key);
  IF NOT coalesce((v_cmd->>'ok')::boolean,false) THEN RETURN v_cmd; END IF;
  IF (v_cmd->>'replay')::boolean THEN RETURN v_cmd->'result'; END IF;
  v_denied := public.daily_play_session_write_denied(v_t.status);
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  IF jsonb_typeof(p_matches) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('ok',false,'code','MATCHES_REQUIRED');
  END IF;
  IF jsonb_array_length(p_matches)=0 THEN
    RETURN jsonb_build_object('ok',false,'code','MATCHES_REQUIRED');
  END IF;
  v_s := coalesce(v_t.payload#>'{settings,dailyPlay}','{}'::jsonb);
  v_actual := coalesce(CASE WHEN (v_s->>'revision')~'^[0-9]+$' THEN (v_s->>'revision')::int END,0);
  IF p_expected_version IS DISTINCT FROM v_actual THEN
    RETURN public.daily_play_version_conflict(p_expected_version,v_actual);
  END IF;
  v_existing := CASE WHEN jsonb_typeof(v_s->'matches')='array' THEN v_s->'matches' ELSE '[]'::jsonb END;
  SELECT count(*)::integer INTO v_eligible_actual
  FROM jsonb_array_elements(CASE
    WHEN jsonb_typeof(v_s->'checkedInPlayerIds')='array' THEN v_s->'checkedInPlayerIds'
    ELSE '[]'::jsonb END) p
  WHERE public.daily_play_athlete_eligible_for_club(p_tenant_id,p_club_id,p #>> '{}')
    AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_existing) m
    WHERE coalesce(m->>'status','waiting') IN ('waiting','assigned','playing')
      AND public.daily_play_match_player_ids(m) @> jsonb_build_array(p)
  );
  FOR v_m IN SELECT value FROM jsonb_array_elements(p_matches) LOOP
    v_canonical := public.daily_play_canonical_match_type(coalesce(v_m->>'matchType', v_m->>'competitionType', v_s->>'matchType'));
    IF v_canonical IS NULL THEN
      RETURN jsonb_build_object('ok',false,'code','INVALID_MATCH_TYPE');
    END IF;
    v_shape := public.daily_play_match_shape(v_canonical);
    v_need := v_need + coalesce((v_shape->>'playersPerMatch')::int, 0);
  END LOOP;
  IF v_eligible_actual < v_need THEN
    RETURN jsonb_build_object('ok',false,'code','NOT_ENOUGH_PLAYERS');
  END IF;
  IF p_eligible_player_count IS NOT NULL AND p_eligible_player_count < 0 THEN
    RETURN jsonb_build_object('ok',false,'code','VALIDATION','error','eligiblePlayerCount invalid');
  END IF;
  v_courts := public.daily_play_read_courts(
    p_club_id, CASE WHEN v_s?'enabledCourtIds' THEN v_s->'enabledCourtIds' ELSE NULL END);
  IF jsonb_array_length(v_courts)=0 THEN
    RETURN jsonb_build_object('ok',false,'code','NO_COURT_CAPABILITY');
  END IF;

  FOR v_m IN SELECT value FROM jsonb_array_elements(p_matches) LOOP
    v_mid := nullif(trim(coalesce(v_m->>'id',v_m->>'matchId','')),'');
    v_canonical := public.daily_play_canonical_match_type(coalesce(v_m->>'matchType', v_m->>'competitionType', v_s->>'matchType'));
    IF v_canonical IS NULL THEN
      RETURN jsonb_build_object('ok',false,'code','INVALID_MATCH_TYPE');
    END IF;
    v_shape := public.daily_play_validate_match_shape(jsonb_set(v_m,'{matchType}',to_jsonb(v_canonical),true));
    IF v_mid IS NULL OR NOT coalesce((v_shape->>'ok')::boolean, false) THEN
      RETURN jsonb_build_object('ok',false,'code',coalesce(v_shape->>'code','INVALID_MATCH_SHAPE'));
    END IF;
    v_players := public.daily_play_match_player_ids(v_m);
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_existing||v_new) x
      WHERE coalesce(x->>'id',x->>'matchId')=v_mid) THEN
      RETURN jsonb_build_object('ok',false,'code','MATCH_ALREADY_EXISTS','matchId',v_mid);
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_players) p
      WHERE NOT (CASE WHEN jsonb_typeof(v_s->'checkedInPlayerIds')='array'
        THEN v_s->'checkedInPlayerIds' ELSE '[]'::jsonb END) @> jsonb_build_array(p)
    ) THEN RETURN jsonb_build_object('ok',false,'code','PLAYER_NOT_CHECKED_IN','matchId',v_mid); END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_players) p
      WHERE NOT public.daily_play_athlete_eligible_for_club(
        p_tenant_id,p_club_id,p #>> '{}'
      )
    ) THEN RETURN jsonb_build_object('ok',false,'code','PLAYER_NOT_ELIGIBLE','matchId',v_mid); END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_existing||v_new) x
      WHERE coalesce(x->>'status','waiting') IN ('waiting','assigned','playing')
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_players) p
          WHERE public.daily_play_match_player_ids(x) @> jsonb_build_array(p))
    ) THEN RETURN jsonb_build_object('ok',false,'code','PLAYER_ALREADY_ACTIVE','matchId',v_mid); END IF;
    v_gender := public.daily_play_validate_match_gender(p_tenant_id,p_club_id,v_m,v_canonical);
    IF NOT coalesce((v_gender->>'ok')::boolean, false) THEN
      RETURN v_gender;
    END IF;
    v_nm := jsonb_set(v_m,'{id}',to_jsonb(v_mid),true);
    v_nm := jsonb_set(v_nm,'{matchType}',to_jsonb(v_canonical),true);
    v_nm := jsonb_set(v_nm,'{playerIds}',v_players,true);
    v_nm := jsonb_set(v_nm,'{status}','"waiting"'::jsonb,true);
    v_nm := jsonb_set(v_nm,'{courtId}','null'::jsonb,true);
    v_new := v_new || jsonb_build_array(v_nm);
  END LOOP;

  v_s := jsonb_set(v_s,'{matches}',v_existing||v_new,true);
  v_s := jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result := jsonb_build_object('ok',true,'revision',v_actual+1,'matches',v_new,'state',v_s);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'create_matches',p_idempotency_key,v_result);
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.daily_play_assign_court(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_court_id text, p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_t public.canonical_tournaments%ROWTYPE; v_s jsonb; v_cmd jsonb; v_result jsonb;
  v_actual int; v_matches jsonb; v_m jsonb; v_mid text:=nullif(trim(coalesce(p_match_id,'')),'');
  v_cid text:=nullif(trim(coalesce(p_court_id,'')),''); v_candidate text; v_courts jsonb; v_denied jsonb;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  SELECT * INTO v_t FROM public.canonical_tournaments WHERE id=p_tournament_id
    AND tenant_id=p_tenant_id AND club_id=p_club_id AND mode='daily_play' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','TOURNAMENT_NOT_FOUND'); END IF;
  v_cmd:=public.daily_play_begin_command(p_tenant_id,p_tournament_id,'assign_court',p_idempotency_key);
  IF NOT coalesce((v_cmd->>'ok')::boolean,false) THEN RETURN v_cmd; END IF;
  IF (v_cmd->>'replay')::boolean THEN RETURN v_cmd->'result'; END IF;
  v_denied := public.daily_play_session_write_denied(v_t.status);
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  v_s:=coalesce(v_t.payload#>'{settings,dailyPlay}','{}'); v_actual:=coalesce(
    CASE WHEN (v_s->>'revision')~'^[0-9]+$' THEN (v_s->>'revision')::int END,0);
  IF p_expected_version IS DISTINCT FROM v_actual THEN RETURN public.daily_play_version_conflict(p_expected_version,v_actual); END IF;
  v_matches:=CASE WHEN jsonb_typeof(v_s->'matches')='array' THEN v_s->'matches' ELSE '[]' END;
  SELECT value INTO v_m FROM jsonb_array_elements(v_matches) WHERE coalesce(value->>'id',value->>'matchId')=v_mid;
  IF v_m IS NULL THEN RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_FOUND'); END IF;
  IF v_m->>'status' IS DISTINCT FROM 'waiting' THEN
    RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_WAITING');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(public.daily_play_match_player_ids(v_m)) p
    WHERE NOT (CASE WHEN jsonb_typeof(v_s->'checkedInPlayerIds')='array'
      THEN v_s->'checkedInPlayerIds' ELSE '[]'::jsonb END) @> jsonb_build_array(p)
  ) THEN RETURN jsonb_build_object('ok',false,'code','PLAYER_NOT_CHECKED_IN','matchId',v_mid); END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(public.daily_play_match_player_ids(v_m)) p
    WHERE NOT public.daily_play_athlete_eligible_for_club(
      p_tenant_id,p_club_id,p #>> '{}'
    )
  ) THEN RETURN jsonb_build_object('ok',false,'code','PLAYER_NOT_ELIGIBLE','matchId',v_mid); END IF;
  v_courts:=public.daily_play_read_courts(
    p_club_id,CASE WHEN v_s?'enabledCourtIds' THEN v_s->'enabledCourtIds' ELSE NULL END);
  IF jsonb_array_length(v_courts)=0 THEN
    RETURN jsonb_build_object('ok',false,'code','NO_COURT_CAPABILITY');
  END IF;
  IF v_cid IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_courts) c WHERE coalesce(c->>'id',c->>'courtId')=v_cid)
      THEN RETURN jsonb_build_object('ok',false,'code','COURT_NOT_AVAILABLE'); END IF;
    BEGIN
      INSERT INTO public.daily_play_court_leases(tenant_id,club_id,tournament_id,match_id,court_id)
      VALUES(p_tenant_id,p_club_id,p_tournament_id,v_mid,v_cid);
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('ok',false,'code','COURT_ALREADY_LEASED','courtId',v_cid);
    END;
  ELSE
    FOR v_candidate IN
      SELECT coalesce(c->>'id',c->>'courtId') FROM jsonb_array_elements(v_courts) c
    LOOP
      BEGIN
        INSERT INTO public.daily_play_court_leases(tenant_id,club_id,tournament_id,match_id,court_id)
        VALUES(p_tenant_id,p_club_id,p_tournament_id,v_mid,v_candidate);
        v_cid:=v_candidate;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        v_cid:=NULL;
      END;
    END LOOP;
    IF v_cid IS NULL THEN
      RETURN jsonb_build_object('ok',false,'code','NO_COURT_AVAILABLE');
    END IF;
  END IF;
  v_m:=jsonb_set(v_m,'{courtId}',to_jsonb(v_cid),true);
  v_m:=jsonb_set(v_m,'{status}','"assigned"',true);
  v_s:=jsonb_set(v_s,'{matches}',public.daily_play_replace_match(v_matches,v_mid,v_m),true);
  v_s:=jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result:=jsonb_build_object('ok',true,'revision',v_actual+1,'match',v_m);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'assign_court',p_idempotency_key,v_result);
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.daily_play_start_match(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_t public.canonical_tournaments%ROWTYPE; v_s jsonb; v_cmd jsonb; v_result jsonb;
  v_actual int; v_matches jsonb; v_m jsonb; v_cid text;
  v_mid text:=nullif(trim(coalesce(p_match_id,'')),''); v_denied jsonb;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  SELECT * INTO v_t FROM public.canonical_tournaments WHERE id=p_tournament_id
    AND tenant_id=p_tenant_id AND club_id=p_club_id AND mode='daily_play' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','TOURNAMENT_NOT_FOUND'); END IF;
  v_cmd:=public.daily_play_begin_command(p_tenant_id,p_tournament_id,'start_match',p_idempotency_key);
  IF NOT coalesce((v_cmd->>'ok')::boolean,false) THEN RETURN v_cmd; END IF;
  IF (v_cmd->>'replay')::boolean THEN RETURN v_cmd->'result'; END IF;
  v_denied := public.daily_play_session_write_denied(v_t.status);
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  v_s:=coalesce(v_t.payload#>'{settings,dailyPlay}','{}'); v_actual:=coalesce(
    CASE WHEN (v_s->>'revision')~'^[0-9]+$' THEN (v_s->>'revision')::int END,0);
  IF p_expected_version IS DISTINCT FROM v_actual THEN
    RETURN public.daily_play_version_conflict(p_expected_version,v_actual);
  END IF;
  v_matches:=CASE WHEN jsonb_typeof(v_s->'matches')='array' THEN v_s->'matches' ELSE '[]' END;
  SELECT value INTO v_m FROM jsonb_array_elements(v_matches)
    WHERE coalesce(value->>'id',value->>'matchId')=v_mid;
  IF v_m IS NULL THEN RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_FOUND'); END IF;
  IF v_m->>'status' IS DISTINCT FROM 'assigned' THEN
    RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_ASSIGNED');
  END IF;
  v_cid:=nullif(trim(coalesce(v_m->>'courtId','')),'');
  IF v_cid IS NULL THEN RETURN jsonb_build_object('ok',false,'code','COURT_ID_REQUIRED'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.daily_play_court_leases
    WHERE tenant_id=p_tenant_id AND club_id=p_club_id AND tournament_id=p_tournament_id
      AND match_id=v_mid AND court_id=v_cid AND status='active'
  ) THEN RETURN jsonb_build_object('ok',false,'code','COURT_LEASE_NOT_ACTIVE'); END IF;
  v_m:=jsonb_set(v_m,'{status}','"playing"',true);
  v_m:=jsonb_set(v_m,'{startedAt}',to_jsonb(now()),true);
  v_s:=jsonb_set(v_s,'{matches}',public.daily_play_replace_match(v_matches,v_mid,v_m),true);
  v_s:=jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result:=jsonb_build_object('ok',true,'revision',v_actual+1,'match',v_m);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'start_match',p_idempotency_key,v_result);
  RETURN v_result;
END
$$;

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

CREATE OR REPLACE FUNCTION public.daily_play_cancel_match(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_expected_version integer, p_idempotency_key text
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
  v_cmd:=public.daily_play_begin_command(p_tenant_id,p_tournament_id,'cancel_match',p_idempotency_key);
  IF NOT coalesce((v_cmd->>'ok')::boolean,false) THEN RETURN v_cmd; END IF;
  IF (v_cmd->>'replay')::boolean THEN RETURN v_cmd->'result'; END IF;
  v_denied := public.daily_play_session_write_denied(v_t.status);
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  v_s:=coalesce(v_t.payload#>'{settings,dailyPlay}','{}'); v_actual:=coalesce(
    CASE WHEN (v_s->>'revision')~'^[0-9]+$' THEN (v_s->>'revision')::int END,0);
  v_matches:=CASE WHEN jsonb_typeof(v_s->'matches')='array' THEN v_s->'matches' ELSE '[]' END;
  SELECT value INTO v_m FROM jsonb_array_elements(v_matches) WHERE coalesce(value->>'id',value->>'matchId')=v_mid;
  IF v_m IS NULL THEN RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_FOUND'); END IF;
  IF v_m->>'status'='completed' THEN RETURN jsonb_build_object('ok',false,'code','MATCH_COMPLETED_IMMUTABLE'); END IF;
  IF p_expected_version IS DISTINCT FROM v_actual THEN RETURN public.daily_play_version_conflict(p_expected_version,v_actual); END IF;
  v_m:=jsonb_set(v_m,'{status}','"cancelled"',true); v_m:=jsonb_set(v_m,'{cancelledAt}',to_jsonb(now()),true);
  UPDATE public.daily_play_court_leases SET status='released',released_at=now()
  WHERE tenant_id=p_tenant_id AND club_id=p_club_id AND tournament_id=p_tournament_id
    AND match_id=v_mid AND status='active';
  v_s:=jsonb_set(v_s,'{matches}',public.daily_play_replace_match(v_matches,v_mid,v_m),true);
  v_s:=jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result:=jsonb_build_object('ok',true,'revision',v_actual+1,'match',v_m);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'cancel_match',p_idempotency_key,v_result);
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.daily_play_change_court(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_court_id text, p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_t public.canonical_tournaments%ROWTYPE; v_s jsonb; v_cmd jsonb; v_result jsonb;
  v_actual int; v_matches jsonb; v_m jsonb; v_courts jsonb;
  v_mid text:=nullif(trim(coalesce(p_match_id,'')),''); v_cid text:=nullif(trim(coalesce(p_court_id,'')),'');
  v_denied jsonb;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  SELECT * INTO v_t FROM public.canonical_tournaments WHERE id=p_tournament_id
    AND tenant_id=p_tenant_id AND club_id=p_club_id AND mode='daily_play' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','TOURNAMENT_NOT_FOUND'); END IF;
  IF v_cid IS NULL THEN RETURN jsonb_build_object('ok',false,'code','COURT_ID_REQUIRED'); END IF;
  v_cmd:=public.daily_play_begin_command(p_tenant_id,p_tournament_id,'change_court',p_idempotency_key);
  IF NOT coalesce((v_cmd->>'ok')::boolean,false) THEN RETURN v_cmd; END IF;
  IF (v_cmd->>'replay')::boolean THEN RETURN v_cmd->'result'; END IF;
  v_denied := public.daily_play_session_write_denied(v_t.status);
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  v_s:=coalesce(v_t.payload#>'{settings,dailyPlay}','{}'); v_actual:=coalesce(
    CASE WHEN (v_s->>'revision')~'^[0-9]+$' THEN (v_s->>'revision')::int END,0);
  IF p_expected_version IS DISTINCT FROM v_actual THEN RETURN public.daily_play_version_conflict(p_expected_version,v_actual); END IF;
  v_matches:=CASE WHEN jsonb_typeof(v_s->'matches')='array' THEN v_s->'matches' ELSE '[]' END;
  SELECT value INTO v_m FROM jsonb_array_elements(v_matches) WHERE coalesce(value->>'id',value->>'matchId')=v_mid;
  IF v_m IS NULL THEN RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_FOUND'); END IF;
  IF coalesce(v_m->>'status','waiting') NOT IN ('assigned','playing') THEN
    RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_ACTIVE');
  END IF;
  v_courts:=public.daily_play_read_courts(p_club_id,CASE WHEN v_s?'enabledCourtIds' THEN v_s->'enabledCourtIds' ELSE NULL END);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_courts)c WHERE coalesce(c->>'id',c->>'courtId')=v_cid)
    THEN RETURN jsonb_build_object('ok',false,'code','COURT_NOT_AVAILABLE'); END IF;
  IF coalesce(v_m->>'courtId','')<>v_cid THEN
    BEGIN
      INSERT INTO public.daily_play_court_leases(tenant_id,club_id,tournament_id,match_id,court_id)
      VALUES(p_tenant_id,p_club_id,p_tournament_id,v_mid,v_cid);
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('ok',false,'code','COURT_ALREADY_LEASED','courtId',v_cid);
    END;
    UPDATE public.daily_play_court_leases SET status='released',released_at=now()
    WHERE tenant_id=p_tenant_id AND club_id=p_club_id AND tournament_id=p_tournament_id
      AND match_id=v_mid AND status='active' AND court_id<>v_cid;
  END IF;
  v_m:=jsonb_set(v_m,'{courtId}',to_jsonb(v_cid),true);
  v_s:=jsonb_set(v_s,'{matches}',public.daily_play_replace_match(v_matches,v_mid,v_m),true);
  v_s:=jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result:=jsonb_build_object('ok',true,'revision',v_actual+1,'match',v_m);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'change_court',p_idempotency_key,v_result);
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.daily_play_close_session(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_expected_version integer,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_t public.canonical_tournaments%ROWTYPE;
  v_s jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_actual int;
  v_matches jsonb;
  v_assigned int := 0;
  v_playing int := 0;
  v_waiting int := 0;
  v_completed int := 0;
  v_unknown int := 0;
  v_checked int := 0;
  v_cancelled_waiting int := 0;
  v_actor text;
  v_status text;
  v_now timestamptz := now();
  v_next jsonb;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');

  SELECT * INTO v_t FROM public.canonical_tournaments
  WHERE id=p_tournament_id AND tenant_id=p_tenant_id AND club_id=p_club_id AND mode='daily_play'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','TOURNAMENT_NOT_FOUND'); END IF;

  v_cmd := public.daily_play_begin_command(p_tenant_id,p_tournament_id,'close_session',p_idempotency_key);
  IF NOT coalesce((v_cmd->>'ok')::boolean,false) THEN RETURN v_cmd; END IF;
  IF (v_cmd->>'replay')::boolean THEN RETURN v_cmd->'result'; END IF;

  v_status := lower(trim(coalesce(v_t.status,'')));
  IF v_status = 'completed' THEN
    RETURN jsonb_build_object('ok',false,'code','SESSION_ALREADY_COMPLETED');
  END IF;
  IF v_status NOT IN ('draft','registration','ready','active') THEN
    RETURN jsonb_build_object('ok',false,'code','SESSION_NOT_ACTIVE');
  END IF;

  v_actor := nullif(auth.uid()::text, '');
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','NOT_AUTHENTICATED');
  END IF;

  v_s := coalesce(v_t.payload#>'{settings,dailyPlay}','{}'::jsonb);
  v_actual := coalesce(CASE WHEN (v_s->>'revision')~'^[0-9]+$' THEN (v_s->>'revision')::int END,0);
  IF p_expected_version IS DISTINCT FROM v_actual THEN
    RETURN public.daily_play_version_conflict(p_expected_version, v_actual);
  END IF;

  v_matches := CASE WHEN jsonb_typeof(v_s->'matches')='array' THEN v_s->'matches' ELSE '[]'::jsonb END;
  SELECT
    count(*) FILTER (WHERE lower(coalesce(nullif(trim(m->>'status'),''),'waiting'))='assigned'),
    count(*) FILTER (WHERE lower(coalesce(nullif(trim(m->>'status'),''),'waiting'))='playing'),
    count(*) FILTER (WHERE lower(coalesce(nullif(trim(m->>'status'),''),'waiting'))='waiting'),
    count(*) FILTER (WHERE lower(coalesce(nullif(trim(m->>'status'),''),'waiting')) IN ('completed','forfeit')),
    count(*) FILTER (
      WHERE lower(coalesce(nullif(trim(m->>'status'),''),'waiting'))
        NOT IN ('waiting','completed','cancelled','forfeit','assigned','playing')
    )
  INTO v_assigned, v_playing, v_waiting, v_completed, v_unknown
  FROM jsonb_array_elements(v_matches) m;

  IF v_assigned > 0 OR v_playing > 0 OR v_unknown > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'SESSION_CLOSE_BLOCKED',
      'assignedCount', v_assigned,
      'playingCount', v_playing,
      'unknownCount', v_unknown
    );
  END IF;

  SELECT coalesce(jsonb_array_length(
    CASE WHEN jsonb_typeof(v_s->'checkedInPlayerIds')='array'
      THEN v_s->'checkedInPlayerIds' ELSE '[]'::jsonb END
  ), 0) INTO v_checked;

  SELECT coalesce(jsonb_agg(
    CASE WHEN lower(coalesce(nullif(trim(m.match->>'status'),''),'waiting')) = 'waiting' THEN
      jsonb_set(
        jsonb_set(
          jsonb_set(m.match, '{status}', '"cancelled"'),
          '{reason}', '"session_closed"'
        ),
        '{cancelledAt}', to_jsonb(v_now)
      )
    ELSE m.match END
    ORDER BY m.ord
  ), '[]'::jsonb)
  INTO v_next
  FROM jsonb_array_elements(v_matches) WITH ORDINALITY AS m(match, ord);

  v_cancelled_waiting := v_waiting;

  v_s := jsonb_set(v_s, '{matches}', v_next, true);
  v_s := jsonb_set(v_s, '{checkedInPlayerIds}', '[]'::jsonb, true);
  v_s := jsonb_set(v_s, '{closedAt}', to_jsonb(v_now), true);
  v_s := jsonb_set(v_s, '{closedBy}', to_jsonb(v_actor), true);
  v_s := jsonb_set(v_s, '{closeSummary}', jsonb_build_object(
    'completedMatchCount', v_completed,
    'cancelledWaitingCount', v_cancelled_waiting,
    'checkedInCountAtClose', v_checked
  ), true);
  v_s := jsonb_set(v_s, '{revision}', to_jsonb(v_actual + 1), true);

  BEGIN
    IF NOT public.daily_play_write_state(p_tournament_id, v_actual, v_s) THEN
      RAISE EXCEPTION 'DAILY_PLAY_CLOSE_CAS' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.daily_play_court_leases
    SET status = 'released', released_at = v_now
    WHERE tenant_id = p_tenant_id
      AND club_id = p_club_id
      AND tournament_id = p_tournament_id
      AND status = 'active';

    UPDATE public.canonical_tournaments
    SET status = 'completed', updated_at = v_now
    WHERE id = p_tournament_id
      AND tenant_id = p_tenant_id
      AND club_id = p_club_id;

    v_result := jsonb_build_object(
      'ok', true,
      'revision', v_actual + 1,
      'tournamentStatus', 'completed',
      'closeSummary', v_s->'closeSummary',
      'state', v_s
    );
    PERFORM public.daily_play_finish_command(
      p_tenant_id, p_tournament_id, 'close_session', p_idempotency_key, v_result
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RETURN public.daily_play_version_conflict(p_expected_version, v_actual);
  END;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.daily_play_canonical_match_type(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.daily_play_match_shape(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.daily_play_validate_match_shape(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.daily_play_athlete_gender_key(text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.daily_play_validate_match_gender(text,text,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.daily_play_session_write_denied(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.daily_play_snapshot(text,text,uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.daily_play_check_in(text,text,uuid,text,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.daily_play_check_out(text,text,uuid,text,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.daily_play_create_matches(text,text,uuid,jsonb,integer,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.daily_play_assign_court(text,text,uuid,text,text,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.daily_play_start_match(text,text,uuid,text,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.daily_play_submit_score(text,text,uuid,text,integer,integer,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.daily_play_cancel_match(text,text,uuid,text,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.daily_play_change_court(text,text,uuid,text,text,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.daily_play_close_session(text,text,uuid,integer,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.daily_play_check_in(text,text,uuid,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_check_out(text,text,uuid,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_create_matches(text,text,uuid,jsonb,integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_assign_court(text,text,uuid,text,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_start_match(text,text,uuid,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_submit_score(text,text,uuid,text,integer,integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_cancel_match(text,text,uuid,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_change_court(text,text,uuid,text,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_close_session(text,text,uuid,integer,text) TO authenticated;

COMMIT;
