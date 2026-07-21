/**
 * CORE-06 Phase 1D — deterministic fingerprints (input / seed / selection).
 * Same canonical input → same fingerprint. No clock. No secrets.
 */

import { hashStringToUint32 } from "./algorithm.js";

/**
 * Deterministic JSON-like canonicalize: sort object keys; preserve array order
 * after caller has already applied semantic sorting where required.
 * @param {unknown} value
 * @returns {unknown}
 */
export function canonicalizeJsonValue(value) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      return null;
    }
    if (typeof value === "bigint") {
      return String(value);
    }
    if (typeof value === "undefined") {
      return null;
    }
    if (typeof value === "function" || typeof value === "symbol") {
      return null;
    }
    return value ?? null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item));
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(
    /** @type {Record<string, unknown>} */ (value)
  ).sort()) {
    out[key] = canonicalizeJsonValue(
      /** @type {Record<string, unknown>} */ (value)[key]
    );
  }
  return out;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function serializeCanonical(value) {
  return JSON.stringify(canonicalizeJsonValue(value));
}

/**
 * Hex fingerprint from FNV-1a 32-bit (not a cryptographic claim).
 * @param {unknown} value
 * @returns {string}
 */
export function fingerprintValue(value) {
  const material = serializeCanonical(value);
  return hashStringToUint32(material).toString(16).padStart(8, "0");
}

/**
 * @param {string} normalizedSeed
 * @returns {string}
 */
export function fingerprintSeed(normalizedSeed) {
  return fingerprintValue({ kind: "LINEUP_SEED_V1", seed: String(normalizedSeed) });
}

/**
 * Identity-only input fingerprint — no personal profile fields.
 * @param {object} input
 * @returns {string}
 */
export function fingerprintInput(input) {
  return fingerprintValue({
    kind: "LINEUP_RANDOM_INPUT_V1",
    ...input,
  });
}

/**
 * @param {Array<{ disciplineOrSideKey: string, index: number, identityToken: string }>} selectedSlots
 * @returns {string}
 */
export function fingerprintSelection(selectedSlots) {
  const slots = (Array.isArray(selectedSlots) ? selectedSlots : [])
    .map((s) => ({
      disciplineOrSideKey: String(s.disciplineOrSideKey || ""),
      index: Number(s.index),
      identityToken: String(s.identityToken || ""),
    }))
    .sort((a, b) => {
      if (a.disciplineOrSideKey !== b.disciplineOrSideKey) {
        return a.disciplineOrSideKey < b.disciplineOrSideKey
          ? -1
          : a.disciplineOrSideKey > b.disciplineOrSideKey
            ? 1
            : 0;
      }
      if (a.index !== b.index) return a.index - b.index;
      return a.identityToken < b.identityToken
        ? -1
        : a.identityToken > b.identityToken
          ? 1
          : 0;
    });
  return fingerprintValue({
    kind: "LINEUP_SELECTION_V1",
    slots,
  });
}
