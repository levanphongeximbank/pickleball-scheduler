/**
 * Phase 3F — MatchAdapter contract shape.
 */

export const MATCH_ADAPTER_ID = Object.freeze({
  LEGACY: "LEGACY_MATCH",
});

/**
 * @typedef {Object} MatchAdapter
 * @property {string} id
 * @property {string} sourceType
 * @property {(source: unknown, context?: Record<string, unknown>) => boolean} supports
 * @property {(source: unknown, context?: Record<string, unknown>) =>
 *   import('./competitionMatch.js').CompetitionMatch
 * } map
 */

/**
 * @param {unknown} adapter
 * @returns {adapter is MatchAdapter}
 */
export function isMatchAdapter(adapter) {
  return (
    !!adapter &&
    typeof adapter === "object" &&
    typeof adapter.id === "string" &&
    typeof adapter.sourceType === "string" &&
    typeof adapter.supports === "function" &&
    typeof adapter.map === "function"
  );
}
