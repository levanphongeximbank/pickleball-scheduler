/**
 * E2E-03 Organizer action → Identity permission map.
 *
 * Does NOT create a competing permission taxonomy.
 * Logical capability names (competition.*) map onto Identity PERMISSIONS.
 * Authorization uses CORE-02 evaluateAuthorization via E2E-01 with
 * explicit requiredPermissions (OR semantics).
 */

import { PERMISSIONS } from "../../../identity/constants/permissions.js";
import { ORGANIZER_ACTION } from "../constants.js";

/**
 * Logical capability ids requested by E2E-03 brief (documentation / projection).
 * Values are NOT Identity permission strings — see ORGANIZER_ACTION_PERMISSION_MAP.
 */
export const ORGANIZER_CAPABILITY = Object.freeze({
  OPERATIONS_READ: "competition.operations.read",
  PARTICIPANTS_LOCK: "competition.participants.lock",
  DRAW_PREPARE: "competition.draw.prepare",
  SCHEDULE_PREPARE: "competition.schedule.prepare",
  COURTS_CONFIRM: "competition.courts.confirm",
  CHECKIN_MANAGE: "competition.checkin.manage",
  MATCHES_CONTROL: "competition.matches.control",
  KNOCKOUT_ACTIVATE: "competition.knockout.activate",
  PUBLISH: "competition.publish",
  COMPLETE: "competition.complete",
  ARCHIVE_PREPARE: "competition.archive.prepare",
});

/**
 * @type {Readonly<Record<string, Readonly<{
 *   capability: string,
 *   requiredPermissions: readonly string[],
 *   requireVenue: boolean,
 * }>>>}
 */
export const ORGANIZER_ACTION_PERMISSION_MAP = Object.freeze({
  [ORGANIZER_ACTION.OPERATIONS_READ]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.OPERATIONS_READ,
    requiredPermissions: Object.freeze([PERMISSIONS.TOURNAMENT_VIEW]),
    requireVenue: false,
  }),
  [ORGANIZER_ACTION.PREPARE_OPERATIONS]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.OPERATIONS_READ,
    requiredPermissions: Object.freeze([PERMISSIONS.TOURNAMENT_UPDATE]),
    requireVenue: false,
  }),
  [ORGANIZER_ACTION.PARTICIPANTS_LOCK]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.PARTICIPANTS_LOCK,
    requiredPermissions: Object.freeze([PERMISSIONS.TOURNAMENT_UPDATE]),
    requireVenue: false,
  }),
  [ORGANIZER_ACTION.DRAW_PREPARE]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.DRAW_PREPARE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_UPDATE,
      PERMISSIONS.DIRECTOR_USE,
    ]),
    requireVenue: false,
  }),
  [ORGANIZER_ACTION.SCHEDULE_PREPARE]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.SCHEDULE_PREPARE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.SCHEDULING_RUN,
      PERMISSIONS.TOURNAMENT_UPDATE,
    ]),
    requireVenue: true,
  }),
  [ORGANIZER_ACTION.COURTS_CONFIRM]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.COURTS_CONFIRM,
    requiredPermissions: Object.freeze([
      PERMISSIONS.DIRECTOR_USE,
      PERMISSIONS.TOURNAMENT_UPDATE,
    ]),
    requireVenue: true,
  }),
  [ORGANIZER_ACTION.CHECKIN_MANAGE]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.CHECKIN_MANAGE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_UPDATE,
      PERMISSIONS.DIRECTOR_USE,
    ]),
    requireVenue: false,
  }),
  [ORGANIZER_ACTION.MATCHES_CONTROL]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.MATCHES_CONTROL,
    requiredPermissions: Object.freeze([
      PERMISSIONS.DIRECTOR_USE,
      PERMISSIONS.MATCH_UPDATE,
    ]),
    requireVenue: false,
  }),
  [ORGANIZER_ACTION.KNOCKOUT_ACTIVATE]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.KNOCKOUT_ACTIVATE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.DIRECTOR_USE,
      PERMISSIONS.TOURNAMENT_UPDATE,
    ]),
    requireVenue: false,
  }),
  [ORGANIZER_ACTION.PUBLISH]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.PUBLISH,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_UPDATE,
      PERMISSIONS.TOURNAMENT_CERTIFY,
    ]),
    requireVenue: false,
  }),
  [ORGANIZER_ACTION.COMPLETE]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.COMPLETE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_UPDATE,
      PERMISSIONS.DIRECTOR_USE,
    ]),
    requireVenue: false,
  }),
  [ORGANIZER_ACTION.ARCHIVE_PREPARE]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.ARCHIVE_PREPARE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_UPDATE,
      PERMISSIONS.TOURNAMENT_CERTIFY,
    ]),
    requireVenue: false,
  }),
});

/**
 * @param {string} action
 * @returns {{ capability: string, requiredPermissions: readonly string[], requireVenue: boolean }}
 */
export function resolveOrganizerActionPermissions(action) {
  const key = String(action || "").trim();
  const mapped = ORGANIZER_ACTION_PERMISSION_MAP[key];
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
export function isKnownOrganizerAction(action) {
  return Object.prototype.hasOwnProperty.call(
    ORGANIZER_ACTION_PERMISSION_MAP,
    String(action || "").trim()
  );
}
