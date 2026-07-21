/**
 * Tenant / venue resolver certification constants (Phase 1H-A).
 *
 * Offline/static certification only — no live database connection.
 *
 * Verdict options (exactly one):
 * - SAME_SCOPE_MODEL_VERIFIED
 * - DISTINCT_SCOPE_MODEL_SUPPORTED
 * - BLOCKED_MISSING_TENANT_RESOLVER
 */

export const CRM_TENANT_VENUE_RESOLVER_VERDICT = Object.freeze({
  verdict: "SAME_SCOPE_MODEL_VERIFIED",
  phase: "1H-A",
  certifiedAtDoc: "docs/crm/phase-1h/03_TENANT_VENUE_RESOLVER_CERTIFICATION.md",
  evidence: Object.freeze({
    jwtBindingHelper: "public.user_venue_id()",
    jwtBindingSource: "profiles.venue_id for auth.uid()",
    distinctTenantHelper: null,
    phase1gScopeHelper: "public.crm_phase1g_scope_allows(tenant_id, venue_id)",
    phase1gRequirement:
      "tenant_id = user_venue_id() AND venue_id = user_venue_id()",
    appLayerDistinctIdsAllowedInMemory: true,
    durableJwtRequiresEqualIds: true,
    firstVenueFallbackPresent: false,
    nullablePermissivePolicyPresent: false,
  }),
  remediationIfDistinctRequired: Object.freeze({
    required: false,
    summary:
      "If product later requires tenant_id <> venue_id, Identity must publish a verified user_tenant_id() (or equivalent) before any permissive RLS rewrite. Until then, keep SAME_SCOPE fail-closed.",
  }),
});

export function getCrmTenantVenueResolverVerdict() {
  return CRM_TENANT_VENUE_RESOLVER_VERDICT.verdict;
}

export function isAcceptableCrmTenantVenueResolverVerdict(verdict) {
  return (
    verdict === "SAME_SCOPE_MODEL_VERIFIED" ||
    verdict === "DISTINCT_SCOPE_MODEL_SUPPORTED"
  );
}
