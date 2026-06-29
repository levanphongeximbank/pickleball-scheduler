export function normalizeCourtSchedule(schedule) {
  if (!schedule || typeof schedule !== "object") {
    return null;
  }

  const courtIds = Array.isArray(schedule.courtIds)
    ? schedule.courtIds.filter((id) => id !== null && id !== undefined)
    : [];

  const date = schedule.date ? String(schedule.date).slice(0, 10) : "";
  const startTime = schedule.startTime ? String(schedule.startTime).slice(0, 5) : "";
  const endTime = schedule.endTime ? String(schedule.endTime).slice(0, 5) : "";

  if (!date || !startTime || !endTime || courtIds.length === 0) {
    return null;
  }

  return {
    date,
    startTime,
    endTime,
    courtIds,
    syncedAt: schedule.syncedAt || null,
  };
}
