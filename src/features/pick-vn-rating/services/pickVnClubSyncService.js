/**
 * Pick_VN club sync — mirror / read hydration only (BM-FINAL-RATING-01).
 *
 * hydrate: temporary read cache/mirror compatibility (not canonical authority).
 * push: frozen as independent canonical write from club blob.
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
import { rpcPickVnGetRatingByAuthUser } from "./pickVnRatingRpcService.js";
import { frozenWriterResult } from "./playerRatingCanonicalBridge.js";

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
 * After pull club blob — hydrate UI mirror from RPC/local cache.
 * Mirror only: does not establish canonical Player Rating authority.
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
        // Read-cache / compatibility mirror only — not canonical write success.
        upsertPickVnRating({
          ...localRecord,
          mirrorOnly: true,
          canonicalAuthority: false,
        });
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

  return {
    ok: true,
    changed,
    count: nextPlayers.length,
    mirrorOnly: true,
    canonicalAuthority: false,
  };
}

/**
 * Push from club blob as independent canonical write is frozen.
 * Club blob is not an independent Player Rating writer.
 */
export async function pushClubPlayersPickVnRatings(clubId) {
  if (!clubId) {
    return { ok: false, error: "Thiếu clubId." };
  }

  void buildClubPlayerRatingMirror;
  void getPickVnRatingByAuthUserId;

  return frozenWriterResult("pushClubPlayersPickVnRatings", {
    clubId,
    reason:
      "Club blob push is not an independent canonical Player Rating write",
    pushed: 0,
    total: (loadClubData(clubId).players || []).length,
  });
}
