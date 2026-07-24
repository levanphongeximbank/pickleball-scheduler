/**
 * Canonical CM-04 configuration section identities.
 * Explicit references + validated parameters only — not Competition Core runtime state.
 */

export const COMPETITION_CONFIGURATION_SECTION = Object.freeze({
  PARTICIPANT_MODE: "participant_mode",
  FORMAT: "format",
  REGISTRATION_POLICY: "registration_policy",
  ELIGIBILITY: "eligibility",
  DIVISION: "division",
  ROSTER: "roster",
  SEEDING: "seeding",
  DRAW: "draw",
  MATCH_FORMAT: "match_format",
  MATCH_GENERATION: "match_generation",
  SCHEDULING: "scheduling",
  COURT_ASSIGNMENT: "court_assignment",
  REFEREE: "referee",
  CONFLICT_RESOLUTION: "conflict_resolution",
  MATCH_LIFECYCLE: "match_lifecycle",
  SCORING: "scoring",
  RESULT_VALIDATION: "result_validation",
  STANDINGS: "standings",
  WORKFLOW: "workflow",
  OFFICIAL_MODE: "official_mode",
  OPERATIONAL_LIMITS: "operational_limits",
});

export const COMPETITION_CONFIGURATION_SECTION_VALUES = Object.freeze(
  Object.values(COMPETITION_CONFIGURATION_SECTION)
);

/** Sections that require team (or mixed) participant mode. */
export const COMPETITION_CONFIGURATION_TEAM_ONLY_SECTIONS = Object.freeze([
  COMPETITION_CONFIGURATION_SECTION.ROSTER,
]);

/** Sections that are individual-oriented (rejected on pure team competitions). */
export const COMPETITION_CONFIGURATION_INDIVIDUAL_ONLY_SECTIONS = Object.freeze([
  // Reserved empty set — individual constraints are expressed via participant_mode
  // and type compatibility rather than exclusive section ownership today.
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionConfigurationSection(value) {
  return (
    typeof value === "string" &&
    COMPETITION_CONFIGURATION_SECTION_VALUES.includes(value)
  );
}
