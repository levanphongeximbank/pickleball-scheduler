import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import { rpcV2GetMyActiveMembership } from "./clubStorageV2RpcService.js";
import { clearAthleteClubLink } from "../storage/athleteClubLinkStore.js";

export const MEMBERSHIP_CACHE_MS = 30000;

function resolveMembershipCacheScope() {
  const raw = String(
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_SUPABASE_URL || ""
      : ""
  ).trim();
  if (!raw) {
    return "local";
  }
  try {
    return new URL(raw).hostname.split(".")[0] || raw;
  } catch {
    return raw;
  }
}

const MEMBERSHIP_CACHE_SCOPE = resolveMembershipCacheScope();
const SESSION_CACHE_PREFIX = "pb-membership-cache-v1:";

function buildMembershipCacheKey(userId) {
  return `${MEMBERSHIP_CACHE_SCOPE}:${String(userId || "").trim()}`;
}

function sessionCacheStorageKey(cacheKey) {
  return `${SESSION_CACHE_PREFIX}${cacheKey}`;
}

/** In-memory resolved flag — survives route nav, cleared only on explicit invalidation. */
const membershipResolvedKeys = new Set();

function readSessionMembershipCache(cacheKey) {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(sessionCacheStorageKey(cacheKey));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.at || !parsed?.result || Date.now() - parsed.at >= MEMBERSHIP_CACHE_MS) {
      sessionStorage.removeItem(sessionCacheStorageKey(cacheKey));
      return null;
    }
    return parsed.result;
  } catch {
    return null;
  }
}

function writeSessionMembershipCache(cacheKey, result) {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(
      sessionCacheStorageKey(cacheKey),
      JSON.stringify({ at: Date.now(), result })
    );
  } catch {
    /* quota */
  }
}

function clearSessionMembershipCache(cacheKey = null) {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    if (!cacheKey) {
      for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(SESSION_CACHE_PREFIX)) {
          sessionStorage.removeItem(key);
        }
      }
      return;
    }
    sessionStorage.removeItem(sessionCacheStorageKey(cacheKey));
  } catch {
    /* ignore */
  }
}

function markMembershipResolved(cacheKey) {
  membershipResolvedKeys.add(cacheKey);
}

function isMembershipResolved(cacheKey) {
  return membershipResolvedKeys.has(cacheKey);
}

function clearMembershipResolved(cacheKey = null) {
  if (!cacheKey) {
    membershipResolvedKeys.clear();
    return;
  }
  membershipResolvedKeys.delete(cacheKey);
}

/** @type {{ cacheKey: string, at: number, result: object } | null} */
let membershipCache = null;
/** @type {{ cacheKey: string, promise: Promise<object> } | null} */
let membershipInflight = null;

function readMembershipCache(userId) {
  const cacheKey = buildMembershipCacheKey(userId);
  if (
    membershipCache &&
    membershipCache.cacheKey === cacheKey &&
    Date.now() - membershipCache.at < MEMBERSHIP_CACHE_MS
  ) {
    return membershipCache.result;
  }

  const sessionCached = readSessionMembershipCache(cacheKey);
  if (sessionCached) {
    membershipCache = { cacheKey, at: Date.now(), result: sessionCached };
    markMembershipResolved(cacheKey);
    return sessionCached;
  }

  return null;
}

function writeMembershipCache(userId, result) {
  const cacheKey = buildMembershipCacheKey(userId);
  membershipCache = { cacheKey, at: Date.now(), result };
  writeSessionMembershipCache(cacheKey, result);
  if (result?.ok) {
    markMembershipResolved(cacheKey);
  }
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
  clearMembershipResolved();
  clearSessionMembershipCache();
}

export function invalidateMyActiveClubMembershipCache(userId = null) {
  if (!userId) {
    membershipCache = null;
    membershipInflight = null;
    clearMembershipResolved();
    clearSessionMembershipCache();
    return;
  }
  const cacheKey = buildMembershipCacheKey(userId);
  if (membershipCache?.cacheKey === cacheKey) {
    membershipCache = null;
  }
  if (membershipInflight?.cacheKey === cacheKey) {
    membershipInflight = null;
  }
  clearMembershipResolved(cacheKey);
  clearSessionMembershipCache(cacheKey);
}

/** Phase 42J.2.2 — skip network when cache/session still fresh (not SoT). */
export function shouldFetchMembership(userId, { force = false } = {}) {
  if (!userId) {
    return false;
  }
  if (force) {
    return true;
  }
  return !readMembershipCache(userId);
}

/** Clear cache on sign-out / user switch only — not route navigation or token refresh. */
export function clearMembershipCacheForUser(userId) {
  invalidateMyActiveClubMembershipCache(userId);
}

/**
 * Phase 42H — Membership SoT.
 * V2: active club_members only (never profiles.club_id for hasClub).
 * player_id is athlete identity (tournament captain portal) — keep in session.
 * Legacy: user.clubId || user.club_id.
 */
export function stripLegacyProfileClubFields(user) {
  if (!user || typeof user !== "object") {
    return user;
  }
  const playerId = user.playerId || user.player_id || null;
  return {
    ...user,
    clubId: null,
    club_id: null,
    playerId: playerId ? String(playerId).trim() : null,
    player_id: playerId ? String(playerId).trim() : null,
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
    ownerLabel: club.ownerLabel || null,
    presidentLabel: club.presidentLabel || null,
    registeredClusterId: club.governance?.registeredClusterId || null,
    registeredCourtIds: [],
    source: "v2-rpc",
  };
}

/** Home member count SoT when Club Storage V2 is on — never local extension. */
export function resolveMyClubHomeMemberCount({ clubSummary, clubStats } = {}) {
  if (isClubStorageV2Enabled()) {
    const n = clubSummary?.memberCount;
    return Number.isFinite(Number(n)) ? Number(n) : 0;
  }
  if (clubStats?.activeMemberCount != null) {
    return Number(clubStats.activeMemberCount) || 0;
  }
  return Number(clubSummary?.memberCount) || 0;
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

  const cacheKey = buildMembershipCacheKey(user.id);
  if (isMembershipResolved(cacheKey) && readMembershipCache(user.id)) {
    return readMembershipCache(user.id);
  }

  if (membershipInflight?.cacheKey === cacheKey) {
    return membershipInflight.promise;
  }

  const promise = resolveMyActiveClubMembershipInner(user).then((result) => {
    writeMembershipCache(user.id, result);
    return result;
  });

  membershipInflight = { cacheKey, promise };
  try {
    return await promise;
  } finally {
    if (membershipInflight?.cacheKey === cacheKey) {
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
