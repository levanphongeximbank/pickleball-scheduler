/**
 * Content provenance for public read models (NEWS-01).
 *
 * News owns content provenance. Experience Channels owns a related presentation
 * classification (`PUBLIC_PORTAL_DATA_SOURCE`) — that contract is presentation
 * inventory only and must not be imported here (forbidden reverse dependency).
 *
 * Values align intentionally with LIVE / MOCK / PREVIEW so NEWS-04 can map
 * without silent fallback.
 */

export const CONTENT_PROVENANCE = Object.freeze({
  LIVE: "LIVE",
  MOCK: "MOCK",
  PREVIEW: "PREVIEW",
});

export const CONTENT_PROVENANCE_VALUES = Object.freeze(
  Object.values(CONTENT_PROVENANCE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isContentProvenance(value) {
  return CONTENT_PROVENANCE_VALUES.includes(/** @type {string} */ (value));
}
