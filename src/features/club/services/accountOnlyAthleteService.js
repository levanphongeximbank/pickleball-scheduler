import { fetchProfileByUserId as defaultFetchProfileByUserId } from "../../../auth/profileService.js";
import { normalizePlayers } from "../../../models/player.js";
import { normalizeUser } from "../../../models/user.js";
import { GENDER_TO_PLAYER_LABEL } from "../../player-rating/playerSkillAssessmentConfig.js";
import { RATING_STATUS } from "../../pick-vn-rating/constants/ratingStatus.js";
import {
  buildClubPlayerRatingMirror,
  normalizePickVnRatingRecord,
} from "../../pick-vn-rating/models/pickVnRating.js";
import { getPickVnRatingByAuthUserId } from "../../pick-vn-rating/services/pickVnRatingService.js";
import { rpcPickVnGetRatingByAuthUser } from "../../pick-vn-rating/services/pickVnRatingRpcService.js";

const PROFILE_ROUTE_PREFIX = "profile-";
const ATHLETE_ROUTE_PREFIX = "athlete-";
const ACCOUNT_ONLY_LINK_STATUS = "account_only";

let fetchProfileByUserIdImpl = defaultFetchProfileByUserId;

export function __setFetchProfileByUserIdForTests(fetchImpl) {
  fetchProfileByUserIdImpl = fetchImpl || defaultFetchProfileByUserId;
}

export function __resetFetchProfileByUserIdForTests() {
  fetchProfileByUserIdImpl = defaultFetchProfileByUserId;
}

export function buildAccountOnlyPlayerId(authUserId) {
  return `${PROFILE_ROUTE_PREFIX}${String(authUserId || "").trim()}`;
}

/** Canonical profile route id — one auth user has at most one athlete. */
export function buildCanonicalProfileRouteId(authUserId) {
  return buildAccountOnlyPlayerId(authUserId);
}

export function buildAthleteRouteId(athleteId) {
  return `${ATHLETE_ROUTE_PREFIX}${String(athleteId || "").trim()}`;
}

/**
 * Parse a /players/profile/:playerId route param.
 * Supports:
 *   • profile-{auth_user_id}  → { authUserId, isAccountOnly:true }
 *   • athlete-{athlete_id}    → { athleteId }
 *   • legacy id (no prefix)   → { playerId }
 */
export function parsePlatformAthleteRouteId(playerId) {
  const raw = String(playerId || "").trim();

  if (raw.startsWith(PROFILE_ROUTE_PREFIX)) {
    return {
      playerId: raw,
      authUserId: raw.slice(PROFILE_ROUTE_PREFIX.length).trim() || null,
      athleteId: null,
      isAccountOnly: true,
    };
  }

  if (raw.startsWith(ATHLETE_ROUTE_PREFIX)) {
    return {
      playerId: raw,
      authUserId: null,
      athleteId: raw.slice(ATHLETE_ROUTE_PREFIX.length).trim() || null,
      isAccountOnly: false,
    };
  }

  return { playerId: raw, authUserId: null, athleteId: null, isAccountOnly: false };
}

export function resolveAthleteGender(profile, ratingRecord = null) {
  const fromProfile = String(profile?.gender || "").trim();
  if (fromProfile) {
    const lowered = fromProfile.toLowerCase();
    if (GENDER_TO_PLAYER_LABEL[lowered]) {
      return GENDER_TO_PLAYER_LABEL[lowered];
    }
    if (["nam", "nữ", "nu", "khác", "khac"].includes(lowered)) {
      return fromProfile;
    }
  }

  const assessmentGender = ratingRecord?.assessmentAnswers?.gender;
  if (assessmentGender && GENDER_TO_PLAYER_LABEL[assessmentGender]) {
    return GENDER_TO_PLAYER_LABEL[assessmentGender];
  }

  return "";
}

async function fetchRatingRecordForAuthUser(authUserId) {
  const local = getPickVnRatingByAuthUserId(authUserId);
  if (local) {
    return local;
  }

  const rpcResult = await rpcPickVnGetRatingByAuthUser(authUserId);
  if (rpcResult.ok && rpcResult.record) {
    return normalizePickVnRatingRecord(rpcResult.record);
  }

  return null;
}

function buildBaseAccountOnlyPlayer(profile) {
  const userId = String(profile?.id || "").trim();
  return {
    id: buildAccountOnlyPlayerId(userId),
    name: profile.displayName || profile.email || "VĐV",
    email: profile.email || "",
    phone: profile.phone || "",
    gender: "",
    status: profile.status === "suspended" ? "inactive" : "active",
    active: profile.status !== "suspended",
    authUserId: userId,
    clubId: profile.clubId || null,
    tenantId: profile.tenantId || profile.venueId || null,
    sourceClubId: profile.clubId || null,
    clubName: "",
    linkStatus: ACCOUNT_ONLY_LINK_STATUS,
    rating_status: RATING_STATUS.UNRATED,
    current_rating: null,
    level: null,
    rating: null,
    skillLevel: null,
  };
}

export async function enrichAccountOnlyAthlete(profile) {
  const userId = String(profile?.id || "").trim();
  if (!userId) {
    return null;
  }

  const ratingRecord = await fetchRatingRecordForAuthUser(userId);
  const base = buildBaseAccountOnlyPlayer(profile);
  base.gender = resolveAthleteGender(profile, ratingRecord);

  if (ratingRecord && ratingRecord.ratingStatus !== RATING_STATUS.UNRATED) {
    const mirrored = buildClubPlayerRatingMirror(base, ratingRecord);
    return normalizePlayers([{ ...base, ...mirrored }])[0];
  }

  return normalizePlayers([
    {
      ...base,
      rating_status: RATING_STATUS.UNRATED,
      current_rating: null,
      level: null,
      rating: null,
      skillLevel: null,
    },
  ])[0];
}

export async function enrichAccountOnlyAthletes(profiles) {
  const results = await Promise.all(
    (profiles || []).map((profile) => enrichAccountOnlyAthlete(profile))
  );
  return results.filter(Boolean);
}

export async function loadAccountOnlyAthleteProfile(authUserId, options = {}) {
  const id = String(authUserId || "").trim();
  if (!id) {
    return { ok: false, error: "Thiếu auth user." };
  }

  let profileUser = options.profile ? normalizeUser(options.profile) : null;
  if (!profileUser) {
    const result = await fetchProfileByUserIdImpl(id);
    if (!result.ok) {
      return { ok: false, error: result.error || "Không tìm thấy tài khoản VĐV." };
    }
    profileUser = result.user;
  }

  const player = await enrichAccountOnlyAthlete(profileUser);
  if (!player) {
    return { ok: false, error: "Không tải được hồ sơ VĐV." };
  }

  return {
    ok: true,
    clubId: profileUser.clubId || null,
    resolvedPlayerId: player.id,
    player,
    stats: {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
    },
    recentMatches: [],
    topPartners: [],
    topOpponents: [],
    isAccountOnly: true,
    authUserId: id,
  };
}
