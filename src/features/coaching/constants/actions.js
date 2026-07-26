/**
 * Canonical Coaching & Training action identifiers (COACHING-01).
 * Capability/action-based — not menu/route visibility.
 * Not wired into Identity SQL / Production RBAC in COACHING-01.
 */

export const COACHING_ACTIONS = Object.freeze({
  PROGRAM_CREATE: "coaching.program.create",
  PROGRAM_UPDATE: "coaching.program.update",
  COACH_ASSIGN: "coaching.coach.assign",
  PLAYER_ENROLL: "coaching.player.enroll",
  CURRICULUM_CREATE: "coaching.curriculum.create",
  LESSON_CREATE: "coaching.lesson.create",
  SESSION_SCHEDULE: "coaching.session.schedule",
  ATTENDANCE_RECORD: "coaching.attendance.record",
  ATTENDANCE_CORRECT: "coaching.attendance.correct",
  PACKAGE_CREATE: "coaching.package.create",
  ENTITLEMENT_GRANT: "coaching.entitlement.grant",
  ENTITLEMENT_CONSUME: "coaching.entitlement.consume",
  EVALUATION_SUBMIT: "coaching.evaluation.submit",
  RECORDS_READ: "coaching.records.read",
});

export const COACHING_ACTION_VALUES = Object.freeze(Object.values(COACHING_ACTIONS));

/**
 * COACHING-04 assignment-scoped actions (additive — does not replace the 14 above).
 * Require assignment-aware RLS before any COACH grants.
 */
export const COACHING_04_ASSIGNED_ACTIONS = Object.freeze({
  ASSIGNED_READ: "coaching.assigned.read",
  ASSIGNED_SESSION_SCHEDULE: "coaching.assigned.session.schedule",
  ASSIGNED_ATTENDANCE_RECORD: "coaching.assigned.attendance.record",
  ASSIGNED_EVALUATION_SUBMIT: "coaching.assigned.evaluation.submit",
  ASSIGNED_ENTITLEMENT_CONSUME: "coaching.assigned.entitlement.consume",
});

export const COACHING_04_ASSIGNED_ACTION_VALUES = Object.freeze(
  Object.values(COACHING_04_ASSIGNED_ACTIONS)
);

/**
 * COACHING-04 PLAYER self-scope actions (additive — read-only).
 */
export const COACHING_04_PLAYER_SELF_ACTIONS = Object.freeze({
  SELF_READ: "coaching.self.read",
});

export const COACHING_04_PLAYER_SELF_ACTION_VALUES = Object.freeze(
  Object.values(COACHING_04_PLAYER_SELF_ACTIONS)
);

/**
 * @param {string} action
 * @returns {boolean}
 */
export function isCoachingAction(action) {
  const value = String(action || "");
  return (
    COACHING_ACTION_VALUES.includes(value) ||
    COACHING_04_ASSIGNED_ACTION_VALUES.includes(value) ||
    COACHING_04_PLAYER_SELF_ACTION_VALUES.includes(value)
  );
}
