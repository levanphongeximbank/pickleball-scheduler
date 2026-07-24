/**
 * Customer linkage provenance sources (CUSTOMER-05).
 */

export const CUSTOMER_LINKAGE_SOURCE = Object.freeze({
  MANUAL: "MANUAL",
  IMPORT: "IMPORT",
  SYSTEM: "SYSTEM",
  MIGRATION: "MIGRATION",
});

export const CUSTOMER_LINKAGE_SOURCE_VALUES = Object.freeze(
  Object.values(CUSTOMER_LINKAGE_SOURCE)
);

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isCustomerLinkageSource(value) {
  return CUSTOMER_LINKAGE_SOURCE_VALUES.includes(String(value || ""));
}
