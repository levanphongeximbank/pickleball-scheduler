/**
 * Canonical Customer consent status (CUSTOMER-04).
 * Distinct from foundation CUSTOMER_CONSENT_STATE (OPT_IN/OPT_OUT/UNKNOWN)
 * used on aggregate overlay references, and from preference status.
 */

export const CUSTOMER_CONSENT_STATUS = Object.freeze({
  GRANTED: "GRANTED",
  DENIED: "DENIED",
  REVOKED: "REVOKED",
  NOT_RECORDED: "NOT_RECORDED",
  EXPIRED: "EXPIRED",
});

export const CUSTOMER_CONSENT_STATUS_VALUES = Object.freeze(
  Object.values(CUSTOMER_CONSENT_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerConsentStatus(value) {
  return CUSTOMER_CONSENT_STATUS_VALUES.includes(String(value || ""));
}
