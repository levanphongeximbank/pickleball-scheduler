/** Competition Elo anchor — standard Elo scale, separate from public skill 1.0–8.0. */
export const DEFAULT_COMPETITION_ELO = 1500;

/** Public skill anchor paired with DEFAULT_COMPETITION_ELO. */
export const DEFAULT_PUBLIC_SKILL_ANCHOR = 3.5;

/** Elo points per 1.0 public skill step (mapping v1). */
export const ELO_PER_SKILL_POINT_V1 = 400;

export const RATING_MAPPING_VERSION_V1 = "v1";

/** @type {Readonly<Record<string, string>>} */
export const RATING_INELIGIBILITY_REASON = Object.freeze({
  BYE: "bye",
  CANCELLED: "cancelled",
  VOID: "void",
  TEST: "test",
  WALKOVER_BEFORE_START: "walkover_before_start",
  UNVERIFIED: "unverified",
  FRAUD_SUSPECTED: "fraud_suspected",
  INVALID_LINEUP: "invalid_lineup",
  MISSING_TEAMS: "missing_teams",
  DAILY_PLAY: "daily_play",
});

/** @type {Readonly<Record<string, string>>} */
export const RATING_PROPOSAL_STATUS_V2 = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired",
});

export const DEFAULT_MONTHLY_REVIEW_V2_RULES = Object.freeze({
  minValidMatches: 10,
  minPlayingDays: 3,
  minUniqueOpponents: 5,
  minConfidence: 60,
  promoteThreshold: 0.35,
  demoteThreshold: 0.35,
  step: 0.5,
  minLevel: 1.0,
  maxLevel: 8.0,
});
