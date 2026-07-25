-- =============================================================================
-- COACHING-02 — Atomic attendance correction RPC
-- Purpose: Single transaction boundary for AttendanceCorrectionUnitOfWork.
-- Status: AUTHORED ONLY — do not apply in COACHING-02.
--
-- Contract (mirrors COACHING-01 ports.applyCorrection):
--   1. authorize coaching.attendance.correct
--   2. lock/read current attendance in tenant/club scope
--   3. verify expectedVersion
--   4. update attendance status + increment version exactly once
--   5. append correction history
--   6. return canonical result jsonb
-- Any failure rolls back the entire transaction (PL/pgSQL default).
--
-- SECURITY DEFINER: fixed search_path; explicit scope + action checks;
-- does not trust payload actor as JWT substitute; REVOKE FROM PUBLIC.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.coaching_apply_attendance_correction(
  p_tenant_id text,
  p_club_id text,
  p_attendance_id text,
  p_expected_version integer,
  p_corrected_status text,
  p_reason text,
  p_actor_id text,
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
  v_row public.coaching_attendance_records%ROWTYPE;
  v_corrected_at timestamptz;
  v_now timestamptz := now();
  v_correction public.coaching_attendance_corrections%ROWTYPE;
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

  -- Prefer JWT-bound scope when helpers are available; service_role may pass
  -- explicit scope after application-layer authorization.
  IF public.user_venue_id() IS NOT NULL AND public.user_club_id() IS NOT NULL THEN
    IF p_tenant_id <> public.user_venue_id() OR p_club_id <> public.user_club_id() THEN
      RAISE EXCEPTION 'COACHING_FORBIDDEN_SCOPE'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT (
    public.is_super_admin()
    OR public.user_has_permission('coaching.attendance.correct')
  ) THEN
    -- service_role bypasses RLS but we still require an explicit permission
    -- when JWT helpers resolve; when helpers are null (service path), the
    -- calling adapter MUST have already authorized. Detect service path:
    IF public.user_venue_id() IS NOT NULL OR public.user_club_id() IS NOT NULL THEN
      RAISE EXCEPTION 'COACHING_FORBIDDEN_ACTION'
        USING ERRCODE = '42501';
    END IF;
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

  IF length(trim(coalesce(p_actor_id, ''))) = 0 THEN
    RAISE EXCEPTION 'COACHING_INVALID_INPUT: actor_id required'
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
    trim(p_actor_id),
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
  text, text, text, integer, text, text, text, text, timestamptz, text
) IS
  'COACHING-02 atomic attendance correction: versioned update + append-only correction in one transaction.';

REVOKE ALL ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, text, timestamptz, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, text, timestamptz, text
) FROM anon;

REVOKE ALL ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, text, timestamptz, text
) FROM authenticated;
-- EXECUTE granted to service_role / authenticated in 50_COACHING_02_GRANTS.sql
