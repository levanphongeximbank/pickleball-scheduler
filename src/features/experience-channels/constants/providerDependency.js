/**
 * Provider dependency classification for shell/channel boundaries.
 */

export const EXPERIENCE_PROVIDER_DEPENDENCY = Object.freeze({
  OWNED: "OWNED",
  CONSUMED_SHARED: "CONSUMED_SHARED",
  FORBIDDEN_FOR_EC00: "FORBIDDEN_FOR_EC00",
  DEFERRED: "DEFERRED",
});

export const EXPERIENCE_PROVIDER_DEPENDENCY_VALUES = Object.freeze(
  Object.values(EXPERIENCE_PROVIDER_DEPENDENCY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isExperienceProviderDependency(value) {
  return EXPERIENCE_PROVIDER_DEPENDENCY_VALUES.includes(
    /** @type {string} */ (value)
  );
}
