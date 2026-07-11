/** Canonical rule engine error codes — CC-03A. */
export const RULE_ERROR_CODE = Object.freeze({
  CONSTRAINT_CONFLICT: "constraint_conflict",
  DUPLICATE_CONSTRAINT_ID: "duplicate_constraint_id",
  INVALID_CONSTRAINT_TYPE: "invalid_constraint_type",
  INVALID_CONSTRAINT_PARAMS: "invalid_constraint_params",
  CONTRADICTORY_MUST_MUST_NOT: "contradictory_must_must_not",
  CONTRADICTORY_MUST_AVOID: "contradictory_must_avoid",
  UNSATISFIABLE_MUST_PARTNER: "unsatisfiable_must_partner",
  MUST_PARTNER_UNSATISFIED: "must_partner_unsatisfied",
  MUST_NOT_PARTNER_VIOLATED: "must_not_partner_violated",
  AVOID_PARTNER_VIOLATED: "avoid_partner_violated",
  PREFER_PARTNER_MISSED: "prefer_partner_missed",
  SAME_CLUB_SEPARATION_VIOLATED: "same_club_separation_violated",
  SAME_ORGANIZATION_SEPARATION_VIOLATED: "same_organization_separation_violated",
  GENDER_ELIGIBILITY_VIOLATED: "gender_eligibility_violated",
  SKILL_CAP_EXCEEDED: "skill_cap_exceeded",
  CHECKIN_REQUIRED_MISSING: "checkin_required_missing",
  AVAILABILITY_REQUIRED_MISSING: "availability_required_missing",
  UNSUPPORTED_SCOPE: "unsupported_scope",
});

export const RULE_ENGINE_VERSION = "cc03a-v1";

export const DEFAULT_RULE_SET_ID = "competition-core-default";

export const DEFAULT_RULE_SET_VERSION = "1";

/** Soft-score weights — never used to simulate hard rejection. */
export const RULE_SOFT_SCORE = Object.freeze({
  preferPartnerMatchBonus: 120,
  preferPartnerMissPenalty: 40,
  avoidPartnerViolationPenalty: 200,
  sameClubSeparationPenalty: 250,
  sameOrganizationSeparationPenalty: 200,
  skillCapOverPenaltyPerStep: 20,
});

/** @type {Readonly<Record<string, import('../constants/constraintSeverity.js').ConstraintSeverityValue>>} */
export const DEFAULT_SEVERITY_BY_CONSTRAINT_TYPE = Object.freeze({
  must_partner: "hard",
  must_not_partner: "hard",
  prefer_partner: "soft",
  avoid_partner: "soft",
  gender_eligibility: "hard",
  skill_cap: "soft",
  checkin_required: "hard",
  availability_required: "hard",
  same_club_separation: "soft",
  same_organization_separation: "soft",
});

/** Legacy alias → canonical constraint type. */
export const LEGACY_CONSTRAINT_TYPE_ALIASES = Object.freeze({
  avoid_same_group: "same_club_separation",
  avoid_teammate: "avoid_partner",
  prefer_teammate: "prefer_partner",
});
