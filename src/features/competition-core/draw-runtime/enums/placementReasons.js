/** Phase 3H — why a placement was made. */

export const PLACEMENT_REASON = Object.freeze({
  SEEDED_ORDER: "SEEDED_ORDER",
  SNAKE: "SNAKE",
  SERPENTINE: "SERPENTINE",
  POT_TIER: "POT_TIER",
  OPEN_DETERMINISTIC: "OPEN_DETERMINISTIC",
  /** Deterministic shuffle then snake (OPEN_SHUFFLED_SNAKE_GROUPS). */
  OPEN_SHUFFLED_SNAKE: "OPEN_SHUFFLED_SNAKE",
  IDENTITY_ORDER: "IDENTITY_ORDER",
  MANUAL: "MANUAL",
  PROTECTED: "PROTECTED",
  BRACKET_SEED: "BRACKET_SEED",
  BRACKET_OPEN: "BRACKET_OPEN",
  BYE_CALC: "BYE_CALC",
  PARTIAL_AUTO_FILL: "PARTIAL_AUTO_FILL",
  HYBRID: "HYBRID",
  NOOP: "NOOP",
});

/** @type {ReadonlySet<string>} */
export const PLACEMENT_REASON_VALUES = new Set(Object.values(PLACEMENT_REASON));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlacementReason(value) {
  return typeof value === "string" && PLACEMENT_REASON_VALUES.has(value);
}
