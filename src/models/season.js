function createSeasonId() {
  return `season-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeSeason(season) {
  return {
    id: String(season?.id || "").trim(),
    clubId: String(season?.clubId || "").trim(),
    name: String(season?.name || "").trim(),
    startDate: season?.startDate || null,
    endDate: season?.endDate || null,
    status: season?.status || "draft",
    createdAt: season?.createdAt || new Date().toISOString(),
  };
}

export function createSeasonRecord(clubId, name, options = {}) {
  return normalizeSeason({
    id: options.id || createSeasonId(),
    clubId,
    name: String(name || "").trim(),
    startDate: options.startDate || null,
    endDate: options.endDate || null,
    status: options.status || "active",
    createdAt: new Date().toISOString(),
  });
}
