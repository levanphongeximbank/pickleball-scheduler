/**
 * Phase 45A.1 — Club canonical READ model (pure, framework-free).
 *
 * These helpers encapsulate the decision + selection logic that ClubContext and
 * ClubSwitcher use in canonical read mode. Keeping them pure makes the behavior
 * unit-testable without a React render harness and keeps a single source of
 * truth for both the context and the switcher.
 *
 * This module reads NO storage and performs NO RPC — it only transforms inputs.
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
 * A stale/absent preferred id is rejected → first visible club (or null).
 * localStorage never creates existence: only the visible set can.
 *
 * @param {object} params
 * @param {string|null|undefined} params.preferredClubId
 * @param {Array<{id:string}>} params.visibleClubs
 * @returns {{ activeClubId: string|null, activeClub: object|null, stale: boolean }}
 */
export function resolveActiveClubSelection({ preferredClubId, visibleClubs }) {
  const list = Array.isArray(visibleClubs) ? visibleClubs : [];
  const preferred = String(preferredClubId || "").trim();

  if (preferred) {
    const match = list.find((club) => club.id === preferred);
    if (match) {
      return { activeClubId: preferred, activeClub: match, stale: false };
    }
  }

  const fallback = list[0] || null;
  return {
    activeClubId: fallback ? fallback.id : null,
    activeClub: fallback,
    stale: Boolean(preferred),
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
