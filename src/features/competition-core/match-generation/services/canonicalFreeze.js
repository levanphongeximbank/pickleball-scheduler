/**
 * CORE-09 — capability-local canonical JSON copy + deep freeze.
 * No external utility dependency. Fail closed on unsupported values / cycles.
 */

import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { MatchGenerationContractError } from "../errors/contractError.js";

/**
 * Deep-copy JSON-compatible values and recursively freeze.
 * Rejects: functions, symbols, bigint, non-finite numbers, cyclic refs.
 *
 * @param {unknown} value
 * @param {string} [path]
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
export function deepFreezeCanonical(value, path = "", seen = new WeakSet()) {
  if (value === null) {
    return null;
  }

  const t = typeof value;
  if (t === "string" || t === "boolean") {
    return value;
  }
  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new MatchGenerationContractError(
        MATCH_GENERATION_ISSUE_CODE.NON_CANONICAL_VALUE,
        `Non-finite number at ${path || "(root)"}`,
        { path, value: String(value) }
      );
    }
    return value;
  }
  if (t === "undefined") {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.NON_CANONICAL_VALUE,
      `undefined is not allowed in canonical data at ${path || "(root)"}`,
      { path }
    );
  }
  if (t === "function" || t === "symbol" || t === "bigint") {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.NON_CANONICAL_VALUE,
      `Unsupported value type ${t} at ${path || "(root)"}`,
      { path, type: t }
    );
  }

  if (t !== "object") {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.NON_CANONICAL_VALUE,
      `Unsupported value at ${path || "(root)"}`,
      { path, type: t }
    );
  }

  if (seen.has(/** @type {object} */ (value))) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.NON_CANONICAL_VALUE,
      `Cyclic reference at ${path || "(root)"}`,
      { path }
    );
  }
  seen.add(/** @type {object} */ (value));

  if (Array.isArray(value)) {
    const out = value.map((item, i) =>
      deepFreezeCanonical(item, path ? `${path}[${i}]` : `[${i}]`, seen)
    );
    return Object.freeze(out);
  }

  /** @type {Record<string, unknown>} */
  const out = {};
  const keys = Object.keys(/** @type {Record<string, unknown>} */ (value)).sort();
  for (const key of keys) {
    out[key] = deepFreezeCanonical(
      /** @type {Record<string, unknown>} */ (value)[key],
      path ? `${path}.${key}` : key,
      seen
    );
  }
  return Object.freeze(out);
}

/**
 * @param {unknown} value
 * @param {string} [path]
 * @returns {Readonly<Record<string, unknown>>}
 */
export function freezeMetadata(value, path = "metadata") {
  if (value == null) {
    return Object.freeze({});
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.NON_CANONICAL_VALUE,
      `${path} must be a plain object`,
      { path }
    );
  }
  return /** @type {Readonly<Record<string, unknown>>} */ (
    deepFreezeCanonical(value, path)
  );
}
