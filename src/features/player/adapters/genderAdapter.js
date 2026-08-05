/**
 * Phase 1B gender adapter — canonical stored contract: male | female | other | null.
 * Presentation labels stay Vietnamese via athleteGenderDisplayLabel.
 */
import {
  athleteGenderDisplayLabel,
  getPlayerGenderKey,
  normalizeAthleteGender,
} from "../../../models/player.js";

export const CANONICAL_GENDER = Object.freeze({
  MALE: "male",
  FEMALE: "female",
  OTHER: "other",
});

/**
 * @param {unknown} value
 * @returns {"male"|"female"|"other"|null}
 */
export function normalizePlayerGender(value) {
  return getPlayerGenderKey(value);
}

/**
 * Engine-facing key (male|female|unknown).
 * @param {unknown} value
 */
export function normalizeEngineGender(value) {
  return normalizeAthleteGender(value);
}

export function playerGenderDisplayLabel(value) {
  return athleteGenderDisplayLabel(value);
}
