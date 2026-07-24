/**
 * Deterministic helpers for E2E-06 Governance (no Date.now / Math.random).
 */

import { createHash } from "node:crypto";

/**
 * @param {unknown} value
 * @returns {string}
 */
export function stableStringify(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(/** @type {Record<string, unknown>} */ (value)).sort();
    return `{${keys
      .map(
        (k) =>
          `${JSON.stringify(k)}:${stableStringify(
            /** @type {Record<string, unknown>} */ (value)[k]
          )}`
      )
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

/**
 * @param {unknown} value
 * @param {string} [prefix]
 * @returns {string}
 */
export function computeGovernanceFingerprint(value, prefix = "e2e06") {
  const hash = createHash("sha256")
    .update(stableStringify(value), "utf8")
    .digest("hex");
  return `${prefix}:${hash.slice(0, 32)}`;
}

/**
 * @template T
 * @param {T} value
 * @returns {Readonly<T>}
 */
export function deepFreeze(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  for (const key of Reflect.ownKeys(value)) {
    const child = /** @type {Record<string|symbol, unknown>} */ (value)[key];
    if (child && typeof child === "object") {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function clonePlain(value) {
  return structuredClone(value);
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function snapshotInput(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(stableStringify(value));
  }
}

/**
 * Strip secrets / private keys from a plain object (shallow+nested).
 * @param {unknown} value
 * @param {readonly string[]} forbiddenKeys
 * @returns {unknown}
 */
export function stripForbiddenKeys(value, forbiddenKeys) {
  const banned = new Set(
    (forbiddenKeys || []).map((k) => String(k).toLowerCase())
  );
  /**
   * @param {unknown} node
   * @returns {unknown}
   */
  function walk(node) {
    if (node === null || node === undefined) return node;
    if (Array.isArray(node)) return node.map(walk);
    if (typeof node !== "object") return node;
    const out = {};
    for (const [k, v] of Object.entries(
      /** @type {Record<string, unknown>} */ (node)
    )) {
      if (banned.has(k.toLowerCase())) continue;
      out[k] = walk(v);
    }
    return out;
  }
  return walk(value);
}
