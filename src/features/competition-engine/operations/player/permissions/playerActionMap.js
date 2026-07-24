/**
 * E2E-04 Player action → Identity permission map.
 * Does NOT create a competing permission taxonomy.
 */

import { PERMISSIONS } from "../../../../identity/constants/permissions.js";
import { PLAYER_ACTION } from "../constants.js";

export const PLAYER_CAPABILITY = Object.freeze({
  OPERATIONS_READ: "competition.player.read",
  CHECKIN_SELF: "competition.player.checkin.self",
  SCHEDULE_READ: "competition.player.schedule.read",
  MATCH_READ: "competition.player.match.read",
  STANDINGS_READ: "competition.player.standings.read",
  QUALIFICATION_READ: "competition.player.qualification.read",
  KNOCKOUT_READ: "competition.player.knockout.read",
  FINAL_RESULT_READ: "competition.player.final_result.read",
});

/**
 * @type {Readonly<Record<string, Readonly<{
 *   capability: string,
 *   requiredPermissions: readonly string[],
 *   requireVenue: boolean,
 * }>>>}
 */
export const PLAYER_ACTION_PERMISSION_MAP = Object.freeze({
  [PLAYER_ACTION.OPERATIONS_READ]: Object.freeze({
    capability: PLAYER_CAPABILITY.OPERATIONS_READ,
    requiredPermissions: Object.freeze([PERMISSIONS.TOURNAMENT_VIEW]),
    requireVenue: false,
  }),
  [PLAYER_ACTION.CHECKIN_SELF]: Object.freeze({
    capability: PLAYER_CAPABILITY.CHECKIN_SELF,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_VIEW,
      PERMISSIONS.PLAYER_UPDATE,
    ]),
    requireVenue: false,
  }),
  [PLAYER_ACTION.SCHEDULE_READ]: Object.freeze({
    capability: PLAYER_CAPABILITY.SCHEDULE_READ,
    requiredPermissions: Object.freeze([PERMISSIONS.TOURNAMENT_VIEW]),
    requireVenue: false,
  }),
  [PLAYER_ACTION.MATCH_READ]: Object.freeze({
    capability: PLAYER_CAPABILITY.MATCH_READ,
    requiredPermissions: Object.freeze([PERMISSIONS.TOURNAMENT_VIEW]),
    requireVenue: false,
  }),
  [PLAYER_ACTION.STANDINGS_READ]: Object.freeze({
    capability: PLAYER_CAPABILITY.STANDINGS_READ,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_VIEW,
      PERMISSIONS.STATISTICS_VIEW,
    ]),
    requireVenue: false,
  }),
  [PLAYER_ACTION.QUALIFICATION_READ]: Object.freeze({
    capability: PLAYER_CAPABILITY.QUALIFICATION_READ,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_VIEW,
      PERMISSIONS.STATISTICS_VIEW,
    ]),
    requireVenue: false,
  }),
  [PLAYER_ACTION.KNOCKOUT_READ]: Object.freeze({
    capability: PLAYER_CAPABILITY.KNOCKOUT_READ,
    requiredPermissions: Object.freeze([PERMISSIONS.TOURNAMENT_VIEW]),
    requireVenue: false,
  }),
  [PLAYER_ACTION.FINAL_RESULT_READ]: Object.freeze({
    capability: PLAYER_CAPABILITY.FINAL_RESULT_READ,
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
export function resolvePlayerActionPermissions(action) {
  const key = String(action || "").trim();
  const mapped = PLAYER_ACTION_PERMISSION_MAP[key];
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
export function isKnownPlayerAction(action) {
  return Object.prototype.hasOwnProperty.call(
    PLAYER_ACTION_PERMISSION_MAP,
    String(action || "").trim()
  );
}
