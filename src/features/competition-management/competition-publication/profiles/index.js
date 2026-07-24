/**
 * CM-06 publication profile registry.
 */

import { CM06_STANDARD_V1_PROFILE } from "./standardV1.js";
import { deepFreeze } from "../contracts/shared.js";

const PROFILE_REGISTRY = deepFreeze({
  [CM06_STANDARD_V1_PROFILE.id]: CM06_STANDARD_V1_PROFILE,
});

/**
 * @param {unknown} profileId
 * @returns {Readonly<object> | null}
 */
export function getCompetitionPublicationProfile(profileId) {
  if (typeof profileId !== "string") return null;
  return PROFILE_REGISTRY[profileId] ?? null;
}

/**
 * @param {unknown} profileId
 * @returns {boolean}
 */
export function isKnownCompetitionPublicationProfileId(profileId) {
  return getCompetitionPublicationProfile(profileId) != null;
}

/**
 * @returns {ReadonlyArray<Readonly<object>>}
 */
export function listCompetitionPublicationProfiles() {
  return deepFreeze(Object.values(PROFILE_REGISTRY));
}

export { CM06_STANDARD_V1_PROFILE };
