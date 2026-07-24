/**
 * Explicit ownership targets for instantiation proposal fragments (CM-02).
 * CM-02 proposes references; it does not execute ownership of these modules.
 */

export const COMPETITION_TEMPLATE_OWNERSHIP_TARGET = Object.freeze({
  CM01_DEFINITION: "cm01_definition",
  CM04_CONFIGURATION: "cm04_configuration",
  CORE_RULE_SET: "core_rule_set",
  CORE_DIVISION: "core_division",
  CORE_FORMAT: "core_format",
  CORE_SCHEDULE: "core_schedule",
  CORE_SCORING: "core_scoring",
  CORE_STANDINGS: "core_standings",
  DEFERRED: "deferred",
});

export const COMPETITION_TEMPLATE_OWNERSHIP_TARGET_VALUES = Object.freeze(
  Object.values(COMPETITION_TEMPLATE_OWNERSHIP_TARGET)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionTemplateOwnershipTarget(value) {
  return (
    typeof value === "string" &&
    COMPETITION_TEMPLATE_OWNERSHIP_TARGET_VALUES.includes(value)
  );
}
