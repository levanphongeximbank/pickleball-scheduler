/**
 * Public visibility (NEWS-01). Domain truth — not UI labels.
 */

export const PUBLIC_VISIBILITY = Object.freeze({
  PUBLIC: "PUBLIC",
  UNLISTED: "UNLISTED",
  PRIVATE: "PRIVATE",
});

export const PUBLIC_VISIBILITY_VALUES = Object.freeze(
  Object.values(PUBLIC_VISIBILITY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPublicVisibility(value) {
  return PUBLIC_VISIBILITY_VALUES.includes(/** @type {string} */ (value));
}

/**
 * Only PUBLIC is eligible for public live read projection.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPubliclyReadableVisibility(value) {
  return value === PUBLIC_VISIBILITY.PUBLIC;
}
