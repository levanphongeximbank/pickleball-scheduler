/**
 * Publication / operational states eligible for public catalog listing.
 * Deny-by-default: anything else is not projectable.
 */

export const PUBLIC_CLUB_PUBLICATION_STATE = Object.freeze({
  PUBLISHED: "published",
});

export const PUBLIC_COURT_PUBLICATION_STATE = Object.freeze({
  PUBLISHED: "published",
});

export const PUBLIC_COURT_OPERATIONAL_STATE = Object.freeze({
  ACTIVE: "active",
});

export const PUBLIC_COURT_TYPE = Object.freeze({
  INDOOR: "indoor",
  OUTDOOR: "outdoor",
  COVERED: "covered",
});

export const PUBLIC_COURT_TYPE_VALUES = Object.freeze(
  Object.values(PUBLIC_COURT_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPublicCourtType(value) {
  return PUBLIC_COURT_TYPE_VALUES.includes(value);
}
