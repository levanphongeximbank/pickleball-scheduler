import { individualPublicTournamentPath } from "../../../config/tournamentRoutes.js";

export const PUBLIC_TOURNAMENT_DISCOVERY_PATH = "/public/tournaments";

/**
 * Resolve a proven canonical tournament ID for public detail routing.
 *
 * Portal card `id` alone is opaque (catalog PK / mock / synthetic LIVE key) and
 * must NOT be assumed equal to organizer `tournamentId` for `/tournament/:id/public`.
 *
 * Proven sources (Slice 1A):
 * - explicit `canonicalTournamentId`
 * - explicit `tournamentId` (same semantic when already present on the card)
 *
 * @param {Record<string, unknown>|null|undefined} tournament
 * @returns {string|null}
 */
export function resolveCanonicalPublicTournamentId(tournament) {
  if (!tournament || typeof tournament !== "object") return null;
  const explicit = String(
    tournament.canonicalTournamentId || tournament.tournamentId || ""
  ).trim();
  return explicit || null;
}

/**
 * Safe TournamentCard CTA target.
 * With proven canonical ID → `/tournament/:id/public`.
 * Otherwise fail closed to public discovery (no fabricated detail URL).
 *
 * @param {Record<string, unknown>|null|undefined} tournament
 * @returns {string}
 */
export function resolvePublicTournamentCardHref(tournament) {
  const canonicalId = resolveCanonicalPublicTournamentId(tournament);
  if (canonicalId) return individualPublicTournamentPath(canonicalId);
  return PUBLIC_TOURNAMENT_DISCOVERY_PATH;
}
