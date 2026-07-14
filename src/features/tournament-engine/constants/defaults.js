/** @typedef {import('../types/tournamentTypes.js').SeedWeights} SeedWeights */
/** @typedef {import('../types/tournamentTypes.js').RankingRules} RankingRules */
/** @typedef {import('../types/tournamentTypes.js').ScheduleConfig} ScheduleConfig */

export const ENGINE_VERSION = "4.0.0-sprint5";

export const PARTICIPANT_STATUS = {
  ACTIVE: "active",
  ABSENT: "absent",
  INJURED: "injured",
  UNPAID: "unpaid",
  PENDING: "pending",
  INACTIVE: "inactive",
};

export const INELIGIBLE_SEED_STATUSES = new Set([
  PARTICIPANT_STATUS.ABSENT,
  PARTICIPANT_STATUS.INJURED,
  PARTICIPANT_STATUS.UNPAID,
  PARTICIPANT_STATUS.PENDING,
  PARTICIPANT_STATUS.INACTIVE,
]);

export const QUALIFIED_STATUS = {
  QUALIFIED: "qualified",
  ELIMINATED: "eliminated",
  PENDING: "pending",
  TIE_BREAK_REQUIRED: "tie_break_required",
};

export const ENGINE_TYPE = {
  SEED: "seed",
  DRAW: "draw",
  SCHEDULE: "schedule",
  COURT: "court",
  TIME: "time",
  RANKING: "ranking",
  FULL_PLAN: "full_plan",
};

export const DEFAULT_SEED_WEIGHTS = {
  elo: 0.45,
  skillLevel: 0.25,
  winRate: 0.15,
  recentPerformance: 0.1,
  manualPriority: 0.05,
};

export const DEFAULT_RANKING_RULES = {
  criteria: [
    "wins",
    "matchPoints",
    "pointDiff",
    "pointsFor",
    "headToHead",
    "seed",
    "manual",
  ],
  qualifiersPerGroup: 2,
};

export const DEFAULT_SCHEDULE_CONFIG = {
  startTime: "08:00",
  endTime: "22:00",
  averageMatchMinutes: 25,
  bufferMinutes: 5,
  minRestMinutes: 15,
  restRoundsBetweenMatches: 1,
  randomSeed: 42,
};

export const DEFAULT_TIME_PREDICTION = {
  groupStageMinutes: 22,
  quarterfinalMinutes: 28,
  semifinalMinutes: 32,
  finalMinutes: 38,
  thirdPlaceMinutes: 30,
  pointsToWin: 11,
  bestOf: 1,
};

export const DRAW_MAX_RETRIES = 100;

export const UNSEEDED_THRESHOLD_MATCHES = 3;
