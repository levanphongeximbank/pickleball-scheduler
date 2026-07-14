/** Canonical rule engine error codes — CC-03A. */
export const RULE_ERROR_CODE = Object.freeze({
  CONSTRAINT_CONFLICT: "constraint_conflict",
  DUPLICATE_CONSTRAINT_ID: "duplicate_constraint_id",
  INVALID_CONSTRAINT_TYPE: "invalid_constraint_type",
  INVALID_CONSTRAINT_PARAMS: "invalid_constraint_params",
  CONTRADICTORY_MUST_MUST_NOT: "contradictory_must_must_not",
  CONTRADICTORY_MUST_AVOID: "contradictory_must_avoid",
  UNSATISFIABLE_MUST_PARTNER: "unsatisfiable_must_partner",
  MUST_PARTNER_COMPONENT_EXCEEDS_TEAM_SIZE: "must_partner_component_exceeds_team_size",
  CONTRADICTORY_MIXED_GENDER: "contradictory_mixed_gender",
  CONTRADICTORY_AVAILABILITY: "contradictory_availability",
  CONTRADICTORY_SKILL_CAP: "contradictory_skill_cap",
  RULE_NOT_APPLICABLE: "rule_not_applicable",
  RULE_SET_LOCKED: "rule_set_locked",
  RULE_SET_NOT_EFFECTIVE: "rule_set_not_effective",
  MUST_PARTNER_UNSATISFIED: "must_partner_unsatisfied",
  MUST_NOT_PARTNER_VIOLATED: "must_not_partner_violated",
  AVOID_PARTNER_VIOLATED: "avoid_partner_violated",
  AVOID_OPPONENT_VIOLATED: "avoid_opponent_violated",
  PREFER_PARTNER_MISSED: "prefer_partner_missed",
  SAME_CLUB_SEPARATION_VIOLATED: "same_club_separation_violated",
  SAME_ORGANIZATION_SEPARATION_VIOLATED: "same_organization_separation_violated",
  GENDER_ELIGIBILITY_VIOLATED: "gender_eligibility_violated",
  MIXED_TEAM_COMPOSITION_VIOLATED: "mixed_team_composition_violated",
  SKILL_CAP_EXCEEDED: "skill_cap_exceeded",
  TEAM_SKILL_DIFFERENCE_EXCEEDED: "team_skill_difference_exceeded",
  CHECKIN_REQUIRED_MISSING: "checkin_required_missing",
  AVAILABILITY_REQUIRED_MISSING: "availability_required_missing",
  PLAYER_BUSY: "player_busy",
  LINEUP_VALIDITY_VIOLATED: "lineup_validity_violated",
  ENTRY_ELIGIBILITY_VIOLATED: "entry_eligibility_violated",
  MAX_PARTNER_REPEAT_EXCEEDED: "max_partner_repeat_exceeded",
  MAX_OPPONENT_REPEAT_EXCEEDED: "max_opponent_repeat_exceeded",
  MIN_REST_TIME_VIOLATED: "min_rest_time_violated",
  UNSUPPORTED_SCOPE: "unsupported_scope",
  RULES_V2_CONTEXT_MISSING: "rules_v2_context_missing",
  RULES_V2_MAPPING_ERROR: "rules_v2_mapping_error",
  RULES_V2_CONFLICT: "rules_v2_conflict",
  RULES_V2_EVALUATION_FAILED: "rules_v2_evaluation_failed",
  RULES_V2_UNSUPPORTED_LEGACY_RULE: "rules_v2_unsupported_legacy_rule",
  RULES_V2_DUPLICATE_DECISION: "rules_v2_duplicate_decision",
  RULES_V2_DOUBLE_COUNT_DETECTED: "rules_v2_double_count_detected",
});

export const RULE_ENGINE_VERSION = "cc03a-v2";

export const DEFAULT_RULE_SET_ID = "competition-core-default";

export const DEFAULT_RULE_SET_VERSION = "1";

/** Soft-score weights — never used to simulate hard rejection. */
export const RULE_SOFT_SCORE = Object.freeze({
  preferPartnerMatchBonus: 120,
  preferPartnerMissPenalty: 40,
  avoidPartnerViolationPenalty: 200,
  avoidOpponentViolationPenalty: 180,
  sameClubSeparationPenalty: 250,
  sameOrganizationSeparationPenalty: 200,
  skillCapOverPenaltyPerStep: 20,
  teamSkillDiffPenaltyPerStep: 25,
  maxPartnerRepeatPenalty: 150,
  maxOpponentRepeatPenalty: 120,
  minRestTimePenalty: 100,
});

/** @type {Readonly<Record<string, import('../constants/constraintSeverity.js').ConstraintSeverityValue>>} */
export const DEFAULT_SEVERITY_BY_CONSTRAINT_TYPE = Object.freeze({
  must_partner: "hard",
  must_not_partner: "hard",
  prefer_partner: "soft",
  avoid_partner: "soft",
  prefer_opponent: "soft",
  must_opponent: "hard",
  avoid_opponent: "soft",
  must_not_opponent: "hard",
  gender_eligibility: "hard",
  mixed_team_composition: "hard",
  skill_cap: "soft",
  team_skill_difference: "soft",
  checkin_required: "hard",
  availability_required: "hard",
  player_not_busy: "hard",
  lineup_validity: "hard",
  entry_eligibility: "hard",
  same_club_separation: "soft",
  same_organization_separation: "soft",
  same_group: "soft",
  different_group: "soft",
  same_team: "soft",
  different_team: "soft",
  max_partner_repeat: "soft",
  max_opponent_repeat: "soft",
  min_partner_repeat: "soft",
  min_opponent_repeat: "soft",
  min_rest_time: "soft",
});

/** Legacy alias → canonical constraint type. */
export const LEGACY_CONSTRAINT_TYPE_ALIASES = Object.freeze({
  avoid_same_group: "same_club_separation",
  avoid_teammate: "avoid_partner",
  prefer_teammate: "prefer_partner",
  mixed_double: "mixed_team_composition",
});

/** Human-readable titles for explainability. */
export const RULE_ERROR_TITLES = Object.freeze({
  [RULE_ERROR_CODE.MUST_NOT_PARTNER_VIOLATED]: "Must-not partner violated",
  [RULE_ERROR_CODE.MUST_PARTNER_UNSATISFIED]: "Must-partner unsatisfied",
  [RULE_ERROR_CODE.MIXED_TEAM_COMPOSITION_VIOLATED]: "Mixed team composition invalid",
  [RULE_ERROR_CODE.SKILL_CAP_EXCEEDED]: "Skill cap exceeded",
  [RULE_ERROR_CODE.CHECKIN_REQUIRED_MISSING]: "Check-in required",
  [RULE_ERROR_CODE.AVAILABILITY_REQUIRED_MISSING]: "Player unavailable",
  [RULE_ERROR_CODE.PLAYER_BUSY]: "Player busy",
  [RULE_ERROR_CODE.PREFER_PARTNER_MISSED]: "Preferred partner missed",
  [RULE_ERROR_CODE.AVOID_PARTNER_VIOLATED]: "Avoid partner violated",
  [RULE_ERROR_CODE.SAME_CLUB_SEPARATION_VIOLATED]: "Same club separation",
  [RULE_ERROR_CODE.MAX_PARTNER_REPEAT_EXCEEDED]: "Max partner repeat exceeded",
  [RULE_ERROR_CODE.MAX_OPPONENT_REPEAT_EXCEEDED]: "Max opponent repeat exceeded",
  [RULE_ERROR_CODE.INVALID_CONSTRAINT_PARAMS]: "Invalid constraint parameters",
});

/** Default suggested resolutions for common violations. */
export const RULE_SUGGESTED_RESOLUTIONS = Object.freeze({
  [RULE_ERROR_CODE.MUST_NOT_PARTNER_VIOLATED]: "Move one player to a different team.",
  [RULE_ERROR_CODE.MUST_PARTNER_UNSATISFIED]: "Place required partners on the same team.",
  [RULE_ERROR_CODE.MIXED_TEAM_COMPOSITION_VIOLATED]: "Ensure each team has one male and one female player.",
  [RULE_ERROR_CODE.SKILL_CAP_EXCEEDED]: "Rebalance teams to reduce skill difference.",
  [RULE_ERROR_CODE.CHECKIN_REQUIRED_MISSING]: "Check in the player before pairing.",
  [RULE_ERROR_CODE.AVAILABILITY_REQUIRED_MISSING]: "Select an available player or update availability.",
  [RULE_ERROR_CODE.PLAYER_BUSY]: "Wait until the player is free or choose a substitute.",
  [RULE_ERROR_CODE.PREFER_PARTNER_MISSED]: "Pair preferred partners if feasible.",
  [RULE_ERROR_CODE.AVOID_PARTNER_VIOLATED]: "Separate the players onto different teams.",
  [RULE_ERROR_CODE.SAME_CLUB_SEPARATION_VIOLATED]: "Spread same-club players across groups.",
  [RULE_ERROR_CODE.MAX_PARTNER_REPEAT_EXCEEDED]: "Pair with a different partner this round.",
  [RULE_ERROR_CODE.MAX_OPPONENT_REPEAT_EXCEEDED]: "Schedule a different opponent pairing.",
  [RULE_ERROR_CODE.INVALID_CONSTRAINT_PARAMS]: "Fix constraint configuration before evaluation.",
});
