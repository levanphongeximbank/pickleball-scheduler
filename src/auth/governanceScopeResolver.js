/**
 * Phase 44C.1A — Canonical club-governance elevation resolver.
 *
 * Closes the last authorization dependency on the local registry:
 *   resolveGovernanceElevatedRole() → getClubById() → loadClubs() → pickleball-clubs-v1
 *
 * Frozen ownership contract (Phase 44A / 44C):
 *   - public.club_governance_assignments (Club Storage V2) = governance SSOT
 *   - phase42_has_gov_role() canonical RPC (via clubStorageV2RpcService) = read authority
 *   - rbac.can()/assertCan() = authorization contract
 *   - server RLS/RPC = final enforcement
 *
 * Behavior:
 *   - Club Storage V2 authoritative (Supabase configured + VITE_CLUB_STORAGE_V2):
 *       elevation for a PLAYER is decided ONLY by the canonical governance RPC
 *       (president / vice-president in club_governance_assignments). The snapshot is
 *       async-hydrated per auth user. On cloud ERROR or before hydration → NO
 *       elevation (deny-by-default). The local registry is NEVER read for a grant.
 *   - No V2 (offline / dev / legacy transitional): the LOCAL registry is the single
 *       registry source (parity with the pre-44C.1A behavior). This is not a
 *       "cloud error fallback" — there is no V2 governance SSOT in this environment.
 *
 * This module is the ONE authorization-layer place allowed to read the local club
 * registry (loadClubs) for governance. governanceRoleElevation.js re-exports the
 * decision functions from here and no longer reads the registry itself
 * (see scripts/ci/ownership-lock.mjs → rule "governance-legacy-registry-read").
 */
import { ROLES, normalizeRole } from "./roles.js";
import { loadClubs } from "../data/club.js";
import { getVicePresidentUserIds } from "../features/club/models/clubGovernance.js";
import { isClubStorageV2Enabled } from "../features/club/config/clubRegistryFlags.js";
import { rpcV2HasClubGovernanceRole } from "../features/club/services/clubStorageV2RpcService.js";
import { resolveMyActiveClubMembership } from "../features/club/services/clubActiveMembershipService.js";

/** Governance roles that elevate a PLAYER to CLUB_MANAGER (parity: president OR vice). */
export const GOVERNANCE_MANAGER_ROLES = Object.freeze(["president", "vice_president"]);

export const GOV_SCOPE_STATUS = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
});

function emptySnapshot(status = GOV_SCOPE_STATUS.IDLE, userId = null, source = null) {
  return { status, userId, source, elevated: false, clubId: null, error: null };
}

let snapshot = emptySnapshot();

function userKeyOf(user) {
  return user?.id || "anon";
}

function sameUserId(a, b) {
  if (!a || !b) return false;
  return String(a) === String(b);
}

/** Pure president/vice check against a resolved club record (no registry read). */
function localHasManagerAccess(user, club) {
  if (!user?.id || !club?.governance) {
    return false;
  }
  const gov = club.governance;
  if (sameUserId(user.id, gov.presidentUserId)) {
    return true;
  }
  return getVicePresidentUserIds(gov).some((id) => sameUserId(user.id, id));
}

/** Local registry lookup for the user's assigned club (sanctioned; non-V2 only). */
function resolveLocalClubForGovernance(user, club = null) {
  const clubId = user?.clubId || user?.club_id;
  if (!clubId) {
    return null;
  }
  if (club?.id === clubId) {
    return club;
  }
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }
  try {
    return loadClubs().find((item) => item.id === clubId) || null;
  } catch {
    return null;
  }
}

/** True when Club Storage V2 (canonical governance SSOT) is the authority. */
export function isGovernanceCloudAuthoritative() {
  return isClubStorageV2Enabled();
}

/**
 * Async hydration. Client contexts (Auth/Club) call this once per authenticated
 * user before protected guards evaluate. V2 only: resolves the user's active
 * membership club, then asks the canonical RPC whether they hold a manager
 * governance role. Non-V2 is a no-op (sync path reads the local registry).
 */
export async function hydrateGovernanceScope({ user = null } = {}) {
  const userId = userKeyOf(user);

  if (!isGovernanceCloudAuthoritative()) {
    // Offline / non-V2: nothing to hydrate; the sync path uses the local registry.
    snapshot = { ...emptySnapshot(GOV_SCOPE_STATUS.READY, userId, "local") };
    return { ok: true, status: GOV_SCOPE_STATUS.READY, source: "local", elevated: false };
  }

  if (!user?.id) {
    snapshot = emptySnapshot(GOV_SCOPE_STATUS.READY, userId, "cloud");
    return { ok: true, status: GOV_SCOPE_STATUS.READY, source: "cloud", elevated: false };
  }

  // Only PLAYER can be elevated; non-PLAYER never needs a governance lookup.
  if (normalizeRole(user.role) !== ROLES.PLAYER) {
    snapshot = { ...emptySnapshot(GOV_SCOPE_STATUS.READY, userId, "cloud") };
    return { ok: true, status: GOV_SCOPE_STATUS.READY, source: "cloud", elevated: false };
  }

  snapshot = { ...emptySnapshot(GOV_SCOPE_STATUS.LOADING, userId, "cloud") };

  let membership;
  try {
    membership = await resolveMyActiveClubMembership(user);
  } catch (error) {
    snapshot = {
      ...emptySnapshot(GOV_SCOPE_STATUS.ERROR, userId, "cloud"),
      error: String(error?.message || error || "MEMBERSHIP_LOOKUP_FAILED"),
    };
    return { ok: false, status: GOV_SCOPE_STATUS.ERROR, code: "INTERNAL_ERROR", source: "cloud" };
  }

  if (!membership?.ok) {
    snapshot = {
      ...emptySnapshot(GOV_SCOPE_STATUS.ERROR, userId, "cloud"),
      error: membership?.error || "MEMBERSHIP_LOOKUP_FAILED",
    };
    return { ok: false, status: GOV_SCOPE_STATUS.ERROR, code: "INTERNAL_ERROR", source: "cloud" };
  }

  const clubId = membership.clubId || null;
  if (!clubId) {
    // No active membership → no governance elevation possible.
    snapshot = { status: GOV_SCOPE_STATUS.READY, userId, source: "cloud", elevated: false, clubId: null, error: null };
    return { ok: true, status: GOV_SCOPE_STATUS.READY, source: "cloud", elevated: false };
  }

  const govResult = await rpcV2HasClubGovernanceRole(clubId, GOVERNANCE_MANAGER_ROLES);
  if (!govResult?.ok) {
    snapshot = {
      ...emptySnapshot(GOV_SCOPE_STATUS.ERROR, userId, "cloud"),
      clubId,
      error: govResult?.code || "RPC_FAILED",
    };
    return { ok: false, status: GOV_SCOPE_STATUS.ERROR, code: govResult?.code || "INTERNAL_ERROR", source: "cloud" };
  }

  snapshot = {
    status: GOV_SCOPE_STATUS.READY,
    userId,
    source: "cloud",
    elevated: Boolean(govResult.allowed),
    clubId,
    error: null,
  };
  return { ok: true, status: GOV_SCOPE_STATUS.READY, source: "cloud", elevated: snapshot.elevated };
}

/** Reset governance scope. Call on logout / user switch / tenant switch. */
export function clearGovernanceScope() {
  snapshot = emptySnapshot();
}

/** Current snapshot state (for UI / diagnostics). */
export function getGovernanceScopeState() {
  return {
    status: snapshot.status,
    source: snapshot.source,
    userId: snapshot.userId,
    clubId: snapshot.clubId,
    elevated: snapshot.elevated,
    error: snapshot.error,
  };
}

/**
 * Canonical: is this user a governance manager (president / vice-president)?
 *
 * @param {object} user
 * @param {object|null} club  When provided, a pure check against that (canonical)
 *   club record — used by nav/menu code that already holds the club object.
 */
export function hasClubGovernanceManagerAccess(user, club = null) {
  if (!user?.id) {
    return false;
  }

  if (isGovernanceCloudAuthoritative()) {
    // Explicit club provided (from the cloud registry) → pure canonical check.
    if (club) {
      return localHasManagerAccess(user, club);
    }
    // No club → canonical snapshot, deny-by-default until hydrated. Never read local.
    if (snapshot.userId === userKeyOf(user) && snapshot.status === GOV_SCOPE_STATUS.READY) {
      return snapshot.elevated;
    }
    return false;
  }

  // Offline / non-V2 → local registry is the single source (legacy parity).
  const resolvedClub = resolveLocalClubForGovernance(user, club);
  return resolvedClub ? localHasManagerAccess(user, resolvedClub) : false;
}

/**
 * Canonical elevation: PLAYER + governance manager → CLUB_MANAGER for RBAC;
 * every other role is returned unchanged.
 */
export function resolveGovernanceElevatedRole(user) {
  if (!user?.role) {
    return null;
  }

  const role = normalizeRole(user.role);
  if (role !== ROLES.PLAYER) {
    return role;
  }

  if (hasClubGovernanceManagerAccess(user)) {
    return ROLES.CLUB_MANAGER;
  }

  return role;
}

// --- Test seams (deterministic; simulate a hydrated cloud snapshot without network) ---
export function primeGovernanceScopeForTest({
  user = null,
  elevated = false,
  clubId = null,
  status = GOV_SCOPE_STATUS.READY,
  source = "test",
} = {}) {
  snapshot = { status, userId: userKeyOf(user), source, elevated: Boolean(elevated), clubId, error: null };
  return snapshot;
}

export function setGovernanceScopeErrorForTest({ user = null, code = "RPC_FAILED" } = {}) {
  snapshot = { ...emptySnapshot(GOV_SCOPE_STATUS.ERROR, userKeyOf(user), "cloud"), error: code };
  return snapshot;
}
