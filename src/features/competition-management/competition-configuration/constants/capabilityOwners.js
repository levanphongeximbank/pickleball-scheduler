/**
 * Explicit capability / domain owners for CM-04 references.
 * Reuses CM-02 ownership target string vocabulary where overlapping.
 */

export const COMPETITION_CONFIGURATION_CAPABILITY_OWNER = Object.freeze({
  CM04_LOCAL: "cm04_local",
  CM01_DEFINITION: "cm01_definition",
  CORE_RULE_SET: "core_rule_set",
  CORE_DIVISION: "core_division",
  CORE_FORMAT: "core_format",
  CORE_SCHEDULE: "core_schedule",
  CORE_SCORING: "core_scoring",
  CORE_STANDINGS: "core_standings",
  CORE_SEEDING: "core_seeding",
  CORE_DRAW: "core_draw",
  CORE_ELIGIBILITY: "core_eligibility",
  CORE_ROSTER: "core_roster",
  CORE_MATCH_GENERATION: "core_match_generation",
  CORE_COURT_ASSIGNMENT: "core_court_assignment",
  CORE_REFEREE: "core_referee",
  CORE_CONFLICT: "core_conflict",
  CORE_MATCH_LIFECYCLE: "core_match_lifecycle",
  CORE_RESULT_VALIDATION: "core_result_validation",
  CORE_WORKFLOW: "core_workflow",
  DEFERRED: "deferred",
});

export const COMPETITION_CONFIGURATION_CAPABILITY_OWNER_VALUES = Object.freeze(
  Object.values(COMPETITION_CONFIGURATION_CAPABILITY_OWNER)
);

/**
 * Capability owners that currently lack a stable CORE public catalog identity.
 * References may be stored as opaque_proposal or deferred_unsupported only.
 */
export const COMPETITION_CONFIGURATION_DEFERRED_CAPABILITY_OWNERS = Object.freeze([
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_DIVISION,
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_ELIGIBILITY,
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_ROSTER,
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_MATCH_GENERATION,
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_COURT_ASSIGNMENT,
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_REFEREE,
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_CONFLICT,
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_MATCH_LIFECYCLE,
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_RESULT_VALIDATION,
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_WORKFLOW,
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionConfigurationCapabilityOwner(value) {
  return (
    typeof value === "string" &&
    COMPETITION_CONFIGURATION_CAPABILITY_OWNER_VALUES.includes(value)
  );
}
