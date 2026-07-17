import { hashUtf8Sha256Sync } from "./teamTournamentCanonicalDigest.js";

/**
 * Legacy canonical serialization (TT-1B idempotency + shadow compare).
 * Behavior frozen — do not change without migration plan.
 * Object keys sorted recursively; array order preserved.
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
  return hashUtf8Sha256Sync(stableStringifyTeamTournamentValue(value));
}
