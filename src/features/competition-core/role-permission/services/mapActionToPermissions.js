import { COMPETITION_ACTION } from "../enums/competitionActions.js";
import { COMPETITION_PERMISSION } from "../enums/competitionPermissions.js";
import { CORE02_ACTION_PERMISSION_MAP_VERSION } from "../constants/versions.js";

/**
 * Action → required permission ids (any-of).
 * Values align with Identity permission strings.
 */
export const ACTION_PERMISSION_MAP = Object.freeze({
  [COMPETITION_ACTION.TEAM_ROSTER_UNLOCK]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_MANAGE,
  ]),
  [COMPETITION_ACTION.TEAM_WITHDRAW]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_WITHDRAW,
  ]),
  [COMPETITION_ACTION.TEAM_ACTIVATE]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_MANAGE,
  ]),
  [COMPETITION_ACTION.ROSTER_LOCK]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_MANAGE,
  ]),
  [COMPETITION_ACTION.LINEUP_DRAFT]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT,
    COMPETITION_PERMISSION.TEAM_LINEUP_UPDATE_BEFORE_LOCK,
  ]),
  [COMPETITION_ACTION.LINEUP_SUBMIT]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT,
    COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT_V5,
  ]),
  [COMPETITION_ACTION.LINEUP_LOCK]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_LINEUP_LOCK,
    COMPETITION_PERMISSION.TEAM_LINEUP_LOCK_V5,
  ]),
  [COMPETITION_ACTION.LINEUP_PUBLISH]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_LINEUP_PUBLISH,
  ]),
  [COMPETITION_ACTION.LINEUP_OVERRIDE]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_LINEUP_OVERRIDE,
  ]),
  [COMPETITION_ACTION.LINEUP_VOID]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT,
    COMPETITION_PERMISSION.TEAM_LINEUP_UPDATE_BEFORE_LOCK,
  ]),
  [COMPETITION_ACTION.LINEUP_VIEW_OWN]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_VIEW,
    COMPETITION_PERMISSION.TEAM_LINEUP_VIEW_V5,
  ]),
  [COMPETITION_ACTION.LINEUP_VIEW_OPPONENT]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_LINEUP_VIEW_V5,
    COMPETITION_PERMISSION.TOURNAMENT_VIEW,
  ]),
});

/**
 * @param {unknown} action
 * @returns {{ known: boolean, requiredPermissions: string[], mapVersion: string }}
 */
export function mapActionToPermissions(action) {
  const key = String(action || "");
  const mapped = ACTION_PERMISSION_MAP[key];
  if (!mapped) {
    return {
      known: false,
      requiredPermissions: [],
      mapVersion: CORE02_ACTION_PERMISSION_MAP_VERSION,
    };
  }
  return {
    known: true,
    requiredPermissions: [...mapped],
    mapVersion: CORE02_ACTION_PERMISSION_MAP_VERSION,
  };
}
