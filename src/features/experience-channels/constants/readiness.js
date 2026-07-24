/**
 * Implementation / readiness states for channel descriptors.
 */

export const EXPERIENCE_CHANNEL_READINESS = Object.freeze({
  IMPLEMENTED: "IMPLEMENTED",
  PARTIAL: "PARTIAL",
  MISSING: "MISSING",
  MOCK: "MOCK",
  DEFERRED: "DEFERRED",
  NOT_VERIFIED: "NOT_VERIFIED",
});

export const EXPERIENCE_CHANNEL_READINESS_VALUES = Object.freeze(
  Object.values(EXPERIENCE_CHANNEL_READINESS)
);

export const EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  LEGACY: "LEGACY",
  FOUNDATION_ONLY: "FOUNDATION_ONLY",
  DEFERRED: "DEFERRED",
  OWNED_ELSEWHERE: "OWNED_ELSEWHERE",
});

export const EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS_VALUES = Object.freeze(
  Object.values(EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isExperienceChannelReadiness(value) {
  return EXPERIENCE_CHANNEL_READINESS_VALUES.includes(
    /** @type {string} */ (value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isExperienceChannelImplementationStatus(value) {
  return EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS_VALUES.includes(
    /** @type {string} */ (value)
  );
}
