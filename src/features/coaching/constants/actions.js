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
  EVALUATION_SUBMIT: "coaching.evaluation.submit",
  RECORDS_READ: "coaching.records.read",
});

export const COACHING_ACTION_VALUES = Object.freeze(Object.values(COACHING_ACTIONS));

/**
 * @param {string} action
 * @returns {boolean}
 */
export function isCoachingAction(action) {
  return COACHING_ACTION_VALUES.includes(String(action || ""));
}
