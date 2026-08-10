-- =============================================================================
-- OPERATION B1B — One-time live execution authority claim ROLLBACK
-- Status: AUTHORED ONLY — NOT EXECUTED.
-- Pair with 30_OPERATION_B1B_ONE_TIME_AUTHORITY_CLAIM_FORWARD.sql
-- Does NOT touch WP1/WP2 quarantine objects, profiles, or Auth.
--
-- Evidence-preservation contract:
--   - Absent store  → idempotent teardown PASS
--   - Empty store   → destructive cleanup PASS
--   - Non-empty store (any durable claim rows) → FAIL CLOSED; no DROP/REVOKE
-- =============================================================================

SET search_path = public, auth, pg_temp;

-- Guard MUST run before any REVOKE/DROP against the durable authority package.
DO $$
DECLARE
  v_count bigint := 0;
BEGIN
  IF to_regclass('public.operation_b1b_one_time_authority_claims') IS NOT NULL THEN
    SELECT count(*)::bigint
      INTO v_count
    FROM public.operation_b1b_one_time_authority_claims;

    IF v_count > 0 THEN
      RAISE EXCEPTION 'OPERATION_B1B_AUTHORITY_CLAIM_ROLLBACK_REFUSED_NONEMPTY_STORE'
        USING ERRCODE = 'P0001',
              DETAIL = format(
                'Durable one-time authority claim evidence present (row_count=%s). Destructive rollback 70 is forbidden while claim rows exist.',
                v_count
              );
    END IF;
  END IF;
END;
$$;

-- Idempotent revoke (skip when function already absent — Case A).
DO $revoke$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'public.operation_b1b_get_one_time_live_authority_claim(text, text, text, uuid)',
    'public.operation_b1b_claim_one_time_live_authority(text, text, text, uuid, text, text, text, text, text)',
    'public.operation_b1b_authority_claim_is_service_role()'
  ]
  LOOP
    IF to_regprocedure(r) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', r);
    END IF;
  END LOOP;
END
$revoke$;

DROP FUNCTION IF EXISTS public.operation_b1b_get_one_time_live_authority_claim(
  text, text, text, uuid
);
DROP FUNCTION IF EXISTS public.operation_b1b_claim_one_time_live_authority(
  text, text, text, uuid, text, text, text, text, text
);
DROP FUNCTION IF EXISTS public.operation_b1b_authority_claim_is_service_role();

DROP TABLE IF EXISTS public.operation_b1b_one_time_authority_claims;
