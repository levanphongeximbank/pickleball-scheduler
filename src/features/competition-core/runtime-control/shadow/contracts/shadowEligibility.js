/**
 * Shadow eligibility result contract (Phase 3A.2).
 */

import { cloneJsonSafe, isPlainObject } from "../../contracts/jsonSafe.js";
import { SHADOW_REASON_CODE } from "../constants/shadowReasonCodes.js";

/**
 * @typedef {Object} ShadowEligibility
 * @property {boolean} eligible
 * @property {string} reasonCode
 * @property {string[]} reasonCodes
 * @property {Array<{ check: string, passed: boolean, detail?: string }>} checks
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {Partial<ShadowEligibility>|null|undefined} partial
 * @returns {ShadowEligibility}
 */
export function createShadowEligibility(partial = {}) {
  const checks = Array.isArray(partial?.checks)
    ? partial.checks
        .filter((c) => isPlainObject(c))
        .map((c) => ({
          check: typeof c.check === "string" ? c.check : "",
          passed: Boolean(c.passed),
          detail: typeof c.detail === "string" ? c.detail : undefined,
        }))
    : [];

  const reasonCodes = Array.isArray(partial?.reasonCodes)
    ? partial.reasonCodes.filter((c) => typeof c === "string")
    : [];

  const reasonCode =
    typeof partial?.reasonCode === "string" && partial.reasonCode
      ? partial.reasonCode
      : SHADOW_REASON_CODE.SHADOW_DISABLED;

  return {
    eligible: Boolean(partial?.eligible),
    reasonCode,
    reasonCodes: reasonCodes.length > 0 ? reasonCodes : [reasonCode],
    checks,
    metadata: isPlainObject(partial?.metadata)
      ? cloneJsonSafe(partial.metadata)
      : {},
  };
}
