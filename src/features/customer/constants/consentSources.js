/**
 * Consent / preference capture source references (CUSTOMER-04).
 */

export const CUSTOMER_CONSENT_SOURCE = Object.freeze({
  CUSTOMER: "CUSTOMER",
  CRM: "CRM",
  IMPORT: "IMPORT",
  SYSTEM: "SYSTEM",
  STAFF: "STAFF",
  SELF_SERVICE: "SELF_SERVICE",
});

export const CUSTOMER_CONSENT_SOURCE_VALUES = Object.freeze(
  Object.values(CUSTOMER_CONSENT_SOURCE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerConsentSource(value) {
  return CUSTOMER_CONSENT_SOURCE_VALUES.includes(String(value || ""));
}
