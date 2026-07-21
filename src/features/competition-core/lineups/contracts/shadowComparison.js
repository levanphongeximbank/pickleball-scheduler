/**
 * CORE-06 Phase 1F — shadow comparison classification (test/docs only).
 */

export const LINEUP_SHADOW_CLASSIFICATION = Object.freeze({
  MATCH: "MATCH",
  ACCEPTED_DIFFERENCE: "ACCEPTED_DIFFERENCE",
  BLOCKING_DIFFERENCE: "BLOCKING_DIFFERENCE",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
});

/** @type {ReadonlySet<string>} */
export const LINEUP_SHADOW_CLASSIFICATION_VALUES = new Set(
  Object.values(LINEUP_SHADOW_CLASSIFICATION)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLineupShadowClassification(value) {
  return (
    typeof value === "string" &&
    LINEUP_SHADOW_CLASSIFICATION_VALUES.has(value)
  );
}

/**
 * Dimensions compared in shadow readiness (documentation + test utility).
 */
export const LINEUP_SHADOW_DIMENSIONS = Object.freeze([
  "aggregateIdentity",
  "lineupSlots",
  "participantAssignments",
  "lifecycleStatus",
  "lockState",
  "visibilityState",
  "revealEligibility",
  "version",
  "deadlineOutcome",
  "randomFallbackResult",
  "reasonOrErrorCode",
  "auditCommandType",
]);

/**
 * @param {Partial<{
 *   dimension: string,
 *   classification: string,
 *   legacyValue: unknown,
 *   canonicalValue: unknown,
 *   rationale: string|null,
 *   differenceCode: string|null,
 * }>} [partial]
 */
export function createShadowDimensionResult(partial = {}) {
  return Object.freeze({
    dimension: String(partial.dimension || "").trim(),
    classification:
      typeof partial.classification === "string" &&
      LINEUP_SHADOW_CLASSIFICATION_VALUES.has(partial.classification)
        ? partial.classification
        : LINEUP_SHADOW_CLASSIFICATION.INSUFFICIENT_DATA,
    legacyValue: partial.legacyValue ?? null,
    canonicalValue: partial.canonicalValue ?? null,
    rationale:
      partial.rationale != null && String(partial.rationale).trim() !== ""
        ? String(partial.rationale).trim()
        : null,
    differenceCode:
      partial.differenceCode != null &&
      String(partial.differenceCode).trim() !== ""
        ? String(partial.differenceCode).trim()
        : null,
  });
}
