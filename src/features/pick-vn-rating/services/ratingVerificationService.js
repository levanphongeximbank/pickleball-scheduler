/**
 * Pick_VN V2 verification compatibility surface (BM-FINAL-RATING-01).
 * Writers are frozen: must delegate to canonical foundation write facade
 * or return typed WRITER_FROZEN / DURABLE_RUNTIME_UNAVAILABLE.
 * Club blob remains mirror-only — never independent verified-rating success.
 */

import { snapPickVnRating } from "../constants/pickVnRatingScale.js";
import {
  durableUnavailableResult,
  frozenWriterResult,
  runCanonicalRatingWrite,
} from "./playerRatingCanonicalBridge.js";
import { parsePlatformAthleteRouteId } from "../../club/services/accountOnlyAthleteService.js";

function requireCanonicalVerifyArgs(options = {}) {
  return Boolean(
    options.canonicalPlayerId &&
      options.actor &&
      options.expectedVersion != null &&
      options.scope
  );
}

/**
 * V2-first club verification — frozen unless canonical facade args provided.
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
    canonicalPlayerId = null,
    actor = null,
    expectedVersion = null,
    scope = null,
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

  if (!resolvedAuthUserId && !playerId && !canonicalPlayerId) {
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

  void verifiedBy;
  void note;
  void athleteId;
  void verifyClubId;

  if (
    !requireCanonicalVerifyArgs({
      canonicalPlayerId,
      actor,
      expectedVersion,
      scope,
    })
  ) {
    return frozenWriterResult("verifyClubPlayerRating", {
      clubId,
      playerId,
      authUserId: resolvedAuthUserId,
      reason:
        "Local/club-blob verification writers are frozen; provide canonicalPlayerId, actor, scope, expectedVersion",
    });
  }

  // Sync API kept for import compatibility — callers needing durable write
  // should use verifyClubPlayerRatingAsync.
  return durableUnavailableResult("verifyClubPlayerRating", {
    hint: "Use verifyClubPlayerRatingAsync for canonical durable verification",
    rating: snapPickVnRating(rating),
  });
}

export async function verifyClubPlayerRatingAsync(
  clubId,
  playerId,
  rating,
  options = {}
) {
  const {
    canonicalPlayerId = null,
    actor = null,
    expectedVersion = null,
    scope = null,
    ratingMode = "overall",
    note = "",
  } = options;

  if (
    !requireCanonicalVerifyArgs({
      canonicalPlayerId,
      actor,
      expectedVersion,
      scope,
    })
  ) {
    return frozenWriterResult("verifyClubPlayerRatingAsync", {
      clubId,
      playerId,
      reason:
        "Requires canonicalPlayerId, actor, scope, expectedVersion",
    });
  }

  const snapped = snapPickVnRating(rating);
  const result = await runCanonicalRatingWrite(
    (facade) =>
      facade.verify({
        playerId: String(canonicalPlayerId),
        scope,
        ratingMode,
        verifiedRating: snapped,
        expectedVersion,
        actor,
        status: options.status || "club_verified",
      }),
    "verifyClubPlayerRating"
  );

  if (!result.ok) {
    // Fail closed: do not mirror verified rating into club blob on durable failure.
    return result;
  }

  return {
    ...result,
    clubId,
    playerId,
    note,
    mirrorOnly: true,
    mode: "canonical_facade",
  };
}

export function verifyAdminPlayerRating(clubId, playerId, rating, options = {}) {
  return verifyClubPlayerRating(clubId, playerId, rating, {
    ...options,
    source: "admin",
  });
}

export async function verifyAdminPlayerRatingAsync(
  clubId,
  playerId,
  rating,
  options = {}
) {
  return verifyClubPlayerRatingAsync(clubId, playerId, rating, {
    ...options,
    status: options.status || "admin_verified",
  });
}

export function verifyTournamentPlayerRating(
  clubId,
  playerId,
  rating,
  options = {}
) {
  return verifyClubPlayerRating(clubId, playerId, rating, {
    ...options,
    source: "tournament",
  });
}

export async function verifyTournamentPlayerRatingAsync(
  clubId,
  playerId,
  rating,
  options = {}
) {
  return verifyClubPlayerRatingAsync(clubId, playerId, rating, {
    ...options,
    status: options.status || "tournament_verified",
  });
}

export function applySystemVerifiedRating(clubId, playerId, rating, options = {}) {
  void rating;
  return frozenWriterResult("applySystemVerifiedRating", {
    clubId,
    playerId,
    reason:
      "System verified rating must use canonical write facade; club blob is mirror-only",
    ...options,
  });
}

export async function applySystemVerifiedRatingAsync(
  clubId,
  playerId,
  rating,
  options = {}
) {
  return verifyClubPlayerRatingAsync(clubId, playerId, rating, {
    ...options,
    status: options.status || "system_verified",
  });
}
