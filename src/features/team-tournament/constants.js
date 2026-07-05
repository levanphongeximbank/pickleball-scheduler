export const DISCIPLINE_CATEGORY = {
  SINGLES: "singles",
  DOUBLES: "doubles",
  MIXED: "mixed",
};

export const GENDER_REQUIREMENT = {
  MALE: "male",
  FEMALE: "female",
  ANY: "any",
  MIXED_PAIR: "mixed_pair",
};

export const LINEUP_STATUS = {
  NOT_SUBMITTED: "not_submitted",
  DRAFT: "draft",
  SUBMITTED: "submitted",
  LOCKED: "locked",
  PUBLISHED: "published",
};

export const LINEUP_SOURCE = {
  CAPTAIN: "captain",
  RANDOM: "random",
  BTC_OVERRIDE: "btc_override",
};

export const MISSING_LINEUP_POLICY = {
  RANDOM: "random",
  BTC_OVERRIDE: "btc_override",
  FORFEIT: "forfeit",
};

export const MATCHUP_STATUS = {
  SCHEDULED: "scheduled",
  LINEUP_OPEN: "lineup_open",
  LOCKED: "locked",
  PUBLISHED: "published",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
};

export const SUB_MATCH_STATUS = {
  WAITING: "waiting",
  PLAYING: "playing",
  COMPLETED: "completed",
  FORFEIT: "forfeit",
};

export const DEFAULT_TIE_BREAK_ORDER = [
  "wins",
  "subMatchDiff",
  "pointsScored",
  "headToHead",
  "manual",
];

export const DEFAULT_TEAM_TOURNAMENT_SETTINGS = {
  missingLineupPolicy: MISSING_LINEUP_POLICY.RANDOM,
  allowPlayerReusePerMatchup: false,
  allowPlayerCrossTeam: false,
  tiebreakOrder: [...DEFAULT_TIE_BREAK_ORDER],
};

export const TEAM_AUDIT_ACTIONS = {
  TEAM_CREATE: "team.create",
  TEAM_UPDATE: "team.update",
  TEAM_CAPTAIN_ASSIGN: "team.captain_assign",
  TEAM_CAPTAIN_CHANGE: "team.captain_change",
  TEAM_DEPUTY_ASSIGN: "team.deputy_assign",
  TEAM_PLAYER_ADD: "team.player_add",
  TEAM_PLAYER_REMOVE: "team.player_remove",
  LINEUP_DRAFT: "team.lineup.draft",
  LINEUP_SUBMIT: "team.lineup.submit",
  LINEUP_UPDATE: "team.lineup.update",
  LINEUP_LOCK: "team.lineup.lock",
  LINEUP_RANDOM: "team.lineup.randomize",
  LINEUP_PUBLISH: "team.lineup.publish",
  SUB_MATCH_RESULT: "team.match.result",
  SUB_MATCH_RESULT_DRAFT: "team.match.result.draft",
  SUB_MATCH_RESULT_CONFIRM: "team.match.result.confirm",
  SUB_MATCH_RESULT_OVERRIDE: "team.match.result.override",
};
