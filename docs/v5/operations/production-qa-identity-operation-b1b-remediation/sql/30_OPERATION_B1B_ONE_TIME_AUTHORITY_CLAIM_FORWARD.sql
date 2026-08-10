-- =============================================================================
-- OPERATION B1B — One-time live execution authority claim (WP6 execution path)
-- Status: AUTHORED ONLY — NOT EXECUTED against Staging/Production in this WP.
-- Requires a separate Owner Staging schema-apply GO before live rehearsal.
--
-- Purpose:
--   Durable, atomic, first-claim-wins live authority ledger for
--   OPERATION_B1B_QA_QUARANTINE_AUTHORITY across processes.
--
-- Semantics:
--   - Unique on (operation_id, operation_target_mode, project_ref, batch_id)
--   - First INSERT wins → status=claimed (batch BURNED/CONSUMED)
--   - Duplicate / concurrent losers → rejected (authority_already_consumed)
--   - Batch remains burned even if later Auth/quarantine execution fails
--   - Never stores OWNER_*_GO plaintext, DB URL, tokens, service role keys, JWTs
--
-- Does NOT:
--   - alter qa_identity_quarantines / WP1 / WP2 lifecycle RPCs
--   - alter profiles / Auth users
--   - authorize Production live execution by itself (JS harness hard-binds staging)
-- =============================================================================

SET search_path = public, auth, pg_temp;

CREATE TABLE IF NOT EXISTS public.operation_b1b_one_time_authority_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id text NOT NULL
    CHECK (operation_id = 'OPERATION_B1B_QA_QUARANTINE_AUTHORITY'),
  operation_target_mode text NOT NULL
    CHECK (operation_target_mode IN ('staging_rehearsal', 'production')),
  project_ref text NOT NULL
    CHECK (char_length(project_ref) BETWEEN 8 AND 64),
  batch_id uuid NOT NULL,
  allowlist_sha256 text NOT NULL
    CHECK (allowlist_sha256 ~ '^[0-9a-f]{64}$'),
  snapshot_sha256 text NOT NULL
    CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  exact_eight_uuid_set_hash text NOT NULL
    CHECK (exact_eight_uuid_set_hash ~ '^[0-9a-f]{64}$'),
  execution_version text NULL
    CHECK (execution_version IS NULL OR char_length(execution_version) <= 128),
  owner_go_fingerprint text NOT NULL
    CHECK (owner_go_fingerprint ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed', 'consumed')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  claimed_by text NOT NULL DEFAULT 'service_role'
    CHECK (char_length(claimed_by) BETWEEN 1 AND 128),
  CONSTRAINT operation_b1b_one_time_authority_claims_batch_uq
    UNIQUE (operation_id, operation_target_mode, project_ref, batch_id)
);

COMMENT ON TABLE public.operation_b1b_one_time_authority_claims IS
  'OPERATION_B1B: durable one-time live execution authority claims. First claim wins; batch burned thereafter. Stores GO fingerprint only.';

CREATE INDEX IF NOT EXISTS operation_b1b_one_time_authority_claims_claimed_at_idx
  ON public.operation_b1b_one_time_authority_claims (claimed_at DESC);

-- Deny anon/authenticated/service_role direct DML; writes only via SECURITY DEFINER RPC.
REVOKE ALL ON TABLE public.operation_b1b_one_time_authority_claims FROM PUBLIC;
REVOKE ALL ON TABLE public.operation_b1b_one_time_authority_claims FROM anon;
REVOKE ALL ON TABLE public.operation_b1b_one_time_authority_claims FROM authenticated;
REVOKE ALL ON TABLE public.operation_b1b_one_time_authority_claims FROM service_role;

ALTER TABLE public.operation_b1b_one_time_authority_claims ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.operation_b1b_authority_claim_is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    auth.role()
  ) = 'service_role';
$$;

COMMENT ON FUNCTION public.operation_b1b_authority_claim_is_service_role() IS
  'OPERATION_B1B: service_role gate for one-time authority claim RPCs.';

CREATE OR REPLACE FUNCTION public.operation_b1b_claim_one_time_live_authority(
  p_operation_id text,
  p_operation_target_mode text,
  p_project_ref text,
  p_batch_id uuid,
  p_allowlist_sha256 text,
  p_snapshot_sha256 text,
  p_exact_eight_uuid_set_hash text,
  p_execution_version text,
  p_owner_go_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_row public.operation_b1b_one_time_authority_claims%ROWTYPE;
  v_existing public.operation_b1b_one_time_authority_claims%ROWTYPE;
  v_mode text;
  v_op text;
  v_ref text;
  v_allow text;
  v_snap text;
  v_eight text;
  v_fp text;
  v_exec text;
BEGIN
  IF NOT public.operation_b1b_authority_claim_is_service_role() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'consumed', false,
      'reason', 'forbidden_not_service_role',
      'code', 'forbidden'
    );
  END IF;

  v_op := trim(both FROM coalesce(p_operation_id, ''));
  v_mode := lower(trim(both FROM coalesce(p_operation_target_mode, '')));
  v_ref := trim(both FROM coalesce(p_project_ref, ''));
  v_allow := lower(trim(both FROM coalesce(p_allowlist_sha256, '')));
  v_snap := lower(trim(both FROM coalesce(p_snapshot_sha256, '')));
  v_eight := lower(trim(both FROM coalesce(p_exact_eight_uuid_set_hash, '')));
  v_fp := lower(trim(both FROM coalesce(p_owner_go_fingerprint, '')));
  v_exec := nullif(trim(both FROM coalesce(p_execution_version, '')), '');

  IF v_op <> 'OPERATION_B1B_QA_QUARANTINE_AUTHORITY' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'consumed', false,
      'reason', 'invalid_operation_id',
      'code', 'invalid_input'
    );
  END IF;

  IF v_mode NOT IN ('staging_rehearsal', 'production') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'consumed', false,
      'reason', 'invalid_operation_target_mode',
      'code', 'invalid_input'
    );
  END IF;

  IF v_mode = 'staging_rehearsal' AND v_ref <> 'qyewbxjsiiyufanzcjcq' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'consumed', false,
      'reason', 'wrong_or_missing_staging_project_ref',
      'code', 'invalid_input'
    );
  END IF;

  IF v_mode = 'production' AND v_ref <> 'expuvcohlcjzvrrauvud' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'consumed', false,
      'reason', 'wrong_or_missing_production_project_ref',
      'code', 'invalid_input'
    );
  END IF;

  IF v_mode = 'staging_rehearsal' AND v_ref = 'expuvcohlcjzvrrauvud' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'consumed', false,
      'reason', 'production_project_ref_rejected_in_staging_mode',
      'code', 'invalid_input'
    );
  END IF;

  IF p_batch_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'consumed', false,
      'reason', 'malformed_or_missing_batch_id',
      'code', 'invalid_input'
    );
  END IF;

  IF v_allow !~ '^[0-9a-f]{64}$'
     OR v_snap !~ '^[0-9a-f]{64}$'
     OR v_eight !~ '^[0-9a-f]{64}$'
     OR v_fp !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'consumed', false,
      'reason', 'invalid_or_missing_claim_hashes',
      'code', 'invalid_input'
    );
  END IF;

  -- Reject accidental persistence of Owner GO plaintext / secret-looking payloads.
  IF v_fp LIKE 'approve_%'
     OR v_fp LIKE '%service_role%'
     OR v_fp LIKE 'eyj%' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'consumed', false,
      'reason', 'owner_go_plaintext_or_secret_rejected',
      'code', 'invalid_input'
    );
  END IF;

  INSERT INTO public.operation_b1b_one_time_authority_claims (
    operation_id,
    operation_target_mode,
    project_ref,
    batch_id,
    allowlist_sha256,
    snapshot_sha256,
    exact_eight_uuid_set_hash,
    execution_version,
    owner_go_fingerprint,
    status,
    claimed_by
  )
  VALUES (
    v_op,
    v_mode,
    v_ref,
    p_batch_id,
    v_allow,
    v_snap,
    v_eight,
    v_exec,
    v_fp,
    'consumed',
    'service_role'
  )
  ON CONFLICT (operation_id, operation_target_mode, project_ref, batch_id)
  DO NOTHING
  RETURNING * INTO v_row;

  IF FOUND THEN
    -- Successful durable claim burns the batch immediately (consumed),
    -- even if later Auth/quarantine mutation fails.
    RETURN jsonb_build_object(
      'ok', true,
      'consumed', true,
      'status', v_row.status,
      'reason', 'CLAIMED',
      'code', 'claimed',
      'claim_id', v_row.id,
      'claimed_at', v_row.claimed_at,
      'batch_id', v_row.batch_id,
      'project_ref', v_row.project_ref,
      'operation_target_mode', v_row.operation_target_mode
    );
  END IF;

  SELECT * INTO v_existing
  FROM public.operation_b1b_one_time_authority_claims
  WHERE operation_id = v_op
    AND operation_target_mode = v_mode
    AND project_ref = v_ref
    AND batch_id = p_batch_id;

  RETURN jsonb_build_object(
    'ok', false,
    'consumed', true,
    'status', coalesce(v_existing.status, 'consumed'),
    'reason', 'REJECTED_ALREADY_CLAIMED',
    'code', 'authority_already_consumed',
    'claim_id', v_existing.id,
    'claimed_at', v_existing.claimed_at,
    'batch_id', p_batch_id,
    'project_ref', v_ref,
    'operation_target_mode', v_mode,
    'prior_allowlist_sha256', v_existing.allowlist_sha256,
    'prior_snapshot_sha256', v_existing.snapshot_sha256
  );
END;
$$;

COMMENT ON FUNCTION public.operation_b1b_claim_one_time_live_authority(
  text, text, text, uuid, text, text, text, text, text
) IS
  'OPERATION_B1B: atomic first-claim-wins durable live authority. Batch burned on success; duplicates rejected.';

CREATE OR REPLACE FUNCTION public.operation_b1b_get_one_time_live_authority_claim(
  p_operation_id text,
  p_operation_target_mode text,
  p_project_ref text,
  p_batch_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_row public.operation_b1b_one_time_authority_claims%ROWTYPE;
BEGIN
  IF NOT public.operation_b1b_authority_claim_is_service_role() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'forbidden_not_service_role',
      'code', 'forbidden'
    );
  END IF;

  SELECT * INTO v_row
  FROM public.operation_b1b_one_time_authority_claims
  WHERE operation_id = trim(both FROM coalesce(p_operation_id, ''))
    AND operation_target_mode = lower(trim(both FROM coalesce(p_operation_target_mode, '')))
    AND project_ref = trim(both FROM coalesce(p_project_ref, ''))
    AND batch_id = p_batch_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'found', false,
      'consumed', false
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'found', true,
    'consumed', true,
    'status', v_row.status,
    'claim_id', v_row.id,
    'claimed_at', v_row.claimed_at,
    'operation_id', v_row.operation_id,
    'operation_target_mode', v_row.operation_target_mode,
    'project_ref', v_row.project_ref,
    'batch_id', v_row.batch_id,
    'allowlist_sha256', v_row.allowlist_sha256,
    'snapshot_sha256', v_row.snapshot_sha256,
    'exact_eight_uuid_set_hash', v_row.exact_eight_uuid_set_hash,
    'execution_version', v_row.execution_version,
    'owner_go_fingerprint', v_row.owner_go_fingerprint
  );
END;
$$;

COMMENT ON FUNCTION public.operation_b1b_get_one_time_live_authority_claim(
  text, text, text, uuid
) IS
  'OPERATION_B1B: fail-closed readback of durable one-time authority claim evidence (no secrets).';

REVOKE ALL ON FUNCTION public.operation_b1b_authority_claim_is_service_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operation_b1b_authority_claim_is_service_role() FROM anon;
REVOKE ALL ON FUNCTION public.operation_b1b_authority_claim_is_service_role() FROM authenticated;

REVOKE ALL ON FUNCTION public.operation_b1b_claim_one_time_live_authority(
  text, text, text, uuid, text, text, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operation_b1b_claim_one_time_live_authority(
  text, text, text, uuid, text, text, text, text, text
) FROM anon;
REVOKE ALL ON FUNCTION public.operation_b1b_claim_one_time_live_authority(
  text, text, text, uuid, text, text, text, text, text
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.operation_b1b_claim_one_time_live_authority(
  text, text, text, uuid, text, text, text, text, text
) TO service_role;

REVOKE ALL ON FUNCTION public.operation_b1b_get_one_time_live_authority_claim(
  text, text, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operation_b1b_get_one_time_live_authority_claim(
  text, text, text, uuid
) FROM anon;
REVOKE ALL ON FUNCTION public.operation_b1b_get_one_time_live_authority_claim(
  text, text, text, uuid
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.operation_b1b_get_one_time_live_authority_claim(
  text, text, text, uuid
) TO service_role;
