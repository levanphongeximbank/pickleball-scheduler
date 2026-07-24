/**
 * Branding comparison change types + fingerprint algorithm (CM-05).
 */

export const COMPETITION_BRANDING_CHANGE_TYPE = Object.freeze({
  ADDED: "ADDED",
  REMOVED: "REMOVED",
  CHANGED: "CHANGED",
});

export const COMPETITION_BRANDING_CHANGE_TYPE_VALUES = Object.freeze(
  Object.values(COMPETITION_BRANDING_CHANGE_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionBrandingChangeType(value) {
  return (
    typeof value === "string" &&
    COMPETITION_BRANDING_CHANGE_TYPE_VALUES.includes(value)
  );
}

/** Fingerprint algorithm for branding snapshot (not CORE-21 ownership). */
export const COMPETITION_BRANDING_FINGERPRINT_ALGORITHM = Object.freeze({
  id: "cm05-fnv1a32-v1",
  prefix: "cm05-",
  version: 1,
});
