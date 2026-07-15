/**
 * Phase 44C.1 — Canonical club-scope resolver.
 *
 * Single source for the club REGISTRY reads used by authorization / API scope.
 * Frozen ownership contract (Phase 44A):
 *   - public.clubs / Club Storage V2 cloud registry = source of truth
 *   - clubStorageV2RpcService (canonical club registry gateway) = read authority
 *   - rbac.can()/assertCan() = authorization contract
 *   - server RLS/RPC = final enforcement
 *
 * Behavior:
 *   - Cloud authoritative (Supabase configured + registry cloud/V2 on):
 *       hydrate from rpcV2ClubListRegistry(). On cloud ERROR → DENY (empty set,
 *       status "error"); NEVER fall back to the local registry to produce a grant.
 *       Synchronous callers must have been async-hydrated (hydrateClubScope) first;
 *       if the current user is not hydrated they observe status "loading" → DENY.
 *   - No cloud configured (offline / dev / test): the LOCAL registry is the single
 *       registry source. This is NOT a "cloud error fallback" — there is no cloud in
 *       this environment, so there is no dual authorization decision.
 *
 * The snapshot is identity-scoped (by auth user id) and MUST be cleared on logout /
 * user switch / tenant switch to prevent cross-user / cross-tenant cache leakage.
 *
 * This module is the ONE authorization-layer place allowed to read loadClubs()
 * (see scripts/ci/ownership-lock.mjs → rule "authorization-legacy-club-registry").
 * Decision functions (rbac.canAccessClub, guardAction, clubScopeService, API
 * handlers) consume this resolver and never read the local registry directly.
 */
import { loadClubs } from "../data/club.js";
import { tenantIdFromRecord } from "../models/tenant.js";
import { hasSupabaseConfig } from "./supabaseClient.js";
import { isClubRegistryCloudAuthoritative } from "../features/club/config/clubRegistryFlags.js";
import { rpcV2ClubListRegistry } from "../features/club/services/clubStorageV2RpcService.js";

export const SCOPE_STATUS = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
});

function emptySnapshot(status = SCOPE_STATUS.IDLE, userId = null, source = null) {
  return { status, userId, source, clubs: [], metaById: new Map(), tenantId: null, error: null };
}

let snapshot = emptySnapshot();
let lastShadowDiff = null;

function userKeyOf(user) {
  return user?.id || "anon";
}

function tenantIdForUser(user) {
  return user?.tenantId || user?.venueId || null;
}

function toMetaRecord(club) {
  return {
    id: club.id,
    name: club.name ?? null,
    venueId: club.venueId ?? null,
    tenantId: tenantIdFromRecord(club) ?? club.tenantId ?? null,
    isDefault: Boolean(club.isDefault),
  };
}

function buildMetaMap(clubs) {
  const map = new Map();
  for (const club of clubs) {
    if (!club?.id) continue;
    map.set(club.id, toMetaRecord(club));
  }
  return map;
}

function filterLocalByTenant(clubs, tenantId) {
  if (!tenantId) return clubs;
  return clubs.filter((club) => {
    const t = tenantIdFromRecord(club);
    return !t || t === tenantId;
  });
}

/** True when the cloud club registry is the authoritative source (Supabase configured + flag). */
export function isCloudRegistryAuthoritative() {
  return Boolean(hasSupabaseConfig()) && isClubRegistryCloudAuthoritative();
}

/**
 * Async hydration. Client contexts (Auth/Club) and API handlers call this once per
 * authenticated user/tenant context before protected guards evaluate.
 */
export async function hydrateClubScope({ user = null, tenantId = tenantIdForUser(user) } = {}) {
  const userId = userKeyOf(user);

  if (isCloudRegistryAuthoritative()) {
    snapshot = { ...emptySnapshot(SCOPE_STATUS.LOADING, userId, "cloud"), tenantId };
    let res;
    try {
      res = await rpcV2ClubListRegistry({ tenantId });
    } catch (error) {
      snapshot = {
        ...emptySnapshot(SCOPE_STATUS.ERROR, userId, "cloud"),
        tenantId,
        error: String(error?.message || error || "RPC_FAILED"),
      };
      return { ok: false, status: SCOPE_STATUS.ERROR, code: "INTERNAL_ERROR", source: "cloud" };
    }
    if (!res?.ok) {
      snapshot = {
        ...emptySnapshot(SCOPE_STATUS.ERROR, userId, "cloud"),
        tenantId,
        error: res?.code || "RPC_FAILED",
      };
      return { ok: false, status: SCOPE_STATUS.ERROR, code: res?.code || "INTERNAL_ERROR", source: "cloud" };
    }
    const clubs = Array.isArray(res.clubs) ? res.clubs : [];
    snapshot = {
      status: SCOPE_STATUS.READY,
      userId,
      source: "cloud",
      clubs,
      metaById: buildMetaMap(clubs),
      tenantId,
      error: null,
    };
    recordShadowDiff(clubs, tenantId);
    return { ok: true, status: SCOPE_STATUS.READY, source: "cloud", count: clubs.length };
  }

  // No cloud configured → local registry is the single registry source.
  const all = loadClubs();
  const scoped = filterLocalByTenant(all, tenantId);
  snapshot = {
    status: SCOPE_STATUS.READY,
    userId,
    source: "local",
    clubs: scoped,
    metaById: buildMetaMap(all),
    tenantId,
    error: null,
  };
  return { ok: true, status: SCOPE_STATUS.READY, source: "local", count: scoped.length };
}

/**
 * Synchronous accessor used by authorization decision functions.
 * Cloud-authoritative mode NEVER reads the local registry: if the current user is
 * not async-hydrated it returns a loading snapshot (→ callers DENY). Offline it
 * builds from the single local registry source (rebuilt per call to match the
 * legacy per-call read and avoid cross-context stale caches).
 */
export function ensureClubScopeSync({ user = null, tenantId = tenantIdForUser(user) } = {}) {
  const userId = userKeyOf(user);

  if (isCloudRegistryAuthoritative()) {
    if (
      snapshot.userId === userId &&
      (snapshot.status === SCOPE_STATUS.READY || snapshot.status === SCOPE_STATUS.ERROR)
    ) {
      return snapshot;
    }
    // Unknown / unhydrated user in cloud mode → deny-by-default (do not read local).
    return { ...emptySnapshot(SCOPE_STATUS.LOADING, userId, "cloud"), tenantId };
  }

  const all = loadClubs();
  const scoped = filterLocalByTenant(all, tenantId);
  snapshot = {
    status: SCOPE_STATUS.READY,
    userId,
    source: "local",
    clubs: scoped,
    metaById: buildMetaMap(all),
    tenantId,
    error: null,
  };
  return snapshot;
}

/** Canonical metadata for a single club (venueId / tenantId / isDefault), scoped to the user. */
export function getClubMetaForAuthz(clubId, options = {}) {
  const snap = ensureClubScopeSync(options);
  return {
    status: snap.status,
    source: snap.source,
    cloudAuthoritative: isCloudRegistryAuthoritative(),
    ready: snap.status === SCOPE_STATUS.READY,
    meta: (clubId && snap.metaById.get(clubId)) || null,
  };
}

/** Canonical list of clubs in scope for the user/tenant. */
export function getScopedClubsForAuthz(options = {}) {
  const snap = ensureClubScopeSync(options);
  return {
    status: snap.status,
    source: snap.source,
    cloudAuthoritative: isCloudRegistryAuthoritative(),
    ready: snap.status === SCOPE_STATUS.READY,
    clubs: snap.clubs,
  };
}

/** Current snapshot state (for UI loading/ready/error surfacing). */
export function getClubScopeState() {
  return {
    status: snapshot.status,
    source: snapshot.source,
    userId: snapshot.userId,
    tenantId: snapshot.tenantId,
    count: snapshot.clubs.length,
    error: snapshot.error,
  };
}

/** Reset scope. Call on logout / user switch / tenant switch. */
export function clearClubScope() {
  snapshot = emptySnapshot();
  lastShadowDiff = null;
}

// --- Shadow comparison (evidence/logging only; NEVER affects the decision) ---
function recordShadowDiff(cloudClubs, tenantId) {
  try {
    const local = filterLocalByTenant(loadClubs(), tenantId);
    const cloudIds = new Set(cloudClubs.map((c) => c.id));
    const localIds = new Set(local.map((c) => c.id));
    const onlyCloud = [...cloudIds].filter((id) => !localIds.has(id));
    const onlyLocal = [...localIds].filter((id) => !cloudIds.has(id));
    lastShadowDiff = { tenantId, onlyCloud, onlyLocal, at: Date.now() };
    const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
    if ((env.DEV || env.VITE_ENABLE_AUTH_DEBUG === "true") && (onlyCloud.length || onlyLocal.length)) {
      console.warn("[club-scope] cloud vs local registry diff (shadow, not a decision)", lastShadowDiff);
    }
  } catch {
    lastShadowDiff = null;
  }
}

export function getLastClubScopeShadowDiff() {
  return lastShadowDiff;
}

// --- Test seams (deterministic; simulate a hydrated cloud snapshot without network) ---
export function primeClubScopeForTest({
  user = null,
  tenantId = tenantIdForUser(user),
  clubs = [],
  status = SCOPE_STATUS.READY,
  source = "test",
} = {}) {
  snapshot = {
    status,
    userId: userKeyOf(user),
    source,
    clubs,
    metaById: buildMetaMap(clubs),
    tenantId,
    error: null,
  };
  return snapshot;
}

export function setClubScopeErrorForTest({ user = null, tenantId = tenantIdForUser(user), code = "RPC_FAILED" } = {}) {
  snapshot = { ...emptySnapshot(SCOPE_STATUS.ERROR, userKeyOf(user), "cloud"), tenantId, error: code };
  return snapshot;
}
