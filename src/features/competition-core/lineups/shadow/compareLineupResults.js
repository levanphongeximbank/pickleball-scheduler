/**
 * CORE-06 Phase 1F — shadow comparison utility (test/docs only).
 * Never wires into Production runtime. Performs no writes / no network.
 *
 * Accepted differences require an allowlisted difference code.
 * Caller-supplied free-text labels alone cannot accept a difference.
 */

import {
  LINEUP_SHADOW_CLASSIFICATION,
  LINEUP_SHADOW_DIMENSIONS,
  createShadowDimensionResult,
} from "../contracts/shadowComparison.js";
import {
  isLineupAcceptedDifferenceCode,
  LINEUP_ACCEPTED_DIFFERENCE_CODE,
} from "../contracts/acceptedDifferences.js";

/**
 * @param {unknown} a
 * @param {unknown} b
 */
function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Resolve allowlisted accepted code for a dimension.
 * @param {string} dimension
 * @param {Record<string, string>} accepted — map dimension → difference code
 * @returns {string|null}
 */
function resolveAcceptedCode(dimension, accepted) {
  const code = accepted && typeof accepted === "object" ? accepted[dimension] : null;
  if (!isLineupAcceptedDifferenceCode(code)) return null;
  return code;
}

/**
 * Default allowlisted codes for known structural dimension gaps
 * (only when values actually differ).
 */
const DEFAULT_DIMENSION_CODES = Object.freeze({
  visibilityState: LINEUP_ACCEPTED_DIFFERENCE_CODE.REVEAL_VS_PUBLISH_DIMENSIONS,
  revealEligibility: LINEUP_ACCEPTED_DIFFERENCE_CODE.REVEAL_VS_PUBLISH_DIMENSIONS,
});

/**
 * Compare legacy fixture expectation vs canonical-mapped result.
 * @param {object} params
 * @param {object|null} params.legacy
 * @param {object|null} params.canonical
 * @param {Record<string, string>} [params.accepted] — dimension → allowlisted difference code
 * @param {boolean} [params.unauthorizedViewer] — when true, skip comparing hidden selection details
 */
export function compareLineupShadowResults({
  legacy = null,
  canonical = null,
  accepted = {},
  unauthorizedViewer = false,
} = {}) {
  const dimensions = LINEUP_SHADOW_DIMENSIONS.map((dimension) => {
    if (!legacy || !canonical) {
      return createShadowDimensionResult({
        dimension,
        classification: LINEUP_SHADOW_CLASSIFICATION.INSUFFICIENT_DATA,
        rationale: "Missing legacy or canonical observation",
      });
    }

    if (
      unauthorizedViewer &&
      (dimension === "lineupSlots" ||
        dimension === "participantAssignments" ||
        dimension === "randomFallbackResult")
    ) {
      return createShadowDimensionResult({
        dimension,
        classification: LINEUP_SHADOW_CLASSIFICATION.INSUFFICIENT_DATA,
        rationale: "Hidden lineup details not compared for unauthorized viewer",
      });
    }

    const legacyValue = legacy[dimension] ?? null;
    const canonicalValue = canonical[dimension] ?? null;

    if (legacyValue == null && canonicalValue == null) {
      return createShadowDimensionResult({
        dimension,
        classification: LINEUP_SHADOW_CLASSIFICATION.INSUFFICIENT_DATA,
        legacyValue,
        canonicalValue,
        rationale: "Both sides lack data",
      });
    }

    if (same(legacyValue, canonicalValue)) {
      return createShadowDimensionResult({
        dimension,
        classification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
        legacyValue,
        canonicalValue,
      });
    }

    const explicitCode = resolveAcceptedCode(dimension, accepted);
    if (explicitCode) {
      return createShadowDimensionResult({
        dimension,
        classification: LINEUP_SHADOW_CLASSIFICATION.ACCEPTED_DIFFERENCE,
        legacyValue,
        canonicalValue,
        rationale: explicitCode,
        differenceCode: explicitCode,
      });
    }

    // Reject unknown free-text acceptance attempts.
    if (
      accepted &&
      typeof accepted === "object" &&
      accepted[dimension] != null &&
      !isLineupAcceptedDifferenceCode(accepted[dimension])
    ) {
      return createShadowDimensionResult({
        dimension,
        classification: LINEUP_SHADOW_CLASSIFICATION.BLOCKING_DIFFERENCE,
        legacyValue,
        canonicalValue,
        rationale: `Unknown difference code rejected: ${String(accepted[dimension])}`,
      });
    }

    const defaultCode = DEFAULT_DIMENSION_CODES[dimension] || null;
    if (defaultCode && isLineupAcceptedDifferenceCode(defaultCode)) {
      return createShadowDimensionResult({
        dimension,
        classification: LINEUP_SHADOW_CLASSIFICATION.ACCEPTED_DIFFERENCE,
        legacyValue,
        canonicalValue,
        rationale: defaultCode,
        differenceCode: defaultCode,
      });
    }

    return createShadowDimensionResult({
      dimension,
      classification: LINEUP_SHADOW_CLASSIFICATION.BLOCKING_DIFFERENCE,
      legacyValue,
      canonicalValue,
      rationale: "Values differ without allowlisted difference code",
    });
  });

  const counts = {
    matched: 0,
    acceptedDifferences: 0,
    blockingDifferences: 0,
    insufficientData: 0,
  };
  for (const d of dimensions) {
    if (d.classification === LINEUP_SHADOW_CLASSIFICATION.MATCH) {
      counts.matched += 1;
    } else if (
      d.classification === LINEUP_SHADOW_CLASSIFICATION.ACCEPTED_DIFFERENCE
    ) {
      counts.acceptedDifferences += 1;
    } else if (
      d.classification === LINEUP_SHADOW_CLASSIFICATION.BLOCKING_DIFFERENCE
    ) {
      counts.blockingDifferences += 1;
    } else {
      counts.insufficientData += 1;
    }
  }

  return Object.freeze({
    dimensions: Object.freeze(dimensions),
    totals: Object.freeze({
      total: dimensions.length,
      ...counts,
    }),
    hasBlockingDifference: counts.blockingDifferences > 0,
  });
}
