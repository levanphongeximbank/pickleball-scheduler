/**
 * Customer linkage lifecycle statuses (CUSTOMER-05).
 * PENDING is intentionally omitted — no verification workflow in this phase.
 */

export const CUSTOMER_LINKAGE_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  UNLINKED: "UNLINKED",
});

export const CUSTOMER_LINKAGE_STATUS_VALUES = Object.freeze(
  Object.values(CUSTOMER_LINKAGE_STATUS)
);

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isCustomerLinkageStatus(value) {
  return CUSTOMER_LINKAGE_STATUS_VALUES.includes(String(value || ""));
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isActiveCustomerLinkageStatus(status) {
  return String(status || "") === CUSTOMER_LINKAGE_STATUS.ACTIVE;
}
