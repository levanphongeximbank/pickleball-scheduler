/**
 * Customer communication purpose codes (CUSTOMER-04).
 * Typed purpose catalog owned as Customer business facts.
 * Platform Governance owns which purposes require regulatory consent.
 */

export const CUSTOMER_COMMUNICATION_PURPOSE = Object.freeze({
  MARKETING: "MARKETING",
  SERVICE: "SERVICE",
  EVENT_UPDATE: "EVENT_UPDATE",
  BOOKING_UPDATE: "BOOKING_UPDATE",
  COMPETITION_UPDATE: "COMPETITION_UPDATE",
  MEMBERSHIP_UPDATE: "MEMBERSHIP_UPDATE",
});

export const CUSTOMER_COMMUNICATION_PURPOSE_VALUES = Object.freeze(
  Object.values(CUSTOMER_COMMUNICATION_PURPOSE)
);

/**
 * Purposes that always require an explicit recorded consent fact for eligibility
 * to become ELIGIBLE without a Governance policy decision.
 * MARKETING is fail-closed toward REQUIRES_POLICY_DECISION when Governance
 * policy input is absent even if preference/consent appear opted-in/granted.
 */
export const CUSTOMER_PURPOSES_REQUIRING_EXPLICIT_CONSENT = Object.freeze([
  CUSTOMER_COMMUNICATION_PURPOSE.MARKETING,
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerCommunicationPurpose(value) {
  return CUSTOMER_COMMUNICATION_PURPOSE_VALUES.includes(String(value || ""));
}
