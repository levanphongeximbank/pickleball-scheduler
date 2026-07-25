-- =============================================================================
-- COACHING-02 — Atomic attendance correction RPC
-- Purpose: Single transaction boundary for AttendanceCorrectionUnitOfWork.
-- Status: AUTHORED ONLY — do not apply in COACHING-02.
--
-- Client-write path: THIS RPC ONLY for attendance correction mutations.
-- Authenticated callers have no direct UPDATE on attendance_records and no
-- direct INSERT on attendance_corrections (see 50_COACHING_02_GRANTS.sql).
--
-- Actor integrity: audit actor_id is ALWAYS auth.uid()::text.
-- p_actor_id is NOT accepted — forged payload actors are impossible.
-- service_role EXECUTE is intentionally NOT granted (no trusted-server actor
-- contract yet — deferred to COACHING-03).
-- =============================================================================

SET search_path = public, pg_temp;

-- Drop prior signatures (remediation may change arity)
DROP FUNCTION IF EXISTS public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, text, timestamptz, text
);
DROP FUNCTION IF EXISTS public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, timestamptz, text
);

CREATE OR REPLACE FUNCTION public.coaching_apply_attendance_correction(
  p_tenant_id text,
  p_club_id text,
  p_attendance_id text,
  p_expected_version integer,
  p_corrected_status text,
  p_reason text,
  p_correction_id text,
  p_corrected_at timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor_id text;
  v_row public.coaching_attendance_records%ROWTYPE;
  v_corrected_at timestamptz;
  v_now timestamptz := now();
  v_correction public.coaching_attendance_corrections%ROWTYPE;
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

  -- Fail-closed JWT scope: tenant_id binds to user_venue_id (Sprint-2),
  -- club_id binds to user_club_id. No service_role bypass path.
  IF public.user_venue_id() IS NULL OR public.user_club_id() IS NULL THEN
    RAISE EXCEPTION 'COACHING_MISSING_SCOPE'
      USING ERRCODE = '42501';
  END IF;

  IF p_tenant_id <> public.user_venue_id() OR p_club_id <> public.user_club_id() THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_SCOPE'
      USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.is_super_admin()
    OR public.user_has_permission('coaching.attendance.correct')
  ) THEN
    RAISE EXCEPTION 'COACHING_FORBIDDEN_ACTION'
      USING ERRCODE = '42501';
  END IF;

  IF p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION 'COACHING_INVALID_INPUT: expectedVersion required'
      USING ERRCODE = '22023';
  END IF;

  IF p_corrected_status IS NULL OR p_corrected_status NOT IN ('absent', 'present', 'late', 'excused') THEN
    RAISE EXCEPTION 'COACHING_INVALID_STATUS'
      USING ERRCODE = '22023';
  END IF;

  IF length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'COACHING_INVALID_INPUT: reason required'
      USING ERRCODE = '22023';
  END IF;

  IF length(trim(coalesce(p_correction_id, ''))) = 0 THEN
    RAISE EXCEPTION 'COACHING_INVALID_INPUT: correction_id required'
      USING ERRCODE = '22023';
  END IF;

  v_corrected_at := coalesce(p_corrected_at, v_now);

  SELECT *
  INTO v_row
  FROM public.coaching_attendance_records
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND attendance_id = p_attendance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COACHING_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_row.version <> p_expected_version THEN
    RAISE EXCEPTION 'COACHING_VERSION_CONFLICT'
      USING ERRCODE = '40001';
  END IF;

  IF v_row.status = p_corrected_status THEN
    RAISE EXCEPTION 'COACHING_INVALID_INPUT: correction must change status'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.coaching_attendance_records
  SET
    status = p_corrected_status,
    notes = CASE WHEN p_notes IS NULL THEN notes ELSE p_notes END,
    version = version + 1,
    updated_at = v_now
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND attendance_id = p_attendance_id
    AND version = p_expected_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COACHING_VERSION_CONFLICT'
      USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.coaching_attendance_corrections (
    correction_id,
    tenant_id,
    club_id,
    venue_id,
    attendance_id,
    previous_status,
    corrected_status,
    reason,
    actor_id,
    corrected_at,
    created_at,
    version
  ) VALUES (
    p_correction_id,
    p_tenant_id,
    p_club_id,
    v_row.venue_id,
    p_attendance_id,
    v_row.status,
    p_corrected_status,
    trim(p_reason),
    v_actor_id,
    v_corrected_at,
    v_now,
    1
  )
  RETURNING * INTO v_correction;

  SELECT *
  INTO v_row
  FROM public.coaching_attendance_records
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND attendance_id = p_attendance_id;

  RETURN jsonb_build_object(
    'attendance', to_jsonb(v_row),
    'correction', to_jsonb(v_correction)
  );
END;
$$;

COMMENT ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, timestamptz, text
) IS
  'COACHING-02 atomic attendance correction. Actor from auth.uid() only. Authenticated EXECUTE; no service_role grant.';

REVOKE ALL ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, timestamptz, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, timestamptz, text
) FROM anon;

REVOKE ALL ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, timestamptz, text
) FROM authenticated;

REVOKE ALL ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, timestamptz, text
) FROM service_role;
-- EXECUTE granted to authenticated only in 50_COACHING_02_GRANTS.sql
