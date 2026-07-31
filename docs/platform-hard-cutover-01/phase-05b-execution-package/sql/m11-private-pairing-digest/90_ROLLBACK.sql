-- M11 rollback
-- Production pre-apply body already matches Staging catalog (def_md5 identical).
-- Exact pre-M11 restore = re-apply the STAGING_CATALOG_DERIVED definition in
-- 10_PRIVATE_PAIRING_DIGEST.sql (same bytes).
-- Do NOT revert to bare digest(...) from docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql.
-- No DROP. No identity/catalog row writes.
-- NO-OP when live def_md5 already equals 0be77671f95c52b1d5e00496bee2adf1.

-- Operator instruction: re-execute sql/m11-private-pairing-digest/10_PRIVATE_PAIRING_DIGEST.sql
-- to restore the catalog-derived body if a divergent apply occurred.
SELECT 'M11_ROLLBACK_NOOP_OR_REAPPLY_10_PRIVATE_PAIRING_DIGEST' AS rollback_action;
