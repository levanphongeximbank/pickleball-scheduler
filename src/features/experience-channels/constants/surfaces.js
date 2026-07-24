/**
 * Supported delivery surfaces.
 * IOS_FUTURE / ANDROID_FUTURE / EMBEDDED_FUTURE are readiness metadata only.
 */

export const EXPERIENCE_CHANNEL_SURFACE = Object.freeze({
  WEB: "WEB",
  PWA: "PWA",
  IOS_FUTURE: "IOS_FUTURE",
  ANDROID_FUTURE: "ANDROID_FUTURE",
  EMBEDDED_FUTURE: "EMBEDDED_FUTURE",
});

export const EXPERIENCE_CHANNEL_SURFACE_VALUES = Object.freeze(
  Object.values(EXPERIENCE_CHANNEL_SURFACE)
);

export const EXPERIENCE_CHANNEL_FUTURE_SURFACES = Object.freeze([
  EXPERIENCE_CHANNEL_SURFACE.IOS_FUTURE,
  EXPERIENCE_CHANNEL_SURFACE.ANDROID_FUTURE,
  EXPERIENCE_CHANNEL_SURFACE.EMBEDDED_FUTURE,
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isExperienceChannelSurface(value) {
  return EXPERIENCE_CHANNEL_SURFACE_VALUES.includes(
    /** @type {string} */ (value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isFutureOnlySurface(value) {
  return EXPERIENCE_CHANNEL_FUTURE_SURFACES.includes(
    /** @type {string} */ (value)
  );
}
