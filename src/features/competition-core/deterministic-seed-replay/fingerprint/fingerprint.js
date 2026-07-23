/**
 * CORE-21 — FNV-1a 32-bit + versioned fingerprint.
 * Identity hash only — not a cryptographic claim.
 */

import { CORE21_FINGERPRINT_VERSION } from "../constants.js";
import { canonicalizeJsonValue, serializeCanonical } from "../serialize/canonicalize.js";

/**
 * @param {string} input
 * @returns {number}
 */
export function hashStringToUint32(input) {
  let hash = 2166136261;
  const str = String(input ?? "");
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Hex fingerprint including algorithm version in material.
 * @param {unknown} value
 * @returns {string}
 */
export function fingerprintValue(value) {
  const material = {
    fingerprintAlgorithmVersion: CORE21_FINGERPRINT_VERSION,
    payload: canonicalizeJsonValue(value),
  };
  return hashStringToUint32(JSON.stringify(material))
    .toString(16)
    .padStart(8, "0");
}

/**
 * Fingerprint of an already-accepted value via owned canonical path.
 * @param {unknown} value
 * @returns {string}
 */
export function fingerprintAccepted(value) {
  // Force owned canonical representation.
  canonicalizeJsonValue(
    typeof value === "object" && value !== null
      ? JSON.parse(serializeCanonical(value))
      : value
  );
  return fingerprintValue(value);
}

export { CORE21_FINGERPRINT_VERSION };
