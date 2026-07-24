/**
 * Canonical customer types (CUSTOMER-01).
 * Venue-specific labels (walk_in / member / club / visitor) remain legacy
 * classification overlays — not canonical customerType values.
 */

export const CUSTOMER_TYPE = Object.freeze({
  INDIVIDUAL: "INDIVIDUAL",
  ORGANIZATION: "ORGANIZATION",
});

export const CUSTOMER_TYPE_VALUES = Object.freeze(Object.values(CUSTOMER_TYPE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerType(value) {
  return CUSTOMER_TYPE_VALUES.includes(String(value || ""));
}
