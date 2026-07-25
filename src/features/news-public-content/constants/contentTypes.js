/**
 * Canonical content types (NEWS-01). Domain truth — not UI labels.
 */

export const CONTENT_TYPE = Object.freeze({
  NEWS: "NEWS",
  ARTICLE: "ARTICLE",
  ANNOUNCEMENT: "ANNOUNCEMENT",
  TOURNAMENT_CONTENT: "TOURNAMENT_CONTENT",
  VENUE_CONTENT: "VENUE_CONTENT",
  CLUB_CONTENT: "CLUB_CONTENT",
  BANNER: "BANNER",
  SPONSOR_CONTENT: "SPONSOR_CONTENT",
});

export const CONTENT_TYPE_VALUES = Object.freeze(Object.values(CONTENT_TYPE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isContentType(value) {
  return CONTENT_TYPE_VALUES.includes(/** @type {string} */ (value));
}
