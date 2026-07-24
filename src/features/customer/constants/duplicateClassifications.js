/**
 * Duplicate pair classifications (CUSTOMER-06).
 * Never auto-merge regardless of classification.
 */

export const CUSTOMER_DUPLICATE_CLASSIFICATION = Object.freeze({
  EXACT_REFERENCE_MATCH: "EXACT_REFERENCE_MATCH",
  STRONG_DUPLICATE_CANDIDATE: "STRONG_DUPLICATE_CANDIDATE",
  POSSIBLE_DUPLICATE: "POSSIBLE_DUPLICATE",
  INSUFFICIENT_EVIDENCE: "INSUFFICIENT_EVIDENCE",
  CONFLICTING_IDENTITIES: "CONFLICTING_IDENTITIES",
  NOT_DUPLICATE: "NOT_DUPLICATE",
  REQUIRES_MANUAL_REVIEW: "REQUIRES_MANUAL_REVIEW",
});

export const CUSTOMER_DUPLICATE_CLASSIFICATION_VALUES = Object.freeze(
  Object.values(CUSTOMER_DUPLICATE_CLASSIFICATION)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerDuplicateClassification(value) {
  return CUSTOMER_DUPLICATE_CLASSIFICATION_VALUES.includes(String(value || ""));
}
