/**
 * Shadow report summary contract (Phase 3A.2).
 */

import { cloneJsonSafe, isPlainObject } from "../../contracts/jsonSafe.js";
import { SHADOW_DIFFERENCE_SEVERITY } from "../constants/shadowDifferenceKinds.js";

/**
 * @typedef {Object} ShadowReportSummary
 * @property {boolean} equivalent
 * @property {boolean} diverged
 * @property {boolean} skipped
 * @property {boolean} errored
 * @property {boolean} notComparable
 * @property {number} differenceCount
 * @property {string|null} highestSeverity
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {Partial<ShadowReportSummary>|null|undefined} partial
 * @returns {ShadowReportSummary}
 */
export function createShadowReportSummary(partial = {}) {
  return {
    equivalent: Boolean(partial?.equivalent),
    diverged: Boolean(partial?.diverged),
    skipped: Boolean(partial?.skipped),
    errored: Boolean(partial?.errored),
    notComparable: Boolean(partial?.notComparable),
    differenceCount:
      typeof partial?.differenceCount === "number" &&
      Number.isFinite(partial.differenceCount)
        ? partial.differenceCount
        : 0,
    highestSeverity:
      typeof partial?.highestSeverity === "string"
        ? partial.highestSeverity
        : null,
    metadata: isPlainObject(partial?.metadata)
      ? cloneJsonSafe(partial.metadata)
      : {},
  };
}

export { SHADOW_DIFFERENCE_SEVERITY };
