/** Approved communication consent channels (Phase 1F). */

export const CONSENT_CHANNEL = Object.freeze({
  EMAIL: "EMAIL",
  SMS: "SMS",
  PHONE: "PHONE",
  PUSH: "PUSH",
});

export const CONSENT_CHANNEL_VALUES = Object.freeze(Object.values(CONSENT_CHANNEL));

/**
 * @param {string} channel
 * @returns {boolean}
 */
export function isConsentChannel(channel) {
  return CONSENT_CHANNEL_VALUES.includes(String(channel || ""));
}
