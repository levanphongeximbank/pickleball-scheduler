import { createHash } from "node:crypto";

/**
 * Shared canonical serialization for team tournament idempotency + shadow compare.
 * Object keys are sorted recursively; array element order is preserved.
 * Undefined object properties are omitted (missing); explicit null is retained.
 */

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function canonicalizeTeamTournamentValue(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      const canonical = canonicalizeTeamTournamentValue(item);
      return canonical === undefined ? null : canonical;
    });
  }

  return Object.keys(value)
    .sort()
    .reduce((accumulator, key) => {
      const canonical = canonicalizeTeamTournamentValue(value[key]);
      if (canonical === undefined) {
        return accumulator;
      }
      accumulator[key] = canonical;
      return accumulator;
    }, {});
}

/** @deprecated Use canonicalizeTeamTournamentValue */
export const canonicalizeTeamTournamentPayload = canonicalizeTeamTournamentValue;

/**
 * Canonical JSON string for stable hashing/comparison.
 * Top-level undefined is treated as null for hash stability of absent roots.
 * @param {unknown} value
 * @returns {string}
 */
export function stableStringifyTeamTournamentValue(value) {
  const canonical = canonicalizeTeamTournamentValue(value ?? null);
  return JSON.stringify(canonical);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function hashTeamTournamentCanonicalValue(value) {
  return createHash("sha256")
    .update(stableStringifyTeamTournamentValue(value))
    .digest("hex");
}
