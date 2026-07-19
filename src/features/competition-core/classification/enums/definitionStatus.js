/** Lifecycle for CompetitionDivision and CompetitionCategory definitions. */
export const DEFINITION_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
});

/** @type {ReadonlySet<string>} */
export const DEFINITION_STATUS_VALUES = new Set(Object.values(DEFINITION_STATUS));

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isDefinitionStatus(value) {
  return typeof value === "string" && DEFINITION_STATUS_VALUES.has(value);
}
