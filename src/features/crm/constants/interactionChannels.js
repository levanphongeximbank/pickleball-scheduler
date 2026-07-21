/** Canonical CRM interaction channels (Phase 1E). */

export const INTERACTION_CHANNEL = Object.freeze({
  PHONE: "phone",
  EMAIL: "email",
  SMS: "sms",
  IN_PERSON: "in_person",
  CHAT: "chat",
  SYSTEM: "system",
  OTHER: "other",
});

export const INTERACTION_CHANNEL_VALUES = Object.freeze(
  Object.values(INTERACTION_CHANNEL)
);

/**
 * @param {string} channel
 * @returns {boolean}
 */
export function isInteractionChannel(channel) {
  return INTERACTION_CHANNEL_VALUES.includes(String(channel || ""));
}
