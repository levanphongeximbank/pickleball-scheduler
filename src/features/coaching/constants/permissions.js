/**
 * Coaching → Identity permission identifier mapping (COACHING-02 + COACHING-04 additive).
 * Catalog handoff only — does not modify Identity internals.
 * Mirrors docs/coaching-training/coaching-02/15_COACHING_02_PERMISSION_SEED.sql
 * plus COACHING-04 assigned scoped permission ids (authored; not Staging-applied here).
 */

import {
  COACHING_ACTIONS,
  COACHING_ACTION_VALUES,
  COACHING_04_ASSIGNED_ACTIONS,
  COACHING_04_ASSIGNED_ACTION_VALUES,
} from "./actions.js";

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
 * COACHING-04 assigned / scoped permission ids (additive — keep the 14 above intact).
 * @type {Readonly<Record<string, string>>}
 */
export const COACHING_04_ASSIGNED_PERMISSION_IDS = Object.freeze({
  [COACHING_04_ASSIGNED_ACTIONS.ASSIGNED_READ]: "coaching.assigned.read",
  [COACHING_04_ASSIGNED_ACTIONS.ASSIGNED_SESSION_SCHEDULE]:
    "coaching.assigned.session.schedule",
  [COACHING_04_ASSIGNED_ACTIONS.ASSIGNED_ATTENDANCE_RECORD]:
    "coaching.assigned.attendance.record",
  [COACHING_04_ASSIGNED_ACTIONS.ASSIGNED_EVALUATION_SUBMIT]:
    "coaching.assigned.evaluation.submit",
  [COACHING_04_ASSIGNED_ACTIONS.ASSIGNED_ENTITLEMENT_CONSUME]:
    "coaching.assigned.entitlement.consume",
});

export const COACHING_04_ASSIGNED_PERMISSION_VALUES = Object.freeze(
  Object.values(COACHING_04_ASSIGNED_PERMISSION_IDS)
);

/**
 * @param {string} action
 * @returns {string}
 */
export function coachingActionToIdentityPermissionId(action) {
  const key = String(action || "");
  const id =
    COACHING_IDENTITY_PERMISSION_IDS[key] ||
    COACHING_04_ASSIGNED_PERMISSION_IDS[key];
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
  /** COACHING-04 additive notes — scoped perms authored; player self-scope blocked. */
  coaching04: Object.freeze({
    phase: "COACHING-04",
    assignedActions: COACHING_04_ASSIGNED_ACTION_VALUES,
    scopedPermissionIds: COACHING_04_ASSIGNED_PERMISSION_VALUES,
    playerSelfScopeBlocked: true,
    playerSelfScopeStatus: "COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED",
    notes: Object.freeze([
      "Assigned scoped permissions are additive and do not replace the 14 COACHING-02 ids.",
      "COACH grants require assignment-aware RLS before Staging apply.",
      "PLAYER self-scope mapping remains blocked — no verified auth.uid()→player_id contract.",
      "Durable runtime default remains false; localStorage not retired in this phase.",
    ]),
  }),
  playerSelfScopeBlocked: true,
});
