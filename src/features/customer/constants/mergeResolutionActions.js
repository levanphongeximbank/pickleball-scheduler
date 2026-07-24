/**
 * Field / collection resolution actions for merge proposals (CUSTOMER-06).
 */

export const CUSTOMER_MERGE_RESOLUTION_ACTION = Object.freeze({
  KEEP_SURVIVOR: "KEEP_SURVIVOR",
  TAKE_ABSORBED: "TAKE_ABSORBED",
  KEEP_BOTH: "KEEP_BOTH",
  DROP_DUPLICATE: "DROP_DUPLICATE",
  REQUIRE_MANUAL_RESOLUTION: "REQUIRE_MANUAL_RESOLUTION",
  BLOCK_MERGE: "BLOCK_MERGE",
});

export const CUSTOMER_MERGE_RESOLUTION_ACTION_VALUES = Object.freeze(
  Object.values(CUSTOMER_MERGE_RESOLUTION_ACTION)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerMergeResolutionAction(value) {
  return CUSTOMER_MERGE_RESOLUTION_ACTION_VALUES.includes(String(value || ""));
}
