/**
 * Internal schedule courts — projection from Competition Court Adapter Contract V1.
 * Internal does not own courts, availability, or reservation authority.
 */
import {
  COMPETITION_COURT_RESULT_CODE,
  isForeignReservationCode,
} from "../../competition-core/contracts/competitionCourtAdapterContract.js";
import {
  INTERNAL_COURT_AUTHORITY,
  INTERNAL_COURT_READER,
  createInternalTournamentCourtAdapter,
} from "./InternalTournamentCourtAdapter.js";

export { INTERNAL_COURT_AUTHORITY, INTERNAL_COURT_READER };

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
  const physicalCourtId = String(
    court.physicalCourtId || court.id || court.courtId || ""
  ).trim();
  if (!physicalCourtId) return null;
  const foreign =
    isForeignReservationCode(court.resultCode) ||
    court.resultCode === COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION ||
    court.failClosed === true;
  const bookable =
    !foreign &&
    court.active !== false &&
    court.status !== "locked" &&
    court.status !== "maintenance";
  return {
    id: physicalCourtId,
    physicalCourtId,
    name: String(court.displayName || court.courtLabel || court.name || physicalCourtId),
    active: court.active !== false,
    status: foreign ? "unavailable" : court.status || (bookable ? "active" : "locked"),
    locked: !bookable,
    foreignReservation: foreign,
    number: court.displayNumber ?? court.number ?? index + 1,
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

function windowFromAssignment({ date, startTime, matchMinutes, matchCount, bufferMinutes }) {
  const start = parseStartMinutes(startTime);
  const slot = Number(matchMinutes) + Number(bufferMinutes);
  const end = start + Math.max(1, matchCount) * slot;
  const startHours = String(Math.floor(start / 60)).padStart(2, "0");
  const startMins = String(start % 60).padStart(2, "0");
  const endHours = String(Math.floor(end / 60)).padStart(2, "0");
  const endMins = String(end % 60).padStart(2, "0");
  return {
    date,
    startTime: `${startHours}:${startMins}`,
    endTime: `${endHours}:${endMins}`,
  };
}

/**
 * Assign court/time onto existing matches. Never creates or duplicates match IDs.
 * Court assignment decision stays in Internal schedule; reservation goes through V1.
 */
export function assignCourtsAndTimesToExistingInternalMatches({
  matches = [],
  courts = [],
  date,
  startTime = "08:00",
  matchMinutes = 25,
  bufferMinutes = 5,
  courtAdapter = null,
  competitionId = "",
  clubId = "",
  tenantId = "",
  actorId = "",
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
      courtId: court.physicalCourtId,
      physicalCourtId: court.physicalCourtId,
      courtName: court.name,
      scheduledStart: toIso(date, startMinutes),
      scheduledEnd: toIso(date, startMinutes + Number(matchMinutes)),
    };
  });

  const nextIds = next.map((match) => String(match.id || ""));
  if (nextIds.join("|") !== ids.join("|")) {
    return { ok: false, code: "ID_MUTATION", error: "Không được đổi mã trận khi xếp sân.", matches: existing };
  }

  if (courtAdapter && typeof courtAdapter.reserveCourts === "function") {
    const physicalCourtIds = [...new Set(next.map((match) => match.physicalCourtId).filter(Boolean))];
    const reserved = courtAdapter.reserveCourts({
      clubId,
      tenantId,
      competitionId,
      actorId,
      physicalCourtIds,
      ...windowFromAssignment({
        date,
        startTime,
        matchMinutes,
        matchCount: next.length,
        bufferMinutes,
      }),
    });
    if (reserved?.ok === false || reserved?.failClosed) {
      return {
        ok: false,
        code: reserved.code || COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION,
        error: reserved.error || "Không đặt được sân — sân đang thuộc reservation khác.",
        matches: existing,
        failClosed: true,
      };
    }
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
 * Load eligible Physical Courts through Court Adapter V1. Internal never owns courts.
 */
export async function loadInternalScheduleCourts({
  clubId,
  tenantId,
  competitionId,
  actorId,
  courtAdapter,
} = {}) {
  const adapter = courtAdapter || createInternalTournamentCourtAdapter();
  const listed = adapter.listEligibleCourts({
    clubId,
    tenantId,
    competitionId,
    actorId,
  });
  const courts = projectInternalScheduleCourts(listed?.courts || []);
  return {
    ok: listed?.ok !== false,
    courts,
    source: INTERNAL_COURT_AUTHORITY,
    authority: INTERNAL_COURT_AUTHORITY,
    reader: INTERNAL_COURT_READER,
    availability: classifyInternalCourtAvailability(courts),
    error: listed?.error || null,
    code: listed?.code || null,
  };
}

export function matchesHaveCourtAndTime(matches = []) {
  const list = Array.isArray(matches) ? matches : [];
  if (!list.length) return false;
  return list.every(
    (match) =>
      String(match?.physicalCourtId || match?.courtId || "").trim() &&
      String(match?.scheduledStart || "").trim()
  );
}
