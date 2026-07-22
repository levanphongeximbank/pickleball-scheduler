/**
 * CORE-12 — CourtAssignmentStatus.
 *
 * ERROR is reserved for unexpected engine faults in future integration
 * wrappers. The Phase 1B pure assigner (`assignCourtsDeterministic`) never
 * emits ERROR — validation → REJECTED; assignment shortfall → INFEASIBLE/PARTIAL.
 */

export const COURT_ASSIGNMENT_STATUS = Object.freeze({
  SUCCESS: "SUCCESS",
  PARTIAL: "PARTIAL",
  INFEASIBLE: "INFEASIBLE",
  REJECTED: "REJECTED",
  /** Reserved — not emitted by Phase 1B pure assigner. */
  ERROR: "ERROR",
});

export const COURT_ASSIGNMENT_STATUS_VALUES = Object.freeze(
  Object.values(COURT_ASSIGNMENT_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCourtAssignmentStatus(value) {
  return COURT_ASSIGNMENT_STATUS_VALUES.includes(/** @type {string} */ (value));
}
