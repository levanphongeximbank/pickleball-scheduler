/**
 * Pick_VN SSOT: `pick_vn_player_ratings` (global) + local fallback store.
 * Club blob `players[]` chỉ mirror denormalized — hydrate on pull, push after club sync.
 */
import { loadClubData, saveClubData } from "../../../domain/clubStorage.js";
import { normalizePlayers } from "../../../models/player.js";
import {
  buildClubPlayerRatingMirror,
  normalizePickVnRatingRecord,
} from "../models/pickVnRating.js";
import { upsertPickVnRating } from "../storage/pickVnRatingLocalStore.js";
import {
  getPickVnRatingByAuthUserId,
  syncRatingToClubPlayer,
} from "./pickVnRatingService.js";
import {
  rpcPickVnGetRatingByAuthUser,
  rpcPickVnSyncRating,
} from "./pickVnRatingRpcService.js";

function buildGlobalRecordFromClubPlayer(player) {
  const authUserId = player?.authUserId ? String(player.authUserId) : null;
  if (!authUserId) {
    return null;
  }

  const mirror = buildClubPlayerRatingMirror(player);
  const existing = getPickVnRatingByAuthUserId(authUserId);

  return normalizePickVnRatingRecord({
    id: existing?.id || `pvn-rating-${authUserId}`,
    authUserId,
    vprAthleteId: existing?.vprAthleteId || player.vprAthleteId || null,
    selfDeclaredRating: mirror.self_declared_rating,
    provisionalRating: mirror.provisional_rating,
    verifiedRating: mirror.verified_rating,
    currentRating: mirror.current_rating,
    ratingStatus: mirror.rating_status,
    ratingConfidence: mirror.rating_confidence,
    ratingMatchCount: mirror.rating_match_count,
    lastRatingUpdatedAt: mirror.last_rating_updated_at,
    ratingVerifiedBy: mirror.rating_verified_by,
    ratingVerificationNote: mirror.rating_verification_note,
    ratingHistory: existing?.ratingHistory || [],
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function mapRpcRecordToLocal(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  return normalizePickVnRatingRecord({
    id: record.id,
    authUserId: record.auth_user_id || record.authUserId,
    vprAthleteId: record.vpr_athlete_id || record.vprAthleteId,
    selfDeclaredRating: record.self_declared_rating ?? record.selfDeclaredRating,
    provisionalRating: record.provisional_rating ?? record.provisionalRating,
    verifiedRating: record.verified_rating ?? record.verifiedRating,
    currentRating: record.current_rating ?? record.currentRating,
    ratingStatus: record.rating_status ?? record.ratingStatus,
    ratingConfidence: record.rating_confidence ?? record.ratingConfidence,
    ratingMatchCount: record.rating_match_count ?? record.ratingMatchCount,
    lastRatingUpdatedAt: record.last_rating_updated_at ?? record.lastRatingUpdatedAt,
    ratingVerifiedBy: record.rating_verified_by ?? record.ratingVerifiedBy,
    ratingVerificationNote:
      record.rating_verification_note ?? record.ratingVerificationNote,
    ratingHistory: record.rating_history ?? record.ratingHistory,
    createdAt: record.created_at ?? record.createdAt,
    updatedAt: record.updated_at ?? record.updatedAt,
  });
}

/**
 * Sau pull club blob — hydrate mirror từ global store / RPC cloud.
 */
export async function hydrateClubPlayersPickVnRatings(clubId) {
  if (!clubId) {
    return { ok: false, error: "Thiếu clubId." };
  }

  const data = loadClubData(clubId);
  const players = data.players || [];
  let changed = false;

  const nextPlayers = [];
  for (const player of players) {
    const authUserId = player?.authUserId ? String(player.authUserId) : null;
    if (!authUserId) {
      nextPlayers.push(player);
      continue;
    }

    const rpcResult = await rpcPickVnGetRatingByAuthUser(authUserId);
    if (rpcResult.ok && rpcResult.record) {
      const localRecord = mapRpcRecordToLocal(rpcResult.record);
      if (localRecord) {
        upsertPickVnRating(localRecord);
      }
    }

    const synced = syncRatingToClubPlayer(player, authUserId);
    if (JSON.stringify(synced) !== JSON.stringify(player)) {
      changed = true;
    }
    nextPlayers.push(synced);
  }

  if (changed) {
    data.players = normalizePlayers(nextPlayers);
    data.updatedAt = new Date().toISOString();
    saveClubData(clubId, data);
  }

  return { ok: true, changed, count: nextPlayers.length };
}

/**
 * Sau push club blob — đẩy mirror lên global store + RPC cloud.
 */
export async function pushClubPlayersPickVnRatings(clubId) {
  if (!clubId) {
    return { ok: false, error: "Thiếu clubId." };
  }

  const data = loadClubData(clubId);
  const players = data.players || [];
  let pushed = 0;

  for (const player of players) {
    const record = buildGlobalRecordFromClubPlayer(player);
    if (!record) {
      continue;
    }
    upsertPickVnRating(record);
    const rpcResult = await rpcPickVnSyncRating(record);
    if (rpcResult.ok) {
      pushed += 1;
    }
  }

  return { ok: true, pushed, total: players.length };
}
