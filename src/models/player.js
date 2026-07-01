import { PLAYER_TYPE } from "./tournament/constants.js";

const VALID_PLAYER_TYPES = new Set(Object.values(PLAYER_TYPE));

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getPlayerGenderKey(gender) {
  const raw = String(gender || "").trim().toLowerCase();

  if (["nam", "male", "m"].includes(raw)) {
    return "male";
  }

  if (["nữ", "nu", "female", "f"].includes(raw)) {
    return "female";
  }

  if (["other", "khac", "khác"].includes(raw)) {
    return "other";
  }

  return "unknown";
}

function normalizePlayerType(value) {
  const raw = String(value || "").trim().toLowerCase();
  return VALID_PLAYER_TYPES.has(raw) ? raw : PLAYER_TYPE.MEMBER;
}

function normalizeStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["active", "inactive", "archived"].includes(raw)) {
    return raw;
  }
  return "active";
}

function normalizeSkillMeta(skillMeta) {
  if (!skillMeta || typeof skillMeta !== "object") {
    return {};
  }

  return {
    ...(skillMeta.lastPublicLevelReviewAt
      ? { lastPublicLevelReviewAt: String(skillMeta.lastPublicLevelReviewAt) }
      : {}),
    ...(skillMeta.lastRatingInternalUpdateAt
      ? { lastRatingInternalUpdateAt: String(skillMeta.lastRatingInternalUpdateAt) }
      : {}),
    ...(Array.isArray(skillMeta.publicLevelHistory)
      ? {
          publicLevelHistory: skillMeta.publicLevelHistory.map((entry) => ({
            at: entry?.at || null,
            from: toNumber(entry?.from, null),
            to: toNumber(entry?.to, null),
            ratingInternal: toNumber(entry?.ratingInternal, null),
            reason: entry?.reason ? String(entry.reason) : "",
          })),
        }
      : {}),
  };
}

/**
 * Rating nội bộ dùng cho Elo — fallback dữ liệu cũ chưa có ratingInternal.
 */
export function getPlayerRatingInternal(player, fallback = 3.5) {
  if (!player) {
    return fallback;
  }

  if (player.ratingInternal !== undefined && player.ratingInternal !== null && player.ratingInternal !== "") {
    return toNumber(player.ratingInternal, fallback);
  }

  return toNumber(player.rating ?? player.level, fallback);
}

export function normalizePlayer(player) {
  if (!player || player.id === undefined || player.id === null) {
    return null;
  }

  const level = toNumber(player.level ?? player.rating, 3.5);
  const rating = toNumber(player.rating ?? player.level, level);
  const ratingInternal = getPlayerRatingInternal(player, level);

  const normalized = {
    ...player,
    id: player.id,
    name: String(player.name || "Unknown").trim(),
    gender: player.gender ?? null,
    genderKey: getPlayerGenderKey(player.gender),
    playerType: normalizePlayerType(player.playerType),
    level,
    rating,
    ratingInternal,
    status: normalizeStatus(player.status),
    active: player.active !== false,
  };

  const optionalFields = ["phone", "clubName", "unitName", "levelLabel", "note"];
  for (const field of optionalFields) {
    if (field in player) {
      normalized[field] = player[field] != null ? String(player[field]).trim() : "";
    }
  }

  if (player.skillMeta && typeof player.skillMeta === "object") {
    normalized.skillMeta = normalizeSkillMeta(player.skillMeta);
  }

  if (player.tenantId) {
    normalized.tenantId = String(player.tenantId).trim();
  }

  return normalized;
}

export function normalizePlayers(players = []) {
  if (!Array.isArray(players)) {
    return [];
  }

  return players
    .filter(Boolean)
    .map((player) => normalizePlayer(player))
    .filter(Boolean);
}
