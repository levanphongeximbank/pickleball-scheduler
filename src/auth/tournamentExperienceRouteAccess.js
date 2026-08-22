/**
 * Wave 0 — Canonical Tournament Experience route authorization helpers.
 *
 * Owner architecture: `/tournament/:id/*` Experience screens (except register + public)
 * are the ORGANIZER WORKSPACE and require existing TOURNAMENT_UPDATE.
 * Spectator viewing uses `/tournament/:id/public`. Athlete write uses `/register`.
 *
 * Does NOT invent a new permission model. Consumed only by getRouteAccessPermissions.
 */
import { PERMISSIONS } from "./permissions.js";

/** First path segments under /tournament that are hubs/legacy — not Experience :id. */
export const TOURNAMENT_NON_EXPERIENCE_FIRST_SEGMENTS = Object.freeze(
  new Set([
    "list",
    "create",
    "types",
    "roster",
    "organize",
    "operations",
    "results",
    "register",
    "my",
    "teams",
    "schedule",
    "match-reports",
    "config",
    "eligibility",
    "entry-fee",
    "publish-schedule",
    "referee-assign",
    "awards",
    "withdrawal",
    "bracket",
    "daily",
    "internal",
    "official",
    "team",
    "director",
  ])
);

/**
 * Frozen 23-screen organizer workspace segments (Owner Wave 0 final classification).
 * register + public are intentionally excluded.
 */
export const TOURNAMENT_EXPERIENCE_ORGANIZER_SEGMENTS = Object.freeze(
  new Set([
    "overview",
    "settings",
    "registration",
    "participants",
    "pairs",
    "pair-draw",
    "group-draw",
    "groups",
    "schedule",
    "matches",
    "standings",
    "knockout",
    "bracket",
    "director",
    "courts",
    "referees",
    "exceptions",
    "communications",
    "media",
    "awards",
    "complete",
  ])
);

export const TOURNAMENT_EXPERIENCE_ORGANIZER_PERMISSIONS = Object.freeze([
  PERMISSIONS.TOURNAMENT_UPDATE,
]);

export const TOURNAMENT_EXPERIENCE_REGISTER_PERMISSIONS = Object.freeze([
  PERMISSIONS.TOURNAMENT_VIEW,
]);

export const TOURNAMENT_EXPERIENCE_PUBLIC_PERMISSIONS = Object.freeze([
  PERMISSIONS.TOURNAMENT_VIEW,
]);

/**
 * @param {string} pathname
 * @returns {string}
 */
export function normalizeTournamentExperiencePathname(pathname) {
  if (!pathname) return "";
  const path = String(pathname).split("?")[0];
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

/**
 * Parse `/tournament/:tournamentId/:segment` Experience-shaped paths.
 * Returns null for hubs, legacy families, or non-matching shapes.
 *
 * @param {string} pathname
 * @returns {{ tournamentId: string, segment: string } | null}
 */
export function parseTournamentExperiencePath(pathname) {
  const path = normalizeTournamentExperiencePathname(pathname);
  const match = path.match(/^\/tournament\/([^/]+)\/([^/]+)$/);
  if (!match) return null;

  const tournamentId = match[1];
  const segment = match[2];

  if (!tournamentId || tournamentId.includes(":")) return null;
  if (TOURNAMENT_NON_EXPERIENCE_FIRST_SEGMENTS.has(tournamentId)) return null;

  return { tournamentId, segment };
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isTournamentExperienceOrganizerPath(pathname) {
  const parsed = parseTournamentExperiencePath(pathname);
  if (!parsed) return false;
  return TOURNAMENT_EXPERIENCE_ORGANIZER_SEGMENTS.has(parsed.segment);
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isTournamentExperienceRegisterPath(pathname) {
  const parsed = parseTournamentExperiencePath(pathname);
  return Boolean(parsed && parsed.segment === "register");
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isTournamentExperiencePublicPath(pathname) {
  const parsed = parseTournamentExperiencePath(pathname);
  return Boolean(parsed && parsed.segment === "public");
}

/**
 * Experience-specific permission resolution for getRouteAccessPermissions.
 * @returns {readonly string[] | null} null = not an Experience :id surface
 */
export function resolveTournamentExperienceRoutePermissions(pathname) {
  const parsed = parseTournamentExperiencePath(pathname);
  if (!parsed) return null;

  if (parsed.segment === "register") {
    return TOURNAMENT_EXPERIENCE_REGISTER_PERMISSIONS;
  }

  if (parsed.segment === "public") {
    // Registry parity only — route is served outside MainLayout / RouteAccessGate.
    return TOURNAMENT_EXPERIENCE_PUBLIC_PERMISSIONS;
  }

  if (TOURNAMENT_EXPERIENCE_ORGANIZER_SEGMENTS.has(parsed.segment)) {
    return TOURNAMENT_EXPERIENCE_ORGANIZER_PERMISSIONS;
  }

  // Unknown /tournament/:id/<segment> — fail closed as organizer workspace.
  return TOURNAMENT_EXPERIENCE_ORGANIZER_PERMISSIONS;
}
