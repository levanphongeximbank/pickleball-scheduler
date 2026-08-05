-- RATING-V5-CUTOVER-02 Gate A3c — Controlled Staging fixture preparation RPCs
-- AUTHOR ONLY — DO NOT APPLY in this workstream (SQL_EXECUTION=0 / SQL_GUARD_APPLY_GO=NO).
--
-- Purpose:
--   Allow a Staging SUPER_ADMIN (or rating_v5.calibration_manage) caller, via a
--   trusted Edge boundary using service_role AFTER validation, to create a draft
--   V5 assessment for an allowlisted Wave-A fixture identity without candidate JWT.
--
-- Safety:
--   - Exact Staging project guard: qyewbxjsiiyufanzcjcq
--   - Explicit Production deny: expuvcohlcjzvrrauvud
--   - service_role EXECUTE only (no anon / no general authenticated grant)
--   - Requires non-null p_caller_id (blocks anonymous service-role-only clients)
--   - Caller must be SUPER_ADMIN or hold rating_v5.calibration_manage
--   - Target must match fixed five id hashes + wave1 fixture email evidence
--   - Exact cohort label only
--   - Idempotent audit objects
--
-- Does NOT:
--   - change pick_vn_player_ratings published authority semantics
--   - promote V5 / flip rollout
--   - grant browser service-role
--   - accept arbitrary player IDs / ratings
--
-- Expected migration identity:
--   RATING_V5_CUTOVER_02_A3C_FIXTURE_PREP_v1
-- Checksum (sha256 of this file body after apply authoring): compute at apply time.
--
-- Production:
--   MUST refuse to apply when project ref == expuvcohlcjzvrrauvud

BEGIN;

DO $$
DECLARE
  v_db_ref text := coalesce(
    current_setting('app.settings.supabase_project_ref', true),
    current_setting('app.supabase_project_ref', true),
    ''
  );
  v_env text := lower(coalesce(current_setting('app.settings.app_env', true), ''));
BEGIN
  IF v_db_ref = 'expuvcohlcjzvrrauvud' OR v_env IN ('production', 'prod') THEN
    RAISE EXCEPTION 'CUTOVER_02_A3C_REFUSE_PRODUCTION: fixture prep SQL must not apply on Production';
  END IF;

  IF v_db_ref <> '' AND v_db_ref <> 'qyewbxjsiiyufanzcjcq' THEN
    RAISE EXCEPTION 'CUTOVER_02_A3C_REFUSE_UNKNOWN_REF: expected staging ref qyewbxjsiiyufanzcjcq, got %', v_db_ref;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.rating_v5_cutover_02_fixture_allowlist (
  id_hash text PRIMARY KEY,
  candidate_label text NOT NULL,
  cohort_label text NOT NULL
    CHECK (cohort_label = 'rating-v5-cutover-02-staging-rehearsal-wave-a'),
  preparation_version text NOT NULL DEFAULT 'a3c-v1',
  v2_raw numeric NOT NULL,
  v5_target_display numeric NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.rating_v5_cutover_02_fixture_allowlist
  (id_hash, candidate_label, cohort_label, preparation_version, v2_raw, v5_target_display)
VALUES
  ('e97fa28f4a36', 'CANDIDATE-01', 'rating-v5-cutover-02-staging-rehearsal-wave-a', 'a3c-v1', 2.0, 2.2),
  ('0b464be6cbba', 'CANDIDATE-02', 'rating-v5-cutover-02-staging-rehearsal-wave-a', 'a3c-v1', 3.0, 2.8),
  ('9154af71ee16', 'CANDIDATE-03', 'rating-v5-cutover-02-staging-rehearsal-wave-a', 'a3c-v1', 3.5, 3.1),
  ('d678d828c636', 'CANDIDATE-04', 'rating-v5-cutover-02-staging-rehearsal-wave-a', 'a3c-v1', 4.0, 3.6),
  ('3d644a31b486', 'CANDIDATE-05', 'rating-v5-cutover-02-staging-rehearsal-wave-a', 'a3c-v1', 5.0, 4.2)
ON CONFLICT (id_hash) DO UPDATE SET
  candidate_label = EXCLUDED.candidate_label,
  v2_raw = EXCLUDED.v2_raw,
  v5_target_display = EXCLUDED.v5_target_display,
  active = true;

CREATE TABLE IF NOT EXISTS public.rating_v5_cutover_02_fixture_prep_audit (
  id bigserial PRIMARY KEY,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  project_ref text NOT NULL DEFAULT 'qyewbxjsiiyufanzcjcq',
  cohort_label text NOT NULL,
  preparation_version text NOT NULL,
  candidate_label text NOT NULL,
  candidate_id_hash text NOT NULL,
  caller_id uuid NULL,
  outcome text NOT NULL,
  before_fingerprint text NULL,
  after_fingerprint text NULL,
  v2_raw numeric NULL,
  v5_scorer_output numeric NULL,
  mapping_status text NOT NULL DEFAULT 'UNAPPROVED',
  row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  rollback_handle text NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS rating_v5_cutover_02_fixture_prep_idempotent_idx
  ON public.rating_v5_cutover_02_fixture_prep_audit (
    project_ref, cohort_label, candidate_id_hash, preparation_version
  )
  WHERE outcome IN ('PREPARED', 'ALREADY_PREPARED');

CREATE OR REPLACE FUNCTION public.rating_v5_cutover_02_a3c_assert_staging_project()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_db_ref text := coalesce(
    current_setting('app.settings.supabase_project_ref', true),
    current_setting('app.supabase_project_ref', true),
    ''
  );
  v_env text := lower(coalesce(current_setting('app.settings.app_env', true), ''));
BEGIN
  IF v_db_ref = 'expuvcohlcjzvrrauvud' OR v_env IN ('production', 'prod') THEN
    RAISE EXCEPTION 'WRONG_PROJECT: production denied';
  END IF;
  IF v_db_ref <> '' AND v_db_ref <> 'qyewbxjsiiyufanzcjcq' THEN
    RAISE EXCEPTION 'WRONG_PROJECT: expected qyewbxjsiiyufanzcjcq';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rating_v5_cutover_02_a3c_assert_caller(p_caller_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_ok boolean;
BEGIN
  IF p_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED_CALLER: caller required';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = p_caller_id AND status = 'active';
  IF v_role = 'SUPER_ADMIN' THEN
    RETURN;
  END IF;

  BEGIN
    v_ok := public.rating_v5_has_permission('rating_v5.calibration_manage');
  EXCEPTION WHEN undefined_function THEN
    v_ok := false;
  END;

  IF auth.uid() IS NULL THEN
    IF v_role IS DISTINCT FROM 'SUPER_ADMIN' THEN
      RAISE EXCEPTION 'UNAUTHORIZED_CALLER: service path requires SUPER_ADMIN caller profile';
    END IF;
    RETURN;
  END IF;

  IF auth.uid() IS DISTINCT FROM p_caller_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED_CALLER: caller mismatch';
  END IF;

  IF coalesce(v_ok, false) = false AND v_role IS DISTINCT FROM 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'UNAUTHORIZED_CALLER: calibration_manage or SUPER_ADMIN required';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rating_v5_cutover_02_a3c_service_create_fixture_assessment(
  p_caller_id uuid,
  p_target_player_id uuid,
  p_cohort_label text,
  p_preparation_version text DEFAULT 'a3c-v1',
  p_tenant_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hash text;
  v_allow public.rating_v5_cutover_02_fixture_allowlist%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_tenant text;
  v_id uuid;
  v_existing uuid;
BEGIN
  PERFORM public.rating_v5_assert_service_role();
  PERFORM public.rating_v5_cutover_02_a3c_assert_staging_project();
  PERFORM public.rating_v5_cutover_02_a3c_assert_caller(p_caller_id);

  IF p_cohort_label IS DISTINCT FROM 'rating-v5-cutover-02-staging-rehearsal-wave-a' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'WRONG_COHORT');
  END IF;

  IF p_preparation_version IS DISTINCT FROM 'a3c-v1' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TARGET_NOT_APPROVED', 'reason', 'PREP_VERSION');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_target_player_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TARGET_NOT_APPROVED', 'reason', 'NO_PROFILE');
  END IF;

  IF v_profile.status IS NOT NULL AND lower(v_profile.status) <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TARGET_NOT_APPROVED', 'reason', 'INACTIVE');
  END IF;

  IF lower(coalesce(v_profile.email, '')) NOT LIKE 'rating.wave1.%@staging.local' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TARGET_NOT_APPROVED', 'reason', 'FIXTURE_DOMAIN');
  END IF;

  v_hash := left(md5(p_target_player_id::text), 12);
  SELECT * INTO v_allow
  FROM public.rating_v5_cutover_02_fixture_allowlist
  WHERE id_hash = v_hash AND active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TARGET_NOT_APPROVED', 'reason', 'NOT_IN_FIXED_FIVE');
  END IF;

  v_tenant := coalesce(nullif(p_tenant_id, ''), nullif(v_profile.venue_id, ''), 'platform');

  SELECT id INTO v_existing
  FROM public.player_skill_assessments
  WHERE player_id = p_target_player_id
    AND assessment_status = 'completed'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COLLISION_BLOCKED', 'assessmentId', v_existing);
  END IF;

  INSERT INTO public.player_skill_assessments (
    tenant_id, player_id, rating_mode, assessment_status, is_shadow, rollout_cohort
  ) VALUES (
    v_tenant, p_target_player_id, 'doubles', 'draft', true, 'v5-shadow-pilot'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'DRAFT_CREATED',
    'assessmentId', v_id,
    'tenant_id', v_tenant,
    'player_id', p_target_player_id,
    'is_shadow', true,
    'candidate_label', v_allow.candidate_label,
    'candidate_id_hash', v_hash
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rating_v5_cutover_02_a3c_service_record_prep_audit(
  p_caller_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id bigint;
BEGIN
  PERFORM public.rating_v5_assert_service_role();
  PERFORM public.rating_v5_cutover_02_a3c_assert_staging_project();
  PERFORM public.rating_v5_cutover_02_a3c_assert_caller(p_caller_id);

  INSERT INTO public.rating_v5_cutover_02_fixture_prep_audit (
    project_ref, cohort_label, preparation_version, candidate_label, candidate_id_hash,
    caller_id, outcome, before_fingerprint, after_fingerprint, v2_raw, v5_scorer_output,
    mapping_status, row_counts, rollback_handle, detail
  ) VALUES (
    coalesce(p_payload->>'project_ref', 'qyewbxjsiiyufanzcjcq'),
    p_payload->>'cohort_label',
    p_payload->>'preparation_version',
    p_payload->>'candidate_label',
    p_payload->>'candidate_id_hash',
    p_caller_id,
    p_payload->>'outcome',
    p_payload->>'before_fingerprint',
    p_payload->>'after_fingerprint',
    nullif(p_payload->>'v2_raw', '')::numeric,
    nullif(p_payload->>'v5_scorer_output', '')::numeric,
    coalesce(p_payload->>'mapping_status', 'UNAPPROVED'),
    coalesce(p_payload->'row_counts', '{}'::jsonb),
    p_payload->>'rollback_handle',
    coalesce(p_payload->'detail', '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'auditId', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_assert_staging_project() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_assert_caller(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rating_v5_cutover_02_a3c_service_record_prep_audit(uuid, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rating_v5_cutover_02_a3c_service_record_prep_audit(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid, uuid, text, text, text) IS
  'CUTOVER-02 A3c Staging-only: create V5 draft assessment for fixed Wave-A fixture without candidate JWT. service_role + caller guard.';

COMMIT;

-- VERIFICATION (read-only; after Owner apply GO — not this gate)
-- SELECT has_function_privilege('anon', 'rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid,uuid,text,text,text)', 'execute');
-- SELECT has_function_privilege('authenticated', 'rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid,uuid,text,text,text)', 'execute');

-- DOWN (objects only)
-- DROP FUNCTION IF EXISTS public.rating_v5_cutover_02_a3c_service_record_prep_audit(uuid, jsonb);
-- DROP FUNCTION IF EXISTS public.rating_v5_cutover_02_a3c_service_create_fixture_assessment(uuid, uuid, text, text, text);
-- DROP FUNCTION IF EXISTS public.rating_v5_cutover_02_a3c_assert_caller(uuid);
-- DROP FUNCTION IF EXISTS public.rating_v5_cutover_02_a3c_assert_staging_project();
-- DROP TABLE IF EXISTS public.rating_v5_cutover_02_fixture_prep_audit;
-- DROP TABLE IF EXISTS public.rating_v5_cutover_02_fixture_allowlist;
