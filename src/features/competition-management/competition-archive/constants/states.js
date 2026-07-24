/**
 * CM-08 effective competition archive states.
 *
 * Distinct from CM-01 management status, CM-06 publication status,
 * CM-07 lifecycle interruption (ACTIVE/SUSPENDED/CANCELLED),
 * soft-delete, purge, and completion.
 */

export const COMPETITION_ARCHIVE_STATE = Object.freeze({
  UNARCHIVED: "UNARCHIVED",
  ARCHIVED: "ARCHIVED",
});

export const COMPETITION_ARCHIVE_STATE_VALUES = Object.freeze(
  Object.values(COMPETITION_ARCHIVE_STATE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionArchiveState(value) {
  return (
    typeof value === "string" &&
    COMPETITION_ARCHIVE_STATE_VALUES.includes(value)
  );
}
