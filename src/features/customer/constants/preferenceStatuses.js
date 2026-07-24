/**
 * Canonical Customer communication preference status (CUSTOMER-04).
 * Preference is not consent — OPTED_IN does not prove legal permission.
 */

export const CUSTOMER_PREFERENCE_STATUS = Object.freeze({
  OPTED_IN: "OPTED_IN",
  OPTED_OUT: "OPTED_OUT",
  UNSPECIFIED: "UNSPECIFIED",
});

export const CUSTOMER_PREFERENCE_STATUS_VALUES = Object.freeze(
  Object.values(CUSTOMER_PREFERENCE_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerPreferenceStatus(value) {
  return CUSTOMER_PREFERENCE_STATUS_VALUES.includes(String(value || ""));
}
