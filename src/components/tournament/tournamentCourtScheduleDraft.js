export const COURT_SCHEDULE_DEFAULT_START = "07:00";
export const COURT_SCHEDULE_DEFAULT_END = "12:00";

export function hydrateCourtScheduleDraft(schedule, todayIso) {
  return {
    date: schedule?.date || todayIso,
    startTime: schedule?.startTime || COURT_SCHEDULE_DEFAULT_START,
    endTime: schedule?.endTime || COURT_SCHEDULE_DEFAULT_END,
    courtIds: Array.isArray(schedule?.courtIds) ? [...schedule.courtIds] : [],
  };
}

export function shouldResetCourtScheduleDraftOnTournamentChange(prevId, nextId) {
  return String(prevId || "") !== String(nextId || "");
}

export function applyCourtInventoryToDraftCourtIds(
  currentCourtIds,
  courts,
  persistedCourtIds = []
) {
  if (!Array.isArray(courts) || courts.length === 0) {
    return Array.isArray(currentCourtIds) ? currentCourtIds : [];
  }
  const stillValid = (currentCourtIds || []).filter((id) =>
    courts.some((court) => String(court.id) === String(id))
  );
  if (stillValid.length) {
    return stillValid;
  }
  return (persistedCourtIds || []).filter((id) =>
    courts.some((court) => String(court.id) === String(id))
  );
}

export function courtIdIsSelected(courtIds, courtId) {
  return (courtIds || []).some((id) => String(id) === String(courtId));
}
