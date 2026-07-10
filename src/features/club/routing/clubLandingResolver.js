/** Phase 42J.1+ — canonical club landing (V2 membership SSOT). */

import {
  MEMBERSHIP_PHASE,
  isMembershipPhasePending,
  resolveMembershipPhase,
} from "../membership/membershipState.js";

/** @deprecated use MEMBERSHIP_PHASE */
export const CLUB_LANDING_STATE = Object.freeze({
  LOADING: "LOADING",
  ERROR: "ERROR",
  NO_MEMBERSHIP: "NO_MEMBERSHIP",
  ACTIVE_MEMBERSHIP: "ACTIVE_MEMBERSHIP",
});

export function resolveClubLandingState(membership) {
  const phase = resolveMembershipPhase(membership);
  if (phase === MEMBERSHIP_PHASE.LOADING || phase === MEMBERSHIP_PHASE.IDLE) {
    return CLUB_LANDING_STATE.LOADING;
  }
  if (phase === MEMBERSHIP_PHASE.ERROR) {
    return CLUB_LANDING_STATE.ERROR;
  }
  if (phase === MEMBERSHIP_PHASE.NONE) {
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

/** Default PLAYER home after membership is ready (not while pending). */
export function resolveClubAwarePlayerHomePath(membership) {
  const phase = resolveMembershipPhase(membership);
  if (isMembershipPhasePending(phase)) {
    return null;
  }
  if (phase === MEMBERSHIP_PHASE.ERROR) {
    return null;
  }
  if (phase === MEMBERSHIP_PHASE.ACTIVE) {
    return "/my-club";
  }
  return "/discover-clubs";
}

/**
 * Phase 42J.2.1 — post-login landing ONLY (ClubPostAuthRedirect / ClubPlayerHomeRedirect).
 * Ignores stale auth-guard `from` paths like /discover-clubs.
 */
export function resolvePostLoginClubPath(membership) {
  const phase = resolveMembershipPhase(membership);
  if (isMembershipPhasePending(phase)) {
    return null;
  }
  if (phase === MEMBERSHIP_PHASE.ERROR) {
    return null;
  }
  if (phase === MEMBERSHIP_PHASE.ACTIVE) {
    return "/my-club";
  }
  return "/discover-clubs";
}

/**
 * Direct protected /my-club access — guard redirect only (not post-login).
 */
export function resolveDirectMyClubPath(membership) {
  const phase = resolveMembershipPhase(membership);
  if (isMembershipPhasePending(phase)) {
    return null;
  }
  if (phase === MEMBERSHIP_PHASE.ERROR) {
    return null;
  }
  if (phase === MEMBERSHIP_PHASE.NONE) {
    return "/discover-clubs";
  }
  return null;
}

/** @deprecated use resolvePostLoginClubPath for login landing */
export function resolvePostAuthClubPath(requestedPath, membership) {
  const ready = resolvePostLoginClubPath(membership);
  if (ready) {
    return ready;
  }
  const path = String(requestedPath || "").split("?")[0];
  if (path === "/my-club") {
    const phase = resolveMembershipPhase(membership);
    return phase === MEMBERSHIP_PHASE.ACTIVE ? "/my-club" : "/discover-clubs";
  }
  return resolveClubAwarePlayerHomePath(membership) || "/discover-clubs";
}
