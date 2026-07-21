/**
 * CORE-06 Phase 1E — deadline phase outcomes.
 * Format injects timestamps; CORE-06 evaluates deterministically with explicit time.
 */

export const LINEUP_DEADLINE_PHASE = Object.freeze({
  NOT_OPEN: "NOT_OPEN",
  OPEN: "OPEN",
  GRACE_PERIOD: "GRACE_PERIOD",
  CLOSED: "CLOSED",
  LOCKED: "LOCKED",
  REVEAL_READY: "REVEAL_READY",
});

/** @type {ReadonlySet<string>} */
export const LINEUP_DEADLINE_PHASE_VALUES = new Set(
  Object.values(LINEUP_DEADLINE_PHASE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLineupDeadlinePhase(value) {
  return typeof value === "string" && LINEUP_DEADLINE_PHASE_VALUES.has(value);
}

/**
 * @typedef {Object} LineupDeadlineTimestamps
 * @property {string|null} [opensAt]
 * @property {string|null} [submitBy]
 * @property {string|null} [lockAt]
 * @property {string|null} [revealAt]
 * @property {string|null} [graceUntil]
 * @property {string|null} [correctionUntil]
 * @property {string|null} [timezone]
 */

/**
 * @param {Partial<LineupDeadlineTimestamps>} [partial]
 * @returns {Readonly<LineupDeadlineTimestamps>}
 */
export function createLineupDeadlineTimestamps(partial = {}) {
  const pick = (key) => {
    const v = partial[key];
    if (v == null || String(v).trim() === "") return null;
    return String(v).trim();
  };
  return Object.freeze({
    opensAt: pick("opensAt"),
    submitBy: pick("submitBy"),
    lockAt: pick("lockAt"),
    revealAt: pick("revealAt"),
    graceUntil: pick("graceUntil"),
    correctionUntil: pick("correctionUntil"),
    timezone: pick("timezone"),
  });
}
