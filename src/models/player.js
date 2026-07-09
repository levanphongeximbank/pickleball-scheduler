import { PLAYER_TYPE } from "./tournament/constants.js";
import {
  PICK_VN_MIN,
  parsePickVnRating,
  snapPickVnRating,
} from "../features/pick-vn-rating/constants/pickVnRatingScale.js";
import {
  migratePlayerRatingFields,
} from "../features/pick-vn-rating/models/pickVnRating.js";
import { normalizeRatingStatus, RATING_STATUS } from "../features/pick-vn-rating/constants/ratingStatus.js";

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
 * Trình độ hiệu lực Pick_VN — ưu tiên current_rating, fallback legacy.
 */
export function getPlayerCurrentRating(player, fallback = 3.5) {
  if (!player) {
    return fallback;
  }

  if (
    player.current_rating !== undefined &&
    player.current_rating !== null &&
    player.current_rating !== ""
  ) {
    return snapPickVnRating(player.current_rating);
  }

  return getPlayerSkillLevel(player, fallback);
}

/**
 * Điểm trình độ chính thức (riêng tư) — fallback dữ liệu cũ.
 */
export function getPlayerSkillLevel(player, fallback = 3.5) {
  if (!player) {
    return fallback;
  }

  const raw =
    player.skillLevel !== undefined && player.skillLevel !== null && player.skillLevel !== ""
      ? player.skillLevel
      : player.level ?? player.rating;

  // NOTE: normalizePlayer expects to preserve fractional levels already on the accepted scale.
  // We only clamp the minimum; we do not snap here (snap is handled elsewhere for UI/slider).
  return Math.max(PICK_VN_MIN, parsePickVnRating(raw, fallback));
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

export function syncCurrentRatingMirrors(skillLevel) {
  const value = snapPickVnRating(skillLevel);
  return {
    skillLevel: value,
    level: value,
    rating: value,
    current_rating: value,
  };
}

export function syncSkillLevelMirrors(player, skillLevel) {
  const value = snapPickVnRating(skillLevel);
  return {
    ...syncCurrentRatingMirrors(value),
    ratingInternal: toNumber(player?.ratingInternal, value),
  };
}

export function normalizePlayer(player) {
  if (!player || player.id === undefined || player.id === null) {
    return null;
  }

  const hasExplicitRating =
    player.current_rating != null ||
    player.level != null ||
    player.rating != null ||
    player.skillLevel != null;

  const incomingStatus = normalizeRatingStatus(player.rating_status, null);
  const isExplicitlyUnrated =
    incomingStatus === RATING_STATUS.UNRATED && !hasExplicitRating;

  const migratedRating = isExplicitlyUnrated
    ? {
        rating_status: RATING_STATUS.UNRATED,
        current_rating: null,
        level: null,
        rating: null,
        skillLevel: null,
      }
    : migratePlayerRatingFields({
        ...player,
        skillLevel: player.skillLevel,
        level: player.level,
        rating: player.rating,
        ratingInternal: player.ratingInternal,
      });

  const ratingStatus = normalizeRatingStatus(
    migratedRating.rating_status ?? player.rating_status,
    hasExplicitRating ? RATING_STATUS.SELF_DECLARED : RATING_STATUS.UNRATED
  );
  const isUnrated = ratingStatus === RATING_STATUS.UNRATED && !hasExplicitRating;
  const skillLevel = isUnrated
    ? null
    : getPlayerCurrentRating(
        { ...player, ...migratedRating },
        Math.max(PICK_VN_MIN, parsePickVnRating(player.level ?? player.rating, 3.5))
      );

  const normalized = {
    ...player,
    ...migratedRating,
    id: player.id,
    name: String(player.name || "Unknown").trim(),
    gender: player.gender ?? null,
    genderKey: getPlayerGenderKey(player.gender),
    playerType: normalizePlayerType(player.playerType),
    skillLevel,
    level: skillLevel,
    rating: skillLevel,
    ratingInternal: isUnrated ? null : getPlayerRatingInternal(player, skillLevel ?? 3.5),
    status: normalizeStatus(player.status),
    active: player.active !== false,
    rating_status: ratingStatus,
  };

  if (player.skillLevelLockedAt) {
    normalized.skillLevelLockedAt = String(player.skillLevelLockedAt);
  } else if (
    player.level !== undefined ||
    player.rating !== undefined ||
    player.skillLevel !== undefined
  ) {
    normalized.skillLevelLockedAt =
      player.createdAt || new Date(0).toISOString();
  }

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
