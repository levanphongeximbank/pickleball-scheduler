import { RATING_STATUS } from "../constants/ratingStatus.js";
import { clampPickVnRating, snapPickVnRating } from "../constants/pickVnRatingScale.js";
import { buildClubPlayerRatingMirror } from "../models/pickVnRating.js";
import {
  applyVerifiedRatingToRecord,
  getPickVnRatingByAuthUserId,
  saveSelfDeclaredRating,
} from "./pickVnRatingService.js";
import { logPickVnRatingAudit } from "./pickVnRatingAuditService.js";
import { normalizePlayers } from "../../../models/player.js";
import { loadClubData, saveClubData } from "../../../domain/clubStorage.js";

function applyRatingToClubPlayer(player, globalRecord, status) {
  const mirror = buildClubPlayerRatingMirror(player, globalRecord);
  return {
    ...player,
    ...mirror,
    rating_status: status,
    rating_verified_by: globalRecord?.ratingVerifiedBy || null,
    rating_verification_note: globalRecord?.ratingVerificationNote || "",
    last_rating_updated_at: globalRecord?.lastRatingUpdatedAt || new Date().toISOString(),
  };
}

export function verifyClubPlayerRating(
  clubId,
  playerId,
  rating,
  { verifiedBy = null, note = "", authUserId = null } = {}
) {
  const data = loadClubData(clubId);
  const playerIndex = (data.players || []).findIndex(
    (item) => String(item.id) === String(playerId)
  );
  if (playerIndex < 0) {
    return { ok: false, error: "Không tìm thấy vận động viên." };
  }

  const player = data.players[playerIndex];
  const snapped = clampPickVnRating(rating);
  const resolvedAuthUserId = authUserId || player.authUserId || null;

  let globalRecord = resolvedAuthUserId
    ? getPickVnRatingByAuthUserId(resolvedAuthUserId)
    : null;

  if (resolvedAuthUserId) {
    if (!globalRecord) {
      saveSelfDeclaredRating(resolvedAuthUserId, snapped, { source: "club_verify" });
      globalRecord = getPickVnRatingByAuthUserId(resolvedAuthUserId);
    }
    globalRecord = applyVerifiedRatingToRecord(globalRecord, {
      rating: snapped,
      status: RATING_STATUS.CLUB_VERIFIED,
      verifiedBy,
      note,
      source: "club_verification",
    });
  }

  const nextPlayers = [...data.players];
  const playerWithRating = {
    ...player,
    current_rating: snapped,
    verified_rating: snapped,
    skillLevel: snapped,
    level: snapped,
    rating: snapped,
  };
  nextPlayers[playerIndex] = applyRatingToClubPlayer(
    playerWithRating,
    globalRecord,
    RATING_STATUS.CLUB_VERIFIED
  );

  data.players = normalizePlayers(nextPlayers);
  data.updatedAt = new Date().toISOString();
  saveClubData(clubId, data);

  logPickVnRatingAudit({
    action: "rating.verify",
    clubId,
    playerId,
    authUserId: resolvedAuthUserId,
    before: { rating: player.current_rating ?? player.skillLevel },
    after: { rating: snapped, status: RATING_STATUS.CLUB_VERIFIED },
    metadata: { source: "club", note },
    actorUserId: verifiedBy,
  });

  return { ok: true, player: data.players[playerIndex], record: globalRecord };
}

export function verifyAdminPlayerRating(
  clubId,
  playerId,
  rating,
  { verifiedBy = null, note = "", authUserId = null } = {}
) {
  const result = verifyClubPlayerRating(clubId, playerId, rating, {
    verifiedBy,
    note,
    authUserId,
  });
  if (!result.ok) {
    return result;
  }

  const resolvedAuthUserId = authUserId || result.player?.authUserId || null;
  if (resolvedAuthUserId) {
    const globalRecord = applyVerifiedRatingToRecord(
      getPickVnRatingByAuthUserId(resolvedAuthUserId),
      {
        rating,
        status: RATING_STATUS.ADMIN_VERIFIED,
        verifiedBy,
        note,
        source: "admin_verification",
      }
    );
    const data = loadClubData(clubId);
    const playerIndex = (data.players || []).findIndex(
      (item) => String(item.id) === String(playerId)
    );
    if (playerIndex >= 0) {
      const nextPlayers = [...data.players];
      nextPlayers[playerIndex] = applyRatingToClubPlayer(
        nextPlayers[playerIndex],
        globalRecord,
        RATING_STATUS.ADMIN_VERIFIED
      );
      data.players = normalizePlayers(nextPlayers);
      saveClubData(clubId, data);
      result.player = data.players[playerIndex];
      result.record = globalRecord;
    }
  }

  logPickVnRatingAudit({
    action: "rating.verify",
    clubId,
    playerId,
    authUserId: resolvedAuthUserId,
    after: { rating, status: RATING_STATUS.ADMIN_VERIFIED },
    metadata: { source: "admin", note },
    actorUserId: verifiedBy,
  });

  return result;
}

export function verifyTournamentPlayerRating(
  clubId,
  playerId,
  rating,
  { verifiedBy = null, note = "", tournamentId = null, authUserId = null } = {}
) {
  const result = verifyClubPlayerRating(clubId, playerId, rating, {
    verifiedBy,
    note: note || `Xác thực lúc đăng ký giải ${tournamentId || ""}`.trim(),
    authUserId,
  });

  if (result.ok) {
    logPickVnRatingAudit({
      action: "rating.verify",
      clubId,
      playerId,
      tournamentId,
      after: { rating, status: RATING_STATUS.CLUB_VERIFIED },
      metadata: { source: "tournament_registration", note },
      actorUserId: verifiedBy,
    });
  }

  return result;
}

export function applySystemVerifiedRating(clubId, playerId, rating, options = {}) {
  const data = loadClubData(clubId);
  const playerIndex = (data.players || []).findIndex(
    (item) => String(item.id) === String(playerId)
  );
  if (playerIndex < 0) {
    return { ok: false, error: "Không tìm thấy vận động viên." };
  }

  const player = data.players[playerIndex];
  const authUserId = options.authUserId || player.authUserId || null;
  const snapped = snapPickVnRating(rating);
  let globalRecord = null;

  if (authUserId) {
    globalRecord = applyVerifiedRatingToRecord(
      getPickVnRatingByAuthUserId(authUserId) ||
        saveSelfDeclaredRating(authUserId, rating, { source: "system" }).record,
      {
        rating,
        status: RATING_STATUS.SYSTEM_VERIFIED,
        verifiedBy: options.verifiedBy || "system",
        note: options.note || "",
        source: "system_match_analysis",
        provisionalRating: options.provisionalRating,
      }
    );
  }

  const nextPlayers = [...data.players];
  const playerWithRating = {
    ...player,
    current_rating: snapped,
    verified_rating: snapped,
    skillLevel: snapped,
    level: snapped,
    rating: snapped,
  };
  nextPlayers[playerIndex] = applyRatingToClubPlayer(
    playerWithRating,
    globalRecord,
    RATING_STATUS.SYSTEM_VERIFIED
  );
  data.players = normalizePlayers(nextPlayers);
  data.updatedAt = new Date().toISOString();
  saveClubData(clubId, data);

  logPickVnRatingAudit({
    action: "rating.propose",
    clubId,
    playerId,
    authUserId,
    after: { rating, status: RATING_STATUS.SYSTEM_VERIFIED },
    metadata: options.metadata || {},
  });

  return { ok: true, player: data.players[playerIndex], record: globalRecord };
}
