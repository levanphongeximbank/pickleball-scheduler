import { DEFAULT_SKILL_LEVEL_RULES } from "../../ai/config.js";
import { getPlayerRatingInternal } from "../../models/player.js";

const PROPOSAL_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

function toRating(value, fallback = 3.5) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeSkillLevelRules(rules = {}) {
  return {
    enabled: rules.enabled === true,
    autoGenerateProposals: rules.autoGenerateProposals === true,
    step: toRating(rules.step, DEFAULT_SKILL_LEVEL_RULES.step),
    promoteThreshold: toRating(
      rules.promoteThreshold,
      DEFAULT_SKILL_LEVEL_RULES.promoteThreshold
    ),
    demoteThreshold: toRating(
      rules.demoteThreshold,
      DEFAULT_SKILL_LEVEL_RULES.demoteThreshold
    ),
    minLevel: toRating(rules.minLevel, DEFAULT_SKILL_LEVEL_RULES.minLevel),
    maxLevel: toRating(rules.maxLevel, DEFAULT_SKILL_LEVEL_RULES.maxLevel),
    minMatchesForProposal: Math.max(
      1,
      Number(rules.minMatchesForProposal) ||
        DEFAULT_SKILL_LEVEL_RULES.minMatchesForProposal ||
        5
    ),
    confidencePerMatch: toRating(
      rules.confidencePerMatch,
      DEFAULT_SKILL_LEVEL_RULES.confidencePerMatch
    ),
  };
}

export function getMonthKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    return "";
  }

  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

export function isMonthlyReviewDue(skillMeta, now = new Date()) {
  const currentMonth = getMonthKey(now);
  if (!currentMonth) {
    return false;
  }

  const lastReviewAt = skillMeta?.lastPublicLevelReviewAt;
  if (!lastReviewAt) {
    return true;
  }

  const lastMonth = getMonthKey(lastReviewAt);
  return Boolean(lastMonth && lastMonth < currentMonth);
}

function canGenerateRatingProposal(player, rules = DEFAULT_SKILL_LEVEL_RULES) {
  const minMatches = Number(rules.minMatchesForProposal) || 5;
  const matchCount = Number(player?.rating_match_count) || 0;
  return matchCount >= minMatches;
}

export function snapPublicLevel(value, rules = {}) {
  const normalized = normalizeSkillLevelRules(rules);
  const step = normalized.step;
  const min = normalized.minLevel;
  const max = normalized.maxLevel;
  const snapped = Math.round(toRating(value) / step) * step;

  return Math.min(max, Math.max(min, Math.round(snapped * 10) / 10));
}

export function computeNextPublicLevel(publicLevel, ratingInternal, rules = {}) {
  const normalized = normalizeSkillLevelRules(rules);
  const pub = toRating(publicLevel);
  const internal = toRating(ratingInternal);
  const step = normalized.step;

  if (internal >= pub + normalized.promoteThreshold) {
    const nextLevel = snapPublicLevel(pub + step, normalized);
    if (nextLevel > pub) {
      return { nextLevel, changed: true, direction: "up" };
    }
  }

  if (internal <= pub - normalized.demoteThreshold) {
    const nextLevel = snapPublicLevel(pub - step, normalized);
    if (nextLevel < pub) {
      return { nextLevel, changed: true, direction: "down" };
    }
  }

  return { nextLevel: pub, changed: false, direction: "none" };
}

export function assessMonthlyPublicLevel(player, rules = {}, now = new Date(), options = {}) {
  if (!player?.id) {
    return null;
  }

  const normalizedRules = normalizeSkillLevelRules(rules);
  if (!normalizedRules.enabled && !options.force) {
    return null;
  }

  if (!options.force && !canGenerateRatingProposal(player, normalizedRules)) {
    return null;
  }

  const skillMeta = player.skillMeta || {};
  if (!options.force && !isMonthlyReviewDue(skillMeta, now)) {
    return null;
  }

  const publicLevel = toRating(player.current_rating ?? player.level ?? player.rating);
  const ratingInternal = getPlayerRatingInternal(player, publicLevel);
  const decision = computeNextPublicLevel(publicLevel, ratingInternal, normalizedRules);

  return {
    playerId: String(player.id),
    playerName: String(player.name || "").trim(),
    previousLevel: publicLevel,
    nextLevel: decision.changed ? decision.nextLevel : publicLevel,
    ratingInternal,
    changed: decision.changed,
    direction: decision.direction,
    reviewMonth: getMonthKey(now),
  };
}

export function buildSkillLevelProposalId(playerId, reviewMonth) {
  return `slp-${String(playerId)}-${reviewMonth}`;
}

export function createSkillLevelProposal(assessment, now = new Date()) {
  if (!assessment?.changed) {
    return null;
  }

  const reviewedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();

  return {
    id: buildSkillLevelProposalId(assessment.playerId, assessment.reviewMonth),
    playerId: assessment.playerId,
    playerName: assessment.playerName || "",
    reviewMonth: assessment.reviewMonth,
    currentLevel: assessment.previousLevel,
    proposedLevel: assessment.nextLevel,
    ratingInternal: assessment.ratingInternal,
    direction: assessment.direction,
    status: PROPOSAL_STATUS.PENDING,
    ratingStatus: "under_review",
    source: "system_match_analysis",
    createdAt: reviewedAt,
    reviewedAt: null,
  };
}

export function normalizeSkillLevelProposal(proposal) {
  if (!proposal?.id || !proposal?.playerId) {
    return null;
  }

  return {
    ...proposal,
    id: String(proposal.id),
    playerId: String(proposal.playerId),
    playerName: String(proposal.playerName || "").trim(),
    reviewMonth: String(proposal.reviewMonth || "").trim(),
    currentLevel: toRating(proposal.currentLevel),
    proposedLevel: toRating(proposal.proposedLevel),
    ratingInternal: toRating(proposal.ratingInternal),
    direction: proposal.direction === "down" ? "down" : proposal.direction === "up" ? "up" : "none",
    status: [PROPOSAL_STATUS.PENDING, PROPOSAL_STATUS.APPROVED, PROPOSAL_STATUS.REJECTED].includes(
      proposal.status
    )
      ? proposal.status
      : PROPOSAL_STATUS.PENDING,
    createdAt: proposal.createdAt || null,
    reviewedAt: proposal.reviewedAt || null,
  };
}

export function normalizeSkillLevelProposals(proposals = []) {
  if (!Array.isArray(proposals)) {
    return [];
  }

  return proposals.map((item) => normalizeSkillLevelProposal(item)).filter(Boolean);
}

export function buildMonthlyHoldSkillMeta(player, assessment, now = new Date()) {
  const skillMeta = player.skillMeta || {};
  const reviewedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const historyEntry = {
    at: reviewedAt,
    from: assessment.previousLevel,
    to: assessment.previousLevel,
    ratingInternal: assessment.ratingInternal,
    reason: "monthly_hold",
  };
  const previousHistory = Array.isArray(skillMeta.publicLevelHistory)
    ? skillMeta.publicLevelHistory
    : [];

  return {
    ...skillMeta,
    lastPublicLevelReviewAt: reviewedAt,
    publicLevelHistory: [...previousHistory, historyEntry].slice(-24),
  };
}

export function buildApprovedSkillMeta(player, assessment, now = new Date()) {
  const skillMeta = player.skillMeta || {};
  const reviewedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const historyEntry = {
    at: reviewedAt,
    from: assessment.previousLevel,
    to: assessment.nextLevel,
    ratingInternal: assessment.ratingInternal,
    reason: `monthly_${assessment.direction}_approved`,
  };
  const previousHistory = Array.isArray(skillMeta.publicLevelHistory)
    ? skillMeta.publicLevelHistory
    : [];

  return {
    ...skillMeta,
    lastPublicLevelReviewAt: reviewedAt,
    publicLevelHistory: [...previousHistory, historyEntry].slice(-24),
  };
}

export function applyApprovedPublicLevel(player, assessment, now = new Date()) {
  return {
    ...player,
    skillLevel: assessment.nextLevel,
    level: assessment.nextLevel,
    rating: assessment.nextLevel,
    skillMeta: buildApprovedSkillMeta(player, assessment, now),
  };
}

export function applyMonthlyHoldReview(player, assessment, now = new Date()) {
  return {
    ...player,
    skillMeta: buildMonthlyHoldSkillMeta(player, assessment, now),
  };
}

/** @deprecated Dùng assessMonthlyPublicLevel + approve flow */
export function buildMonthlyPublicLevelUpdate(player, rules = {}, now = new Date(), options = {}) {
  const assessment = assessMonthlyPublicLevel(player, rules, now, options);
  if (!assessment) {
    return null;
  }

  const reviewedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const skillMeta = assessment.changed
    ? player.skillMeta || {}
    : buildMonthlyHoldSkillMeta(player, assessment, now);

  if (assessment.changed) {
    return {
      ...assessment,
      skillMeta: {
        ...skillMeta,
        lastPublicLevelReviewAt: reviewedAt,
      },
    };
  }

  return {
    ...assessment,
    skillMeta,
  };
}

/** @deprecated Dùng applyApprovedPublicLevel */
export function applyMonthlyPublicLevelUpdate(player, update) {
  if (!update) {
    return player;
  }

  const next = {
    ...player,
    skillMeta: update.skillMeta,
  };

  if (update.changed) {
    next.level = update.nextLevel;
    next.rating = update.nextLevel;
  }

  return next;
}

/** @deprecated */
export function buildMonthlyPublicLevelUpdates(players = [], rules = {}, now = new Date(), options = {}) {
  return (players || [])
    .map((player) => buildMonthlyPublicLevelUpdate(player, rules, now, options))
    .filter(Boolean);
}

export { PROPOSAL_STATUS };
