/**
 * Template ownership / catalog scope (CM-02).
 * Distinct from CompetitionDefinition.scope (club/multi_club/tenant/open).
 */

export const COMPETITION_TEMPLATE_SCOPE = Object.freeze({
  GLOBAL: "global",
  TENANT: "tenant",
});

export const COMPETITION_TEMPLATE_SCOPE_VALUES = Object.freeze(
  Object.values(COMPETITION_TEMPLATE_SCOPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionTemplateScope(value) {
  return (
    typeof value === "string" &&
    COMPETITION_TEMPLATE_SCOPE_VALUES.includes(value)
  );
}
