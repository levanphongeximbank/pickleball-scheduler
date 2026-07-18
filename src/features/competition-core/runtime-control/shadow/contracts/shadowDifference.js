/**
 * Structured difference model (Phase 3A.2).
 * Avoid embedding raw sensitive payloads unless explicitly provided.
 */

import { cloneJsonSafe } from "../../contracts/jsonSafe.js";
import {
  SHADOW_DIFFERENCE_KIND,
  SHADOW_DIFFERENCE_KIND_VALUES,
  SHADOW_DIFFERENCE_SEVERITY,
  SHADOW_DIFFERENCE_SEVERITY_VALUES,
} from "../constants/shadowDifferenceKinds.js";

/**
 * @typedef {Object} ShadowDifference
 * @property {string} path
 * @property {string} kind
 * @property {unknown} legacyValue
 * @property {unknown} canonicalValue
 * @property {string} severity
 * @property {string} message
 */

/**
 * @param {Partial<ShadowDifference>|null|undefined} partial
 * @returns {ShadowDifference}
 */
export function createShadowDifference(partial = {}) {
  const kind = SHADOW_DIFFERENCE_KIND_VALUES.includes(partial?.kind)
    ? partial.kind
    : SHADOW_DIFFERENCE_KIND.VALUE_MISMATCH;
  const severity = SHADOW_DIFFERENCE_SEVERITY_VALUES.includes(partial?.severity)
    ? partial.severity
    : SHADOW_DIFFERENCE_SEVERITY.MEDIUM;

  return {
    path: typeof partial?.path === "string" ? partial.path : "",
    kind,
    legacyValue:
      partial?.legacyValue === undefined
        ? undefined
        : cloneJsonSafe(partial.legacyValue),
    canonicalValue:
      partial?.canonicalValue === undefined
        ? undefined
        : cloneJsonSafe(partial.canonicalValue),
    severity,
    message: typeof partial?.message === "string" ? partial.message : "",
  };
}
