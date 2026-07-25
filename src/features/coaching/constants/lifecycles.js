/**
 * Coaching lifecycle statuses and allowed transitions (COACHING-01).
 */

export const PROGRAM_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  COMPLETED: "completed",
  ARCHIVED: "archived",
});

export const PROGRAM_STATUS_VALUES = Object.freeze(Object.values(PROGRAM_STATUS));

/** @type {Readonly<Record<string, readonly string[]>>} */
export const PROGRAM_ALLOWED_TRANSITIONS = Object.freeze({
  [PROGRAM_STATUS.DRAFT]: Object.freeze([
    PROGRAM_STATUS.ACTIVE,
    PROGRAM_STATUS.ARCHIVED,
  ]),
  [PROGRAM_STATUS.ACTIVE]: Object.freeze([
    PROGRAM_STATUS.SUSPENDED,
    PROGRAM_STATUS.COMPLETED,
    PROGRAM_STATUS.ARCHIVED,
  ]),
  [PROGRAM_STATUS.SUSPENDED]: Object.freeze([
    PROGRAM_STATUS.ACTIVE,
    PROGRAM_STATUS.ARCHIVED,
  ]),
  [PROGRAM_STATUS.COMPLETED]: Object.freeze([PROGRAM_STATUS.ARCHIVED]),
  [PROGRAM_STATUS.ARCHIVED]: Object.freeze([]),
});

export const ENROLLMENT_STATUS = Object.freeze({
  PENDING: "pending",
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

export const ENROLLMENT_STATUS_VALUES = Object.freeze(
  Object.values(ENROLLMENT_STATUS)
);

/** @type {Readonly<Record<string, readonly string[]>>} */
export const ENROLLMENT_ALLOWED_TRANSITIONS = Object.freeze({
  [ENROLLMENT_STATUS.PENDING]: Object.freeze([
    ENROLLMENT_STATUS.ACTIVE,
    ENROLLMENT_STATUS.CANCELLED,
  ]),
  [ENROLLMENT_STATUS.ACTIVE]: Object.freeze([
    ENROLLMENT_STATUS.PAUSED,
    ENROLLMENT_STATUS.COMPLETED,
    ENROLLMENT_STATUS.CANCELLED,
  ]),
  [ENROLLMENT_STATUS.PAUSED]: Object.freeze([
    ENROLLMENT_STATUS.ACTIVE,
    ENROLLMENT_STATUS.CANCELLED,
  ]),
  [ENROLLMENT_STATUS.COMPLETED]: Object.freeze([]),
  [ENROLLMENT_STATUS.CANCELLED]: Object.freeze([]),
});

export const SESSION_STATUS = Object.freeze({
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

export const SESSION_STATUS_VALUES = Object.freeze(Object.values(SESSION_STATUS));

/** @type {Readonly<Record<string, readonly string[]>>} */
export const SESSION_ALLOWED_TRANSITIONS = Object.freeze({
  [SESSION_STATUS.DRAFT]: Object.freeze([
    SESSION_STATUS.SCHEDULED,
    SESSION_STATUS.CANCELLED,
  ]),
  [SESSION_STATUS.SCHEDULED]: Object.freeze([
    SESSION_STATUS.CONFIRMED,
    SESSION_STATUS.COMPLETED,
    SESSION_STATUS.CANCELLED,
  ]),
  [SESSION_STATUS.CONFIRMED]: Object.freeze([
    SESSION_STATUS.COMPLETED,
    SESSION_STATUS.CANCELLED,
  ]),
  [SESSION_STATUS.COMPLETED]: Object.freeze([]),
  [SESSION_STATUS.CANCELLED]: Object.freeze([]),
});

export const ATTENDANCE_STATUS = Object.freeze({
  ABSENT: "absent",
  PRESENT: "present",
  LATE: "late",
  EXCUSED: "excused",
});

export const ATTENDANCE_STATUS_VALUES = Object.freeze(
  Object.values(ATTENDANCE_STATUS)
);

export const EVALUATION_STATUS = Object.freeze({
  DRAFT: "draft",
  SUBMITTED: "submitted",
});

export const EVALUATION_STATUS_VALUES = Object.freeze(
  Object.values(EVALUATION_STATUS)
);

/** @type {Readonly<Record<string, readonly string[]>>} */
export const EVALUATION_ALLOWED_TRANSITIONS = Object.freeze({
  [EVALUATION_STATUS.DRAFT]: Object.freeze([EVALUATION_STATUS.SUBMITTED]),
  [EVALUATION_STATUS.SUBMITTED]: Object.freeze([]),
});

export const PACKAGE_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  EXPIRED: "expired",
  ARCHIVED: "archived",
});

export const PACKAGE_STATUS_VALUES = Object.freeze(Object.values(PACKAGE_STATUS));

/** @type {Readonly<Record<string, readonly string[]>>} */
export const PACKAGE_ALLOWED_TRANSITIONS = Object.freeze({
  [PACKAGE_STATUS.DRAFT]: Object.freeze([
    PACKAGE_STATUS.ACTIVE,
    PACKAGE_STATUS.ARCHIVED,
  ]),
  [PACKAGE_STATUS.ACTIVE]: Object.freeze([
    PACKAGE_STATUS.EXPIRED,
    PACKAGE_STATUS.ARCHIVED,
  ]),
  [PACKAGE_STATUS.EXPIRED]: Object.freeze([PACKAGE_STATUS.ARCHIVED]),
  [PACKAGE_STATUS.ARCHIVED]: Object.freeze([]),
});

export const RELATIONSHIP_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
});

export const RELATIONSHIP_STATUS_VALUES = Object.freeze(
  Object.values(RELATIONSHIP_STATUS)
);

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isProgramStatus(status) {
  return PROGRAM_STATUS_VALUES.includes(String(status || ""));
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isEnrollmentStatus(status) {
  return ENROLLMENT_STATUS_VALUES.includes(String(status || ""));
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isSessionStatus(status) {
  return SESSION_STATUS_VALUES.includes(String(status || ""));
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isAttendanceStatus(status) {
  return ATTENDANCE_STATUS_VALUES.includes(String(status || ""));
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isEvaluationStatus(status) {
  return EVALUATION_STATUS_VALUES.includes(String(status || ""));
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isPackageStatus(status) {
  return PACKAGE_STATUS_VALUES.includes(String(status || ""));
}

/**
 * @param {string} from
 * @param {string} to
 * @param {Readonly<Record<string, readonly string[]>>} table
 * @returns {boolean}
 */
export function isAllowedTransition(from, to, table) {
  const allowed = table[String(from)] || [];
  return allowed.includes(String(to));
}
