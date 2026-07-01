import { DEFAULT_CLUB_ELO } from "../constants/clubStatus.js";

export function normalizeClubPlayerRating(rating) {
  const id = String(rating?.id || "").trim();
  const clubId = String(rating?.clubId || "").trim();
  const playerId = String(rating?.playerId || "").trim();
  const tenantId = String(rating?.tenantId || "").trim();

  const elo = Number.isFinite(Number(rating?.elo))
    ? Number(rating.elo)
    : DEFAULT_CLUB_ELO;

  return {
    id: id || `cpr-${clubId}-${playerId}`,
    tenantId,
    clubId,
    playerId,
    elo,
    level: rating?.level != null ? Number(rating.level) : null,
    matchesPlayed: Number(rating?.matchesPlayed) || 0,
    wins: Number(rating?.wins) || 0,
    losses: Number(rating?.losses) || 0,
    lastUpdatedAt: rating?.lastUpdatedAt || new Date().toISOString(),
  };
}

export function createDefaultClubRating({ tenantId, clubId, playerId, level }) {
  const now = new Date().toISOString();
  return normalizeClubPlayerRating({
    id: `cpr-${clubId}-${playerId}`,
    tenantId,
    clubId,
    playerId,
    elo: DEFAULT_CLUB_ELO,
    level: level != null ? Number(level) : null,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    lastUpdatedAt: now,
  });
}
