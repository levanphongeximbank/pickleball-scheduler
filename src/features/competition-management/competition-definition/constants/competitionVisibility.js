/**
 * Competition listing/visibility baseline (CM-01).
 * Distinct from CORE-06 lineup visibility and private-pairing rule visibility.
 */

export const COMPETITION_VISIBILITY = Object.freeze({
  PRIVATE: "private",
  CLUB: "club",
  TENANT: "tenant",
  PUBLIC: "public",
});

export const COMPETITION_VISIBILITY_VALUES = Object.freeze(
  Object.values(COMPETITION_VISIBILITY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionVisibility(value) {
  return (
    typeof value === "string" &&
    COMPETITION_VISIBILITY_VALUES.includes(value)
  );
}
