/**
 * Canonical content scopes (NEWS-01). Domain truth — not UI labels.
 */

export const CONTENT_SCOPE = Object.freeze({
  PLATFORM: "PLATFORM",
  TENANT: "TENANT",
  VENUE: "VENUE",
  CLUB: "CLUB",
  COMPETITION: "COMPETITION",
});

export const CONTENT_SCOPE_VALUES = Object.freeze(Object.values(CONTENT_SCOPE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isContentScope(value) {
  return CONTENT_SCOPE_VALUES.includes(/** @type {string} */ (value));
}
