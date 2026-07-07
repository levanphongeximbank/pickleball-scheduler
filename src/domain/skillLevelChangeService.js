import { DEFAULT_SKILL_LEVEL_RULES } from "../ai/config.js";
import {
  getPlayerSkillLevel,
  normalizePlayers,
  syncSkillLevelMirrors,
} from "../models/player.js";
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
  const min = Number(rules.minLevel) || 1.5;
  const max = Number(rules.maxLevel) || 6;
  return Math.min(max, Math.max(min, Math.round(toLevel(value) * 10) / 10));
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
  return {
    ...player,
    ...syncSkillLevelMirrors(player, skillLevel),
    skillLevelLockedAt: lockedAt,
  };
}

export function applySkillLevelValue(player, level, options = {}) {
  const skillLevel = clampLevel(level, options.rules);
  const next = {
    ...player,
    ...syncSkillLevelMirrors(player, skillLevel),
  };

  if (options.lock && !player.skillLevelLockedAt) {
    next.skillLevelLockedAt =
      options.lockedAt || new Date().toISOString();
  }

  return next;
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

  const currentLevel = getPlayerSkillLevel(player);
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
  const nextPlayers = [...(data.players || [])];
  nextPlayers[playerIndex] = applySkillLevelValue(nextPlayers[playerIndex], request.requestedLevel);

  requests[index] = {
    ...request,
    status: CHANGE_REQUEST_STATUS.APPROVED,
    reviewedBy,
    reviewedAt,
    reviewNote: reviewNote ? String(reviewNote).trim() : "",
  };

  data.players = normalizePlayers(nextPlayers);
  data.skillLevelChangeRequests = requests;
  data.updatedAt = reviewedAt;
  saveClubData(clubId, data);

  return { ok: true, request: requests[index], player: nextPlayers[playerIndex] };
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
