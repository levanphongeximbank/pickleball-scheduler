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
  OVERRIDDEN: "overridden",
};

export const LINEUP_SOURCE = {
  CAPTAIN: "captain",
  RANDOM: "random",
  BTC_OVERRIDE: "btc_override",
};

export const DREAMBREAKER_ORDER_SOURCE = {
  CAPTAIN: "captain",
  RANDOM: "random",
};

export const MISSING_LINEUP_POLICY = {
  RANDOM: "random",
  /** @deprecated use FORFEIT_PENDING — legacy alias */
  FORFEIT: "forfeit",
  FORFEIT_PENDING: "forfeit_pending",
  /** @deprecated use MANUAL_PENDING — legacy alias */
  BTC_OVERRIDE: "btc_override",
  MANUAL_PENDING: "manual_pending",
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

export const FORMAT_PRESET = {
  MLP_4: "mlp_4",
  CUSTOM: "custom",
};

export const DISCIPLINE_KIND = {
  DOUBLES: "doubles",
  DREAMBREAKER: "dreambreaker",
};

export const ACTIVATION_RULE = {
  ALWAYS: "always",
  TIE_AT_2_2: "tie_at_2_2",
};

export const SCORING_SYSTEM = {
  RALLY: "rally",
  SIDE_OUT: "side_out",
};

export const DREAMBREAKER_STATUS = {
  PENDING: "pending",
  LINEUP_OPEN: "lineup_open",
  READY: "ready",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
};

export const DEFAULT_MLP_ROSTER_RULES = {
  minPlayers: 4,
  maxPlayers: 4,
  requiredMales: 2,
  requiredFemales: 2,
};

export const DEFAULT_TIE_BREAK_ORDER = [
  "wins",
  "subMatchDiff",
  "pointsScored",
  "headToHead",
  "manual",
];

export const TEAM_GROUP_SEEDING = {
  OFF: "off",
  TOP_PLAYER_THEN_TOTAL: "top_player_then_total",
  AVG_LEVEL: "avg_level",
};

export const DEFAULT_TEAM_TOURNAMENT_SETTINGS = {
  formatPreset: FORMAT_PRESET.CUSTOM,
  groupSeeding: TEAM_GROUP_SEEDING.AVG_LEVEL,
  missingLineupPolicy: MISSING_LINEUP_POLICY.RANDOM,
  allowPlayerReusePerMatchup: false,
  allowPlayerCrossTeam: false,
  dreambreakerEnabled: false,
  lineupLockLeadMinutes: 15,
  rosterRules: null,
  tiebreakOrder: [...DEFAULT_TIE_BREAK_ORDER],
  regulations: null,
};

export const TEAM_AUDIT_ACTIONS = {
  TEAM_CREATE: "team.create",
  TEAM_CLONE: "team.clone",
  TEAM_UPDATE: "team.update",
  TEAM_CAPTAIN_ASSIGN: "team.captain_assign",
  TEAM_CAPTAIN_CHANGE: "team.captain_change",
  TEAM_DEPUTY_ASSIGN: "team.deputy_assign",
  TEAM_PLAYER_ADD: "team.player_add",
  TEAM_PLAYER_REMOVE: "team.player_remove",
  TEAM_SUBSTITUTION: "team.substitution",
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
  SUB_MATCH_FORFEIT: "team.match.forfeit",
  DREAMBREAKER_ORDER_SUBMIT: "team.dreambreaker.order_submit",
  DREAMBREAKER_ORDER_LOCK: "team.dreambreaker.order_lock",
  DREAMBREAKER_POINT: "team.dreambreaker.point",
  KNOCKOUT_GENERATE: "team.knockout.generate",
  AWARDS_UPDATE: "team.awards.update",
  AWARDS_ASSIGN: "team.awards.assign",
  TOURNAMENT_CLOSE: "team.tournament.close",
};
