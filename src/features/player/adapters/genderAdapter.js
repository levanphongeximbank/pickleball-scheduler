/**
 * Phase 1B gender adapter — canonical output only: male | female | unknown.
 * Wraps existing normalizeAthleteGender; accepts legacy Nam/Nữ/M/F/other.
 */
import { normalizeAthleteGender } from "../../../models/player.js";

export const CANONICAL_GENDER = Object.freeze({
  MALE: "male",
  FEMALE: "female",
  UNKNOWN: "unknown",
});

/**
 * @param {unknown} value
 * @returns {"male"|"female"|"unknown"}
 */
export function normalizePlayerGender(value) {
  const key = normalizeAthleteGender(value);
  if (key === CANONICAL_GENDER.MALE || key === CANONICAL_GENDER.FEMALE) {
    return key;
  }
  return CANONICAL_GENDER.UNKNOWN;
}
