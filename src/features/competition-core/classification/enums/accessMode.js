export const ACCESS_MODE = Object.freeze({
  OPEN: "open",
  RESTRICTED: "restricted",
});

/** @type {ReadonlySet<string>} */
export const ACCESS_MODE_VALUES = new Set(Object.values(ACCESS_MODE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isAccessMode(value) {
  return typeof value === "string" && ACCESS_MODE_VALUES.has(value);
}
