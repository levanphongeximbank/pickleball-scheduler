/**
 * Phase 45A.1 — Club canonical READ model (pure, framework-free).
 *
 * These helpers encapsulate the decision + selection logic that ClubContext and
 * ClubSwitcher use in canonical read mode. Keeping them pure makes the behavior
 * unit-testable without a React render harness and keeps a single source of
 * truth for both the context and the switcher.
 *
 * This module reads NO storage and performs NO RPC — it only transforms inputs.
 * Tenant identity for canonical activeClub must come from the club projection
 * itself (tenantId | venueId | tenant_id | venue_id) — never localStorage,
 * never user.venueId masking, never default-tenant.
 */
import { API_ERROR_CODES } from "../../api/constants/apiErrors.js";

/** Explicit read states surfaced to the UI. */
export const CLUB_READ_STATE = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
});

/** Forbidden synthetic tenants — never treat as ready. */
const FORBIDDEN_CANONICAL_TENANTS = new Set(["default-tenant", "default"]);

/**
 * Canonical cloud read mode requires BOTH the feature flag AND a cloud backend.
 * When there is no Supabase config, the app runs in explicit offline/local mode
 * and the legacy registry remains the read path (never a broken cloud RPC).
 *
 * @param {{ canonicalEnabled?: boolean, hasSupabase?: boolean }} params
 * @returns {boolean}
 */
export function isCanonicalClubReadEnabled({ canonicalEnabled, hasSupabase } = {}) {
  return Boolean(canonicalEnabled) && Boolean(hasSupabase);
}

/**
 * Extract explicit tenant identity from a canonical club projection.
 * No localStorage. No user fallback. No default-tenant.
 *
 * @param {object|null|undefined} club
 * @returns {string|null}
 */
export function resolveExplicitTenantFromCanonicalClub(club) {
  if (!club || typeof club !== "object") {
    return null;
  }
  const raw =
    club.tenantId ?? club.venueId ?? club.tenant_id ?? club.venue_id ?? null;
  const tenantId = String(raw || "").trim();
  if (!tenantId || FORBIDDEN_CANONICAL_TENANTS.has(tenantId)) {
    return null;
  }
  return tenantId;
}

/**
 * Normalize a canonical club so tenantId and venueId are both present and equal
 * when the architecture treats them as the same authority. Returns null when
 * the club lacks id or an explicit non-forbidden tenant — not tenant-ready.
 *
 * @param {object|null|undefined} club
 * @returns {object|null}
 */
export function normalizeCanonicalActiveClub(club) {
  if (!club || typeof club !== "object") {
    return null;
  }
  const id = String(club.id || "").trim();
  if (!id) {
    return null;
  }
  const tenantId = resolveExplicitTenantFromCanonicalClub(club);
  if (!tenantId) {
    return null;
  }
  return {
    ...club,
    id,
    tenantId,
    venueId: tenantId,
  };
}

/**
 * Fail-closed readiness for tenant-scoped consumers (Tournament, Daily Play, …).
 *
 * @param {object|null|undefined} club
 * @returns {boolean}
 */
export function isCanonicalActiveClubReady(club) {
  return Boolean(normalizeCanonicalActiveClub(club));
}

/**
 * Map a canonical repository result code → a registered canonical API error code.
 * Prevents ad-hoc string error codes leaking into the UI contract.
 *
 * @param {string|null|undefined} code
 * @returns {string}
 */
export function mapRepoCodeToClubError(code) {
  switch (code) {
    case "CLUB_OUT_OF_SCOPE":
      return API_ERROR_CODES.CLUB_OUT_OF_SCOPE;
    case "CLUB_REQUIRED":
    case "CLUB_ID_REQUIRED":
      return API_ERROR_CODES.CLUB_REQUIRED;
    case "NOT_FOUND":
    case "DEFAULT_CLUB_NOT_ALLOWED":
      return API_ERROR_CODES.NOT_FOUND;
    case "FORBIDDEN":
    case "TENANT_FORBIDDEN":
    case "CROSS_TENANT_ACCESS":
      return API_ERROR_CODES.FORBIDDEN;
    default:
      return API_ERROR_CODES.INTERNAL_ERROR;
  }
}

/**
 * Authorization filter for the canonical club list. Mirrors the legacy
 * visibleClubs authorization filter so switching read source does not change
 * which clubs a user may see.
 *
 * @param {object} params
 * @param {Array<{id:string, venueId?:string|null}>} params.clubs
 * @param {object|null} params.user
 * @param {boolean} params.rbacEnabled
 * @param {boolean} params.isAuthenticated
 * @param {(user:object, clubId:string, scope:object, opts:object)=>boolean} params.canAccessClub
 * @returns {Array}
 */
export function filterAccessibleCanonicalClubs({
  clubs,
  user,
  rbacEnabled,
  isAuthenticated,
  canAccessClub,
}) {
  const list = Array.isArray(clubs) ? clubs : [];
  if (!rbacEnabled || !isAuthenticated) {
    return list;
  }
  if (typeof canAccessClub !== "function") {
    return list;
  }
  return list.filter((club) =>
    canAccessClub(user, club.id, { venueId: club.venueId || null }, { rbacEnabled })
  );
}

/**
 * Deterministic active-club selection from the canonical visible set.
 * A stale/absent preferred id is rejected → unique visible club (or null).
 * localStorage never creates existence: only the visible set can.
 *
 * When requireTenant=true (canonical ClubContext path), only clubs with an
 * explicit tenant identity are selectable; the returned activeClub is
 * normalized to expose both tenantId and venueId.
 *
 * @param {object} params
 * @param {string|null|undefined} params.preferredClubId
 * @param {Array<{id:string}>} params.visibleClubs
 * @param {boolean} [params.requireTenant=false]
 * @returns {{ activeClubId: string|null, activeClub: object|null, stale: boolean }}
 */
export function resolveActiveClubSelection({
  preferredClubId,
  visibleClubs,
  requireTenant = false,
} = {}) {
  const rawList = Array.isArray(visibleClubs) ? visibleClubs : [];
  const list = requireTenant
    ? rawList.map(normalizeCanonicalActiveClub).filter(Boolean)
    : rawList;
  const preferred = String(preferredClubId || "").trim();

  if (preferred) {
    const match = list.find((club) => club.id === preferred);
    if (match) {
      const activeClub = requireTenant ? normalizeCanonicalActiveClub(match) : match;
      if (!requireTenant || activeClub) {
        return { activeClubId: preferred, activeClub, stale: false };
      }
    }
  }

  // Phase 2F: never silent first-of-many. Auto-select only when exactly one club.
  if (list.length === 1) {
    const only = list[0];
    const activeClub = requireTenant ? normalizeCanonicalActiveClub(only) : only;
    if (!requireTenant || activeClub) {
      return {
        activeClubId: only.id,
        activeClub,
        stale: Boolean(preferred),
      };
    }
  }

  return {
    activeClubId: null,
    activeClub: null,
    stale: Boolean(preferred) || list.length > 1,
  };
}

/**
 * Stable ClubContext identity — token/session object churn must not count.
 */
export function readClubAuthIdentityKey({
  isAuthenticated = false,
  userId = "",
  role = "",
  tenantId = "",
  rbacEnabled = false,
} = {}) {
  return [
    isAuthenticated ? "1" : "0",
    String(userId || "").trim(),
    String(role || "").trim(),
    String(tenantId || "").trim(),
    rbacEnabled ? "1" : "0",
  ].join("::");
}

/**
 * Same auth/tenant identity: keep lastClubs / lastActiveClub (stale-while-revalidate).
 * Sign-out or a real user/tenant change: clear so the previous context cannot leak.
 */
export function resolveCanonicalClubRefreshPolicy({
  previousIdentityKey = "",
  nextIdentityKey = "",
  clubReadState = CLUB_READ_STATE.IDLE,
  clubCount = 0,
} = {}) {
  const parts = String(nextIdentityKey || "").split("::");
  const authenticated = parts[0] === "1";
  const nextUserId = String(parts[1] || "").trim();
  if (!authenticated || !nextUserId) {
    return {
      clearClubs: true,
      emitLoading: false,
      idle: true,
      staleWhileRevalidate: false,
    };
  }
  if (String(previousIdentityKey || "") !== String(nextIdentityKey || "")) {
    return {
      clearClubs: true,
      emitLoading: true,
      idle: false,
      staleWhileRevalidate: false,
    };
  }
  if (clubReadState === CLUB_READ_STATE.READY && Number(clubCount) > 0) {
    return {
      clearClubs: false,
      emitLoading: false,
      idle: false,
      staleWhileRevalidate: true,
    };
  }
  return {
    clearClubs: true,
    emitLoading: true,
    idle: false,
    staleWhileRevalidate: false,
  };
}

/**
 * Map a canonical repository read result → an explicit UI snapshot.
 * A cloud error/loading never silently exposes legacy clubs (clubs = []).
 *
 * @param {object|null} result canonical repo result ({ ok, data, code })
 * @returns {{ state: string, clubs: Array, errorCode: string|null }}
 */
export function toClubReadSnapshot(result) {
  if (!result) {
    return { state: CLUB_READ_STATE.ERROR, clubs: [], errorCode: API_ERROR_CODES.INTERNAL_ERROR };
  }
  if (result.ok) {
    return {
      state: CLUB_READ_STATE.READY,
      clubs: Array.isArray(result.data) ? result.data : [],
      errorCode: null,
    };
  }
  return {
    state: CLUB_READ_STATE.ERROR,
    clubs: [],
    errorCode: mapRepoCodeToClubError(result.code),
  };
}
