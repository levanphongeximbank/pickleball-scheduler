import { findTournamentClubId } from "../../club/services/clubTournamentBridge.js";

const TEAM_PORTAL_PREFIX = "/team-portal/";
const TEAM_REFEREE_PREFIX = "/team-referee/";

export function isTeamTournamentPortalPath(pathname) {
  const path = String(pathname || "").split("?")[0];
  return path.startsWith(TEAM_PORTAL_PREFIX) || path.startsWith(TEAM_REFEREE_PREFIX);
}

export function extractTournamentIdFromPortalPath(pathname) {
  const path = String(pathname || "").split("?")[0];

  for (const prefix of [TEAM_PORTAL_PREFIX, TEAM_REFEREE_PREFIX]) {
    if (!path.startsWith(prefix)) {
      continue;
    }
    const segment = path.slice(prefix.length).split("/")[0];
    const id = segment ? decodeURIComponent(segment).trim() : "";
    return id || null;
  }

  return null;
}

/**
 * Deep-link team portal routes resolve club/tournament from URL + local blob,
 * not from the user's currently selected CLB in the header.
 */
export function applyTeamPortalRouteScope(pathname, scope, { user = null } = {}) {
  if (!isTeamTournamentPortalPath(pathname)) {
    return scope;
  }

  const tournamentId = extractTournamentIdFromPortalPath(pathname);
  if (!tournamentId) {
    return scope;
  }

  const next = {
    ...scope,
    tournamentId,
  };

  const tournamentClubId = findTournamentClubId(tournamentId);
  if (tournamentClubId) {
    next.clubId = tournamentClubId;
    return next;
  }

  // V2 player captain: do not bind RBAC to a stale/wrong activeClubId selection.
  if (!user?.clubId && !user?.club_id) {
    next.clubId = null;
  }

  return next;
}
