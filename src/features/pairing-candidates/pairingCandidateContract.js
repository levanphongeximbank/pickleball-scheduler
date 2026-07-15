/**
 * PHASE 45B.2 — Pairing candidate response contract helpers.
 * Portable. No React / storage / UI imports.
 */

export const PAIRING_CANDIDATE_GATEWAY_VERSION = "45B.3.0";

export const PAIRING_CANDIDATE_STATUS = Object.freeze({
  READY: "ready",
  LOADING: "loading",
  ERROR: "error",
  BLOCKED: "blocked",
});

/**
 * @returns {{ mapped: number, derived: number, unmapped: number }}
 */
export function emptyIdentityCoverage() {
  return { mapped: 0, derived: 0, unmapped: 0 };
}

/**
 * @returns {{
 *   athleteRows: number,
 *   membershipRows: number,
 *   activeMembershipRows: number,
 *   registeredRows?: number,
 *   preEligibilityRows: number,
 *   eligibleRows: number
 * }}
 */
export function emptySourceBreakdown() {
  return {
    athleteRows: 0,
    membershipRows: 0,
    activeMembershipRows: 0,
    registeredRows: undefined,
    preEligibilityRows: 0,
    eligibleRows: 0,
  };
}

/**
 * Build a stable gateway response. Never a bare array.
 *
 * @param {object} partial
 * @returns {object}
 */
export function buildPairingCandidateResponse(partial = {}) {
  const status = partial.status || PAIRING_CANDIDATE_STATUS.READY;
  const candidates = Array.isArray(partial.candidates) ? partial.candidates : [];
  const excluded = Array.isArray(partial.excluded) ? partial.excluded : [];
  const byReason = {};
  for (const row of excluded) {
    const code = String(row?.reasonCode || "");
    if (!code) continue;
    byReason[code] = (byReason[code] || 0) + 1;
  }

  const summary = {
    sourceCount: Number(partial.summary?.sourceCount ?? 0),
    eligibleCount: Number(partial.summary?.eligibleCount ?? candidates.length),
    excludedCount: Number(partial.summary?.excludedCount ?? excluded.length),
    byReason: {
      ...(partial.summary?.byReason && typeof partial.summary.byReason === "object"
        ? partial.summary.byReason
        : {}),
      ...byReason,
    },
  };

  const diagnostics = {
    scope: partial.diagnostics?.scope && typeof partial.diagnostics.scope === "object"
      ? { ...partial.diagnostics.scope }
      : {},
    identityCoverage: {
      ...emptyIdentityCoverage(),
      ...(partial.diagnostics?.identityCoverage || {}),
    },
    sourceBreakdown: {
      ...emptySourceBreakdown(),
      ...(partial.diagnostics?.sourceBreakdown || {}),
    },
    aliasDiagnostics: {
      duplicateAliases: Array.isArray(
        partial.diagnostics?.aliasDiagnostics?.duplicateAliases
      )
        ? [...partial.diagnostics.aliasDiagnostics.duplicateAliases]
        : [],
      mismatchedAliasCount: Number(
        partial.diagnostics?.aliasDiagnostics?.mismatchedAliasCount || 0
      ),
      ignoredPrimaryClaimCount: Number(
        partial.diagnostics?.aliasDiagnostics?.ignoredPrimaryClaimCount || 0
      ),
    },
    gatewayVersion:
      partial.diagnostics?.gatewayVersion || PAIRING_CANDIDATE_GATEWAY_VERSION,
    warnings: Array.isArray(partial.diagnostics?.warnings)
      ? [...partial.diagnostics.warnings]
      : [],
  };

  if (partial.diagnostics?.error) {
    diagnostics.error = { ...partial.diagnostics.error };
  }

  return {
    status,
    candidates,
    excluded,
    summary,
    diagnostics,
  };
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPairingCandidateResponse(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    typeof value.status === "string" &&
    Array.isArray(value.candidates) &&
    Array.isArray(value.excluded) &&
    value.summary &&
    typeof value.summary === "object" &&
    value.diagnostics &&
    typeof value.diagnostics === "object"
  );
}
