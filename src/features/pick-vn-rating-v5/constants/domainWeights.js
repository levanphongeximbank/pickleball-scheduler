/**
 * V5 doubles domain weights — versioned config, not UI hard-code.
 * calibration_version gates parameter changes after pilot.
 */
import { CALIBRATION_VERSION } from "./versions.js";

export const DOMAIN_WEIGHTS_VERSION = CALIBRATION_VERSION;

export const DOUBLES_DOMAIN_WEIGHTS = Object.freeze({
  serve: 0.06,
  return: 0.07,
  groundstroke: 0.09,
  dink_soft_game: 0.12,
  third_shot: 0.065,
  transition: 0.065,
  volley: 0.04,
  block_reset: 0.08,
  footwork: 0.08,
  doubles_positioning: 0.05,
  communication: 0.05,
  tactical_decision: 0.10,
  consistency: 0.045,
  pressure_execution: 0.045,
  rules: 0.04,
});

export const SINGLES_DOMAIN_WEIGHTS = Object.freeze({
  serve: 0.08,
  return: 0.08,
  groundstroke: 0.10,
  court_coverage: 0.12,
  passing_shot: 0.10,
  serve_plus_one: 0.08,
  return_plus_one: 0.08,
  endurance: 0.06,
  full_court_defense: 0.10,
  tactical_decision: 0.10,
  consistency: 0.05,
  pressure_execution: 0.05,
  rules: 0.04,
});

export function getDomainWeights(ratingMode) {
  return ratingMode === "singles" ? SINGLES_DOMAIN_WEIGHTS : DOUBLES_DOMAIN_WEIGHTS;
}
