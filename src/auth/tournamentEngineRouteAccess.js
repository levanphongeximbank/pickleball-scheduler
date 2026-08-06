/**
 * Tournament Engine plural-route authorization helpers (Phase 4 OD-PLURAL-AUTHZ).
 * Public catalog `/tournaments` (and `/tournaments/`) stays public; `/tournaments/:id/*` is protected.
 *
 * Engine authorization uses the canonical permission (`tournament.update`) and
 * ownership/tenant authorities (`assertTournamentAccess` / `guardClubAccess`) with
 * forced enforcement whenever auth is active — independent of VITE_RBAC_ENABLED.
 */
import { PERMISSIONS } from "./permissions.js";
import { can } from "./rbac.js";
import { assertTournamentAccess } from "../domain/tournamentService.js";
import { resolveTournamentClubId } from "../features/club/services/clubTournamentBridge.js";

/** Local mirror of authGuard.isAuthRequired — avoid circular import with authGuard. */
function isAuthzActive({ authProductionEnabled, rbacEnabled }) {
  return Boolean(authProductionEnabled || rbacEnabled);
}

const ENGINE_TABS = new Set([
  "engine",
  "seed",
  "draw",
  "schedule",
  "courts",
  "ranking",
  "logs",
]);

export const TOURNAMENT_ENGINE_ROUTE_PERMISSIONS = Object.freeze([
  PERMISSIONS.TOURNAMENT_UPDATE,
]);

/**
 * Normalize pathname for catalog / engine matching (strip query; collapse trailing slash on root).
 * @param {string} pathname
 * @returns {string}
 */
export function normalizeTournamentsPathname(pathname) {
  if (!pathname) return "";
  const path = String(pathname).split("?")[0];
  if (path === "/tournaments/") return "/tournaments";
  return path;
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isTournamentEnginePath(pathname) {
  if (!pathname) return false;
  const path = normalizeTournamentsPathname(pathname);
  const match = path.match(/^\/tournaments\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return false;
  return ENGINE_TABS.has(match[2]);
}

/**
 * Exact public catalog only — not Engine descendants.
 * Treats `/tournaments` and `/tournaments/` as equivalent.
 * @param {string} pathname
 * @returns {boolean}
 */
export function isPublicTournamentsCatalogPath(pathname) {
  if (!pathname) return false;
  return normalizeTournamentsPathname(pathname) === "/tournaments";
}

/**
 * @param {string} pathname
 * @returns {{ tournamentId: string, tab: string } | null}
 */
export function parseTournamentEnginePath(pathname) {
  if (!pathname) return null;
  const path = normalizeTournamentsPathname(pathname);
  const match = path.match(/^\/tournaments\/([^/]+)\/([^/]+)\/?$/);
  if (!match || !ENGINE_TABS.has(match[2])) return null;
  return { tournamentId: match[1], tab: match[2] };
}

/**
 * Synchronous ownership / tenant check for Engine deep links.
 * When forceAuthz is true, club/tenant authority is evaluated with RBAC semantics
 * so auth-active + RBAC-flag-OFF cannot bypass ownership (BR-PLURAL-01).
 *
 * @param {{
 *   pathname: string,
 *   user: object|null,
 *   activeClubId?: string|null,
 *   rbacEnabled?: boolean,
 *   tenantId?: string|null,
 *   forceAuthz?: boolean,
 * }} args
 */
export function evaluateTournamentEngineRouteAccess({
  pathname,
  user,
  activeClubId = null,
  rbacEnabled = false,
  tenantId = null,
  forceAuthz = false,
} = {}) {
  const parsed = parseTournamentEnginePath(pathname);
  if (!parsed) {
    return { ok: false, code: "NOT_ENGINE_ROUTE", tournament: null };
  }

  const { tournamentId } = parsed;
  if (!tournamentId || tournamentId.includes(":")) {
    return { ok: false, code: "INVALID_TOURNAMENT_ID", tournament: null };
  }

  const clubId = resolveTournamentClubId(activeClubId, tournamentId);
  if (!clubId) {
    return { ok: false, code: "TOURNAMENT_NOT_FOUND", tournament: null };
  }

  const enforceRbac = forceAuthz ? true : Boolean(rbacEnabled);

  const access = assertTournamentAccess(clubId, tournamentId, {
    user,
    rbacEnabled: enforceRbac,
    tenantId: tenantId || user?.tenantId || user?.venueId || null,
  });

  if (!access.ok) {
    return {
      ok: false,
      code: access.code || "FORBIDDEN",
      error: access.error,
      tournament: null,
      clubId,
    };
  }

  return {
    ok: true,
    code: "OK",
    tournament: access.tournament,
    clubId,
    tab: parsed.tab,
  };
}

/**
 * Full Engine route gate decision used by RouteAccessGate.
 * Permission + ownership are enforced whenever auth is active, regardless of RBAC flag.
 *
 * @returns {{
 *   apply: boolean,
 *   ok?: boolean,
 *   redirect?: 'login'|'forbidden'|null,
 *   code?: string,
 * }}
 */
export function decideTournamentEngineRouteGate({
  pathname,
  user = null,
  isAuthenticated = false,
  scope = {},
  activeClubId = null,
  authProductionEnabled = false,
  rbacEnabled = false,
  tenantId = null,
} = {}) {
  if (!isTournamentEnginePath(pathname)) {
    return { apply: false };
  }

  if (!isAuthzActive({ authProductionEnabled, rbacEnabled })) {
    return { apply: false };
  }

  if (!isAuthenticated || !user?.id) {
    return {
      apply: true,
      ok: false,
      redirect: "login",
      code: "UNAUTHENTICATED",
    };
  }

  // Canonical permission authority — forced on (not gated by VITE_RBAC_ENABLED).
  const allowed = can(user, PERMISSIONS.TOURNAMENT_UPDATE, scope, { rbacEnabled: true });
  if (!allowed) {
    return {
      apply: true,
      ok: false,
      redirect: "forbidden",
      code: "FORBIDDEN_PERMISSION",
    };
  }

  const ownership = evaluateTournamentEngineRouteAccess({
    pathname,
    user,
    activeClubId,
    forceAuthz: true,
    tenantId: tenantId || user?.tenantId || user?.venueId || null,
  });

  if (!ownership.ok) {
    return {
      apply: true,
      ok: false,
      redirect: "forbidden",
      code: ownership.code || "FORBIDDEN_OWNERSHIP",
      ownership,
    };
  }

  return {
    apply: true,
    ok: true,
    redirect: null,
    code: "OK",
    ownership,
  };
}
