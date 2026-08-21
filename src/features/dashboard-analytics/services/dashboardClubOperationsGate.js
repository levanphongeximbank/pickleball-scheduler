/**
 * Dashboard Club Operations mount gate.
 *
 * AUTHORIZATION_ALLOWED ≠ OPERATIONAL_TARGET_READY.
 * Permission to view club operations must never alone mount Club-scoped services.
 *
 * ClubContext already exposes readiness signals — this helper only composes them.
 * Does NOT read localStorage. Does NOT auto-select a club. Does NOT weaken
 * assertExplicitClubId.
 */

import { CLUB_READ_STATE } from "../../club/context/clubCanonicalReadModel.js";

/** Dashboard-level club context lifecycle (distinct from empty business data). */
export const DASHBOARD_CLUB_CONTEXT_STATE = Object.freeze({
  AUTH_BOOTSTRAPPING: "AUTH_BOOTSTRAPPING",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  CLUB_CONTEXT_LOADING: "CLUB_CONTEXT_LOADING",
  CLUB_CONTEXT_READY_WITH_CLUB: "CLUB_CONTEXT_READY_WITH_CLUB",
  CLUB_CONTEXT_READY_NO_CLUB: "CLUB_CONTEXT_READY_NO_CLUB",
  CLUB_CONTEXT_ERROR: "CLUB_CONTEXT_ERROR",
});

/**
 * @param {{
 *   authLoading?: boolean,
 *   isAuthenticated?: boolean,
 *   canonicalClubRead?: boolean,
 *   clubReadState?: string|null,
 *   clubReadReady?: boolean,
 *   activeClubReady?: boolean,
 *   activeClubId?: string|null,
 *   activeClub?: { id?: string|null }|null,
 *   permissionAllowsClubOperations?: boolean,
 * }} input
 * @returns {{
 *   state: string,
 *   mountClubOperations: boolean,
 *   showClubOperationsPlaceholder: boolean,
 *   reason: string|null,
 * }}
 */
export function resolveDashboardClubOperationsGate(input = {}) {
  const authLoading = Boolean(input.authLoading);
  const isAuthenticated = Boolean(input.isAuthenticated);
  const canonicalClubRead = Boolean(input.canonicalClubRead);
  const clubReadState = String(input.clubReadState || "").trim() || null;
  const clubReadReady =
    input.clubReadReady !== undefined
      ? Boolean(input.clubReadReady)
      : !canonicalClubRead || clubReadState === CLUB_READ_STATE.READY;
  const activeClubReady = Boolean(input.activeClubReady);
  const activeClubId = String(input.activeClubId || "").trim() || null;
  const activeClubResolvedId = String(input.activeClub?.id || "").trim() || null;
  const permissionAllows = input.permissionAllowsClubOperations !== false;

  if (authLoading) {
    return deny(DASHBOARD_CLUB_CONTEXT_STATE.AUTH_BOOTSTRAPPING, "auth_bootstrapping");
  }

  if (!isAuthenticated) {
    return deny(DASHBOARD_CLUB_CONTEXT_STATE.UNAUTHENTICATED, "unauthenticated");
  }

  if (!permissionAllows) {
    return {
      state: DASHBOARD_CLUB_CONTEXT_STATE.CLUB_CONTEXT_READY_NO_CLUB,
      mountClubOperations: false,
      showClubOperationsPlaceholder: false,
      reason: "permission_denied",
    };
  }

  if (canonicalClubRead) {
    if (clubReadState === CLUB_READ_STATE.ERROR) {
      return deny(DASHBOARD_CLUB_CONTEXT_STATE.CLUB_CONTEXT_ERROR, "club_read_error", true);
    }

    if (
      clubReadState === CLUB_READ_STATE.LOADING ||
      clubReadState === CLUB_READ_STATE.IDLE ||
      !clubReadReady
    ) {
      return deny(DASHBOARD_CLUB_CONTEXT_STATE.CLUB_CONTEXT_LOADING, "club_context_loading", true);
    }
  }

  const explicitCanonicalReady =
    Boolean(activeClubId) &&
    Boolean(activeClubResolvedId) &&
    activeClubId === activeClubResolvedId &&
    activeClubReady;

  if (explicitCanonicalReady) {
    return {
      state: DASHBOARD_CLUB_CONTEXT_STATE.CLUB_CONTEXT_READY_WITH_CLUB,
      mountClubOperations: true,
      showClubOperationsPlaceholder: false,
      reason: null,
    };
  }

  return deny(
    DASHBOARD_CLUB_CONTEXT_STATE.CLUB_CONTEXT_READY_NO_CLUB,
    activeClubId && !activeClubReady ? "active_club_not_ready" : "no_canonical_club",
    true
  );
}

function deny(state, reason, showPlaceholder = false) {
  return {
    state,
    mountClubOperations: false,
    showClubOperationsPlaceholder: showPlaceholder,
    reason,
  };
}
