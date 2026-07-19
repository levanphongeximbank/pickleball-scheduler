/** Distinct entity kinds — OD-07 + DivisionCategory relation. */
export const CLASSIFICATION_ENTITY_KIND = Object.freeze({
  DIVISION: "competition_division",
  CATEGORY: "competition_category",
  DIVISION_CATEGORY: "competition_division_category",
});

/** @type {ReadonlySet<string>} */
export const CLASSIFICATION_ENTITY_KIND_VALUES = new Set(
  Object.values(CLASSIFICATION_ENTITY_KIND)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isClassificationEntityKind(value) {
  return typeof value === "string" && CLASSIFICATION_ENTITY_KIND_VALUES.has(value);
}
