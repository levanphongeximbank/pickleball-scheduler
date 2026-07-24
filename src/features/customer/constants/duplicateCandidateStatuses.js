/**
 * Duplicate candidate lifecycle statuses (CUSTOMER-06).
 * Distinct from CUSTOMER_MERGE_STATUS on proposals.
 */

export const CUSTOMER_DUPLICATE_CANDIDATE_STATUS = Object.freeze({
  OPEN: "OPEN",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  APPROVED_FOR_MERGE: "APPROVED_FOR_MERGE",
  REJECTED: "REJECTED",
  RESOLVED: "RESOLVED",
});

export const CUSTOMER_DUPLICATE_CANDIDATE_STATUS_VALUES = Object.freeze(
  Object.values(CUSTOMER_DUPLICATE_CANDIDATE_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerDuplicateCandidateStatus(value) {
  return CUSTOMER_DUPLICATE_CANDIDATE_STATUS_VALUES.includes(String(value || ""));
}
