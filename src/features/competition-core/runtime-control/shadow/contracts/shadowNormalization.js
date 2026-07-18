/**
 * Normalization boundary contract (Phase 3A.2).
 * Generic ignore / strip rules only — no domain hard-coding.
 */

import { cloneJsonSafe, isPlainObject } from "../../contracts/jsonSafe.js";

/**
 * @typedef {Object} ShadowNormalizationPolicy
 * @property {string[]} ignorePaths
 * @property {string[]} stripKeys
 * @property {boolean} sortArrayItems
 * @property {string[]} orderInsensitivePaths
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {Partial<ShadowNormalizationPolicy>|null|undefined} partial
 * @returns {ShadowNormalizationPolicy}
 */
export function createShadowNormalizationPolicy(partial = {}) {
  const asStringList = (value) =>
    Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];

  return {
    ignorePaths: asStringList(partial?.ignorePaths),
    stripKeys: asStringList(partial?.stripKeys),
    sortArrayItems: Boolean(partial?.sortArrayItems),
    orderInsensitivePaths: asStringList(partial?.orderInsensitivePaths),
    metadata: isPlainObject(partial?.metadata)
      ? cloneJsonSafe(partial.metadata)
      : {},
  };
}

/**
 * @typedef {Object} ShadowNormalizationResult
 * @property {unknown} legacyNormalized
 * @property {unknown} canonicalNormalized
 * @property {string[]} appliedRules
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {Partial<ShadowNormalizationResult>|null|undefined} partial
 * @returns {ShadowNormalizationResult}
 */
export function createShadowNormalizationResult(partial = {}) {
  return {
    legacyNormalized:
      partial?.legacyNormalized === undefined
        ? null
        : cloneJsonSafe(partial.legacyNormalized),
    canonicalNormalized:
      partial?.canonicalNormalized === undefined
        ? null
        : cloneJsonSafe(partial.canonicalNormalized),
    appliedRules: Array.isArray(partial?.appliedRules)
      ? partial.appliedRules.filter((r) => typeof r === "string")
      : [],
    metadata: isPlainObject(partial?.metadata)
      ? cloneJsonSafe(partial.metadata)
      : {},
  };
}
