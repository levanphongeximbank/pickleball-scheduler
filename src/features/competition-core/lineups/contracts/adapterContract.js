/**
 * Phase 3E — LineupAdapter contract shape.
 */

export const LINEUP_ADAPTER_ID = Object.freeze({
  LEGACY: "LEGACY_LINEUP",
});

/**
 * @typedef {Object} LineupAdapter
 * @property {string} id
 * @property {string} sourceType
 * @property {(source: unknown, context?: Record<string, unknown>) => boolean} supports
 * @property {(source: unknown, context?: Record<string, unknown>) =>
 *   import('../../participants/contracts/teamRosterLineup.js').CompetitionLineup
 * } map
 */

/**
 * @param {unknown} adapter
 * @returns {adapter is LineupAdapter}
 */
export function isLineupAdapter(adapter) {
  return (
    !!adapter &&
    typeof adapter === "object" &&
    typeof adapter.id === "string" &&
    typeof adapter.sourceType === "string" &&
    typeof adapter.supports === "function" &&
    typeof adapter.map === "function"
  );
}
