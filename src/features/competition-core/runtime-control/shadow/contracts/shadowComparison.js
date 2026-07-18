/**
 * Shadow comparison result contract (Phase 3A.2).
 */

import { cloneJsonSafe, isPlainObject } from "../../contracts/jsonSafe.js";
import {
  SHADOW_COMPARISON_STATUS,
  SHADOW_COMPARISON_STATUS_VALUES,
} from "../constants/shadowComparisonStatuses.js";
import { SHADOW_COMPARATOR_VERSION } from "../constants/shadowExecutors.js";
import { SHADOW_REASON_CODE } from "../constants/shadowReasonCodes.js";
import { createShadowDifference } from "./shadowDifference.js";

/**
 * @typedef {Object} ShadowComparisonResult
 * @property {string} status
 * @property {string} reasonCode
 * @property {import('./shadowDifference.js').ShadowDifference[]} differences
 * @property {import('./shadowDifference.js').ShadowDifference[]} ignoredDifferences
 * @property {string|null} legacyFingerprint
 * @property {string|null} canonicalFingerprint
 * @property {string} comparatorVersion
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {Partial<ShadowComparisonResult>|null|undefined} partial
 * @returns {ShadowComparisonResult}
 */
export function createShadowComparisonResult(partial = {}) {
  const status = SHADOW_COMPARISON_STATUS_VALUES.includes(partial?.status)
    ? partial.status
    : SHADOW_COMPARISON_STATUS.SKIPPED;

  const differences = Array.isArray(partial?.differences)
    ? partial.differences.map((d) => createShadowDifference(d))
    : [];
  const ignoredDifferences = Array.isArray(partial?.ignoredDifferences)
    ? partial.ignoredDifferences.map((d) => createShadowDifference(d))
    : [];

  return {
    status,
    reasonCode:
      typeof partial?.reasonCode === "string" && partial.reasonCode
        ? partial.reasonCode
        : SHADOW_REASON_CODE.COMPARISON_SKIPPED,
    differences,
    ignoredDifferences,
    legacyFingerprint:
      typeof partial?.legacyFingerprint === "string"
        ? partial.legacyFingerprint
        : null,
    canonicalFingerprint:
      typeof partial?.canonicalFingerprint === "string"
        ? partial.canonicalFingerprint
        : null,
    comparatorVersion:
      typeof partial?.comparatorVersion === "string" && partial.comparatorVersion
        ? partial.comparatorVersion
        : SHADOW_COMPARATOR_VERSION,
    metadata: isPlainObject(partial?.metadata)
      ? cloneJsonSafe(partial.metadata)
      : {},
  };
}
