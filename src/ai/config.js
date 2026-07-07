export const SESSION_CAP = 200;
export const SNAPSHOT_CAP = 10;

export const DEFAULT_POINTS_SYSTEM = {
  win: 3,
  draw: 0,
  loss: 0,
};

export const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";

/** Quy tắc chốt trình công khai hàng tháng (tách khỏi ratingInternal). */
export const DEFAULT_SKILL_LEVEL_RULES = {
  enabled: false,
  autoGenerateProposals: false,
  step: 0.5,
  promoteThreshold: 0.35,
  demoteThreshold: 0.35,
  minLevel: 1.5,
  maxLevel: 6,
};

export const AI_CONFIG = {
  pairing: {
    candidateCount: 300,
    topCandidates: 3,
    maxTopCandidates: 10,
  },
  scoring: {
    levelScoreMultiplier: 20,
    mixedPairPenalty: 25,
    preferTeammateBonus: 15,
    preferTeammatePenalty: 15,
  },
  penalties: {
    repeatedPartner: 8,
    repeatedOpponent: 6,
    minScore: 0,
    largeLevelDiff: 100,
  },
  thresholds: {
    levelDiffAllowed: 0.5,
    maxWaitCountForScore: 5,
    playCountPenaltyStep: 10,
  },
  weights: {
    level: 1,
    history: 1,
    waiting: 1,
    rules: 1,
    policy: 1,
    competition: 1,
  },
  ruleDefaults: {
    team_level_diff_limit: {
      maxDiff: 0.5,
      penalty: 20,
    },
    max_partner_repeat: {
      maxTimes: 1,
      penalty: 12,
    },
    max_opponent_repeat: {
      maxTimes: 2,
      penalty: 10,
    },
  },
};
