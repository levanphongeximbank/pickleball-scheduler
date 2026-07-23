/**
 * Phase 3F / CORE-15 — completion / terminal outcome reasons (not statuses).
 * Scoring Runtime owns detailed result typing; Core stores opaque reason only.
 * CORE-17 owns final result validation and acceptance.
 */

export const MATCH_COMPLETION_REASON = Object.freeze({
  NONE: "NONE",
  COMPLETED: "COMPLETED",
  WALKOVER: "WALKOVER",
  NO_SHOW: "NO_SHOW",
  FORFEIT: "FORFEIT",
  RETIREMENT: "RETIREMENT",
  ABANDONED: "ABANDONED",
  VOID: "VOID",
  CANCELLED: "CANCELLED",
});

/** @type {ReadonlySet<string>} */
export const MATCH_COMPLETION_REASON_VALUES = new Set(
  Object.values(MATCH_COMPLETION_REASON)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMatchCompletionReason(value) {
  return (
    typeof value === "string" && MATCH_COMPLETION_REASON_VALUES.has(value)
  );
}
