/**
 * Generic shadow payload normalizer (Phase 3A.2).
 * Policy-driven only — no Participant/Registration/Team/Draw/Match rules.
 */

import { cloneJsonSafe, isPlainObject } from "../../contracts/jsonSafe.js";
import {
  createShadowNormalizationPolicy,
  createShadowNormalizationResult,
} from "../contracts/shadowNormalization.js";

/**
 * @param {unknown} value
 * @param {import('../contracts/shadowNormalization.js').ShadowNormalizationPolicy} policy
 * @param {string} path
 * @param {string[]} applied
 * @returns {unknown}
 */
function normalizeValue(value, policy, path, applied) {
  if (policy.ignorePaths.includes(path)) {
    applied.push(`ignore:${path}`);
    return undefined;
  }

  if (Array.isArray(value)) {
    const next = value.map((item, index) =>
      normalizeValue(item, policy, `${path}[${index}]`, applied)
    );
    if (policy.orderInsensitivePaths.includes(path) || policy.sortArrayItems) {
      applied.push(`sort:${path || "$"}`);
      return [...next].sort((a, b) => {
        const sa = JSON.stringify(a);
        const sb = JSON.stringify(b);
        if (sa < sb) return -1;
        if (sa > sb) return 1;
        return 0;
      });
    }
    return next;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  /** @type {Record<string, unknown>} */
  const out = {};
  const keys = Object.keys(value).sort();
  for (const key of keys) {
    if (policy.stripKeys.includes(key)) {
      applied.push(`strip:${path ? `${path}.${key}` : key}`);
      continue;
    }
    const childPath = path ? `${path}.${key}` : key;
    if (policy.ignorePaths.includes(childPath)) {
      applied.push(`ignore:${childPath}`);
      continue;
    }
    const child = normalizeValue(value[key], policy, childPath, applied);
    if (child !== undefined) {
      out[key] = child;
    }
  }
  return out;
}

/**
 * @param {object} [input]
 * @param {unknown} [input.legacy]
 * @param {unknown} [input.canonical]
 * @param {object} [input.policy]
 * @returns {import('../contracts/shadowNormalization.js').ShadowNormalizationResult}
 */
export function normalizeShadowPayload(input = {}) {
  const policy = createShadowNormalizationPolicy(
    isPlainObject(input.policy) ? input.policy : {}
  );
  /** @type {string[]} */
  const appliedRules = [];

  const legacyNormalized = normalizeValue(
    input.legacy === undefined ? null : cloneJsonSafe(input.legacy),
    policy,
    "",
    appliedRules
  );
  const canonicalNormalized = normalizeValue(
    input.canonical === undefined ? null : cloneJsonSafe(input.canonical),
    policy,
    "",
    appliedRules
  );

  return createShadowNormalizationResult({
    legacyNormalized,
    canonicalNormalized,
    appliedRules: [...new Set(appliedRules)],
    metadata: { policy },
  });
}
