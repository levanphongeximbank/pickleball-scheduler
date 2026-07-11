/** @typedef {import('../types/constraintType.js').CompetitionConstraintTypeValue} CompetitionConstraintTypeValue */

export const COMPETITION_CONSTRAINT_TYPE = Object.freeze({
  MUST_PARTNER: "must_partner",
  MUST_NOT_PARTNER: "must_not_partner",
  PREFER_PARTNER: "prefer_partner",
  AVOID_PARTNER: "avoid_partner",
  GENDER_ELIGIBILITY: "gender_eligibility",
  SKILL_CAP: "skill_cap",
  CHECKIN_REQUIRED: "checkin_required",
  AVAILABILITY_REQUIRED: "availability_required",
  SAME_CLUB_SEPARATION: "same_club_separation",
  SAME_ORGANIZATION_SEPARATION: "same_organization_separation",
});

/** @type {ReadonlySet<CompetitionConstraintTypeValue>} */
export const COMPETITION_CONSTRAINT_TYPE_VALUES = new Set(
  Object.values(COMPETITION_CONSTRAINT_TYPE)
);

/**
 * @param {unknown} value
 * @returns {value is CompetitionConstraintTypeValue}
 */
export function isCompetitionConstraintType(value) {
  return (
    typeof value === "string" &&
    COMPETITION_CONSTRAINT_TYPE_VALUES.has(/** @type {CompetitionConstraintTypeValue} */ (value))
  );
}
