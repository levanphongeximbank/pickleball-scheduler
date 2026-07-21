/** Approved Tag assignment target types (Phase 1F). */

export const TAG_TARGET_TYPE = Object.freeze({
  CONTACT_REFERENCE: "CONTACT_REFERENCE",
  LEAD: "LEAD",
  OPPORTUNITY: "OPPORTUNITY",
});

export const TAG_TARGET_TYPE_VALUES = Object.freeze(Object.values(TAG_TARGET_TYPE));

/**
 * @param {string} targetType
 * @returns {boolean}
 */
export function isTagTargetType(targetType) {
  return TAG_TARGET_TYPE_VALUES.includes(String(targetType || ""));
}
