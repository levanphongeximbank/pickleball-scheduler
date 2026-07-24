/**
 * Stable experience-channel identifiers (EC-00).
 * Presentation/channel ownership only — no business rules.
 */

export const EXPERIENCE_CHANNEL_ID = Object.freeze({
  PUBLIC_PORTAL: "public-portal",
  AUTH: "auth",
  APP_SHELL: "app-shell",
  DASHBOARD: "dashboard",
  PLAYER: "player",
  CLUB: "club",
  VENUE_OPS: "venue-ops",
  CUSTOMER_OPS: "customer-ops",
  NOTIFICATIONS: "notifications",
  MESSAGING: "messaging",
  MOBILE: "mobile",
  PWA: "pwa",
  TOURNAMENT_OPS: "tournament-ops",
  PLATFORM_ADMIN: "platform-admin",
  COMPETITION_ENGINE_E2E: "competition-engine-e2e",
  EXPERIENCE_CHANNELS_FOUNDATION: "experience-channels-foundation",
});

export const EXPERIENCE_CHANNEL_ID_VALUES = Object.freeze(
  Object.values(EXPERIENCE_CHANNEL_ID)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isExperienceChannelId(value) {
  return EXPERIENCE_CHANNEL_ID_VALUES.includes(/** @type {string} */ (value));
}
