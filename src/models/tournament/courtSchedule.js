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

export function courtScheduleFieldsMatch(actual, expected) {
  const left = normalizeCourtSchedule(actual);
  const right = normalizeCourtSchedule(expected);
  if (!left || !right) {
    return false;
  }
  if (
    left.date !== right.date ||
    left.startTime !== right.startTime ||
    left.endTime !== right.endTime
  ) {
    return false;
  }
  const leftIds = new Set(left.courtIds.map(String));
  const rightIds = new Set(right.courtIds.map(String));
  if (
    leftIds.size !== left.courtIds.length ||
    rightIds.size !== right.courtIds.length
  ) {
    return false;
  }
  if (leftIds.size !== rightIds.size) {
    return false;
  }
  for (const id of rightIds) {
    if (!leftIds.has(id)) {
      return false;
    }
  }
  return true;
}
