/** Phase 42J — canonical club routes & resolution (no profile.club_id SoT). */

export const CLUB_ROUTE_PATHS = Object.freeze({
  MY_CLUB: "/my-club",
  DISCOVER: "/discover-clubs",
  REQUESTS: "/my-club/requests",
});

export const MY_CLUB_MEMBER_VIEWS = Object.freeze(["home", "schedule", "members"]);

const LEGACY_DISCOVER_VIEWS = new Set(["discover"]);

/**
 * Legacy ?view=discover on /my-club → canonical discover route.
 */
export function resolveLegacyMyClubQueryRedirect(searchParams) {
  const view = String(searchParams?.get?.("view") || "").trim().toLowerCase();
  if (LEGACY_DISCOVER_VIEWS.has(view)) {
    return CLUB_ROUTE_PATHS.DISCOVER;
  }
  return null;
}

/**
 * Resolve in-page tab for /my-club (active members only).
 */
export function resolveMyClubMemberView(searchParams) {
  const view = String(searchParams?.get?.("view") || "").trim().toLowerCase();
  if (MY_CLUB_MEMBER_VIEWS.includes(view)) {
    return view;
  }
  return "home";
}

/**
 * Whether /my-club should redirect to discover (SSOT: no active membership).
 * RPC error → do not redirect (show error + retry).
 */
export function shouldRedirectMyClubToDiscover({ loading, ok, hasActiveMembership }) {
  if (loading) {
    return false;
  }
  if (!ok) {
    return false;
  }
  return !hasActiveMembership;
}

/**
 * Browser back/forward redirect loop guard (session-scoped).
 */
const LOOP_GUARD_KEY = "club-42j-redirect-ts";
const LOOP_GUARD_MS = 1500;

export function markClubRouteRedirect(fromPath, toPath) {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(
      LOOP_GUARD_KEY,
      JSON.stringify({ from: fromPath, to: toPath, at: Date.now() })
    );
  } catch {
    /* ignore quota */
  }
}

export function isClubRouteRedirectLoop(fromPath, toPath) {
  if (typeof sessionStorage === "undefined") {
    return false;
  }
  try {
    const raw = sessionStorage.getItem(LOOP_GUARD_KEY);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.at || Date.now() - parsed.at > LOOP_GUARD_MS) {
      return false;
    }
    return parsed.from === toPath && parsed.to === fromPath;
  } catch {
    return false;
  }
}

export function clearClubRouteRedirectLoop() {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    sessionStorage.removeItem(LOOP_GUARD_KEY);
  } catch {
    /* ignore */
  }
}
