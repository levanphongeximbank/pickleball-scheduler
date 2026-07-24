/**
 * CM-08 archive actions (immutable decision record kinds).
 */

export const COMPETITION_ARCHIVE_ACTION = Object.freeze({
  ARCHIVE: "ARCHIVE",
  UNARCHIVE: "UNARCHIVE",
});

export const COMPETITION_ARCHIVE_ACTION_VALUES = Object.freeze(
  Object.values(COMPETITION_ARCHIVE_ACTION)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionArchiveAction(value) {
  return (
    typeof value === "string" &&
    COMPETITION_ARCHIVE_ACTION_VALUES.includes(value)
  );
}
