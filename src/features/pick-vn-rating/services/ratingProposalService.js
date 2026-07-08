import { DEFAULT_SKILL_LEVEL_RULES } from "../../../ai/config.js";
import { getPlayerCurrentRating, getPlayerRatingInternal } from "../../../models/player.js";
import {
  assessMonthlyPublicLevel,
  createSkillLevelProposal,
} from "../../../tournament/engines/skillLevelEngine.js";
import { RATING_STATUS } from "../constants/ratingStatus.js";
import { setProvisionalRating } from "./pickVnRatingService.js";
import { applySystemVerifiedRating } from "./ratingVerificationService.js";
import { logPickVnRatingAudit } from "./pickVnRatingAuditService.js";

export function canGenerateRatingProposal(player, rules = DEFAULT_SKILL_LEVEL_RULES) {
  const minMatches = Number(rules.minMatchesForProposal) || 5;
  const matchCount = Number(player?.rating_match_count) || 0;
  return matchCount >= minMatches;
}

export function buildRatingProposalFromPlayer(player, rules = {}, now = new Date(), options = {}) {
  if (!canGenerateRatingProposal(player, rules) && !options.force) {
    return null;
  }

  const assessment = assessMonthlyPublicLevel(player, rules, now, options);
  if (!assessment?.changed) {
    return null;
  }

  const proposal = createSkillLevelProposal(assessment, now);
  if (!proposal) {
    return null;
  }

  return {
    ...proposal,
    ratingStatus: RATING_STATUS.UNDER_REVIEW,
    source: "system_match_analysis",
    provisionalRating: assessment.nextLevel,
  };
}

export function applyRatingProposalToPlayer(clubId, playerId, proposal, options = {}) {
  if (!proposal) {
    return { ok: false, error: "Thiếu proposal." };
  }

  const authUserId = options.authUserId || null;
  if (authUserId) {
    setProvisionalRating(authUserId, proposal.proposedLevel, { underReview: true });
  }

  logPickVnRatingAudit({
    action: "rating.propose",
    clubId,
    playerId,
    authUserId,
    before: { rating: proposal.currentLevel },
    after: { rating: proposal.proposedLevel, status: RATING_STATUS.UNDER_REVIEW },
    metadata: { source: proposal.source || "monthly_proposal" },
  });

  return {
    ok: true,
    proposal,
    playerPatch: {
      provisional_rating: proposal.proposedLevel,
      rating_status: RATING_STATUS.UNDER_REVIEW,
    },
  };
}

export function approveRatingProposal(clubId, playerId, proposal, options = {}) {
  const result = applySystemVerifiedRating(clubId, playerId, proposal.proposedLevel, {
    authUserId: options.authUserId,
    verifiedBy: options.verifiedBy || "system",
    note: options.note || "Duyệt đề xuất trình độ",
    provisionalRating: proposal.proposedLevel,
    metadata: { proposalId: proposal.id },
  });

  if (result.ok) {
    logPickVnRatingAudit({
      action: "rating.verify",
      clubId,
      playerId,
      after: {
        rating: proposal.proposedLevel,
        status: RATING_STATUS.SYSTEM_VERIFIED,
      },
      metadata: { proposalId: proposal.id, source: "proposal_approved" },
      actorUserId: options.verifiedBy,
    });
  }

  return result;
}

export function evaluatePlayerForAutoProposal(player, rules = DEFAULT_SKILL_LEVEL_RULES) {
  const publicLevel = getPlayerCurrentRating(player);
  const ratingInternal = getPlayerRatingInternal(player, publicLevel);
  return {
    publicLevel,
    ratingInternal,
    matchCount: Number(player.rating_match_count) || 0,
    eligible: canGenerateRatingProposal(player, rules),
    delta: Math.abs(ratingInternal - publicLevel),
  };
}
