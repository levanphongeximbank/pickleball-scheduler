/**
 * Canonical Customer linkage types (CUSTOMER-05).
 */

export const CUSTOMER_LINKAGE_TYPE = Object.freeze({
  IDENTITY_ACCOUNT: "IDENTITY_ACCOUNT",
  PLAYER: "PLAYER",
  CRM_CONTACT: "CRM_CONTACT",
});

export const CUSTOMER_LINKAGE_TYPE_VALUES = Object.freeze(
  Object.values(CUSTOMER_LINKAGE_TYPE)
);

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isCustomerLinkageType(value) {
  return CUSTOMER_LINKAGE_TYPE_VALUES.includes(String(value || ""));
}

/** Default external system namespaces per linkage type. */
export const CUSTOMER_LINKAGE_EXTERNAL_SYSTEM = Object.freeze({
  IDENTITY: "IDENTITY",
  PLAYER: "PLAYER",
  CRM: "CRM",
});
