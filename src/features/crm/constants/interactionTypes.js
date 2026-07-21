/** Canonical CRM interaction types (Phase 1B). */

export const INTERACTION_TYPE = Object.freeze({
  NOTE: "note",
  CALL: "call",
  MESSAGE: "message",
  MEETING: "meeting",
  EMAIL: "email",
  SYSTEM: "system",
});

export const INTERACTION_TYPE_VALUES = Object.freeze(Object.values(INTERACTION_TYPE));

/**
 * @param {string} type
 * @returns {boolean}
 */
export function isInteractionType(type) {
  return INTERACTION_TYPE_VALUES.includes(String(type || ""));
}
