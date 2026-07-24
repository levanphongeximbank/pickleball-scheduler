/**
 * Stable Public Portal surface identifiers (EC-01).
 * Inventory only — no route registration side effects.
 */

export const PUBLIC_PORTAL_SURFACE_ID = Object.freeze({
  PUBLIC_ROOT: "public-root",
  PUBLIC_HOME: "public-home",
  PUBLIC_TOURNAMENTS: "public-tournaments",
  PUBLIC_CLUBS: "public-clubs",
  PUBLIC_COURTS: "public-courts",
  PUBLIC_RANKINGS: "public-rankings",
  PUBLIC_NEWS: "public-news",
});

export const PUBLIC_PORTAL_SURFACE_ID_VALUES = Object.freeze(
  Object.values(PUBLIC_PORTAL_SURFACE_ID)
);

/**
 * Adjacent surfaces that look "public" but are not Public Portal–owned.
 * Documented for collision / ownership alignment only.
 */
export const PUBLIC_PORTAL_BOUNDARY_ID = Object.freeze({
  ATHLETES_DIRECTORY: "boundary-athletes-directory",
  TOURNAMENT_PUBLIC_VIEW: "boundary-tournament-public-view",
});

export const PUBLIC_PORTAL_BOUNDARY_ID_VALUES = Object.freeze(
  Object.values(PUBLIC_PORTAL_BOUNDARY_ID)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPublicPortalSurfaceId(value) {
  return PUBLIC_PORTAL_SURFACE_ID_VALUES.includes(/** @type {string} */ (value));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPublicPortalBoundaryId(value) {
  return PUBLIC_PORTAL_BOUNDARY_ID_VALUES.includes(/** @type {string} */ (value));
}
