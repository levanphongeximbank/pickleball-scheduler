/**
 * Phase 3B — participant shadow comparator (fixture / non-Production).
 */

import { createShadowComparisonResult } from "../../../../runtime-control/shadow/contracts/shadowComparison.js";
import { createShadowDifference } from "../../../../runtime-control/shadow/contracts/shadowDifference.js";
import { SHADOW_COMPARISON_STATUS } from "../../../../runtime-control/shadow/constants/shadowComparisonStatuses.js";
import { SHADOW_REASON_CODE } from "../../../../runtime-control/shadow/constants/shadowReasonCodes.js";
import {
  SHADOW_DIFFERENCE_KIND,
  SHADOW_DIFFERENCE_SEVERITY,
} from "../../../../runtime-control/shadow/constants/shadowDifferenceKinds.js";

/**
 * @param {{ fingerprint: string|null, normalized: Record<string, unknown>|null }} legacy
 * @param {{ fingerprint: string|null, normalized: Record<string, unknown>|null }} canonical
 * @returns {import('../../../../runtime-control/shadow/contracts/shadowComparison.js').ShadowComparisonResult}
 */
export function compareParticipantShadowPayloads(legacy, canonical) {
  if (!legacy?.normalized || !canonical?.normalized) {
    return createShadowComparisonResult({
      status: SHADOW_COMPARISON_STATUS.NOT_COMPARABLE,
      reasonCode: SHADOW_REASON_CODE.COMPARISON_SKIPPED,
      legacyFingerprint: legacy?.fingerprint ?? null,
      canonicalFingerprint: canonical?.fingerprint ?? null,
      metadata: { phase: "3b", capability: "PARTICIPANT" },
    });
  }

  /** @type {import('../../../../runtime-control/shadow/contracts/shadowDifference.js').ShadowDifference[]} */
  const differences = [];
  const fields = [
    "competitionId",
    "kind",
    "personId",
    "identityKey",
    "status",
  ];

  for (const field of fields) {
    const lv = legacy.normalized[field];
    const cv = canonical.normalized[field];
    if (lv !== cv) {
      const critical = field === "identityKey" || field === "personId" || field === "kind";
      differences.push(
        createShadowDifference({
          path: field,
          kind: SHADOW_DIFFERENCE_KIND.VALUE_MISMATCH,
          legacyValue: lv,
          canonicalValue: cv,
          severity: critical
            ? SHADOW_DIFFERENCE_SEVERITY.CRITICAL
            : SHADOW_DIFFERENCE_SEVERITY.MEDIUM,
          message: `${field} mismatch`,
        })
      );
    }
  }

  if (differences.length === 0) {
    return createShadowComparisonResult({
      status: SHADOW_COMPARISON_STATUS.EQUIVALENT,
      reasonCode: SHADOW_REASON_CODE.COMPARISON_EQUIVALENT,
      differences: [],
      legacyFingerprint: legacy.fingerprint,
      canonicalFingerprint: canonical.fingerprint,
      metadata: { phase: "3b", capability: "PARTICIPANT" },
    });
  }

  const hasCritical = differences.some(
    (d) => d.severity === SHADOW_DIFFERENCE_SEVERITY.CRITICAL
  );

  return createShadowComparisonResult({
    status: SHADOW_COMPARISON_STATUS.NON_EQUIVALENT,
    reasonCode: SHADOW_REASON_CODE.COMPARISON_DIVERGED,
    differences,
    legacyFingerprint: legacy.fingerprint,
    canonicalFingerprint: canonical.fingerprint,
    metadata: {
      phase: "3b",
      capability: "PARTICIPANT",
      hasCritical,
    },
  });
}
