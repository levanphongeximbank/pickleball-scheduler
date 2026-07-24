/**
 * Communication eligibility outcomes (CUSTOMER-04).
 * Fail-closed: absence of facts never yields ELIGIBLE.
 */

export const CUSTOMER_COMMUNICATION_ELIGIBILITY = Object.freeze({
  ELIGIBLE: "ELIGIBLE",
  INELIGIBLE: "INELIGIBLE",
  REQUIRES_POLICY_DECISION: "REQUIRES_POLICY_DECISION",
});

export const CUSTOMER_COMMUNICATION_ELIGIBILITY_VALUES = Object.freeze(
  Object.values(CUSTOMER_COMMUNICATION_ELIGIBILITY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerCommunicationEligibility(value) {
  return CUSTOMER_COMMUNICATION_ELIGIBILITY_VALUES.includes(String(value || ""));
}
