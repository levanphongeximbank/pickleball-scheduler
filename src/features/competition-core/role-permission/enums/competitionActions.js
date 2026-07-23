/**
 * CORE-02 competition actions — Phase 1B includes Team + Lineup action vocabulary.
 * Values match Team/Lineup port action enums for direct adapter mapping.
 */

export const COMPETITION_ACTION = Object.freeze({
  // Team / Roster (Owner CORE-06 / repo teams)
  TEAM_ROSTER_UNLOCK: "TEAM_ROSTER_UNLOCK",
  TEAM_WITHDRAW: "TEAM_WITHDRAW",
  TEAM_ACTIVATE: "TEAM_ACTIVATE",
  ROSTER_LOCK: "ROSTER_LOCK",
  // Lineup (Owner CORE-07 / repo lineups)
  LINEUP_DRAFT: "LINEUP_DRAFT",
  LINEUP_SUBMIT: "LINEUP_SUBMIT",
  LINEUP_LOCK: "LINEUP_LOCK",
  LINEUP_PUBLISH: "LINEUP_PUBLISH",
  LINEUP_OVERRIDE: "LINEUP_OVERRIDE",
  LINEUP_VOID: "LINEUP_VOID",
  LINEUP_VIEW_OWN: "LINEUP_VIEW_OWN",
  LINEUP_VIEW_OPPONENT: "LINEUP_VIEW_OPPONENT",
});

export const COMPETITION_ACTION_VALUES = Object.freeze(
  Object.values(COMPETITION_ACTION)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionAction(value) {
  return COMPETITION_ACTION_VALUES.includes(String(value || ""));
}
