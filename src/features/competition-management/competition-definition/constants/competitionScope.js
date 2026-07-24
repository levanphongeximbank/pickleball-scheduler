/**
 * Canonical competition scope (CM-01).
 */

export const COMPETITION_SCOPE = Object.freeze({
  CLUB: "club",
  MULTI_CLUB: "multi_club",
  TENANT: "tenant",
  OPEN: "open",
});

export const COMPETITION_SCOPE_VALUES = Object.freeze(
  Object.values(COMPETITION_SCOPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionScope(value) {
  return (
    typeof value === "string" &&
    COMPETITION_SCOPE_VALUES.includes(value)
  );
}
