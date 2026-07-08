import { DEFAULT_SKILL_LEVEL_RULES } from "../ai/config.js";
import {
  getPlayerCurrentRating,
  normalizePlayers,
  syncCurrentRatingMirrors,
  syncSkillLevelMirrors,
} from "../models/player.js";
import { snapPickVnRating, PICK_VN_MIN, PICK_VN_MAX } from "../features/pick-vn-rating/constants/pickVnRatingScale.js";
import { RATING_STATUS } from "../features/pick-vn-rating/constants/ratingStatus.js";
import { migratePlayerRatingFields } from "../features/pick-vn-rating/models/pickVnRating.js";
import { verifyAdminPlayerRating } from "../features/pick-vn-rating/services/ratingVerificationService.js";
import { listClubs } from "./clubService.js";
import { loadClubData, saveClubData } from "./clubStorage.js";
import { getSkillLevelRules } from "./skillLevelService.js";

export const CHANGE_REQUEST_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

function toLevel(value, fallback = 3.5) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampLevel(value, rules = DEFAULT_SKILL_LEVEL_RULES) {
  const min = Number(rules.minLevel) || PICK_VN_MIN;
  const max = Number(rules.maxLevel) || PICK_VN_MAX;
  return snapPickVnRating(Math.min(max, Math.max(min, toLevel(value))));
}

export function normalizeSkillLevelChangeRequest(request) {
  if (!request || request.id == null) {
    return null;
  }

  return {
    id: String(request.id),
    clubId: String(request.clubId || ""),
    playerId: request.playerId,
    playerName: request.playerName ? String(request.playerName) : "",
    currentLevel: toLevel(request.currentLevel),
    requestedLevel: toLevel(request.requestedLevel),
    reason: request.reason ? String(request.reason).trim() : "",
    status: Object.values(CHANGE_REQUEST_STATUS).includes(request.status)
      ? request.status
      : CHANGE_REQUEST_STATUS.PENDING,
    requestedBy: request.requestedBy ? String(request.requestedBy) : null,
    requestedAt: request.requestedAt ? String(request.requestedAt) : null,
    reviewedBy: request.reviewedBy ? String(request.reviewedBy) : null,
    reviewedAt: request.reviewedAt ? String(request.reviewedAt) : null,
    reviewNote: request.reviewNote ? String(request.reviewNote) : "",
  };
}

function getClubChangeRequests(clubData) {
  return (clubData?.skillLevelChangeRequests || [])
    .map((item) => normalizeSkillLevelChangeRequest(item))
    .filter(Boolean);
}

export function setInitialSkillLevel(player, level, lockedAt = new Date().toISOString()) {
  if (!player) {
    return null;
  }

  if (player.skillLevelLockedAt) {
    return player;
  }

  const skillLevel = clampLevel(level);
  const base = {
    ...player,
    ...syncSkillLevelMirrors(player, skillLevel),
    skillLevelLockedAt: lockedAt,
  };
  return {
    ...base,
    ...migratePlayerRatingFields({
      ...base,
      self_declared_rating: skillLevel,
      current_rating: skillLevel,
      rating_status: RATING_STATUS.SELF_DECLARED,
      rating_confidence: 0.2,
      last_rating_updated_at: lockedAt,
    }),
  };
}

export function applySkillLevelValue(player, level, options = {}) {
  const skillLevel = clampLevel(level, options.rules);
  const now = options.lockedAt || new Date().toISOString();
  const base = {
    ...player,
    ...syncCurrentRatingMirrors(skillLevel),
    ratingInternal: player?.ratingInternal ?? skillLevel,
  };

  if (options.lock && !player.skillLevelLockedAt) {
    base.skillLevelLockedAt = now;
  }

  const status = options.ratingStatus || RATING_STATUS.ADMIN_VERIFIED;
  return {
    ...base,
    ...migratePlayerRatingFields({
      ...base,
      verified_rating: skillLevel,
      current_rating: skillLevel,
      rating_status: status,
      rating_verified_by: options.verifiedBy || null,
      rating_verification_note: options.note || "",
      last_rating_updated_at: now,
    }),
  };
}

export function listSkillLevelChangeRequests(clubId, options = {}) {
  const data = loadClubData(clubId);
  const requests = getClubChangeRequests(data);
  const status = options.status ? String(options.status) : null;

  if (!status) {
    return requests;
  }

  return requests.filter((item) => item.status === status);
}

export function listPendingSkillLevelChangeRequests(options = {}) {
  const clubFilter = options.clubId ? [options.clubId] : listClubs().map((club) => club.id);
  const rows = [];

  clubFilter.forEach((clubId) => {
    listSkillLevelChangeRequests(clubId, { status: CHANGE_REQUEST_STATUS.PENDING }).forEach(
      (request) => {
        rows.push({
          ...request,
          clubId,
          clubName: listClubs().find((club) => club.id === clubId)?.name || clubId,
        });
      }
    );
  });

  return rows.sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)));
}

export function getPlayerPendingSkillLevelRequest(clubId, playerId) {
  return listSkillLevelChangeRequests(clubId, { status: CHANGE_REQUEST_STATUS.PENDING }).find(
    (item) => String(item.playerId) === String(playerId)
  ) || null;
}

export function submitSkillLevelChangeRequest(
  clubId,
  playerId,
  requestedLevel,
  { reason = "", requestedBy = null } = {}
) {
  const trimmedReason = String(reason || "").trim();
  if (!trimmedReason) {
    return { ok: false, error: "Vui lòng nhập lý do thay đổi trình độ." };
  }

  const data = loadClubData(clubId);
  const rules = getSkillLevelRules(clubId);
  const playerIndex = (data.players || []).findIndex(
    (item) => String(item.id) === String(playerId)
  );

  if (playerIndex < 0) {
    return { ok: false, error: "Không tìm thấy vận động viên." };
  }

  const player = data.players[playerIndex];
  if (!player.skillLevelLockedAt) {
    return { ok: false, error: "Điểm trình độ chưa được khóa." };
  }

  const currentLevel = getPlayerCurrentRating(player);
  const nextLevel = clampLevel(requestedLevel, rules);

  if (nextLevel === currentLevel) {
    return { ok: false, error: "Điểm trình độ mới phải khác điểm hiện tại." };
  }

  const existingPending = getPlayerPendingSkillLevelRequest(clubId, playerId);
  if (existingPending) {
    return { ok: false, error: "Đã có yêu cầu đang chờ duyệt." };
  }

  const now = new Date().toISOString();
  const request = normalizeSkillLevelChangeRequest({
    id: `slcr-${Date.now()}-${playerId}`,
    clubId,
    playerId,
    playerName: player.name,
    currentLevel,
    requestedLevel: nextLevel,
    reason: trimmedReason,
    status: CHANGE_REQUEST_STATUS.PENDING,
    requestedBy,
    requestedAt: now,
  });

  data.skillLevelChangeRequests = [...getClubChangeRequests(data), request];
  data.updatedAt = now;
  saveClubData(clubId, data);

  return { ok: true, request };
}

function findRequestInClub(clubId, requestId) {
  const data = loadClubData(clubId);
  const requests = getClubChangeRequests(data);
  const index = requests.findIndex((item) => String(item.id) === String(requestId));

  return { data, requests, index, request: index >= 0 ? requests[index] : null };
}

export function approveSkillLevelChangeRequest(
  clubId,
  requestId,
  { reviewedBy = null, reviewNote = "" } = {}
) {
  const { data, requests, index, request } = findRequestInClub(clubId, requestId);

  if (!request) {
    return { ok: false, error: "Không tìm thấy yêu cầu." };
  }

  if (request.status !== CHANGE_REQUEST_STATUS.PENDING) {
    return { ok: false, error: "Yêu cầu đã được xử lý." };
  }

  const playerIndex = (data.players || []).findIndex(
    (item) => String(item.id) === String(request.playerId)
  );

  if (playerIndex < 0) {
    return { ok: false, error: "Không tìm thấy vận động viên." };
  }

  const reviewedAt = new Date().toISOString();
  const verifyResult = verifyAdminPlayerRating(clubId, request.playerId, request.requestedLevel, {
    verifiedBy: reviewedBy,
    note: reviewNote ? String(reviewNote).trim() : "",
    authUserId: data.players[playerIndex]?.authUserId || null,
  });

  if (!verifyResult.ok) {
    return verifyResult;
  }

  const refreshed = loadClubData(clubId);
  const refreshedRequests = getClubChangeRequests(refreshed);
  const refreshedIndex = refreshedRequests.findIndex(
    (item) => String(item.id) === String(requestId)
  );

  if (refreshedIndex < 0) {
    return { ok: false, error: "Không tìm thấy yêu cầu sau khi cập nhật." };
  }

  refreshedRequests[refreshedIndex] = {
    ...request,
    status: CHANGE_REQUEST_STATUS.APPROVED,
    reviewedBy,
    reviewedAt,
    reviewNote: reviewNote ? String(reviewNote).trim() : "",
  };

  refreshed.skillLevelChangeRequests = refreshedRequests;
  refreshed.updatedAt = reviewedAt;
  saveClubData(clubId, refreshed);

  return {
    ok: true,
    request: refreshedRequests[refreshedIndex],
    player: verifyResult.player,
  };
}

export function rejectSkillLevelChangeRequest(
  clubId,
  requestId,
  { reviewedBy = null, reviewNote = "" } = {}
) {
  const { data, requests, index, request } = findRequestInClub(clubId, requestId);

  if (!request) {
    return { ok: false, error: "Không tìm thấy yêu cầu." };
  }

  if (request.status !== CHANGE_REQUEST_STATUS.PENDING) {
    return { ok: false, error: "Yêu cầu đã được xử lý." };
  }

  const reviewedAt = new Date().toISOString();
  requests[index] = {
    ...request,
    status: CHANGE_REQUEST_STATUS.REJECTED,
    reviewedBy,
    reviewedAt,
    reviewNote: reviewNote ? String(reviewNote).trim() : "",
  };

  data.skillLevelChangeRequests = requests;
  data.updatedAt = reviewedAt;
  saveClubData(clubId, data);

  return { ok: true, request: requests[index] };
}
