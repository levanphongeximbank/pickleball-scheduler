/**
 * Phase 3D — TeamAdapter / RosterAdapter contract shapes.
 */

export const TEAM_ADAPTER_ID = Object.freeze({
  LEGACY: "LEGACY_TEAM",
});

export const ROSTER_ADAPTER_ID = Object.freeze({
  LEGACY: "LEGACY_ROSTER",
});

/**
 * @typedef {Object} TeamAdapter
 * @property {string} id
 * @property {string} sourceType
 * @property {(source: unknown, context?: Record<string, unknown>) => boolean} supports
 * @property {(source: unknown, context?: Record<string, unknown>) =>
 *   import('../../participants/contracts/teamRosterLineup.js').CompetitionTeam
 * } map
 */

/**
 * @typedef {Object} RosterAdapter
 * @property {string} id
 * @property {string} sourceType
 * @property {(source: unknown, context?: Record<string, unknown>) => boolean} supports
 * @property {(source: unknown, context?: Record<string, unknown>) =>
 *   import('../../participants/contracts/teamRosterLineup.js').CompetitionRoster
 * } map
 */

/**
 * @param {unknown} adapter
 * @returns {adapter is TeamAdapter}
 */
export function isTeamAdapter(adapter) {
  return (
    !!adapter &&
    typeof adapter === "object" &&
    typeof adapter.id === "string" &&
    typeof adapter.sourceType === "string" &&
    typeof adapter.supports === "function" &&
    typeof adapter.map === "function"
  );
}

/**
 * @param {unknown} adapter
 * @returns {adapter is RosterAdapter}
 */
export function isRosterAdapter(adapter) {
  return isTeamAdapter(adapter);
}
