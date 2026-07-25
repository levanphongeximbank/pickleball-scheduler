/**
 * COACHING-04 runtime constants.
 * Durable default stays off; localStorage retirement stays inactive.
 */

export const COACHING_RUNTIME_MODE = Object.freeze({
  DURABLE: "durable",
  LEGACY: "legacy",
  UNAVAILABLE: "unavailable",
});

/** Mirror of persistence flag — must remain false until Owner activation. */
export const COACHING_DURABLE_RUNTIME_DEFAULT = false;

/** Retirement activation gate — must remain false (detect/classify only). */
export const LOCALSTORAGE_RETIRED = false;

export const COACHING_LEGACY_STORAGE_KEY_PREFIX = "pickleball-coaching-v1";

export const COACHING_04_PHASE = "COACHING-04";

export const COACHING_04_SCOPED_PERMISSION_IDS = Object.freeze([
  "coaching.assigned.read",
  "coaching.assigned.session.schedule",
  "coaching.assigned.attendance.record",
  "coaching.assigned.evaluation.submit",
  "coaching.assigned.entitlement.consume",
]);

export const COACHING_04_PLAYER_SELF_SCOPE_STATUS =
  "COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED";

/** UI collection names used by legacy pages / runtime gateway. */
export const COACHING_UI_COLLECTIONS = Object.freeze([
  "coaches",
  "students",
  "classes",
  "schedule",
  "packages",
  "attendance",
  "evaluations",
]);
