/**
 * CORE-02 competition permission IDs.
 * String values align with Identity PERMISSIONS — do not fork catalog SoT.
 */

export const COMPETITION_PERMISSION = Object.freeze({
  TOURNAMENT_VIEW: "tournament.view",
  TOURNAMENT_UPDATE: "tournament.update",
  MATCH_UPDATE: "match.update",
  DIRECTOR_USE: "director.use",
  TEAM_MANAGE: "team.manage",
  TEAM_VIEW: "team.view",
  TEAM_WITHDRAW: "team.withdraw",
  TEAM_LINEUP_SUBMIT: "team.lineup.submit",
  TEAM_LINEUP_LOCK: "team.lineup.lock",
  TEAM_LINEUP_PUBLISH: "team.lineup.publish",
  TEAM_LINEUP_RANDOMIZE: "team.lineup.randomize",
  TEAM_LINEUP_OVERRIDE: "team.lineup.override",
  TEAM_LINEUP_VIEW_V5: "team_lineup.view",
  TEAM_LINEUP_SUBMIT_V5: "team_lineup.submit",
  TEAM_LINEUP_UPDATE_BEFORE_LOCK: "team_lineup.update_before_lock",
  TEAM_LINEUP_LOCK_V5: "team_lineup.lock",
  TEAM_LINEUP_APPROVE: "team_lineup.approve",
});

export const COMPETITION_PERMISSION_VALUES = Object.freeze(
  Object.values(COMPETITION_PERMISSION)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionPermission(value) {
  return COMPETITION_PERMISSION_VALUES.includes(String(value || ""));
}
