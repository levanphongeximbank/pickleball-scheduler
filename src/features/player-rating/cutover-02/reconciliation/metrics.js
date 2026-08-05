/**
 * Reconciliation metrics aggregation for dual-read + freeze evidence.
 * OWNER_APPROVAL_REQUIRED on any Production GO threshold.
 */

import { DUAL_READ_COMPARE_OUTCOME } from "../constants/compareOutcomes.js";

export const RECONCILIATION_OWNER_APPROVAL = Object.freeze({
  OWNER_APPROVAL_REQUIRED: "YES",
  note: "Do not treat suggested thresholds as Production cutover GO criteria.",
});

/** Suggested Staging rehearsal thresholds only — not Production GO. */
export const SUGGESTED_STAGING_THRESHOLDS = Object.freeze({
  minV5CoveragePct: 80,
  maxMissingV5Pct: 20,
  maxTenantMismatch: 0,
  maxIdentityMismatch: 0,
  maxUnexpectedWriters: 0,
  OWNER_APPROVAL_REQUIRED: "YES",
});

/**
 * @param {{
 *   comparisons?: Array<Record<string, unknown>>,
 *   writerAttempts?: Array<Record<string, unknown>>,
 *   eligibleV2Population?: number,
 *   usersWithV5ShadowProfile?: number,
 *   rollbackSuccess?: boolean|null,
 * }} input
 */
export function buildReconciliationReport(input = {}) {
  const comparisons = Array.isArray(input.comparisons) ? input.comparisons : [];
  const writerAttempts = Array.isArray(input.writerAttempts) ? input.writerAttempts : [];

  const eligibleV2 =
    Number.isFinite(Number(input.eligibleV2Population))
      ? Number(input.eligibleV2Population)
      : comparisons.filter((c) => c?.v2?.present).length;

  const usersWithV5 =
    Number.isFinite(Number(input.usersWithV5ShadowProfile))
      ? Number(input.usersWithV5ShadowProfile)
      : comparisons.filter((c) => c?.v5?.present).length;

  const paired = comparisons.filter((c) => c?.v2?.present && c?.v5?.present).length;
  const coveragePct =
    eligibleV2 > 0 ? Math.round((usersWithV5 / eligibleV2) * 10000) / 100 : 0;
  const missingV5Pct =
    eligibleV2 > 0
      ? Math.round(
          ((eligibleV2 - usersWithV5) / eligibleV2) * 10000
        ) / 100
      : 0;

  const countPrimary = (code) =>
    comparisons.filter((c) => c?.classification?.primary === code).length;

  const rawExactMatch = comparisons.filter(
    (c) => c?.rawCompare?.rawExactMatch === true
  ).length;

  const unapprovedScale = comparisons.filter(
    (c) =>
      c?.classification?.secondary?.includes?.(
        DUAL_READ_COMPARE_OUTCOME.SCALE_MAPPING_UNAPPROVED
      ) ||
      c?.mapping?.status === "UNAPPROVED" ||
      c?.rawCompare?.equivalenceVerdict === "NO_EQUIVALENCE_MAPPING_UNAPPROVED"
  ).length;

  /** @type {Record<string, number>} */
  const attemptsByWriter = {};
  /** @type {Record<string, number>} */
  const blockedByWriter = {};
  let unexpectedWriters = 0;

  for (const attempt of writerAttempts) {
    const writerId = String(attempt.writerId || "UNKNOWN");
    attemptsByWriter[writerId] = (attemptsByWriter[writerId] || 0) + 1;
    if (attempt.blocked === true) {
      blockedByWriter[writerId] = (blockedByWriter[writerId] || 0) + 1;
    }
    if (attempt.unexpectedWriter === true) unexpectedWriters += 1;
  }

  return Object.freeze({
    eligibleV2Population: eligibleV2,
    usersWithV5ShadowProfile: usersWithV5,
    pairedV2V5Records: paired,
    v5CoveragePercentage: coveragePct,
    missingV5Percentage: missingV5Pct,
    invalidatedV5Count: countPrimary(DUAL_READ_COMPARE_OUTCOME.V5_INVALIDATED),
    outOfRangeCount: countPrimary(DUAL_READ_COMPARE_OUTCOME.VALUE_OUT_OF_RANGE),
    tenantOrIdentityMismatchCount: countPrimary(
      DUAL_READ_COMPARE_OUTCOME.TENANT_OR_IDENTITY_MISMATCH
    ),
    tenantMismatchCount: comparisons.filter((c) =>
      c?.classification?.notes?.includes?.("TENANT_MISMATCH")
    ).length,
    identityMismatchCount: comparisons.filter((c) =>
      c?.classification?.notes?.includes?.("IDENTITY_MISMATCH")
    ).length,
    staleV2Count: countPrimary(DUAL_READ_COMPARE_OUTCOME.STALE_V2),
    staleV5Count: countPrimary(DUAL_READ_COMPARE_OUTCOME.STALE_V5),
    rawExactMatchCount: rawExactMatch,
    normalizedComparisonStatus: "UNAPPROVED_SCALE_NO_EQUIVALENCE",
    unapprovedScaleCount: unapprovedScale,
    writerAttemptsByWriter: Object.freeze({ ...attemptsByWriter }),
    blockedAttemptsByWriter: Object.freeze({ ...blockedByWriter }),
    unexpectedWriters,
    rollbackSuccess:
      input.rollbackSuccess === undefined ? null : input.rollbackSuccess === true,
    thresholds: SUGGESTED_STAGING_THRESHOLDS,
    OWNER_APPROVAL_REQUIRED: RECONCILIATION_OWNER_APPROVAL.OWNER_APPROVAL_REQUIRED,
  });
}
