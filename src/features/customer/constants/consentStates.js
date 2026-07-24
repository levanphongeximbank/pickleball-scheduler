/**
 * Consent state at Customer business-contract level.
 * Platform Governance owns regulatory rules; Customer stores state/refs only.
 */

export const CUSTOMER_CONSENT_STATE = Object.freeze({
  OPT_IN: "OPT_IN",
  OPT_OUT: "OPT_OUT",
  UNKNOWN: "UNKNOWN",
});

export const CUSTOMER_CONSENT_STATE_VALUES = Object.freeze(
  Object.values(CUSTOMER_CONSENT_STATE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerConsentState(value) {
  return CUSTOMER_CONSENT_STATE_VALUES.includes(String(value || ""));
}
