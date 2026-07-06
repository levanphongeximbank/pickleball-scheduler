import { DEFAULT_SKILL_LEVEL_RULES } from "../ai/config.js";
import { getPlayerRatingInternal, normalizePlayers } from "../models/player.js";
import { loadClubData, saveClubData } from "./clubStorage.js";
import {
  applyApprovedPublicLevel,
  applyMonthlyHoldReview,
  assessMonthlyPublicLevel,
  createSkillLevelProposal,
  getMonthKey,
  isMonthlyReviewDue,
  normalizeSkillLevelProposals,
  normalizeSkillLevelRules,
  PROPOSAL_STATUS,
} from "../tournament/engines/skillLevelEngine.js";

function getClubSkillLevelRules(clubData) {
  return normalizeSkillLevelRules({
    ...DEFAULT_SKILL_LEVEL_RULES,
    ...(clubData?.skillLevel || {}),
  });
}

function getClubProposals(clubData) {
  return normalizeSkillLevelProposals(clubData?.skillLevelProposals || []);
}

export function getSkillLevelRules(clubId) {
  const data = loadClubData(clubId);
  return getClubSkillLevelRules(data);
}

export function listPendingSkillLevelProposals(clubId) {
  return listSkillLevelProposals(clubId, { status: PROPOSAL_STATUS.PENDING });
}

export function listSkillLevelProposals(clubId, options = {}) {
  const data = loadClubData(clubId);
  const proposals = getClubProposals(data);
  const status = options.status ? String(options.status) : null;

  if (!status) {
    return proposals;
  }

  return proposals.filter((item) => item.status === status);
}

export function updateSkillLevelRules(clubId, partialRules = {}) {
  const data = loadClubData(clubId);
  const nextRules = normalizeSkillLevelRules({
    ...getClubSkillLevelRules(data),
    ...partialRules,
  });

  data.skillLevel = nextRules;
  data.updatedAt = new Date().toISOString();
  saveClubData(clubId, data);

  return { ok: true, rules: nextRules };
}

function buildLevelDistribution(players = [], rules = DEFAULT_SKILL_LEVEL_RULES) {
  const step = Number(rules.step) || 0.5;
  const min = Number(rules.minLevel) || 1.5;
  const max = Number(rules.maxLevel) || 6;
  const buckets = [];

  for (let level = min; level < max; level += step) {
    const upper = Math.min(max, Math.round((level + step) * 10) / 10);
    const label = `${level.toFixed(1)}–${upper.toFixed(1)}`;
    const count = players.filter((player) => {
      const value = Number(player.level ?? player.rating);
      if (!Number.isFinite(value)) {
        return false;
      }
      return value >= level && (upper >= max ? value <= max : value < upper);
    }).length;

    buckets.push({ label, level, count });
  }

  return buckets;
}

export function getSkillLevelOverview(clubId, now = new Date()) {
  const data = loadClubData(clubId);
  const rules = getClubSkillLevelRules(data);
  const players = normalizePlayers(data.players || []);
  const proposals = getClubProposals(data);
  const activePlayers = players.filter(
    (player) => player.status !== "archived" && player.active !== false
  );

  const levelSum = activePlayers.reduce(
    (sum, player) => sum + Number(player.level ?? player.rating ?? 0),
    0
  );
  const averageLevel = activePlayers.length ? levelSum / activePlayers.length : 0;

  const playerRows = activePlayers.map((player) => {
    const publicLevel = Number(player.level ?? player.rating) || 0;
    const ratingInternal = getPlayerRatingInternal(player, publicLevel);

    return {
      id: player.id,
      name: player.name,
      publicLevel,
      ratingInternal,
      delta: Math.round((ratingInternal - publicLevel) * 100) / 100,
      lastReviewAt: player.skillMeta?.lastPublicLevelReviewAt || null,
    };
  });

  return {
    rules,
    reviewMonth: getMonthKey(now),
    totalPlayers: activePlayers.length,
    averageLevel: Math.round(averageLevel * 10) / 10,
    pendingCount: proposals.filter((item) => item.status === PROPOSAL_STATUS.PENDING).length,
    distribution: buildLevelDistribution(activePlayers, rules),
    players: playerRows,
    proposals,
  };
}

export function isClubMonthlySkillReviewDue(clubId, now = new Date()) {
  const data = loadClubData(clubId);
  const rules = getClubSkillLevelRules(data);

  if (!rules.enabled) {
    return false;
  }

  const hasDuePlayer = (data.players || []).some((player) =>
    isMonthlyReviewDue(player.skillMeta, now)
  );
  const hasPending = getClubProposals(data).some(
    (item) => item.status === PROPOSAL_STATUS.PENDING
  );

  return hasDuePlayer || hasPending;
}

export function generateMonthlySkillLevelProposals(clubId, options = {}) {
  const data = loadClubData(clubId);
  const rules = getClubSkillLevelRules(data);
  const now = options.now || new Date();

  if (!rules.enabled && !options.force) {
    return { ok: true, skipped: true, reason: "disabled", proposals: [], holds: 0 };
  }

  const existingProposals = getClubProposals(data);
  const pendingByPlayerMonth = new Set(
    existingProposals
      .filter((item) => item.status === PROPOSAL_STATUS.PENDING)
      .map((item) => `${item.playerId}::${item.reviewMonth}`)
  );

  const newProposals = [];
  let holds = 0;
  const playersToUpdate = new Map();

  (data.players || []).forEach((player) => {
    const assessment = assessMonthlyPublicLevel(player, rules, now, options);
    if (!assessment) {
      return;
    }

    if (assessment.changed) {
      const key = `${assessment.playerId}::${assessment.reviewMonth}`;
      if (!pendingByPlayerMonth.has(key)) {
        const proposal = createSkillLevelProposal(assessment, now);
        if (proposal) {
          newProposals.push(proposal);
          pendingByPlayerMonth.add(key);
        }
      }
      return;
    }

    holds += 1;
    playersToUpdate.set(String(player.id), applyMonthlyHoldReview(player, assessment, now));
  });

  if (!newProposals.length && !playersToUpdate.size) {
    return { ok: true, skipped: true, reason: "not-due", proposals: [], holds: 0 };
  }

  data.skillLevelProposals = [...existingProposals, ...newProposals];
  data.players = normalizePlayers(
    (data.players || []).map((player) => playersToUpdate.get(String(player.id)) || player)
  );
  data.updatedAt = new Date().toISOString();
  saveClubData(clubId, data);

  return {
    ok: true,
    proposals: newProposals,
    proposalCount: newProposals.length,
    holds,
    pendingCount: listPendingSkillLevelProposals(clubId).length,
  };
}

export function maybeGenerateMonthlySkillLevelProposals(clubId, options = {}) {
  const data = loadClubData(clubId);
  const rules = getClubSkillLevelRules(data);

  if (!rules.enabled) {
    return { ok: true, skipped: true, reason: "disabled" };
  }

  if (!rules.autoGenerateProposals && !options.force) {
    return { ok: true, skipped: true, reason: "manual-only" };
  }

  const now = options.now || new Date();
  const hasDuePlayer = (data.players || []).some((player) =>
    isMonthlyReviewDue(player.skillMeta, now)
  );

  if (!hasDuePlayer && !options.force) {
    return { ok: true, skipped: true, reason: "not-due" };
  }

  return generateMonthlySkillLevelProposals(clubId, options);
}

/** Tự động tạo đề xuất nếu đến kỳ — gọi khi mở app / đổi CLB / vào trang Người chơi. */
export function ensureMonthlySkillLevelProposals(clubId, options = {}) {
  return maybeGenerateMonthlySkillLevelProposals(clubId, options);
}

export function approveSkillLevelProposal(clubId, proposalId, options = {}) {
  const data = loadClubData(clubId);
  const proposals = getClubProposals(data);
  const index = proposals.findIndex((item) => String(item.id) === String(proposalId));

  if (index < 0) {
    return { ok: false, error: "Khong tim thay de xuat." };
  }

  const proposal = proposals[index];
  if (proposal.status !== PROPOSAL_STATUS.PENDING) {
    return { ok: false, error: "De xuat da duoc xu ly." };
  }

  const playerIndex = (data.players || []).findIndex(
    (item) => String(item.id) === String(proposal.playerId)
  );

  if (playerIndex < 0) {
    return { ok: false, error: "Khong tim thay van dong vien." };
  }

  const now = options.now || new Date();
  const reviewedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const assessment = {
    playerId: proposal.playerId,
    previousLevel: proposal.currentLevel,
    nextLevel: proposal.proposedLevel,
    ratingInternal: proposal.ratingInternal,
    changed: true,
    direction: proposal.direction,
    reviewMonth: proposal.reviewMonth,
  };

  const nextPlayers = [...(data.players || [])];
  nextPlayers[playerIndex] = applyApprovedPublicLevel(nextPlayers[playerIndex], assessment, now);

  proposals[index] = {
    ...proposal,
    status: PROPOSAL_STATUS.APPROVED,
    reviewedAt,
  };

  data.players = normalizePlayers(nextPlayers);
  data.skillLevelProposals = proposals;
  data.updatedAt = reviewedAt;
  saveClubData(clubId, data);

  return { ok: true, proposal: proposals[index], player: nextPlayers[playerIndex] };
}

export function rejectSkillLevelProposal(clubId, proposalId, options = {}) {
  const data = loadClubData(clubId);
  const proposals = getClubProposals(data);
  const index = proposals.findIndex((item) => String(item.id) === String(proposalId));

  if (index < 0) {
    return { ok: false, error: "Khong tim thay de xuat." };
  }

  const proposal = proposals[index];
  if (proposal.status !== PROPOSAL_STATUS.PENDING) {
    return { ok: false, error: "De xuat da duoc xu ly." };
  }

  const playerIndex = (data.players || []).findIndex(
    (item) => String(item.id) === String(proposal.playerId)
  );

  const now = options.now || new Date();
  const reviewedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();

  let nextPlayers = [...(data.players || [])];
  if (playerIndex >= 0) {
    const player = nextPlayers[playerIndex];
    const assessment = {
      playerId: proposal.playerId,
      previousLevel: proposal.currentLevel,
      nextLevel: proposal.currentLevel,
      ratingInternal: proposal.ratingInternal,
      changed: false,
      direction: "none",
      reviewMonth: proposal.reviewMonth,
    };
    nextPlayers[playerIndex] = applyMonthlyHoldReview(player, assessment, now);
  }

  proposals[index] = {
    ...proposal,
    status: PROPOSAL_STATUS.REJECTED,
    reviewedAt,
  };

  data.players = normalizePlayers(nextPlayers);
  data.skillLevelProposals = proposals;
  data.updatedAt = reviewedAt;
  saveClubData(clubId, data);

  return { ok: true, proposal: proposals[index] };
}

/** @deprecated Dùng generateMonthlySkillLevelProposals + approveSkillLevelProposal */
export function applyMonthlyPublicLevelReview(clubId, options = {}) {
  return generateMonthlySkillLevelProposals(clubId, options);
}

/** @deprecated */
export function maybeRunMonthlyPublicLevelReview(clubId, options = {}) {
  return maybeGenerateMonthlySkillLevelProposals(clubId, options);
}
