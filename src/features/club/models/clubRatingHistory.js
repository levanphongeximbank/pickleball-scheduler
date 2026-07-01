export function normalizeClubRatingHistory(entry) {
  return {
    id: String(entry?.id || `crh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    tenantId: String(entry?.tenantId || "").trim(),
    clubId: String(entry?.clubId || "").trim(),
    playerId: String(entry?.playerId || "").trim(),
    oldElo: Number(entry?.oldElo) || 0,
    newElo: Number(entry?.newElo) || 0,
    reason: String(entry?.reason || "").trim() || null,
    changedByUserId: String(entry?.changedByUserId || "").trim(),
    changedAt: entry?.changedAt || new Date().toISOString(),
  };
}
