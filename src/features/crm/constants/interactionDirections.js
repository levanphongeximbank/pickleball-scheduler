/** Canonical CRM interaction directions (Phase 1E). */

export const INTERACTION_DIRECTION = Object.freeze({
  INBOUND: "inbound",
  OUTBOUND: "outbound",
  INTERNAL: "internal",
});

export const INTERACTION_DIRECTION_VALUES = Object.freeze(
  Object.values(INTERACTION_DIRECTION)
);

/**
 * @param {string} direction
 * @returns {boolean}
 */
export function isInteractionDirection(direction) {
  return INTERACTION_DIRECTION_VALUES.includes(String(direction || ""));
}
