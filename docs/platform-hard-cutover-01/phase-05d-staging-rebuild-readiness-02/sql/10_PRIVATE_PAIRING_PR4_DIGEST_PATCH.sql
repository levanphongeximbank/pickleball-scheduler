-- =============================================================================
-- PRIVATE PAIRING RULES V2 — PR4 DIGEST PATCH (canonical tracked)
-- Marker: private_pairing_pr4_digest_patch
-- Purpose: Use extensions.digest with search_path including extensions
--          (parity with TT1B digest hotfix pattern). Does not change digest
--          payload composition or Private Pairing Rules V2 hard-cutover policy.
-- Authority: TRACKED CANONICAL — closes B-R04 for blank-DB rebuild readiness.
-- Do NOT execute in this readiness workstream; apply only under future GO-A build.
-- =============================================================================

SET search_path = public, extensions, pg_temp;

CREATE OR REPLACE FUNCTION public.private_pairing_compute_rules_digest(p_rule_set_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_payload text;
BEGIN
  SELECT coalesce(string_agg(chunk, '|' ORDER BY chunk), '')
    INTO v_payload
  FROM (
    SELECT
      r.id::text || ':' || r.constraint_type || ':' || r.severity || ':' ||
      coalesce(r.primary_player_id, '') || ':' || coalesce(r.relation_mode, '') || ':' ||
      coalesce(r.weight::text, '') || ':' || coalesce(r.visibility, '') || ':' ||
      coalesce((
        SELECT string_agg(t.target_player_id, ',' ORDER BY t.target_player_id)
        FROM public.private_pairing_rule_targets t
        WHERE t.rule_id = r.id
      ), '') AS chunk
    FROM public.private_pairing_rules r
    WHERE r.rule_set_id = p_rule_set_id
      AND r.deleted_at IS NULL
      AND r.active = true
  ) s;

  RETURN encode(extensions.digest(convert_to(v_payload, 'UTF8'), 'sha256'), 'hex');
END;
$$;

COMMENT ON FUNCTION public.private_pairing_compute_rules_digest(uuid) IS
  'PR4 digest patch: extensions.digest SHA-256 over active rules payload; search_path public,extensions,pg_temp';