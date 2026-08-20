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
 * itself (canonical tenantId / tenant_id) — never localStorage, never
 * user.venueId masking, never default-tenant, never venueId cross-fill.
 */
import { API_ERROR_CODES } from "../../api/constants/apiErrors.js";

/** Explicit read states surfaced to the UI. */
export const CLUB_READ_STATE = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
});

/**
 * Persisted active-club id is a HINT, not authority.
 * Clear storage only after AUTHORITATIVE rejection (INVALID), never while PENDING.
 */
export const CLUB_PREFERENCE_STATUS = Object.freeze({
  NONE: "none",
  PENDING_VALIDATION: "pending_validation",
  VALID: "valid",
  INVALID: "invalid",
});

/** Forbidden synthetic tenants — never treat as ready. */
const FORBIDDEN_CANONICAL_TENANTS = new Set(["default-tenant", "default"]);

/**
 * Canonical cloud Club authority.
 *
 * CLOUD_PRESENT + CANONICAL_CAPABILITY_AVAILABLE (live Staging/Production flag
 * TRUE) => singular canonical Club authority. Local blob must not become the
 * authority because a preference is missing or validation is pending.
 *
 * The env flag remains a documented rollback kill-switch: explicit false keeps
 * local compatibility even if cloud config is present. No-cloud => local mode.
 *
 * @param {{ canonicalEnabled?: boolean, hasSupabase?: boolean }} params
 * @returns {boolean}
 */
export function isCanonicalClubReadEnabled({ canonicalEnabled, hasSupabase } = {}) {
  if (!hasSupabase) {
    return false;
  }
  return canonicalEnabled !== false && Boolean(canonicalEnabled);
}

/**
 * Extract explicit canonical tenant identity from a club projection.
 * No localStorage. No user fallback. No default-tenant. No venueId cross-fill.
 *
 * @param {object|null|undefined} club
 * @returns {string|null}
 */
export function resolveExplicitTenantFromCanonicalClub(club) {
  if (!club || typeof club !== "object") {
    return null;
  }
  const raw = club.tenantId ?? club.tenant_id ?? null;
  const tenantId = String(raw || "").trim();
  if (!tenantId || FORBIDDEN_CANONICAL_TENANTS.has(tenantId)) {
    return null;
  }
  return tenantId;
}

/**
 * Normalize a canonical club. tenantId and venueId stay independent.
 * Returns null when the club lacks id or an explicit non-forbidden tenant.
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
  const venueId = String(club.venueId ?? club.venue_id ?? "").trim() || null;
  return {
    ...club,
    id,
    tenantId,
    venueId,
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
    canAccessClub(
      user,
      club.id,
      { venueId: club.venueId || null, tenantId: club.tenantId || null },
      { rbacEnabled }
    )
  );
}

/**
 * Deterministic active-club selection from the canonical visible set.
 * A stale/absent preferred id is rejected → unique visible club (or null).
 * localStorage never creates existence: only the visible set can.
 *
 * When requireTenant=true (canonical ClubContext path), only clubs with an
 * explicit canonical tenant identity are selectable. tenantId and venueId stay
 * independent — venueId is never manufactured from tenantId.
 *
 * When selectedTenantId is provided, clubs outside that operational tenant are
 * rejected even if they remain in an authorized platform-wide catalog.
 *
 * authorityReady=false means the eligible list is not yet authoritative for the
 * selected operational scope (loading, tenant not restored, transient empty).
 * In that case a preferred id stays PENDING_VALIDATION — callers must not clear
 * the persisted hint.
 *
 * @param {object} params
 * @param {string|null|undefined} params.preferredClubId
 * @param {Array<{id:string}>} params.visibleClubs
 * @param {boolean} [params.requireTenant=false]
 * @param {string|null|undefined} [params.selectedTenantId]
 * @param {boolean} [params.authorityReady=true]
 * @returns {{
 *   activeClubId: string|null,
 *   activeClub: object|null,
 *   stale: boolean,
 *   preferenceStatus: string,
 * }}
 */
export function resolveActiveClubSelection({
  preferredClubId,
  visibleClubs,
  requireTenant = false,
  selectedTenantId = null,
  authorityReady = true,
} = {}) {
  const preferred = String(preferredClubId || "").trim();

  if (!authorityReady) {
    return {
      // Keep the hint id for rehydrate continuity; activeClub stays null until validated.
      activeClubId: preferred || null,
      activeClub: null,
      stale: false,
      preferenceStatus: preferred
        ? CLUB_PREFERENCE_STATUS.PENDING_VALIDATION
        : CLUB_PREFERENCE_STATUS.NONE,
    };
  }

  const rawList = Array.isArray(visibleClubs) ? visibleClubs : [];
  const selected = String(selectedTenantId || "").trim() || null;
  let list = requireTenant
    ? rawList.map(normalizeCanonicalActiveClub).filter(Boolean)
    : rawList;

  if (selected) {
    list = list.filter((club) => {
      const clubTenant = resolveExplicitTenantFromCanonicalClub(club);
      return clubTenant === selected;
    });
  }

  if (preferred) {
    const match = list.find((club) => club.id === preferred);
    if (match) {
      const activeClub = requireTenant ? normalizeCanonicalActiveClub(match) : match;
      if (!requireTenant || activeClub) {
        return {
          activeClubId: preferred,
          activeClub,
          stale: false,
          preferenceStatus: CLUB_PREFERENCE_STATUS.VALID,
        };
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
        preferenceStatus: preferred
          ? CLUB_PREFERENCE_STATUS.INVALID
          : CLUB_PREFERENCE_STATUS.NONE,
      };
    }
  }

  return {
    activeClubId: null,
    activeClub: null,
    stale: Boolean(preferred) || list.length > 1,
    preferenceStatus: preferred
      ? CLUB_PREFERENCE_STATUS.INVALID
      : CLUB_PREFERENCE_STATUS.NONE,
  };
}

/**
 * Whether ClubContext may authoritatively validate / clear a persisted club hint.
 * Transient tenant=null or non-READY reads must keep PREFERENCE_PENDING_VALIDATION.
 *
 * @param {{
 *   canonicalRead?: boolean,
 *   clubReadState?: string,
 *   selectedTenantId?: string|null,
 * }} params
 * @returns {boolean}
 */
export function isClubPreferenceAuthorityReady({
  canonicalRead = false,
  clubReadState = CLUB_READ_STATE.IDLE,
  selectedTenantId = null,
} = {}) {
  if (!canonicalRead) {
    return Boolean(String(selectedTenantId || "").trim());
  }
  return (
    clubReadState === CLUB_READ_STATE.READY &&
    Boolean(String(selectedTenantId || "").trim())
  );
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
