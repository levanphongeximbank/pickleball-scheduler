import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import { rpcV2GetMyActiveMembership } from "./clubStorageV2RpcService.js";
import { clearAthleteClubLink } from "../storage/athleteClubLinkStore.js";

/**
 * Phase 42H — Membership SoT.
 * V2: active club_members only (never profiles.club_id / player_id / role inference).
 * Legacy: user.clubId || user.club_id.
 */
export function stripLegacyProfileClubFields(user) {
  if (!user || typeof user !== "object") {
    return user;
  }
  return {
    ...user,
    clubId: null,
    club_id: null,
    playerId: null,
    player_id: null,
  };
}

/** Sync helper for tests / legacy UI — must NOT be used as V2 hasClub SoT. */
export function hasClubFromProfileFields(user) {
  return Boolean(user?.clubId || user?.club_id);
}

export function canShowCreateClub({ user, hasActiveMembership, hasClubCreatePermission }) {
  if (hasActiveMembership) {
    return false;
  }
  if (hasClubCreatePermission === true) {
    return true;
  }
  // Fallback: role gate used by canSelfRegisterClub (PLAYER / CLUB_MANAGER)
  const role = String(user?.role || "").toUpperCase();
  return role === "PLAYER" || role === "CLUB_MANAGER";
}

export function canShowLeaveClub(hasActiveMembership) {
  return Boolean(hasActiveMembership);
}

/**
 * Resolve active membership club id.
 * @returns {Promise<{ ok: boolean, clubId: string|null, hasActiveMembership: boolean, club?: object|null, source: string, error?: string }>}
 */
export async function resolveMyActiveClubMembership(user) {
  if (!user?.id) {
    return {
      ok: false,
      clubId: null,
      hasActiveMembership: false,
      club: null,
      source: "anon",
      error: "Chưa đăng nhập.",
    };
  }

  if (!isClubStorageV2Enabled()) {
    const clubId = user.clubId || user.club_id || null;
    return {
      ok: true,
      clubId,
      hasActiveMembership: Boolean(clubId),
      club: null,
      source: "legacy-profile",
    };
  }

  // V2: never trust profile / local athlete link
  clearAthleteClubLink(user.id);

  const result = await rpcV2GetMyActiveMembership();
  if (!result.ok) {
    return {
      ok: false,
      clubId: null,
      hasActiveMembership: false,
      club: null,
      source: "v2-rpc",
      error: result.error || result.code || "MEMBERSHIP_LOOKUP_FAILED",
    };
  }

  return {
    ok: true,
    clubId: result.clubId || null,
    hasActiveMembership: Boolean(result.hasActiveMembership && result.clubId),
    club: result.club || null,
    memberId: result.memberId || null,
    source: "v2-club-members",
  };
}
