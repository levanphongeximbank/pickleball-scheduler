/**
 * Public Portal data-source classification (EC-01).
 * Presentation inventory only — not runtime feature flags.
 */

export const PUBLIC_PORTAL_DATA_SOURCE = Object.freeze({
  LIVE: "LIVE",
  MOCK: "MOCK",
  PREVIEW: "PREVIEW",
  MIXED: "MIXED",
  UNKNOWN: "UNKNOWN",
});

export const PUBLIC_PORTAL_DATA_SOURCE_VALUES = Object.freeze(
  Object.values(PUBLIC_PORTAL_DATA_SOURCE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPublicPortalDataSource(value) {
  return PUBLIC_PORTAL_DATA_SOURCE_VALUES.includes(/** @type {string} */ (value));
}

export const PUBLIC_PORTAL_AUTH_DEPENDENCY = Object.freeze({
  NONE: "NONE",
  OPTIONAL_CONSUMED: "OPTIONAL_CONSUMED",
  REQUIRED: "REQUIRED",
});

export const PUBLIC_PORTAL_AUTH_DEPENDENCY_VALUES = Object.freeze(
  Object.values(PUBLIC_PORTAL_AUTH_DEPENDENCY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPublicPortalAuthDependency(value) {
  return PUBLIC_PORTAL_AUTH_DEPENDENCY_VALUES.includes(/** @type {string} */ (value));
}

export const PUBLIC_PORTAL_TENANT_DEPENDENCY = Object.freeze({
  NONE: "NONE",
  CONSUMED_SHARED: "CONSUMED_SHARED",
});

export const PUBLIC_PORTAL_TENANT_DEPENDENCY_VALUES = Object.freeze(
  Object.values(PUBLIC_PORTAL_TENANT_DEPENDENCY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPublicPortalTenantDependency(value) {
  return PUBLIC_PORTAL_TENANT_DEPENDENCY_VALUES.includes(
    /** @type {string} */ (value)
  );
}

/**
 * Competition presentation ownership marker for public surfaces.
 * Does not encode standings/scoring/eligibility rules.
 */
export const PUBLIC_PORTAL_COMPETITION_MARKER = Object.freeze({
  NONE: "NONE",
  PRESENTATION_ONLY: "PRESENTATION_ONLY",
  TOURNAMENT_OPS_DEFERRED: "TOURNAMENT_OPS_DEFERRED",
  COMPETITION_E2E_OWNED: "COMPETITION_E2E_OWNED",
});

export const PUBLIC_PORTAL_COMPETITION_MARKER_VALUES = Object.freeze(
  Object.values(PUBLIC_PORTAL_COMPETITION_MARKER)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPublicPortalCompetitionMarker(value) {
  return PUBLIC_PORTAL_COMPETITION_MARKER_VALUES.includes(
    /** @type {string} */ (value)
  );
}
