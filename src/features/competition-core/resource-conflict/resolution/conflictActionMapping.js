/**
 * CORE-14 Phase 1E — frozen finding-code → permitted action mapping.
 */

import { RESOURCE_FINDING_CODE } from "../enums/findingCode.js";
import { RESOURCE_KIND } from "../enums/resourceKind.js";
import { RESOLUTION_ACTION_TYPE } from "./actionTypes.js";

export const CONFLICT_ACTION_MAPPING_VERSION = "core14-conflict-action-mapping-v1";

/**
 * Base permitted actions per finding code (resource-kind filters applied separately).
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const CONFLICT_TO_ACTIONS = Object.freeze({
  [RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP]: Object.freeze([
    RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
    RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
  ]),
  [RESOURCE_FINDING_CODE.TEAM_TIME_OVERLAP]: Object.freeze([
    RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
    RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
  ]),
  [RESOURCE_FINDING_CODE.COURT_TIME_OVERLAP]: Object.freeze([
    RESOLUTION_ACTION_TYPE.REASSIGN_COURT,
    RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
    RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
  ]),
  [RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP]: Object.freeze([
    RESOLUTION_ACTION_TYPE.REASSIGN_REFEREE,
    RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
    RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
  ]),
  [RESOURCE_FINDING_CODE.MANDATORY_REST_VIOLATION]: Object.freeze([
    RESOLUTION_ACTION_TYPE.INSERT_REST_GAP,
    RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
    RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
  ]),
  [RESOURCE_FINDING_CODE.PREFERRED_REST_WARNING]: Object.freeze([
    RESOLUTION_ACTION_TYPE.INSERT_REST_GAP,
    RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
  ]),
  [RESOURCE_FINDING_CODE.RESOURCE_CAPACITY_EXCEEDED]: Object.freeze([
    RESOLUTION_ACTION_TYPE.REDUCE_CAPACITY_USAGE,
    RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
    RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
  ]),
  [RESOURCE_FINDING_CODE.VENUE_CAPACITY_EXCEEDED]: Object.freeze([
    RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    RESOLUTION_ACTION_TYPE.REDUCE_CAPACITY_USAGE,
    RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
    RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
  ]),
  [RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE]: Object.freeze([
    RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    RESOLUTION_ACTION_TYPE.REASSIGN_COURT,
    RESOLUTION_ACTION_TYPE.REASSIGN_REFEREE,
    RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
    RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
  ]),
  [RESOURCE_FINDING_CODE.VENUE_UNAVAILABLE]: Object.freeze([
    RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
    RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
  ]),
  [RESOURCE_FINDING_CODE.LOCATION_TIME_OVERLAP]: Object.freeze([
    RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
    RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
  ]),
});

/**
 * @param {string} findingCode
 * @returns {readonly string[]}
 */
export function getBasePermittedActions(findingCode) {
  const mapped = CONFLICT_TO_ACTIONS[findingCode];
  return mapped ? [...mapped] : [];
}

/**
 * Filter actions for resource-kind compatibility.
 * @param {string} findingCode
 * @param {string | null | undefined} resourceKind
 * @returns {string[]}
 */
export function getPermittedActionsForFinding(findingCode, resourceKind) {
  const base = getBasePermittedActions(findingCode);
  if (findingCode === RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE) {
    return base.filter((action) => {
      if (action === RESOLUTION_ACTION_TYPE.REASSIGN_COURT) {
        return resourceKind === RESOURCE_KIND.COURT;
      }
      if (action === RESOLUTION_ACTION_TYPE.REASSIGN_REFEREE) {
        return resourceKind === RESOURCE_KIND.REFEREE;
      }
      return true;
    });
  }
  if (actionIsCourtReassign(findingCode) && resourceKind && resourceKind !== RESOURCE_KIND.COURT) {
    return base.filter((a) => a !== RESOLUTION_ACTION_TYPE.REASSIGN_COURT);
  }
  if (
    findingCode === RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP &&
    resourceKind &&
    resourceKind !== RESOURCE_KIND.REFEREE
  ) {
    return base.filter((a) => a !== RESOLUTION_ACTION_TYPE.REASSIGN_REFEREE);
  }
  return base;
}

/**
 * @param {string} findingCode
 * @returns {boolean}
 */
function actionIsCourtReassign(findingCode) {
  return findingCode === RESOURCE_FINDING_CODE.COURT_TIME_OVERLAP;
}

/**
 * @param {string} findingCode
 * @param {string} actionType
 * @param {string | null | undefined} resourceKind
 * @returns {boolean}
 */
export function isActionPermittedForFinding(findingCode, actionType, resourceKind) {
  return getPermittedActionsForFinding(findingCode, resourceKind).includes(actionType);
}
