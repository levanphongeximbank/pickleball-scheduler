/**
 * CORE-14 Phase 1D — overlap detector policy helpers.
 * Specialized overlap owns exclusive capacity-one conflict reporting for
 * PLAYER / TEAM / COURT / REFEREE and exclusive LOCATION.
 */

import { RESOURCE_KIND } from "../enums/resourceKind.js";
import { RESOURCE_FINDING_CODE } from "../enums/findingCode.js";

export const OVERLAP_POLICY_VERSION = "core14-overlap-policy-v1";

/** Resource kinds whose exclusive conflicts are reported via specialized time-overlap codes. */
export const SPECIALIZED_OVERLAP_KINDS = Object.freeze([
  RESOURCE_KIND.PLAYER,
  RESOURCE_KIND.TEAM,
  RESOURCE_KIND.COURT,
  RESOURCE_KIND.REFEREE,
]);

const SPECIALIZED_OVERLAP_KIND_SET = new Set(SPECIALIZED_OVERLAP_KINDS);

/**
 * @param {string} resourceKind
 * @returns {boolean}
 */
export function isSpecializedOverlapKind(resourceKind) {
  return SPECIALIZED_OVERLAP_KIND_SET.has(resourceKind);
}

/**
 * @param {string} resourceKind
 * @param {{ exclusive?: boolean }} [locationFlags]
 * @returns {string | null} finding code or null when overlap findings are not emitted for this kind
 */
export function resolveOverlapFindingCode(resourceKind, locationFlags = {}) {
  switch (resourceKind) {
    case RESOURCE_KIND.PLAYER:
      return RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP;
    case RESOURCE_KIND.TEAM:
      return RESOURCE_FINDING_CODE.TEAM_TIME_OVERLAP;
    case RESOURCE_KIND.COURT:
      return RESOURCE_FINDING_CODE.COURT_TIME_OVERLAP;
    case RESOURCE_KIND.REFEREE:
      return RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP;
    case RESOURCE_KIND.LOCATION:
      return locationFlags.exclusive === true
        ? RESOURCE_FINDING_CODE.LOCATION_TIME_OVERLAP
        : null;
    case RESOURCE_KIND.VENUE:
    case RESOURCE_KIND.EQUIPMENT:
    case RESOURCE_KIND.CUSTOM_RESOURCE:
      return null;
    default:
      return null;
  }
}
