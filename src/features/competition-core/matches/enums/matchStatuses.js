/**
 * Phase 3F / CORE-15 — canonical Match Runtime statuses.
 * LINEUPS_PENDING is optional / policy-specific (recognized, not mandatory).
 * PAUSED and SUSPENDED are distinct non-terminal states.
 */

export const MATCH_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  READY: "READY",
  SCHEDULED: "SCHEDULED",
  LINEUPS_PENDING: "LINEUPS_PENDING",
  READY_TO_START: "READY_TO_START",
  IN_PROGRESS: "IN_PROGRESS",
  PAUSED: "PAUSED",
  SUSPENDED: "SUSPENDED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  POSTPONED: "POSTPONED",
});

/** @type {ReadonlySet<string>} */
export const MATCH_STATUS_VALUES = new Set(Object.values(MATCH_STATUS));

/**
 * Core mandatory statuses (LINEUPS_PENDING excluded — policy may still use it).
 * @type {ReadonlySet<string>}
 */
export const MATCH_CORE_STATUS_VALUES = new Set([
  MATCH_STATUS.DRAFT,
  MATCH_STATUS.READY,
  MATCH_STATUS.SCHEDULED,
  MATCH_STATUS.READY_TO_START,
  MATCH_STATUS.IN_PROGRESS,
  MATCH_STATUS.PAUSED,
  MATCH_STATUS.SUSPENDED,
  MATCH_STATUS.COMPLETED,
  MATCH_STATUS.CANCELLED,
  MATCH_STATUS.POSTPONED,
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMatchStatus(value) {
  return typeof value === "string" && MATCH_STATUS_VALUES.has(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMatchCoreStatus(value) {
  return typeof value === "string" && MATCH_CORE_STATUS_VALUES.has(value);
}
