/** @typedef {import('../types/constraintType.js').CompetitionConstraintTypeValue} CompetitionConstraintTypeValue */

export const COMPETITION_CONSTRAINT_TYPE = Object.freeze({
  MUST_PARTNER: "must_partner",
  MUST_NOT_PARTNER: "must_not_partner",
  PREFER_PARTNER: "prefer_partner",
  AVOID_PARTNER: "avoid_partner",
  AVOID_OPPONENT: "avoid_opponent",
  GENDER_ELIGIBILITY: "gender_eligibility",
  MIXED_TEAM_COMPOSITION: "mixed_team_composition",
  SKILL_CAP: "skill_cap",
  TEAM_SKILL_DIFFERENCE: "team_skill_difference",
  CHECKIN_REQUIRED: "checkin_required",
  AVAILABILITY_REQUIRED: "availability_required",
  PLAYER_NOT_BUSY: "player_not_busy",
  LINEUP_VALIDITY: "lineup_validity",
  ENTRY_ELIGIBILITY: "entry_eligibility",
  SAME_CLUB_SEPARATION: "same_club_separation",
  SAME_ORGANIZATION_SEPARATION: "same_organization_separation",
  MAX_PARTNER_REPEAT: "max_partner_repeat",
  MAX_OPPONENT_REPEAT: "max_opponent_repeat",
  MIN_REST_TIME: "min_rest_time",
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
