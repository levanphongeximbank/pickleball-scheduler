/**
 * CORE-06 Phase 1F — accepted difference allowlist (governance).
 * Only these codes may classify as ACCEPTED_DIFFERENCE.
 * Unknown codes → BLOCKING_DIFFERENCE (or INSUFFICIENT_DATA when no observation).
 */

export const LINEUP_ACCEPTED_DIFFERENCE_CODE = Object.freeze({
  GRACE_POLICY_INJECTION: "DIFF_GRACE_POLICY_INJECTION",
  REVEAL_VS_PUBLISH_DIMENSIONS: "DIFF_REVEAL_VS_PUBLISH_DIMENSIONS",
  OFFICIALS_VISIBILITY_MATRIX: "DIFF_OFFICIALS_VISIBILITY_MATRIX",
  PUBLIC_VISIBILITY_ENUM: "DIFF_PUBLIC_VISIBILITY_ENUM",
  CORRECTION_DEFAULT_DENY: "DIFF_CORRECTION_DEFAULT_DENY",
  RNG_SEMANTIC_ONLY: "DIFF_RNG_SEMANTIC_ONLY",
  TENANT_EXPLICIT_REQUIRED: "DIFF_TENANT_EXPLICIT_REQUIRED",
  CANONICAL_FINGERPRINT_ABSENT_IN_LEGACY: "DIFF_CANONICAL_FINGERPRINT_ABSENT",
});

/** @type {ReadonlySet<string>} */
export const LINEUP_ACCEPTED_DIFFERENCE_CODE_VALUES = new Set(
  Object.values(LINEUP_ACCEPTED_DIFFERENCE_CODE)
);

/**
 * @param {unknown} code
 * @returns {boolean}
 */
export function isLineupAcceptedDifferenceCode(code) {
  return (
    typeof code === "string" &&
    LINEUP_ACCEPTED_DIFFERENCE_CODE_VALUES.has(code)
  );
}

/**
 * Governance metadata for each allowlisted difference.
 * @type {Readonly<Record<string, object>>}
 */
export const LINEUP_ACCEPTED_DIFFERENCE_REGISTRY = Object.freeze({
  [LINEUP_ACCEPTED_DIFFERENCE_CODE.GRACE_POLICY_INJECTION]: Object.freeze({
    code: LINEUP_ACCEPTED_DIFFERENCE_CODE.GRACE_POLICY_INJECTION,
    scenarios: Object.freeze(["P3"]),
    legacyBehavior: "Format-specific late submit during grace",
    canonicalBehavior: "allowsLateMutation injected by hardening policy",
    reason: "Grace permission is format-owned, not hard-coded in CORE-06",
    ownerDecisionRequired: true,
    productionCutoverImpact: "Adapter must map TT grace flags to hardening policy",
    rollbackImpact: "Low — policy injection reversible",
    resolutionStage: 1,
    blocksAdapterImplementation: false,
    blocksShadowMode: false,
    blocksCanonicalWriter: false,
    blocksLegacyRetirement: false,
  }),
  [LINEUP_ACCEPTED_DIFFERENCE_CODE.REVEAL_VS_PUBLISH_DIMENSIONS]: Object.freeze({
    code: LINEUP_ACCEPTED_DIFFERENCE_CODE.REVEAL_VS_PUBLISH_DIMENSIONS,
    scenarios: Object.freeze(["P6", "P9"]),
    legacyBehavior: "Opponent visibility tied to publish / matchup state",
    canonicalBehavior: "visibilityState + revealEligible are separate dimensions",
    reason: "CORE-06 Phase 1E hardens reveal vs lifecycle separation",
    ownerDecisionRequired: true,
    productionCutoverImpact: "Adapter must not map publish→PUBLIC without policy",
    rollbackImpact: "Medium — dual-read must preserve both models",
    resolutionStage: 3,
    blocksAdapterImplementation: false,
    blocksShadowMode: false,
    blocksCanonicalWriter: false,
    blocksLegacyRetirement: true,
  }),
  [LINEUP_ACCEPTED_DIFFERENCE_CODE.OFFICIALS_VISIBILITY_MATRIX]: Object.freeze({
    code: LINEUP_ACCEPTED_DIFFERENCE_CODE.OFFICIALS_VISIBILITY_MATRIX,
    scenarios: Object.freeze(["P8"]),
    legacyBehavior: "BTC/ref product role matrix",
    canonicalBehavior: "OFFICIALS_VISIBLE + injected projection policy",
    reason: "Role catalogs remain format-owned",
    ownerDecisionRequired: true,
    productionCutoverImpact: "Adapter supplies officials authorization",
    rollbackImpact: "Low",
    resolutionStage: 1,
    blocksAdapterImplementation: false,
    blocksShadowMode: false,
    blocksCanonicalWriter: false,
    blocksLegacyRetirement: false,
  }),
  [LINEUP_ACCEPTED_DIFFERENCE_CODE.PUBLIC_VISIBILITY_ENUM]: Object.freeze({
    code: LINEUP_ACCEPTED_DIFFERENCE_CODE.PUBLIC_VISIBILITY_ENUM,
    scenarios: Object.freeze(["P9"]),
    legacyBehavior: "Published matchup visibility (no PUBLIC enum)",
    canonicalBehavior: "Explicit PUBLIC visibility state",
    reason: "Canonical-only visibility enum",
    ownerDecisionRequired: true,
    productionCutoverImpact: "Output mapper documents unsupported field",
    rollbackImpact: "Low",
    resolutionStage: 2,
    blocksAdapterImplementation: false,
    blocksShadowMode: false,
    blocksCanonicalWriter: false,
    blocksLegacyRetirement: true,
  }),
  [LINEUP_ACCEPTED_DIFFERENCE_CODE.CORRECTION_DEFAULT_DENY]: Object.freeze({
    code: LINEUP_ACCEPTED_DIFFERENCE_CODE.CORRECTION_DEFAULT_DENY,
    scenarios: Object.freeze(["P14"]),
    legacyBehavior: "BTC override via permission codes",
    canonicalBehavior: "allowsLockedCorrection default false",
    reason: "Phase 1E fail-closed correction gate",
    ownerDecisionRequired: true,
    productionCutoverImpact: "Adapter must explicitly allow corrections",
    rollbackImpact: "Low",
    resolutionStage: 1,
    blocksAdapterImplementation: false,
    blocksShadowMode: false,
    blocksCanonicalWriter: false,
    blocksLegacyRetirement: false,
  }),
  [LINEUP_ACCEPTED_DIFFERENCE_CODE.RNG_SEMANTIC_ONLY]: Object.freeze({
    code: LINEUP_ACCEPTED_DIFFERENCE_CODE.RNG_SEMANTIC_ONLY,
    scenarios: Object.freeze(["P16"]),
    legacyBehavior: "TT product randomize engine",
    canonicalBehavior: "CORE-06 Phase 1D seeded Fisher–Yates (semantic determinism)",
    reason:
      "No claim of exact bit-parity with TT RNG; same seed may yield different assignments across engines",
    ownerDecisionRequired: true,
    productionCutoverImpact:
      "Canonical writer cutover BLOCKED until Owner approves compatibility RNG adapter or accepts reassignment",
    rollbackImpact: "High if published lineups must remain reproducible",
    resolutionStage: 6,
    blocksAdapterImplementation: false,
    blocksShadowMode: false,
    blocksCanonicalWriter: true,
    blocksLegacyRetirement: true,
    rngParityClass: "SEMANTIC_ONLY",
  }),
  [LINEUP_ACCEPTED_DIFFERENCE_CODE.TENANT_EXPLICIT_REQUIRED]: Object.freeze({
    code: LINEUP_ACCEPTED_DIFFERENCE_CODE.TENANT_EXPLICIT_REQUIRED,
    scenarios: Object.freeze(["P24"]),
    legacyBehavior: "May derive club/tournament scope",
    canonicalBehavior: "Explicit tenantId required; no inference",
    reason: "Fail-closed multi-tenant isolation",
    ownerDecisionRequired: false,
    productionCutoverImpact: "Production adapter must supply verified tenantId",
    rollbackImpact: "None",
    resolutionStage: 1,
    blocksAdapterImplementation: false,
    blocksShadowMode: false,
    blocksCanonicalWriter: false,
    blocksLegacyRetirement: false,
  }),
  [LINEUP_ACCEPTED_DIFFERENCE_CODE.CANONICAL_FINGERPRINT_ABSENT_IN_LEGACY]:
    Object.freeze({
      code: LINEUP_ACCEPTED_DIFFERENCE_CODE.CANONICAL_FINGERPRINT_ABSENT_IN_LEGACY,
      scenarios: Object.freeze(["P25"]),
      legacyBehavior: "No command/result fingerprint fields",
      canonicalBehavior: "Fingerprints retained canonically; omitted in legacy output",
      reason: "Canonical-only audit fingerprint fields",
      ownerDecisionRequired: false,
      productionCutoverImpact: "None for TT UI",
      rollbackImpact: "None",
      resolutionStage: 2,
      blocksAdapterImplementation: false,
      blocksShadowMode: false,
      blocksCanonicalWriter: false,
      blocksLegacyRetirement: false,
    }),
});
