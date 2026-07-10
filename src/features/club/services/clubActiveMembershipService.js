import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import { rpcV2GetMyActiveMembership } from "./clubStorageV2RpcService.js";
import { clearAthleteClubLink } from "../storage/athleteClubLinkStore.js";

const MEMBERSHIP_CACHE_MS = 30000;
/** @type {{ userId: string, at: number, result: object } | null} */
let membershipCache = null;
/** @type {{ userId: string, promise: Promise<object> } | null} */
let membershipInflight = null;

function readMembershipCache(userId) {
  if (
    membershipCache &&
    membershipCache.userId === userId &&
    Date.now() - membershipCache.at < MEMBERSHIP_CACHE_MS
  ) {
    return membershipCache.result;
  }
  return null;
}

function writeMembershipCache(userId, result) {
  membershipCache = { userId, at: Date.now(), result };
}

/** Sync read for hook initial state / skip stale refetch (Phase 42J.2). */
export function getCachedMembershipSnapshot(userId) {
  const id = String(userId || "").trim();
  if (!id) {
    return null;
  }
  return readMembershipCache(id);
}

/** Test helper — reset in-flight/cache between unit tests. */
export function resetMyActiveClubMembershipCache() {
  membershipCache = null;
  membershipInflight = null;
}

export function invalidateMyActiveClubMembershipCache(userId = null) {
  if (!userId || membershipCache?.userId === userId) {
    membershipCache = null;
  }
  if (!userId || membershipInflight?.userId === userId) {
    membershipInflight = null;
  }
}

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

/** V2 fallback summary from RPC club payload (minimal — full read model is 42K). */
export function buildMyClubSummaryFromClub(club) {
  if (!club?.id) {
    return null;
  }
  return {
    id: club.id,
    name: club.name,
    status: club.status,
    memberCount: club.activeMemberCount ?? 0,
    governance: club.governance || {},
    registeredClusterId: club.governance?.registeredClusterId || null,
    registeredCourtIds: [],
  };
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

  const cached = readMembershipCache(user.id);
  if (cached) {
    return cached;
  }

  if (membershipInflight?.userId === user.id) {
    return membershipInflight.promise;
  }

  const promise = resolveMyActiveClubMembershipInner(user).then((result) => {
    writeMembershipCache(user.id, result);
    return result;
  });

  membershipInflight = { userId: user.id, promise };
  try {
    return await promise;
  } finally {
    if (membershipInflight?.userId === user.id) {
      membershipInflight = null;
    }
  }
}

async function resolveMyActiveClubMembershipInner(user) {

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
