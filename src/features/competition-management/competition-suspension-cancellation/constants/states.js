/**
 * CM-07 effective competition lifecycle interruption states.
 *
 * Distinct from CM-01 management status, CM-06 publication status,
 * CORE-15 match lifecycle, CORE-19 workflow pause, and CM-08 archive.
 */

export const COMPETITION_LIFECYCLE_STATE = Object.freeze({
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  CANCELLED: "CANCELLED",
});

export const COMPETITION_LIFECYCLE_STATE_VALUES = Object.freeze(
  Object.values(COMPETITION_LIFECYCLE_STATE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionLifecycleState(value) {
  return (
    typeof value === "string" &&
    COMPETITION_LIFECYCLE_STATE_VALUES.includes(value)
  );
}

/** Terminal state — no resume/suspend from CANCELLED within CM-07. */
export const COMPETITION_LIFECYCLE_TERMINAL_STATES = Object.freeze([
  COMPETITION_LIFECYCLE_STATE.CANCELLED,
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionLifecycleTerminalState(value) {
  return COMPETITION_LIFECYCLE_TERMINAL_STATES.includes(value);
}
