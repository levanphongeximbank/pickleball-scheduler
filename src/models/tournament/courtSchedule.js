export function normalizeCourtSchedule(schedule) {
  if (!schedule || typeof schedule !== "object") {
    return null;
  }

  const physicalCourtIds = Array.isArray(schedule.physicalCourtIds)
    ? schedule.physicalCourtIds.filter((id) => id !== null && id !== undefined)
    : [];

  const courtIds = Array.isArray(schedule.courtIds)
    ? schedule.courtIds.filter((id) => id !== null && id !== undefined)
    : physicalCourtIds.length > 0
      ? [...physicalCourtIds]
      : [];

  const date = schedule.date ? String(schedule.date).slice(0, 10) : "";
  const startTime = schedule.startTime ? String(schedule.startTime).slice(0, 5) : "";
  const endTime = schedule.endTime ? String(schedule.endTime).slice(0, 5) : "";
  const clusterId =
    schedule.clusterId == null || String(schedule.clusterId).trim() === ""
      ? null
      : String(schedule.clusterId).trim();

  if (!date || !startTime || !endTime || courtIds.length === 0) {
    return null;
  }

  return {
    date,
    startTime,
    endTime,
    courtIds,
    // Canonical identity when provided; otherwise courtIds may hold UUIDs on Adapter B path.
    physicalCourtIds: physicalCourtIds.length > 0 ? physicalCourtIds : [...courtIds],
    clusterId,
    syncedAt: schedule.syncedAt || null,
  };
}
