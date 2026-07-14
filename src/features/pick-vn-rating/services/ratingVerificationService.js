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
import { parsePlatformAthleteRouteId } from "../../club/services/accountOnlyAthleteService.js";

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

function findBlobPlayerIndex(data, { playerId, authUserId, athleteId } = {}) {
  const players = data?.players || [];
  if (playerId) {
    const byId = players.findIndex((item) => String(item.id) === String(playerId));
    if (byId >= 0) {
      return byId;
    }
  }
  if (athleteId) {
    const byAthlete = players.findIndex(
      (item) => String(item.athleteId || item.athlete_id || "") === String(athleteId)
    );
    if (byAthlete >= 0) {
      return byAthlete;
    }
  }
  if (authUserId) {
    return players.findIndex(
      (item) => String(item.authUserId || item.auth_user_id || "") === String(authUserId)
    );
  }
  return -1;
}

function persistVerifiedRatingForAuthUser(authUserId, rating, { verifiedBy, note }) {
  const snapped = clampPickVnRating(rating);
  let globalRecord = getPickVnRatingByAuthUserId(authUserId);
  if (!globalRecord) {
    saveSelfDeclaredRating(authUserId, snapped, { source: "club_verify" });
    globalRecord = getPickVnRatingByAuthUserId(authUserId);
  }
  return applyVerifiedRatingToRecord(globalRecord, {
    rating: snapped,
    status: RATING_STATUS.CLUB_VERIFIED,
    verifiedBy,
    note,
    source: "club_verification",
  });
}

/**
 * V2-first club verification.
 * Keys: authUserId + clubId (+ athleteId). Legacy blob is optional mirror only.
 * Never treats profile-{uuid} as a required blob player id.
 */
export function verifyClubPlayerRating(
  clubId,
  playerId,
  rating,
  {
    verifiedBy = null,
    note = "",
    authUserId = null,
    athleteId = null,
    membershipClubId = null,
    requireMembershipClub = false,
  } = {}
) {
  const route = parsePlatformAthleteRouteId(playerId);
  const resolvedAuthUserId = authUserId || route.authUserId || null;
  const verifyClubId = membershipClubId || clubId;

  if (requireMembershipClub && membershipClubId && String(membershipClubId) !== String(clubId)) {
    return {
      ok: false,
      error: "Vận động viên không thuộc CLB đang xác thực.",
      code: "MEMBERSHIP_CLUB_MISMATCH",
    };
  }

  if (!resolvedAuthUserId && route.isAccountOnly) {
    return {
      ok: false,
      error: "Tài khoản chưa có hồ sơ vận động viên.",
      code: "MISSING_AUTH_USER",
    };
  }

  if (!resolvedAuthUserId && !playerId) {
    return {
      ok: false,
      error: "Tài khoản chưa có hồ sơ vận động viên.",
      code: "MISSING_AUTH_USER",
    };
  }

  if (requireMembershipClub && !athleteId && route.isAccountOnly) {
    return {
      ok: false,
      error: "Membership chưa liên kết với hồ sơ vận động viên.",
      code: "MISSING_ATHLETE_LINK",
    };
  }

  const snapped = clampPickVnRating(rating);
  let globalRecord = null;

  if (resolvedAuthUserId) {
    globalRecord = persistVerifiedRatingForAuthUser(resolvedAuthUserId, snapped, {
      verifiedBy,
      note,
    });
  }

  // Optional legacy blob mirror — never required for V2 membership athletes.
  if (verifyClubId) {
    const data = loadClubData(verifyClubId);
    const playerIndex = findBlobPlayerIndex(data, {
      playerId: route.isAccountOnly ? null : playerId,
      authUserId: resolvedAuthUserId,
      athleteId,
    });

    if (playerIndex >= 0) {
      const player = data.players[playerIndex];
      const nextPlayers = [...data.players];
      const playerWithRating = {
        ...player,
        current_rating: snapped,
        verified_rating: snapped,
        skillLevel: snapped,
        level: snapped,
        rating: snapped,
        athleteId: athleteId || player.athleteId || null,
        authUserId: resolvedAuthUserId || player.authUserId || null,
      };
      nextPlayers[playerIndex] = applyRatingToClubPlayer(
        playerWithRating,
        globalRecord,
        RATING_STATUS.CLUB_VERIFIED
      );
      data.players = normalizePlayers(nextPlayers);
      data.updatedAt = new Date().toISOString();
      saveClubData(verifyClubId, data);

      logPickVnRatingAudit({
        action: "rating.verify",
        clubId: verifyClubId,
        playerId: data.players[playerIndex].id,
        authUserId: resolvedAuthUserId,
        athleteId,
        before: { rating: player.current_rating ?? player.skillLevel },
        after: { rating: snapped, status: RATING_STATUS.CLUB_VERIFIED },
        metadata: { source: "club", note, mode: "blob_mirror" },
        actorUserId: verifiedBy,
      });

      return { ok: true, player: data.players[playerIndex], record: globalRecord, mode: "blob_mirror" };
    }
  }

  if (resolvedAuthUserId && globalRecord) {
    logPickVnRatingAudit({
      action: "rating.verify",
      clubId: verifyClubId,
      playerId: athleteId || resolvedAuthUserId,
      authUserId: resolvedAuthUserId,
      athleteId,
      after: { rating: snapped, status: RATING_STATUS.CLUB_VERIFIED },
      metadata: { source: "club", note, mode: "auth_user_only" },
      actorUserId: verifiedBy,
    });

    return {
      ok: true,
      player: {
        id: athleteId ? `athlete-${athleteId}` : `profile-${resolvedAuthUserId}`,
        authUserId: resolvedAuthUserId,
        athleteId,
        current_rating: snapped,
        verified_rating: snapped,
        skillLevel: snapped,
        rating_status: RATING_STATUS.CLUB_VERIFIED,
      },
      record: globalRecord,
      mode: "auth_user_only",
    };
  }

  return {
    ok: false,
    error: "Không tìm thấy vận động viên.",
    code: "PLAYER_NOT_FOUND",
  };
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
