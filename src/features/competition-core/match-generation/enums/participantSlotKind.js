/**
 * CORE-09 — ParticipantSlot kinds.
 */

export const PARTICIPANT_SLOT_KIND = Object.freeze({
  DIRECT_PARTICIPANT: "DIRECT_PARTICIPANT",
  WINNER_OF: "WINNER_OF",
  LOSER_OF: "LOSER_OF",
  BYE: "BYE",
  UNRESOLVED_PLACEMENT: "UNRESOLVED_PLACEMENT",
});

/** @type {ReadonlySet<string>} */
export const PARTICIPANT_SLOT_KIND_VALUES = new Set(
  Object.values(PARTICIPANT_SLOT_KIND)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isParticipantSlotKind(value) {
  return typeof value === "string" && PARTICIPANT_SLOT_KIND_VALUES.has(value);
}
