/**
 * Phase 3D — Team / Roster source types (capability-local).
 */

export const TEAM_SOURCE_TYPE = Object.freeze({
  LEGACY_TEAM: "LEGACY_TEAM",
  LEGACY_ROSTER: "LEGACY_ROSTER",
});

/** @type {ReadonlySet<string>} */
export const TEAM_SOURCE_TYPE_VALUES = new Set(Object.values(TEAM_SOURCE_TYPE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTeamSourceType(value) {
  return typeof value === "string" && TEAM_SOURCE_TYPE_VALUES.has(value);
}
