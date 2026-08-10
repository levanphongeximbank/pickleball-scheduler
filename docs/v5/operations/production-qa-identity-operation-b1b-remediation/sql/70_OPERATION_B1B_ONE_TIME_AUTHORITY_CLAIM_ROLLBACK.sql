-- =============================================================================
-- OPERATION B1B — One-time live execution authority claim ROLLBACK
-- Status: AUTHORED ONLY — NOT EXECUTED.
-- Pair with 30_OPERATION_B1B_ONE_TIME_AUTHORITY_CLAIM_FORWARD.sql
-- Does NOT touch WP1/WP2 quarantine objects, profiles, or Auth.
-- =============================================================================

SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.operation_b1b_get_one_time_live_authority_claim(
  text, text, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operation_b1b_get_one_time_live_authority_claim(
  text, text, text, uuid
) FROM anon;
REVOKE ALL ON FUNCTION public.operation_b1b_get_one_time_live_authority_claim(
  text, text, text, uuid
) FROM authenticated;
REVOKE ALL ON FUNCTION public.operation_b1b_get_one_time_live_authority_claim(
  text, text, text, uuid
) FROM service_role;

REVOKE ALL ON FUNCTION public.operation_b1b_claim_one_time_live_authority(
  text, text, text, uuid, text, text, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operation_b1b_claim_one_time_live_authority(
  text, text, text, uuid, text, text, text, text, text
) FROM anon;
REVOKE ALL ON FUNCTION public.operation_b1b_claim_one_time_live_authority(
  text, text, text, uuid, text, text, text, text, text
) FROM authenticated;
REVOKE ALL ON FUNCTION public.operation_b1b_claim_one_time_live_authority(
  text, text, text, uuid, text, text, text, text, text
) FROM service_role;

DROP FUNCTION IF EXISTS public.operation_b1b_get_one_time_live_authority_claim(
  text, text, text, uuid
);
DROP FUNCTION IF EXISTS public.operation_b1b_claim_one_time_live_authority(
  text, text, text, uuid, text, text, text, text, text
);
DROP FUNCTION IF EXISTS public.operation_b1b_authority_claim_is_service_role();

DROP TABLE IF EXISTS public.operation_b1b_one_time_authority_claims;
