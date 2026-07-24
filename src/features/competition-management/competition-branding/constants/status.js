/**
 * CM-05 branding status / editability baseline.
 *
 * DRAFT — editable via update-draft.
 * LOCKED — frozen for editability boundary (external publication constraint reference).
 *
 * Does NOT own PUBLISHED / SUSPENDED / CANCELLED / ARCHIVED (CM-06..CM-08).
 */

export const COMPETITION_BRANDING_STATUS = Object.freeze({
  DRAFT: "draft",
  LOCKED: "locked",
});

export const COMPETITION_BRANDING_STATUS_VALUES = Object.freeze(
  Object.values(COMPETITION_BRANDING_STATUS)
);

export const COMPETITION_BRANDING_EDITABLE_STATUSES = Object.freeze([
  COMPETITION_BRANDING_STATUS.DRAFT,
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionBrandingStatus(value) {
  return (
    typeof value === "string" &&
    COMPETITION_BRANDING_STATUS_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isBrandingEditableStatus(value) {
  return value === COMPETITION_BRANDING_STATUS.DRAFT;
}
