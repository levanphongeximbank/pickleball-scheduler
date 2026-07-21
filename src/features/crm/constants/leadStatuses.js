/** Canonical lead statuses (Phase 1B foundation — lifecycle transitions in 1C+). */

export const LEAD_STATUS = Object.freeze({
  NEW: "new",
  CONTACTED: "contacted",
  QUALIFIED: "qualified",
  UNQUALIFIED: "unqualified",
  CONVERTED: "converted",
  ARCHIVED: "archived",
});

export const LEAD_STATUS_VALUES = Object.freeze(Object.values(LEAD_STATUS));

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isLeadStatus(status) {
  return LEAD_STATUS_VALUES.includes(String(status || ""));
}
