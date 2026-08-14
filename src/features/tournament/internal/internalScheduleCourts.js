/**
 * Internal schedule courts — projection from shared club court inventory.
 * Internal does not own courts; it consumes club_data_v3 via Team/Daily reader.
 */
import { isCourtBookable } from "../../../models/court.js";
import { listCanonicalClubCourtsForFormatVenue } from "../../team-tournament/services/canonicalClubCourtInventory.js";

export const INTERNAL_COURT_AUTHORITY = "club_data_v3";
export const INTERNAL_COURT_READER = "listCanonicalClubCourtsForFormatVenue";

export const INTERNAL_COURT_AVAILABILITY = Object.freeze({
  AVAILABLE: "available",
  NONE_CONFIGURED: "none_configured",
  ALL_UNAVAILABLE: "all_unavailable",
});

export const INTERNAL_COURT_COPY = Object.freeze({
  [INTERNAL_COURT_AVAILABILITY.NONE_CONFIGURED]:
    "CLB chưa có sân khả dụng. Hãy cấu hình sân trước khi xếp lịch.",
  [INTERNAL_COURT_AVAILABILITY.ALL_UNAVAILABLE]:
    "Hiện không có sân trống trong khung thời gian đã chọn.",
});

export function projectInternalScheduleCourt(court, index = 0) {
  if (!court || typeof court !== "object") return null;
  const bookable = isCourtBookable(court);
  return {
    id: String(court.id || `court-${index + 1}`),
    name: String(court.name || court.id || `Sân ${index + 1}`),
    active: court.active !== false,
    status: court.status || (bookable ? "active" : "locked"),
    locked: !bookable,
    number: court.number ?? index + 1,
    clubId: court.clubId || "",
    tenantId: court.tenantId || court.venueId || "",
  };
}

export function projectInternalScheduleCourts(courts = []) {
  return (Array.isArray(courts) ? courts : [])
    .map((court, index) => projectInternalScheduleCourt(court, index))
    .filter(Boolean);
}

export function listInternalAvailableScheduleCourts(courts = []) {
  return projectInternalScheduleCourts(courts).filter((court) => !court.locked);
}

export function classifyInternalCourtAvailability(courts = []) {
  const projected = projectInternalScheduleCourts(courts);
  const available = projected.filter((court) => !court.locked);
  if (projected.length === 0) {
    return {
      state: INTERNAL_COURT_AVAILABILITY.NONE_CONFIGURED,
      sourceCount: 0,
      activeCount: 0,
      unlockedCount: 0,
      availableCount: 0,
      message: INTERNAL_COURT_COPY[INTERNAL_COURT_AVAILABILITY.NONE_CONFIGURED],
    };
  }
  if (available.length === 0) {
    return {
      state: INTERNAL_COURT_AVAILABILITY.ALL_UNAVAILABLE,
      sourceCount: projected.length,
      activeCount: projected.filter((court) => court.active).length,
      unlockedCount: 0,
      availableCount: 0,
      message: INTERNAL_COURT_COPY[INTERNAL_COURT_AVAILABILITY.ALL_UNAVAILABLE],
    };
  }
  return {
    state: INTERNAL_COURT_AVAILABILITY.AVAILABLE,
    sourceCount: projected.length,
    activeCount: projected.filter((court) => court.active).length,
    unlockedCount: available.length,
    availableCount: available.length,
    message: null,
  };
}

function parseStartMinutes(startTime) {
  const [hours, minutes] = String(startTime || "08:00").split(":").map(Number);
  return (Number(hours) || 8) * 60 + (Number(minutes) || 0);
}

function toIso(date, totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mins = String(totalMinutes % 60).padStart(2, "0");
  return `${date}T${hours}:${mins}:00`;
}

/**
 * Assign court/time onto existing matches. Never creates or duplicates match IDs.
 */
export function assignCourtsAndTimesToExistingInternalMatches({
  matches = [],
  courts = [],
  date,
  startTime = "08:00",
  matchMinutes = 25,
  bufferMinutes = 5,
} = {}) {
  const existing = Array.isArray(matches) ? matches : [];
  const ids = existing.map((match) => String(match?.id || ""));
  const available = listInternalAvailableScheduleCourts(courts);
  const availability = classifyInternalCourtAvailability(courts);

  if (!existing.length) {
    return { ok: false, code: "NO_MATCHES", error: "Chưa có trận để xếp sân.", matches: [] };
  }
  if (!date) {
    return { ok: false, code: "NO_DATE", error: "Chọn ngày thi đấu trước khi xếp sân.", matches: existing };
  }
  if (availability.state !== INTERNAL_COURT_AVAILABILITY.AVAILABLE) {
    return {
      ok: false,
      code: availability.state,
      error: availability.message,
      matches: existing,
    };
  }

  const slot = Number(matchMinutes) + Number(bufferMinutes);
  const start = parseStartMinutes(startTime);
  const next = existing.map((match, index) => {
    const court = available[index % available.length];
    const startMinutes = start + index * slot;
    return {
      ...match,
      courtId: court.id,
      courtName: court.name,
      scheduledStart: toIso(date, startMinutes),
      scheduledEnd: toIso(date, startMinutes + Number(matchMinutes)),
    };
  });

  const nextIds = next.map((match) => String(match.id || ""));
  if (nextIds.join("|") !== ids.join("|")) {
    return { ok: false, code: "ID_MUTATION", error: "Không được đổi mã trận khi xếp sân.", matches: existing };
  }

  return {
    ok: true,
    matches: next,
    matchCount: next.length,
    duplicateCount: 0,
    availability,
  };
}

/**
 * Load shared club court inventory for Internal scheduling. Internal never owns courts.
 */
export async function loadInternalScheduleCourts({
  clubId,
  tenantId,
  listCourtsFn = listCanonicalClubCourtsForFormatVenue,
} = {}) {
  const result = await listCourtsFn({ clubId, tenantId });
  const courts = projectInternalScheduleCourts(result?.courts || []);
  return {
    ok: result?.ok !== false,
    courts,
    source: result?.source || INTERNAL_COURT_AUTHORITY,
    authority: INTERNAL_COURT_AUTHORITY,
    reader: INTERNAL_COURT_READER,
    availability: classifyInternalCourtAvailability(courts),
    error: result?.error || null,
    code: result?.code || null,
  };
}

export function matchesHaveCourtAndTime(matches = []) {
  const list = Array.isArray(matches) ? matches : [];
  if (!list.length) return false;
  return list.every(
    (match) =>
      String(match?.courtId || "").trim() && String(match?.scheduledStart || "").trim()
  );
}
