/**
 * High-level experience channel categories.
 */

export const EXPERIENCE_CHANNEL_CATEGORY = Object.freeze({
  PUBLIC: "PUBLIC",
  AUTHENTICATION: "AUTHENTICATION",
  APP_SHELL: "APP_SHELL",
  DASHBOARD: "DASHBOARD",
  PLAYER: "PLAYER",
  CLUB: "CLUB",
  VENUE: "VENUE",
  CUSTOMER: "CUSTOMER",
  NOTIFICATION: "NOTIFICATION",
  MESSAGING: "MESSAGING",
  MOBILE: "MOBILE",
  PWA: "PWA",
  TOURNAMENT: "TOURNAMENT",
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  COMPETITION_ENGINE: "COMPETITION_ENGINE",
  FOUNDATION: "FOUNDATION",
});

export const EXPERIENCE_CHANNEL_CATEGORY_VALUES = Object.freeze(
  Object.values(EXPERIENCE_CHANNEL_CATEGORY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isExperienceChannelCategory(value) {
  return EXPERIENCE_CHANNEL_CATEGORY_VALUES.includes(
    /** @type {string} */ (value)
  );
}
