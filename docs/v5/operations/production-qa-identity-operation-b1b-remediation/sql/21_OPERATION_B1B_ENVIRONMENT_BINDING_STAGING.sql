-- =============================================================================
-- OPERATION B1B — Database environment binding (STAGING)
-- Status: AUTHORED ONLY — NOT EXECUTED against real Staging/Production.
--
-- Installs the immutable singleton binding:
--   operation_target_mode = staging_rehearsal
--   project_ref           = qyewbxjsiiyufanzcjcq
--
-- Apply order (future Owner GO; not now):
--   1) this artifact (21)
--   2) 20_QA_IDENTITY_QUARANTINE_AUTHORITY_FORWARD.sql
--
-- Does NOT store secrets, Owner GO, credentials, or batch IDs.
-- Runtime service_role / anon / authenticated cannot mutate binding.
-- Same exact reinstall: idempotent PASS.
-- Conflicting Production binding: FAIL CLOSED (no silent UPDATE).
-- =============================================================================

SET search_path = public, pg_temp;

CREATE TABLE IF NOT EXISTS public.operation_b1b_environment_binding (
  singleton_key smallint PRIMARY KEY CHECK (singleton_key = 1),
  operation_target_mode text NOT NULL,
  project_ref text NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operation_b1b_environment_binding_pair_check CHECK (
    (
      operation_target_mode = 'production'
      AND project_ref = 'expuvcohlcjzvrrauvud'
    )
    OR (
      operation_target_mode = 'staging_rehearsal'
      AND project_ref = 'qyewbxjsiiyufanzcjcq'
    )
  )
);

COMMENT ON TABLE public.operation_b1b_environment_binding IS
  'OPERATION_B1B: singleton trusted DB environment binding. Runtime-immutable; install via explicit SQL artifacts only.';

REVOKE ALL ON TABLE public.operation_b1b_environment_binding FROM PUBLIC;
REVOKE ALL ON TABLE public.operation_b1b_environment_binding FROM anon;
REVOKE ALL ON TABLE public.operation_b1b_environment_binding FROM authenticated;
REVOKE ALL ON TABLE public.operation_b1b_environment_binding FROM service_role;

CREATE OR REPLACE FUNCTION public.operation_b1b_database_environment()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_mode text;
  v_ref text;
BEGIN
  SELECT count(*)::integer INTO v_count
  FROM public.operation_b1b_environment_binding;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'database_environment_unbound');
  END IF;

  IF v_count <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'database_environment_ambiguous');
  END IF;

  SELECT operation_target_mode, project_ref
    INTO v_mode, v_ref
  FROM public.operation_b1b_environment_binding
  WHERE singleton_key = 1;

  IF v_mode IS NULL OR v_ref IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'database_environment_unbound');
  END IF;

  IF NOT (
    (v_mode = 'production' AND v_ref = 'expuvcohlcjzvrrauvud')
    OR (v_mode = 'staging_rehearsal' AND v_ref = 'qyewbxjsiiyufanzcjcq')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'database_environment_invalid_pair');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'database_environment_bound',
    'operation_target_mode', v_mode,
    'project_ref', v_ref,
    'environment', v_mode
  );
END;
$$;

COMMENT ON FUNCTION public.operation_b1b_database_environment() IS
  'OPERATION_B1B: read trusted singleton DB environment binding. Fail-closed. No caller mode override.';

REVOKE ALL ON FUNCTION public.operation_b1b_database_environment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operation_b1b_database_environment() FROM anon;
REVOKE ALL ON FUNCTION public.operation_b1b_database_environment() FROM authenticated;
REVOKE ALL ON FUNCTION public.operation_b1b_database_environment() FROM service_role;

DO $install$
DECLARE
  v_mode text;
  v_ref text;
BEGIN
  SELECT operation_target_mode, project_ref
    INTO v_mode, v_ref
  FROM public.operation_b1b_environment_binding
  WHERE singleton_key = 1;

  IF NOT FOUND THEN
    INSERT INTO public.operation_b1b_environment_binding (
      singleton_key,
      operation_target_mode,
      project_ref
    ) VALUES (
      1,
      'staging_rehearsal',
      'qyewbxjsiiyufanzcjcq'
    );
    RETURN;
  END IF;

  IF v_mode = 'staging_rehearsal' AND v_ref = 'qyewbxjsiiyufanzcjcq' THEN
    -- Exact same binding reinstall: idempotent no-op.
    RETURN;
  END IF;

  RAISE EXCEPTION
    'OPERATION_B1B_ENVIRONMENT_BINDING_CONFLICT: existing mode=% ref=% cannot be replaced by staging_rehearsal/qyewbxjsiiyufanzcjcq',
    v_mode,
    v_ref;
END
$install$;
