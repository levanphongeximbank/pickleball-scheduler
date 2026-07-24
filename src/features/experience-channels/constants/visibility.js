/**
 * Channel visibility contract (presentation ownership only).
 */

export const EXPERIENCE_CHANNEL_VISIBILITY = Object.freeze({
  PUBLIC: "PUBLIC",
  AUTHENTICATED: "AUTHENTICATED",
  TENANT_SCOPED: "TENANT_SCOPED",
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
});

export const EXPERIENCE_CHANNEL_VISIBILITY_VALUES = Object.freeze(
  Object.values(EXPERIENCE_CHANNEL_VISIBILITY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isExperienceChannelVisibility(value) {
  return EXPERIENCE_CHANNEL_VISIBILITY_VALUES.includes(
    /** @type {string} */ (value)
  );
}
