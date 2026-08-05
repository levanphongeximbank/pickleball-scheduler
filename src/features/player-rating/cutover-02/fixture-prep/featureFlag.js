/**
 * A3c fixture-prep feature flag — default OFF; Production deny forces OFF.
 */

import {
  isProductionDenyActive,
  isStagingRehearsalEnvironmentAllowed,
} from "../config/environmentGuards.js";

export const FIXTURE_PREP_ENV_NAME = "VITE_RATING_V5_CUTOVER_02_FIXTURE_PREP_ENABLED";

function parseBool(value, defaultValue = false) {
  if (value == null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

/**
 * @param {Record<string, unknown>|null|undefined} env
 * @param {{ explicitEnabled?: boolean }} [opts]
 */
export function isFixturePrepPathEnabled(env = {}, opts = {}) {
  if (opts.explicitEnabled === false) return false;
  if (opts.explicitEnabled === true) {
    // Still honor Production deny even when explicitly enabled by caller options
    if (isProductionDenyActive(env)) return false;
    return true;
  }

  const bag = env && typeof env === "object" ? env : {};
  if (isProductionDenyActive(bag)) return false;
  if (!isStagingRehearsalEnvironmentAllowed(bag)) return false;
  return parseBool(bag[FIXTURE_PREP_ENV_NAME], false);
}
