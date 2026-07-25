/**
 * Coaching → Identity permission identifier mapping (COACHING-02).
 * Catalog handoff only — does not modify Identity internals.
 * Mirrors docs/coaching-training/coaching-02/15_COACHING_02_PERMISSION_SEED.sql
 */

import { COACHING_ACTIONS, COACHING_ACTION_VALUES } from "./actions.js";

/** @type {Readonly<Record<string, string>>} */
export const COACHING_IDENTITY_PERMISSION_IDS = Object.freeze({
  [COACHING_ACTIONS.PROGRAM_CREATE]: "coaching.program.create",
  [COACHING_ACTIONS.PROGRAM_UPDATE]: "coaching.program.update",
  [COACHING_ACTIONS.COACH_ASSIGN]: "coaching.coach.assign",
  [COACHING_ACTIONS.PLAYER_ENROLL]: "coaching.player.enroll",
  [COACHING_ACTIONS.CURRICULUM_CREATE]: "coaching.curriculum.create",
  [COACHING_ACTIONS.LESSON_CREATE]: "coaching.lesson.create",
  [COACHING_ACTIONS.SESSION_SCHEDULE]: "coaching.session.schedule",
  [COACHING_ACTIONS.ATTENDANCE_RECORD]: "coaching.attendance.record",
  [COACHING_ACTIONS.ATTENDANCE_CORRECT]: "coaching.attendance.correct",
  [COACHING_ACTIONS.PACKAGE_CREATE]: "coaching.package.create",
  [COACHING_ACTIONS.ENTITLEMENT_GRANT]: "coaching.entitlement.grant",
  [COACHING_ACTIONS.ENTITLEMENT_CONSUME]: "coaching.entitlement.consume",
  [COACHING_ACTIONS.EVALUATION_SUBMIT]: "coaching.evaluation.submit",
  [COACHING_ACTIONS.RECORDS_READ]: "coaching.records.read",
});

export const COACHING_IDENTITY_PERMISSION_VALUES = Object.freeze(
  Object.values(COACHING_IDENTITY_PERMISSION_IDS)
);

/**
 * @param {string} action
 * @returns {string}
 */
export function coachingActionToIdentityPermissionId(action) {
  const id = COACHING_IDENTITY_PERMISSION_IDS[String(action || "")];
  if (!id) {
    throw new Error(`Unknown Coaching action for Identity mapping: ${action}`);
  }
  return id;
}

export const COACHING_PERMISSION_MANIFEST = Object.freeze({
  phase: "COACHING-02",
  identityInternalsModified: false,
  roleGrantsIncluded: false,
  coaching03Prerequisite:
    "Owner-approved role_permissions assignment before Staging apply",
  actions: COACHING_ACTION_VALUES,
  permissionIds: COACHING_IDENTITY_PERMISSION_VALUES,
  seedSql: "docs/coaching-training/coaching-02/15_COACHING_02_PERMISSION_SEED.sql",
  phase28CoarseKeysNotCanonical: Object.freeze([
    "coaching.view",
    "coaching.manage",
    "coaching.attendance",
    "coaching.evaluate",
  ]),
});
