/** Phase 42J.1 — canonical club landing states (V2 membership SSOT). */

export const CLUB_LANDING_STATE = Object.freeze({
  LOADING: "LOADING",
  ERROR: "ERROR",
  NO_MEMBERSHIP: "NO_MEMBERSHIP",
  ACTIVE_MEMBERSHIP: "ACTIVE_MEMBERSHIP",
});

/**
 * Resolve landing state from membership hook / RPC result.
 * Never uses profiles.club_id, user.clubId, or localStorage.
 */
export function resolveClubLandingState({ loading, ok, hasActiveMembership }) {
  if (loading) {
    return CLUB_LANDING_STATE.LOADING;
  }
  if (!ok) {
    return CLUB_LANDING_STATE.ERROR;
  }
  if (!hasActiveMembership) {
    return CLUB_LANDING_STATE.NO_MEMBERSHIP;
  }
  return CLUB_LANDING_STATE.ACTIVE_MEMBERSHIP;
}

/** Target path after landing is resolved (null = stay on current route). */
export function resolveClubLandingRedirect({
  landingState,
  pathname = "",
  requiresActiveMembership = false,
}) {
  const path = String(pathname || "").split("?")[0];

  if (landingState === CLUB_LANDING_STATE.LOADING || landingState === CLUB_LANDING_STATE.ERROR) {
    return null;
  }

  if (requiresActiveMembership && landingState === CLUB_LANDING_STATE.NO_MEMBERSHIP) {
    return "/discover-clubs";
  }

  if (path === "/my-club" && landingState === CLUB_LANDING_STATE.NO_MEMBERSHIP) {
    return "/discover-clubs";
  }

  return null;
}

/** Post-login / default home for club-aware PLAYER (V2). */
export function resolveClubAwarePlayerHomePath({ hasActiveMembership, loading }) {
  if (loading) {
    return "/my-club";
  }
  if (hasActiveMembership) {
    return "/my-club";
  }
  return "/discover-clubs";
}
