-- M8 Competition Remote SSOT — command + single finalize writer RPCs
-- p_tenant_id is text (matches venues.id / user_venue_id()). No uuid/text casts.
BEGIN;

-- Drop legacy uuid-tenant signatures (B-STG-02) and current text signatures for idempotent re-apply.
DROP FUNCTION IF EXISTS public.competition_ssot_append_command(uuid, uuid, text, jsonb, text);
DROP FUNCTION IF EXISTS public.competition_ssot_upsert_working_score(uuid, uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.competition_ssot_finalize_match_result(uuid, uuid, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.competition_ssot_append_command(text, uuid, text, jsonb, text);
DROP FUNCTION IF EXISTS public.competition_ssot_upsert_working_score(text, uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.competition_ssot_finalize_match_result(text, uuid, jsonb, text, text, text);

CREATE OR REPLACE FUNCTION public.competition_ssot_append_command(
  p_tenant_id text,
  p_competition_id uuid,
  p_command_type text,
  p_command_payload jsonb,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing jsonb;
  v_id bigint;
BEGIN
  IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) = 0
     OR p_competition_id IS NULL
     OR coalesce(trim(p_idempotency_key), '') = '' THEN
    RAISE EXCEPTION 'COMPETITION_SSOT_INVALID_ARGS';
  END IF;
  IF NOT (public.is_super_admin() OR p_tenant_id = public.user_venue_id()) THEN
    RAISE EXCEPTION 'COMPETITION_SSOT_FORBIDDEN';
  END IF;

  SELECT response INTO v_existing
  FROM public.competition_ssot_idempotency
  WHERE tenant_id = p_tenant_id AND scope = 'command' AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.competition_ssot_command_log (
    competition_id, tenant_id, command_type, command_payload, idempotency_key, actor_id
  ) VALUES (
    p_competition_id, p_tenant_id, p_command_type, coalesce(p_command_payload, '{}'::jsonb),
    p_idempotency_key, auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.competition_ssot_audit_events (
    competition_id, tenant_id, event_type, event_payload, actor_id
  ) VALUES (
    p_competition_id, p_tenant_id, 'command_appended',
    jsonb_build_object('command_id', v_id, 'command_type', p_command_type),
    auth.uid()
  );

  v_existing := jsonb_build_object('ok', true, 'command_id', v_id, 'replay', false);
  INSERT INTO public.competition_ssot_idempotency (tenant_id, scope, idempotency_key, response)
  VALUES (p_tenant_id, 'command', p_idempotency_key, v_existing);

  RETURN v_existing;
END;
$$;

CREATE OR REPLACE FUNCTION public.competition_ssot_upsert_working_score(
  p_tenant_id text,
  p_match_id uuid,
  p_working_score jsonb,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing jsonb;
  v_comp uuid;
BEGIN
  IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) = 0
     OR p_match_id IS NULL
     OR coalesce(trim(p_idempotency_key), '') = '' THEN
    RAISE EXCEPTION 'COMPETITION_SSOT_INVALID_ARGS';
  END IF;
  IF NOT (public.is_super_admin() OR p_tenant_id = public.user_venue_id()) THEN
    RAISE EXCEPTION 'COMPETITION_SSOT_FORBIDDEN';
  END IF;

  SELECT response INTO v_existing
  FROM public.competition_ssot_idempotency
  WHERE tenant_id = p_tenant_id AND scope = 'working_score' AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  UPDATE public.competition_ssot_matches
  SET working_score = coalesce(p_working_score, '{}'::jsonb),
      status = CASE WHEN status = 'finalized' THEN status ELSE 'score_pending' END,
      updated_at = now()
  WHERE id = p_match_id AND tenant_id = p_tenant_id AND status <> 'finalized'
  RETURNING competition_id INTO v_comp;

  IF v_comp IS NULL THEN
    RAISE EXCEPTION 'COMPETITION_SSOT_MATCH_NOT_WRITABLE';
  END IF;

  v_existing := jsonb_build_object('ok', true, 'match_id', p_match_id, 'replay', false);
  INSERT INTO public.competition_ssot_idempotency (tenant_id, scope, idempotency_key, response)
  VALUES (p_tenant_id, 'working_score', p_idempotency_key, v_existing);
  RETURN v_existing;
END;
$$;

-- THE single finalized-result writer
CREATE OR REPLACE FUNCTION public.competition_ssot_finalize_match_result(
  p_tenant_id text,
  p_match_id uuid,
  p_result_payload jsonb,
  p_idempotency_key text,
  p_winner_side text DEFAULT NULL,
  p_source text DEFAULT 'competition_ssot_finalize'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing jsonb;
  v_comp uuid;
  v_status text;
  v_result_id uuid;
BEGIN
  IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) = 0
     OR p_match_id IS NULL
     OR coalesce(trim(p_idempotency_key), '') = '' THEN
    RAISE EXCEPTION 'COMPETITION_SSOT_INVALID_ARGS';
  END IF;
  IF NOT (public.is_super_admin() OR p_tenant_id = public.user_venue_id()) THEN
    RAISE EXCEPTION 'COMPETITION_SSOT_FORBIDDEN';
  END IF;
  IF p_source NOT IN ('competition_ssot_finalize','referee_pipeline','system_recovery') THEN
    RAISE EXCEPTION 'COMPETITION_SSOT_INVALID_SOURCE';
  END IF;

  SELECT response INTO v_existing
  FROM public.competition_ssot_idempotency
  WHERE tenant_id = p_tenant_id AND scope = 'finalize' AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_existing || jsonb_build_object('replay', true);
  END IF;

  SELECT competition_id, status INTO v_comp, v_status
  FROM public.competition_ssot_matches
  WHERE id = p_match_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_comp IS NULL THEN
    RAISE EXCEPTION 'COMPETITION_SSOT_MATCH_NOT_FOUND';
  END IF;
  IF v_status = 'finalized' THEN
    SELECT to_jsonb(r) INTO v_existing
    FROM public.competition_ssot_finalized_results r
    WHERE match_id = p_match_id;
    RETURN jsonb_build_object('ok', true, 'replay', true, 'already_finalized', true, 'result', v_existing);
  END IF;

  INSERT INTO public.competition_ssot_finalized_results (
    competition_id, match_id, tenant_id, idempotency_key, result_payload, winner_side, finalized_by, source
  ) VALUES (
    v_comp, p_match_id, p_tenant_id, p_idempotency_key,
    coalesce(p_result_payload, '{}'::jsonb), p_winner_side, auth.uid(), p_source
  )
  RETURNING id INTO v_result_id;

  UPDATE public.competition_ssot_matches
  SET status = 'finalized', updated_at = now()
  WHERE id = p_match_id;

  INSERT INTO public.competition_ssot_audit_events (
    competition_id, tenant_id, event_type, event_payload, actor_id
  ) VALUES (
    v_comp, p_tenant_id, 'match_finalized',
    jsonb_build_object('match_id', p_match_id, 'result_id', v_result_id, 'source', p_source),
    auth.uid()
  );

  INSERT INTO public.competition_ssot_command_log (
    competition_id, tenant_id, command_type, command_payload, idempotency_key, actor_id
  ) VALUES (
    v_comp, p_tenant_id, 'finalize_match_result',
    jsonb_build_object('match_id', p_match_id, 'result_id', v_result_id),
    p_idempotency_key || ':cmd', auth.uid()
  );

  v_existing := jsonb_build_object(
    'ok', true,
    'replay', false,
    'result_id', v_result_id,
    'match_id', p_match_id,
    'competition_id', v_comp
  );
  INSERT INTO public.competition_ssot_idempotency (tenant_id, scope, idempotency_key, response)
  VALUES (p_tenant_id, 'finalize', p_idempotency_key, v_existing);

  RETURN v_existing;
END;
$$;

REVOKE ALL ON FUNCTION public.competition_ssot_append_command(text, uuid, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.competition_ssot_upsert_working_score(text, uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.competition_ssot_finalize_match_result(text, uuid, jsonb, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.competition_ssot_append_command(text, uuid, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.competition_ssot_upsert_working_score(text, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.competition_ssot_finalize_match_result(text, uuid, jsonb, text, text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.competition_ssot_append_command(text, uuid, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.competition_ssot_upsert_working_score(text, uuid, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.competition_ssot_finalize_match_result(text, uuid, jsonb, text, text, text) TO service_role;

COMMIT;
