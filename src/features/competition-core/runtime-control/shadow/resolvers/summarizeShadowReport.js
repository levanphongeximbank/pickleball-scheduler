/**
 * Shadow report summarizer (Phase 3A.2).
 */

import { isPlainObject } from "../../contracts/jsonSafe.js";
import { createShadowComparisonResult } from "../contracts/shadowComparison.js";
import { createShadowReportSummary } from "../contracts/shadowReportSummary.js";
import { SHADOW_COMPARISON_STATUS } from "../constants/shadowComparisonStatuses.js";
import {
  SHADOW_DIFFERENCE_SEVERITY,
  SHADOW_SEVERITY_RANK,
} from "../constants/shadowDifferenceKinds.js";

/**
 * @param {import('../contracts/shadowDifference.js').ShadowDifference[]} differences
 * @returns {string|null}
 */
function highestSeverity(differences) {
  let best = null;
  let bestRank = -1;
  for (const d of differences) {
    const rank = SHADOW_SEVERITY_RANK[d.severity] ?? -1;
    if (rank > bestRank) {
      bestRank = rank;
      best = d.severity;
    }
  }
  return best;
}

/**
 * @param {object} [input]
 * @param {object} [input.comparison]
 * @returns {import('../contracts/shadowReportSummary.js').ShadowReportSummary}
 */
export function summarizeShadowReport(input = {}) {
  const comparison = createShadowComparisonResult(
    isPlainObject(input.comparison) ? input.comparison : {}
  );

  const status = comparison.status;
  const differenceCount = comparison.differences.length;

  return createShadowReportSummary({
    equivalent: status === SHADOW_COMPARISON_STATUS.EQUIVALENT,
    diverged: status === SHADOW_COMPARISON_STATUS.NON_EQUIVALENT,
    skipped: status === SHADOW_COMPARISON_STATUS.SKIPPED,
    errored: status === SHADOW_COMPARISON_STATUS.ERROR,
    notComparable: status === SHADOW_COMPARISON_STATUS.NOT_COMPARABLE,
    differenceCount,
    highestSeverity:
      differenceCount > 0
        ? highestSeverity(comparison.differences)
        : status === SHADOW_COMPARISON_STATUS.ERROR
          ? SHADOW_DIFFERENCE_SEVERITY.CRITICAL
          : null,
    metadata: {
      status,
      reasonCode: comparison.reasonCode,
      partial: status === SHADOW_COMPARISON_STATUS.PARTIAL,
    },
  });
}
