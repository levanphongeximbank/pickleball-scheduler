/**
 * Append-only linkage history actions (CUSTOMER-05).
 */

export const CUSTOMER_LINKAGE_ACTION = Object.freeze({
  LINK: "LINK",
  UNLINK: "UNLINK",
  DEACTIVATE: "DEACTIVATE",
  REACTIVATE: "REACTIVATE",
});

export const CUSTOMER_LINKAGE_ACTION_VALUES = Object.freeze(
  Object.values(CUSTOMER_LINKAGE_ACTION)
);

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isCustomerLinkageAction(value) {
  return CUSTOMER_LINKAGE_ACTION_VALUES.includes(String(value || ""));
}
