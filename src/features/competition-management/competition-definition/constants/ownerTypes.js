/**
 * Organizer / owner reference kinds (CM-01).
 * Identity profiles, clubs, and orgs are referenced — not owned.
 */

export const COMPETITION_OWNER_TYPE = Object.freeze({
  USER: "user",
  ORGANIZATION: "organization",
  CLUB: "club",
});

export const COMPETITION_OWNER_TYPE_VALUES = Object.freeze(
  Object.values(COMPETITION_OWNER_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionOwnerType(value) {
  return (
    typeof value === "string" &&
    COMPETITION_OWNER_TYPE_VALUES.includes(value)
  );
}
