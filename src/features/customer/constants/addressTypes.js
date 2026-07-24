/**
 * Customer address type allowlist (CUSTOMER-02).
 * Contract only — no geocoding or verification runtime.
 */

export const CUSTOMER_ADDRESS_TYPE = Object.freeze({
  POSTAL: "POSTAL",
  BUSINESS: "BUSINESS",
  BILLING: "BILLING",
  OTHER: "OTHER",
});

export const CUSTOMER_ADDRESS_TYPE_VALUES = Object.freeze(
  Object.values(CUSTOMER_ADDRESS_TYPE)
);

export const CUSTOMER_ADDRESS_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
});

export const CUSTOMER_ADDRESS_STATUS_VALUES = Object.freeze(
  Object.values(CUSTOMER_ADDRESS_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerAddressType(value) {
  return CUSTOMER_ADDRESS_TYPE_VALUES.includes(String(value || ""));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerAddressStatus(value) {
  return CUSTOMER_ADDRESS_STATUS_VALUES.includes(String(value || ""));
}
