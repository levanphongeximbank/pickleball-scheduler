/** Phase 1D capacity & waitlist operation identifiers (audit + service result). */
export const CAPACITY_WAITLIST_OPERATION = Object.freeze({
  EVALUATE_CAPACITY: "EVALUATE_CAPACITY",
  RESERVE_CAPACITY: "RESERVE_CAPACITY",
  RELEASE_CAPACITY: "RELEASE_CAPACITY",
  PLACE_ON_WAITLIST: "PLACE_ON_WAITLIST",
  WITHDRAW_WAITLISTED: "WITHDRAW_WAITLISTED",
  GET_WAITLIST_POSITION: "GET_WAITLIST_POSITION",
  LIST_WAITLIST: "LIST_WAITLIST",
  SELECT_PROMOTION_CANDIDATES: "SELECT_PROMOTION_CANDIDATES",
  PROMOTE_WAITLISTED: "PROMOTE_WAITLISTED",
});

/** @type {ReadonlySet<string>} */
export const CAPACITY_WAITLIST_OPERATION_VALUES = new Set(
  Object.values(CAPACITY_WAITLIST_OPERATION)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCapacityWaitlistOperation(value) {
  return typeof value === "string" && CAPACITY_WAITLIST_OPERATION_VALUES.has(value);
}

/** System actor for automated capacity/waitlist operations. */
export const CAPACITY_WAITLIST_SYSTEM_ACTOR = "system:capacity-waitlist";
