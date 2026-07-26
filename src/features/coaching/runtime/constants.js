/**
 * COACHING-04 runtime constants.
 * Durable default stays off; localStorage retirement stays inactive.
 * PLAYER self-scope SQL/runtime authored; Staging apply still Owner-gated.
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

/** PLAYER self-read permission (additive; distinct from coaching.records.read). */
export const COACHING_04_PLAYER_SELF_PERMISSION_IDS = Object.freeze([
  "coaching.self.read",
]);

/**
 * Authoring complete; Staging SQL apply + durable flip still require Owner GO.
 * Historical blocker: COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED (pre PM-ID-01).
 */
export const COACHING_04_PLAYER_SELF_SCOPE_STATUS =
  "COACHING_04_PLAYER_SELF_SCOPE_AUTHORED_AWAITING_STAGING_GO";

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
