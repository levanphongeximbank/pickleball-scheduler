/**
 * CORE-14 Phase 1D — availability policy helpers.
 * Mode-dependent severity and certification rules (no production adapter).
 */

import { RESOURCE_KIND } from "../enums/resourceKind.js";
import { RESOURCE_FINDING_CODE } from "../enums/findingCode.js";
import {
  AVAILABILITY_MODE,
  AVAILABILITY_CERTIFICATION,
  isAvailabilityMode,
} from "../enums/availabilityCertification.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { SEVERITY } from "../enums/severity.js";

export const AVAILABILITY_POLICY_VERSION = "core14-availability-policy-v1";

export const AVAILABILITY_STATUS = Object.freeze({
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
  UNKNOWN: "UNKNOWN",
});

export const AVAILABILITY_STATUS_VALUES = Object.freeze([
  AVAILABILITY_STATUS.AVAILABLE,
  AVAILABILITY_STATUS.UNAVAILABLE,
  AVAILABILITY_STATUS.UNKNOWN,
]);

const AVAILABILITY_STATUS_SET = new Set(AVAILABILITY_STATUS_VALUES);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isAvailabilityStatus(value) {
  return typeof value === "string" && AVAILABILITY_STATUS_SET.has(value);
}

/**
 * @param {string} resourceKind
 * @returns {string}
 */
export function resolveUnavailableFindingCode(resourceKind) {
  if (resourceKind === RESOURCE_KIND.VENUE) {
    return RESOURCE_FINDING_CODE.VENUE_UNAVAILABLE;
  }
  return RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE;
}

/**
 * Canonical minimum severity for unavailable findings under the frozen mode.
 * @param {string} availabilityMode
 * @returns {string}
 */
export function resolveUnavailableSeverity(availabilityMode) {
  return availabilityMode === AVAILABILITY_MODE.ADVISORY ? SEVERITY.SOFT : SEVERITY.HARD;
}

/**
 * @param {unknown} mode
 * @returns {{ ok: true, value: string } | { ok: false, diagnostics: object[] }}
 */
export function normalizeAvailabilityMode(mode) {
  if (mode == null) {
    return { ok: true, value: AVAILABILITY_MODE.AUTHORITATIVE };
  }
  if (!isAvailabilityMode(mode)) {
    return {
      ok: false,
      diagnostics: [
        Object.freeze({
          code: INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
          message: "availabilityMode must be AUTHORITATIVE or ADVISORY",
          path: null,
          resourceKey: null,
          occupancyId: null,
          assignmentId: null,
          details: Object.freeze({ availabilityMode: mode ?? null }),
        }),
      ],
    };
  }
  return { ok: true, value: /** @type {string} */ (mode) };
}

/**
 * Derive availability certification from evaluation outcomes.
 *
 * @param {{
 *   availabilityCheckEnabled: boolean,
 *   availabilityMode: string,
 *   authoritativeFailure: boolean,
 *   queriedCount: number,
 *   definitiveCount: number,
 *   unknownOrProviderFailureCount: number,
 * }} input
 * @returns {string}
 */
export function deriveAvailabilityCertification(input) {
  if (!input.availabilityCheckEnabled) {
    return AVAILABILITY_CERTIFICATION.NOT_EVALUATED;
  }
  if (input.authoritativeFailure) {
    return AVAILABILITY_CERTIFICATION.NOT_EVALUATED;
  }
  if (input.unknownOrProviderFailureCount > 0) {
    // Advisory incomplete path (authoritative failure already handled above).
    return AVAILABILITY_CERTIFICATION.PARTIAL;
  }
  if (input.queriedCount > 0 && input.definitiveCount === input.queriedCount) {
    return AVAILABILITY_CERTIFICATION.FULL;
  }
  if (input.queriedCount === 0) {
    return AVAILABILITY_CERTIFICATION.FULL;
  }
  return AVAILABILITY_CERTIFICATION.PARTIAL;
}
