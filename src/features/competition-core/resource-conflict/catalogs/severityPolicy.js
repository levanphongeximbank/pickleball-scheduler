/**
 * CORE-14 — severity policy foundation (minimum severity + raise-only overrides).
 * Does not fetch availability.
 */

import { RESOURCE_FINDING_CODE } from "../enums/findingCode.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { DOMAIN_CONTRACT_ERROR_CODE } from "../enums/domainContractErrorCode.js";
import { SEVERITY, isSeverity, maxSeverity, SEVERITY_RANK } from "../enums/severity.js";
import { AVAILABILITY_MODE } from "../enums/availabilityCertification.js";
import { compareUtf8Bytewise } from "../deterministic/compare.js";
import { ResourceConflictContractError } from "../errors/ResourceConflictContractError.js";

/** Always-HARD minimum set (mode-independent). */
const ALWAYS_HARD = Object.freeze([
  RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP,
  RESOURCE_FINDING_CODE.TEAM_TIME_OVERLAP,
  RESOURCE_FINDING_CODE.COURT_TIME_OVERLAP,
  RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP,
  RESOURCE_FINDING_CODE.RESOURCE_CAPACITY_EXCEEDED,
  RESOURCE_FINDING_CODE.MANDATORY_REST_VIOLATION,
  RESOURCE_FINDING_CODE.VENUE_CAPACITY_EXCEEDED,
  RESOURCE_FINDING_CODE.LOCATION_TIME_OVERLAP,
]);

const ALWAYS_HARD_SET = new Set(ALWAYS_HARD);

/**
 * Frozen minimum-severity lookup.
 * @param {string} findingCode
 * @param {{ availabilityMode?: string }} [options]
 * @returns {string | null} SEVERITY or null if unknown finding code
 */
export function getMinimumSeverity(findingCode, options = {}) {
  if (ALWAYS_HARD_SET.has(findingCode)) {
    return SEVERITY.HARD;
  }
  if (findingCode === RESOURCE_FINDING_CODE.PREFERRED_REST_WARNING) {
    return SEVERITY.SOFT;
  }
  if (
    findingCode === RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE ||
    findingCode === RESOURCE_FINDING_CODE.VENUE_UNAVAILABLE
  ) {
    // Mode-dependent canonical minimum (not a caller downgrade).
    // AUTHORITATIVE → HARD; ADVISORY → SOFT.
    const mode = options.availabilityMode || AVAILABILITY_MODE.AUTHORITATIVE;
    if (mode === AVAILABILITY_MODE.ADVISORY) {
      return SEVERITY.SOFT;
    }
    return SEVERITY.HARD;
  }
  return null;
}

/**
 * Raise-only severity override evaluation.
 * SOFT may raise to HARD; HARD may not be lowered.
 *
 * @param {{
 *   findingCode: string,
 *   requestedSeverity: unknown,
 *   availabilityMode?: string,
 *   path?: string | null,
 * }} input
 * @returns {Readonly<{
 *   effectiveSeverity: string,
 *   minimumSeverity: string,
 *   downgradeRejected: boolean,
 *   raised: boolean,
 *   diagnostic: object | null,
 * }>}
 */
export function evaluateSeverityOverride(input) {
  const minimumSeverity = getMinimumSeverity(input.findingCode, {
    availabilityMode: input.availabilityMode,
  });
  if (!minimumSeverity) {
    throw new ResourceConflictContractError(
      DOMAIN_CONTRACT_ERROR_CODE.UNKNOWN_FINDING_CODE_FOR_SEVERITY,
      "Unknown finding code for severity policy",
      { findingCode: input.findingCode ?? null }
    );
  }

  if (!isSeverity(input.requestedSeverity)) {
    return Object.freeze({
      effectiveSeverity: minimumSeverity,
      minimumSeverity,
      downgradeRejected: false,
      raised: false,
      diagnostic: null,
    });
  }

  const requested = /** @type {string} */ (input.requestedSeverity);
  const requestedRank = SEVERITY_RANK[requested];
  const minimumRank = SEVERITY_RANK[minimumSeverity];

  if (requestedRank < minimumRank) {
    return Object.freeze({
      effectiveSeverity: minimumSeverity,
      minimumSeverity,
      downgradeRejected: true,
      raised: false,
      diagnostic: Object.freeze({
        code: INPUT_DIAGNOSTIC_CODE.SEVERITY_DOWNGRADE_REJECTED,
        message: "Caller severity below canonical minimum was rejected",
        path: input.path ?? null,
        resourceKey: null,
        occupancyId: null,
        assignmentId: null,
        details: Object.freeze({
          findingCode: input.findingCode,
          requestedSeverity: requested,
          retainedSeverity: minimumSeverity,
        }),
      }),
    });
  }

  const effectiveSeverity = maxSeverity(minimumSeverity, requested);
  return Object.freeze({
    effectiveSeverity,
    minimumSeverity,
    downgradeRejected: false,
    raised: effectiveSeverity !== minimumSeverity,
    diagnostic: null,
  });
}

/**
 * Deterministic diagnostic ordering by code then path then message.
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function compareDiagnostics(a, b) {
  const c1 = compareUtf8Bytewise(a?.code, b?.code);
  if (c1 !== 0) return c1;
  const c2 = compareUtf8Bytewise(a?.path ?? "", b?.path ?? "");
  if (c2 !== 0) return c2;
  const c3 = compareUtf8Bytewise(a?.occupancyId ?? "", b?.occupancyId ?? "");
  if (c3 !== 0) return c3;
  return compareUtf8Bytewise(a?.message ?? "", b?.message ?? "");
}

/**
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function compareFindings(a, b) {
  const c1 = compareUtf8Bytewise(a?.findingId ?? "", b?.findingId ?? "");
  if (c1 !== 0) return c1;
  const c2 = compareUtf8Bytewise(a?.code ?? "", b?.code ?? "");
  if (c2 !== 0) return c2;
  return compareUtf8Bytewise(a?.severity ?? "", b?.severity ?? "");
}

export const HARD_MINIMUM_FINDING_CODES = ALWAYS_HARD;
