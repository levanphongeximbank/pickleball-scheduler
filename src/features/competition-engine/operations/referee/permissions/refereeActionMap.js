/**
 * E2E-04 Referee action → Identity permission map.
 */

import { PERMISSIONS } from "../../../../identity/constants/permissions.js";
import { REFEREE_ACTION } from "../constants.js";

export const REFEREE_CAPABILITY = Object.freeze({
  ASSIGNMENT_READ: "competition.referee.assignment.read",
  ASSIGNMENT_ACK: "competition.referee.assignment.acknowledge",
  MATCH_CONTROL: "competition.referee.match.control",
  SCORE_SUBMIT: "competition.referee.score.submit",
  RESULT_SUBMIT: "competition.referee.result.submit",
  RESULT_CORRECT: "competition.referee.result.correct",
  RESULT_READ: "competition.referee.result.read",
});

/**
 * @type {Readonly<Record<string, Readonly<{
 *   capability: string,
 *   requiredPermissions: readonly string[],
 *   requireVenue: boolean,
 * }>>>}
 */
export const REFEREE_ACTION_PERMISSION_MAP = Object.freeze({
  [REFEREE_ACTION.ASSIGNMENT_READ]: Object.freeze({
    capability: REFEREE_CAPABILITY.ASSIGNMENT_READ,
    requiredPermissions: Object.freeze([PERMISSIONS.TOURNAMENT_VIEW]),
    requireVenue: false,
  }),
  [REFEREE_ACTION.ASSIGNMENT_ACK]: Object.freeze({
    capability: REFEREE_CAPABILITY.ASSIGNMENT_ACK,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_VIEW,
      PERMISSIONS.MATCH_UPDATE,
    ]),
    requireVenue: false,
  }),
  [REFEREE_ACTION.MATCH_OPEN]: Object.freeze({
    capability: REFEREE_CAPABILITY.MATCH_CONTROL,
    requiredPermissions: Object.freeze([PERMISSIONS.MATCH_UPDATE]),
    requireVenue: false,
  }),
  [REFEREE_ACTION.MATCH_SUSPEND]: Object.freeze({
    capability: REFEREE_CAPABILITY.MATCH_CONTROL,
    requiredPermissions: Object.freeze([PERMISSIONS.MATCH_UPDATE]),
    requireVenue: false,
  }),
  [REFEREE_ACTION.MATCH_RESUME]: Object.freeze({
    capability: REFEREE_CAPABILITY.MATCH_CONTROL,
    requiredPermissions: Object.freeze([PERMISSIONS.MATCH_UPDATE]),
    requireVenue: false,
  }),
  [REFEREE_ACTION.SCORE_SESSION]: Object.freeze({
    capability: REFEREE_CAPABILITY.SCORE_SUBMIT,
    requiredPermissions: Object.freeze([PERMISSIONS.MATCH_UPDATE]),
    requireVenue: false,
  }),
  [REFEREE_ACTION.SCORE_SUBMIT]: Object.freeze({
    capability: REFEREE_CAPABILITY.SCORE_SUBMIT,
    requiredPermissions: Object.freeze([PERMISSIONS.MATCH_UPDATE]),
    requireVenue: false,
  }),
  [REFEREE_ACTION.RESULT_SUBMIT]: Object.freeze({
    capability: REFEREE_CAPABILITY.RESULT_SUBMIT,
    requiredPermissions: Object.freeze([
      PERMISSIONS.MATCH_UPDATE,
      PERMISSIONS.TEAM_MATCH_RESULT_MANAGE,
    ]),
    requireVenue: false,
  }),
  [REFEREE_ACTION.RESULT_CORRECT]: Object.freeze({
    capability: REFEREE_CAPABILITY.RESULT_CORRECT,
    requiredPermissions: Object.freeze([
      PERMISSIONS.MATCH_UPDATE,
      PERMISSIONS.TEAM_MATCH_RESULT_MANAGE,
    ]),
    requireVenue: false,
  }),
  [REFEREE_ACTION.RESULT_READ]: Object.freeze({
    capability: REFEREE_CAPABILITY.RESULT_READ,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_VIEW,
      PERMISSIONS.STATISTICS_VIEW,
    ]),
    requireVenue: false,
  }),
});

/**
 * @param {string} action
 */
export function resolveRefereeActionPermissions(action) {
  const key = String(action || "").trim();
  const mapped = REFEREE_ACTION_PERMISSION_MAP[key];
  if (!mapped) {
    return Object.freeze({
      capability: key || "unknown",
      requiredPermissions: Object.freeze([]),
      requireVenue: false,
    });
  }
  return mapped;
}

/**
 * @param {string} action
 * @returns {boolean}
 */
export function isKnownRefereeAction(action) {
  return Object.prototype.hasOwnProperty.call(
    REFEREE_ACTION_PERMISSION_MAP,
    String(action || "").trim()
  );
}
