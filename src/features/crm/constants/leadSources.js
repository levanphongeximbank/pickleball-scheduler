/** Canonical lead source types (Phase 1B). */

export const LEAD_SOURCE = Object.freeze({
  WALK_IN: "walk_in",
  PHONE: "phone",
  WEB: "web",
  REFERRAL: "referral",
  BOOKING: "booking",
  CAMPAIGN: "campaign",
  IMPORT: "import",
  OTHER: "other",
});

export const LEAD_SOURCE_VALUES = Object.freeze(Object.values(LEAD_SOURCE));

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isLeadSource(source) {
  return LEAD_SOURCE_VALUES.includes(String(source || ""));
}
