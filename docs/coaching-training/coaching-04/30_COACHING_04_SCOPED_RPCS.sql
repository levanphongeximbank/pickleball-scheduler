-- =============================================================================
-- COACHING-04 — Scoped SECURITY DEFINER RPCs for assigned coach mutations
-- Purpose: Attendance record, evaluation submit, entitlement consume under
--          assignment checks. Actor ALWAYS auth.uid()::text — never client.
-- Status: AUTHORED ONLY — do not apply without Owner GO.
--
-- Fixed search_path. Auth checks. REVOKE PUBLIC / anon. GRANT authenticated.
-- No service_role EXECUTE (same posture as COACHING-02 atomic RPCs).
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- coaching_04_record_assigned_attendance
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.coaching_04_record_assigned_attendance(
  text, text, text, text, text, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.coaching_04_record_assigned_attendance(
  p_tenant_id text,
  p_club_id text,
  p_attendance_id text,
  p_session_id text,
  p_player_id text,
  p_status text,
  p_enrollment_id text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_venue_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor_id text;
  v_session public.coaching_training_sessions%ROWTYPE;
  v_row public.coaching_attendance_records%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'COACHING_MISSING_ACTOR'
      USING ERRCODE = '42501';
  END IF;

  v_actor_id := v_uid::text;

  IF length(trim(coalesce(p_tenant_id, ''))) = 0
     OR length(trim(coalesce(p_club_id, ''))) = 0 THEN
    RAISE EXCEPTION 'COACHING_MISSING_SCOPE'
      USING ERRCODE = '42501';
  END IF;

  IF public.user_venue_id() IS NULL OR public.user_club_id() IS NULL THEN
    RAISE EXCEPTION 'COACHING_MISSING_SCOPE'
      USING ERRCODE = '42501';
  END IF;

  IF p_tenant_id <> public.user_venue_id() OR p_club_id <> public.user_club_id() THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_SCOPE'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.coaching_04_has_assigned_action('coaching.assigned.attendance.record') THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_ACTION'
      USING ERRCODE = '42501';
  END IF;

  IF length(trim(coalesce(p_attendance_id, ''))) = 0
     OR length(trim(coalesce(p_session_id, ''))) = 0
     OR length(trim(coalesce(p_player_id, ''))) = 0 THEN
    RAISE EXCEPTION 'COACHING_INVALID_INPUT: attendance_id, session_id, player_id required'
      USING ERRCODE = '22023';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('absent', 'present', 'late', 'excused') THEN
    RAISE EXCEPTION 'COACHING_INVALID_STATUS'
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.coaching_04_coach_owns_session(p_session_id) THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_SCOPE: session not owned by active coach ref'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_session
  FROM public.coaching_training_sessions
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND session_id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COACHING_NOT_FOUND: session'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.coaching_04_coach_assigned_to_player(p_player_id, v_session.program_id) THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_SCOPE: player not actively assigned'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.coaching_attendance_records (
    attendance_id,
    tenant_id,
    club_id,
    venue_id,
    session_id,
    player_id,
    enrollment_id,
    status,
    recorded_by_actor_id,
    notes,
    version,
    created_at,
    updated_at
  ) VALUES (
    trim(p_attendance_id),
    p_tenant_id,
    p_club_id,
    coalesce(nullif(trim(coalesce(p_venue_id, '')), ''), v_session.venue_id),
    p_session_id,
    p_player_id,
    nullif(trim(coalesce(p_enrollment_id, '')), ''),
    p_status,
    v_actor_id,
    p_notes,
    1,
    v_now,
    v_now
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('attendance', to_jsonb(v_row));
END;
$$;

COMMENT ON FUNCTION public.coaching_04_record_assigned_attendance(
  text, text, text, text, text, text, text, text, text
) IS
  'COACHING-04 assigned attendance insert. Validates ownership + active assignment. Actor from auth.uid() only.';

REVOKE ALL ON FUNCTION public.coaching_04_record_assigned_attendance(
  text, text, text, text, text, text, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_04_record_assigned_attendance(
  text, text, text, text, text, text, text, text, text
) FROM anon;
REVOKE ALL ON FUNCTION public.coaching_04_record_assigned_attendance(
  text, text, text, text, text, text, text, text, text
) FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_04_record_assigned_attendance(
  text, text, text, text, text, text, text, text, text
) TO authenticated;

-- -----------------------------------------------------------------------------
-- coaching_04_submit_assigned_evaluation
-- Inserts new draft/submitted row, or updates an existing draft → submitted.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.coaching_04_submit_assigned_evaluation(
  text, text, text, text, text, text, text, numeric, text, text, text, integer
);

CREATE OR REPLACE FUNCTION public.coaching_04_submit_assigned_evaluation(
  p_tenant_id text,
  p_club_id text,
  p_evaluation_id text,
  p_player_id text,
  p_status text,
  p_summary text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_rating numeric DEFAULT NULL,
  p_program_id text DEFAULT NULL,
  p_revises_evaluation_id text DEFAULT NULL,
  p_venue_id text DEFAULT NULL,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_coach_ref text;
  v_existing public.coaching_evaluations%ROWTYPE;
  v_row public.coaching_evaluations%ROWTYPE;
  v_now timestamptz := now();
  v_submitted_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'COACHING_MISSING_ACTOR'
      USING ERRCODE = '42501';
  END IF;

  IF length(trim(coalesce(p_tenant_id, ''))) = 0
     OR length(trim(coalesce(p_club_id, ''))) = 0 THEN
    RAISE EXCEPTION 'COACHING_MISSING_SCOPE'
      USING ERRCODE = '42501';
  END IF;

  IF public.user_venue_id() IS NULL OR public.user_club_id() IS NULL THEN
    RAISE EXCEPTION 'COACHING_MISSING_SCOPE'
      USING ERRCODE = '42501';
  END IF;

  IF p_tenant_id <> public.user_venue_id() OR p_club_id <> public.user_club_id() THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_SCOPE'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.coaching_04_has_assigned_action('coaching.assigned.evaluation.submit') THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_ACTION'
      USING ERRCODE = '42501';
  END IF;

  v_coach_ref := public.coaching_04_active_coach_reference_id();
  IF v_coach_ref IS NULL THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_SCOPE: no active coach reference'
      USING ERRCODE = '42501';
  END IF;

  IF length(trim(coalesce(p_evaluation_id, ''))) = 0
     OR length(trim(coalesce(p_player_id, ''))) = 0 THEN
    RAISE EXCEPTION 'COACHING_INVALID_INPUT: evaluation_id and player_id required'
      USING ERRCODE = '22023';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'COACHING_INVALID_STATUS'
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.coaching_04_coach_assigned_to_player(p_player_id, p_program_id) THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_SCOPE: player not actively assigned'
      USING ERRCODE = '42501';
  END IF;

  IF p_status = 'submitted' THEN
    IF length(trim(coalesce(p_summary, ''))) = 0 THEN
      RAISE EXCEPTION 'COACHING_INVALID_INPUT: summary required when submitted'
        USING ERRCODE = '22023';
    END IF;
    v_submitted_at := v_now;
  ELSE
    v_submitted_at := NULL;
  END IF;

  SELECT *
  INTO v_existing
  FROM public.coaching_evaluations
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND evaluation_id = p_evaluation_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status <> 'draft' THEN
      RAISE EXCEPTION 'COACHING_INVALID_TRANSITION: only draft evaluations are updatable'
        USING ERRCODE = '22023';
    END IF;

    IF v_existing.player_id <> p_player_id THEN
      RAISE EXCEPTION 'COACHING_FORBIDDEN_SCOPE: cross-player evaluation'
        USING ERRCODE = '42501';
    END IF;

    IF v_existing.coach_reference_id IS NOT NULL
       AND v_existing.coach_reference_id <> v_coach_ref THEN
      RAISE EXCEPTION 'COACHING_FORBIDDEN_SCOPE: evaluation owned by another coach ref'
        USING ERRCODE = '42501';
    END IF;

    IF p_expected_version IS NULL OR v_existing.version <> p_expected_version THEN
      RAISE EXCEPTION 'COACHING_VERSION_CONFLICT'
        USING ERRCODE = '40001';
    END IF;

    UPDATE public.coaching_evaluations
    SET
      summary = p_summary,
      rating = p_rating,
      session_id = nullif(trim(coalesce(p_session_id, '')), ''),
      program_id = nullif(trim(coalesce(p_program_id, '')), ''),
      revises_evaluation_id = nullif(trim(coalesce(p_revises_evaluation_id, '')), ''),
      coach_reference_id = v_coach_ref,
      status = p_status,
      submitted_at = v_submitted_at,
      version = version + 1,
      updated_at = v_now
    WHERE tenant_id = p_tenant_id
      AND club_id = p_club_id
      AND evaluation_id = p_evaluation_id
      AND version = p_expected_version
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'COACHING_VERSION_CONFLICT'
        USING ERRCODE = '40001';
    END IF;

    RETURN jsonb_build_object('evaluation', to_jsonb(v_row), 'created', false);
  END IF;

  INSERT INTO public.coaching_evaluations (
    evaluation_id,
    tenant_id,
    club_id,
    venue_id,
    player_id,
    coach_reference_id,
    session_id,
    program_id,
    summary,
    rating,
    revises_evaluation_id,
    status,
    submitted_at,
    version,
    created_at,
    updated_at
  ) VALUES (
    trim(p_evaluation_id),
    p_tenant_id,
    p_club_id,
    nullif(trim(coalesce(p_venue_id, '')), ''),
    p_player_id,
    v_coach_ref,
    nullif(trim(coalesce(p_session_id, '')), ''),
    nullif(trim(coalesce(p_program_id, '')), ''),
    p_summary,
    p_rating,
    nullif(trim(coalesce(p_revises_evaluation_id, '')), ''),
    p_status,
    v_submitted_at,
    1,
    v_now,
    v_now
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('evaluation', to_jsonb(v_row), 'created', true);
END;
$$;

COMMENT ON FUNCTION public.coaching_04_submit_assigned_evaluation(
  text, text, text, text, text, text, text, numeric, text, text, text, integer
) IS
  'COACHING-04 assigned evaluation insert/update (draft→submitted). Actor coach ref from JWT; no client actor.';

REVOKE ALL ON FUNCTION public.coaching_04_submit_assigned_evaluation(
  text, text, text, text, text, text, text, numeric, text, text, text, integer
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_04_submit_assigned_evaluation(
  text, text, text, text, text, text, text, numeric, text, text, text, integer
) FROM anon;
REVOKE ALL ON FUNCTION public.coaching_04_submit_assigned_evaluation(
  text, text, text, text, text, text, text, numeric, text, text, text, integer
) FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_04_submit_assigned_evaluation(
  text, text, text, text, text, text, text, numeric, text, text, text, integer
) TO authenticated;

-- -----------------------------------------------------------------------------
-- coaching_04_consume_assigned_entitlement
-- Mirrors coaching_consume_entitlement mutations after assignment validation.
-- Uses coaching.assigned.entitlement.consume (NOT club-wide entitlement.consume).
-- Actor_id ALWAYS auth.uid()::text.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.coaching_04_consume_assigned_entitlement(
  text, text, text, integer, text, text, text, timestamptz
);

CREATE OR REPLACE FUNCTION public.coaching_04_consume_assigned_entitlement(
  p_tenant_id text,
  p_club_id text,
  p_entitlement_id text,
  p_expected_version integer,
  p_player_id text,
  p_idempotency_key text,
  p_usage_event_id text,
  p_consumed_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor_id text;
  v_ent public.coaching_package_entitlements%ROWTYPE;
  v_pkg public.coaching_packages%ROWTYPE;
  v_existing_usage public.coaching_package_usage_events%ROWTYPE;
  v_usage public.coaching_package_usage_events%ROWTYPE;
  v_now timestamptz := now();
  v_at timestamptz;
  v_next_consumed integer;
  v_next_remaining integer;
  v_program_id text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'COACHING_MISSING_ACTOR'
      USING ERRCODE = '42501';
  END IF;

  v_actor_id := v_uid::text;

  IF length(trim(coalesce(p_tenant_id, ''))) = 0
     OR length(trim(coalesce(p_club_id, ''))) = 0 THEN
    RAISE EXCEPTION 'COACHING_MISSING_SCOPE'
      USING ERRCODE = '42501';
  END IF;

  IF public.user_venue_id() IS NULL OR public.user_club_id() IS NULL THEN
    RAISE EXCEPTION 'COACHING_MISSING_SCOPE'
      USING ERRCODE = '42501';
  END IF;

  IF p_tenant_id <> public.user_venue_id() OR p_club_id <> public.user_club_id() THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_SCOPE'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.coaching_04_has_assigned_action('coaching.assigned.entitlement.consume') THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_ACTION'
      USING ERRCODE = '42501';
  END IF;

  IF p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION 'COACHING_INVALID_INPUT: expectedVersion required'
      USING ERRCODE = '22023';
  END IF;

  IF length(trim(coalesce(p_player_id, ''))) = 0
     OR length(trim(coalesce(p_idempotency_key, ''))) = 0
     OR length(trim(coalesce(p_usage_event_id, ''))) = 0
     OR length(trim(coalesce(p_entitlement_id, ''))) = 0 THEN
    RAISE EXCEPTION 'COACHING_INVALID_INPUT: entitlement_id, player_id, idempotency_key, usage_event_id required'
      USING ERRCODE = '22023';
  END IF;

  -- Resolve optional program from enrollment for tighter assignment check
  SELECT e.program_id
  INTO v_program_id
  FROM public.coaching_package_entitlements ent
  LEFT JOIN public.coaching_enrollments e
    ON e.enrollment_id = ent.enrollment_id
   AND e.tenant_id = ent.tenant_id
   AND e.club_id = ent.club_id
  WHERE ent.tenant_id = p_tenant_id
    AND ent.club_id = p_club_id
    AND ent.entitlement_id = p_entitlement_id;

  IF NOT public.coaching_04_coach_assigned_to_player(p_player_id, v_program_id) THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_SCOPE: player not actively assigned'
      USING ERRCODE = '42501';
  END IF;

  v_at := coalesce(p_consumed_at, v_now);

  SELECT *
  INTO v_existing_usage
  FROM public.coaching_package_usage_events
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    SELECT *
    INTO v_ent
    FROM public.coaching_package_entitlements
    WHERE tenant_id = p_tenant_id
      AND club_id = p_club_id
      AND entitlement_id = v_existing_usage.entitlement_id;

    RETURN jsonb_build_object(
      'entitlement', to_jsonb(v_ent),
      'usageEvent', to_jsonb(v_existing_usage),
      'idempotentReplay', true
    );
  END IF;

  SELECT *
  INTO v_ent
  FROM public.coaching_package_entitlements
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND entitlement_id = p_entitlement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COACHING_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_ent.version <> p_expected_version THEN
    RAISE EXCEPTION 'COACHING_VERSION_CONFLICT'
      USING ERRCODE = '40001';
  END IF;

  IF v_ent.player_id <> p_player_id THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_SCOPE: cross-player entitlement use'
      USING ERRCODE = '42501';
  END IF;

  IF v_ent.status NOT IN ('active') THEN
    RAISE EXCEPTION 'COACHING_INVALID_TRANSITION: entitlement not active'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_pkg
  FROM public.coaching_packages
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND package_id = v_ent.package_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COACHING_NOT_FOUND: package'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_pkg.status IN ('draft', 'expired', 'archived') THEN
    RAISE EXCEPTION 'COACHING_INVALID_TRANSITION: package inactive/cancelled'
      USING ERRCODE = '22023';
  END IF;

  IF v_ent.sessions_remaining < 1 THEN
    RAISE EXCEPTION 'COACHING_ENTITLEMENT_EXHAUSTED'
      USING ERRCODE = '22023';
  END IF;

  IF v_ent.valid_from IS NOT NULL AND v_at < v_ent.valid_from THEN
    RAISE EXCEPTION 'COACHING_INVALID_TRANSITION: before validFrom'
      USING ERRCODE = '22023';
  END IF;

  IF v_ent.valid_to IS NOT NULL AND v_at > v_ent.valid_to THEN
    RAISE EXCEPTION 'COACHING_INVALID_TRANSITION: after validTo'
      USING ERRCODE = '22023';
  END IF;

  v_next_consumed := v_ent.sessions_consumed + 1;
  v_next_remaining := v_ent.sessions_granted - v_next_consumed;

  IF v_next_remaining < 0 THEN
    RAISE EXCEPTION 'COACHING_ENTITLEMENT_EXHAUSTED'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.coaching_package_entitlements
  SET
    sessions_consumed = v_next_consumed,
    sessions_remaining = v_next_remaining,
    status = CASE WHEN v_next_remaining = 0 THEN 'exhausted' ELSE status END,
    version = version + 1,
    updated_at = v_at
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND entitlement_id = p_entitlement_id
    AND version = p_expected_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COACHING_VERSION_CONFLICT'
      USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.coaching_package_usage_events (
    usage_event_id,
    tenant_id,
    club_id,
    venue_id,
    entitlement_id,
    package_id,
    player_id,
    sessions_delta,
    remaining_after,
    idempotency_key,
    actor_id,
    consumed_at,
    created_at,
    version
  ) VALUES (
    p_usage_event_id,
    p_tenant_id,
    p_club_id,
    v_ent.venue_id,
    p_entitlement_id,
    v_ent.package_id,
    p_player_id,
    1,
    v_next_remaining,
    trim(p_idempotency_key),
    v_actor_id,
    v_at,
    v_now,
    1
  )
  RETURNING * INTO v_usage;

  SELECT *
  INTO v_ent
  FROM public.coaching_package_entitlements
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND entitlement_id = p_entitlement_id;

  RETURN jsonb_build_object(
    'entitlement', to_jsonb(v_ent),
    'usageEvent', to_jsonb(v_usage),
    'idempotentReplay', false
  );
END;
$$;

COMMENT ON FUNCTION public.coaching_04_consume_assigned_entitlement(
  text, text, text, integer, text, text, text, timestamptz
) IS
  'COACHING-04 assigned entitlement consume. Assignment-gated; actor from auth.uid() only; no direct client UPDATE.';

REVOKE ALL ON FUNCTION public.coaching_04_consume_assigned_entitlement(
  text, text, text, integer, text, text, text, timestamptz
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_04_consume_assigned_entitlement(
  text, text, text, integer, text, text, text, timestamptz
) FROM anon;
REVOKE ALL ON FUNCTION public.coaching_04_consume_assigned_entitlement(
  text, text, text, integer, text, text, text, timestamptz
) FROM service_role;
GRANT EXECUTE ON FUNCTION public.coaching_04_consume_assigned_entitlement(
  text, text, text, integer, text, text, text, timestamptz
) TO authenticated;
