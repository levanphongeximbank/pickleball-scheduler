export const GENDER_CLASS = Object.freeze({
  MALE: "male",
  FEMALE: "female",
  MIXED: "mixed",
  OPEN: "open",
  UNSPECIFIED: "unspecified",
});

/** @type {ReadonlySet<string>} */
export const GENDER_CLASS_VALUES = new Set(Object.values(GENDER_CLASS));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isGenderClass(value) {
  return typeof value === "string" && GENDER_CLASS_VALUES.has(value);
}
