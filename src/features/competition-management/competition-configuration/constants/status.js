/**
 * CM-04 configuration status / editability baseline.
 *
 * DRAFT — editable via update-draft / apply-proposal.
 * LOCKED — frozen for editability boundary (e.g. external publication constraint reference).
 *
 * Does NOT own PUBLISHED / SUSPENDED / CANCELLED / ARCHIVED (CM-06..CM-08).
 */

export const COMPETITION_CONFIGURATION_STATUS = Object.freeze({
  DRAFT: "draft",
  LOCKED: "locked",
});

export const COMPETITION_CONFIGURATION_STATUS_VALUES = Object.freeze(
  Object.values(COMPETITION_CONFIGURATION_STATUS)
);

export const COMPETITION_CONFIGURATION_EDITABLE_STATUSES = Object.freeze([
  COMPETITION_CONFIGURATION_STATUS.DRAFT,
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionConfigurationStatus(value) {
  return (
    typeof value === "string" &&
    COMPETITION_CONFIGURATION_STATUS_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isConfigurationEditableStatus(value) {
  return value === COMPETITION_CONFIGURATION_STATUS.DRAFT;
}
