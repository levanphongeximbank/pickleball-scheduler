/**
 * Internal schedule courts — Competition Court Adapter Contract V1 + CORE-12.
 *
 * Authority path:
 * Internal demand
 * → InternalTournamentCourtAdapter
 * → Competition Court Adapter Contract V1 (list / availability / reserve / release / validate)
 * → CORE-12 assignCourtsDeterministic (canonical match→physicalCourtId assignment)
 *
 * Internal does NOT own availability or physical-court assignment authority.
 * courtLabel / name / number remain display-only. No synthetic court identity.
 */
import {
  COMPETITION_COURT_ERROR_CODE,
  COMPETITION_COURT_RESULT_CODE,
  isFailClosedAvailabilityCode,
  isForeignReservationCode,
} from "../../competition-core/contracts/competitionCourtAdapterContract.js";
import {
  CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
  CORE12_POLICY_VERSION,
  COURT_ASSIGNMENT_STATUS,
  COURT_AVAILABILITY_STATUS,
  assignCourtsDeterministic,
} from "../../competition-core/court-assignment/index.js";
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

const FAIL_CLOSED_RESULT_CODES = new Set([
  COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION,
  COMPETITION_COURT_RESULT_CODE.OUT_OF_SCOPE,
  COMPETITION_COURT_RESULT_CODE.MAINTENANCE,
  COMPETITION_COURT_RESULT_CODE.UNKNOWN_COURT,
  COMPETITION_COURT_ERROR_CODE.FOREIGN_RESERVATION,
  COMPETITION_COURT_ERROR_CODE.OUT_OF_SCOPE,
  COMPETITION_COURT_ERROR_CODE.MAINTENANCE,
  COMPETITION_COURT_ERROR_CODE.FOREIGN_RESERVATION_CONFLICT,
]);

export function projectInternalScheduleCourt(court, index = 0) {
  if (!court || typeof court !== "object") return null;
  const physicalCourtId = String(
    court.physicalCourtId || court.id || court.courtId || ""
  ).trim();
  if (!physicalCourtId) return null;
  const foreign =
    isForeignReservationCode(court.resultCode) ||
    FAIL_CLOSED_RESULT_CODES.has(court.resultCode) ||
    court.failClosed === true;
  const bookable =
    !foreign &&
    court.available !== false &&
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
    tenantId: court.tenantId || "",
    venueId: court.venueId || "",
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
  return `${date}T${hours}:${mins}:00Z`;
}

function formatClock(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mins = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

function windowFromAssignment({ date, startTime, matchMinutes, matchCount, bufferMinutes }) {
  const start = parseStartMinutes(startTime);
  const slot = Number(matchMinutes) + Number(bufferMinutes);
  const end = start + Math.max(1, matchCount) * slot;
  return {
    date,
    startTime: formatClock(start),
    endTime: formatClock(end),
  };
}

function matchSlotWindow(date, startMinutes, matchMinutes) {
  return {
    date,
    startTime: formatClock(startMinutes),
    endTime: formatClock(startMinutes + Number(matchMinutes)),
  };
}

function isUnavailableCourtRow(row) {
  if (!row || typeof row !== "object") return true;
  if (row.available === false || row.failClosed === true) return true;
  const code = row.resultCode || row.code;
  if (isForeignReservationCode(code) || isFailClosedAvailabilityCode(code)) return true;
  if (FAIL_CLOSED_RESULT_CODES.has(code)) return true;
  return false;
}

function physicalCourtIdOf(row) {
  return String(
    row?.physicalCourtId || row?.courtId || row?.id || row?.court?.id || ""
  ).trim();
}

/**
 * Assign court/time onto existing matches.
 * Availability + assignment + reservation + validation are Contract V1 / CORE-12 only.
 * Persistence must happen only after this returns ok=true.
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
  venueId = "",
  actorId = "",
} = {}) {
  const existing = Array.isArray(matches) ? matches : [];
  const ids = existing.map((match) => String(match?.id || ""));
  const adapter = courtAdapter || createInternalTournamentCourtAdapter();

  if (!existing.length) {
    return { ok: false, code: "NO_MATCHES", error: "Chưa có trận để xếp sân.", matches: [] };
  }
  if (!date) {
    return { ok: false, code: "NO_DATE", error: "Chọn ngày thi đấu trước khi xếp sân.", matches: existing };
  }
  if (typeof adapter.getCourtAvailability !== "function") {
    return {
      ok: false,
      code: COMPETITION_COURT_ERROR_CODE.SHARED_CONTRACT_CAPABILITY_GAP,
      error: "Competition Court Adapter Contract V1 getCourtAvailability is required.",
      matches: existing,
      failClosed: true,
      sharedContractCapabilityGap: true,
    };
  }

  const seedCourts = projectInternalScheduleCourts(courts);
  const physicalCourtIds = [
    ...new Set(seedCourts.map((court) => court.physicalCourtId).filter(Boolean)),
  ];
  if (physicalCourtIds.length === 0 && typeof adapter.listEligibleCourts === "function") {
    const listed = adapter.listEligibleCourts({
      clubId,
      tenantId,
      competitionId,
      actorId,
    });
    for (const court of projectInternalScheduleCourts(listed?.courts || [])) {
      physicalCourtIds.push(court.physicalCourtId);
    }
  }
  if (physicalCourtIds.length === 0) {
    return {
      ok: false,
      code: INTERNAL_COURT_AVAILABILITY.NONE_CONFIGURED,
      error: INTERNAL_COURT_COPY[INTERNAL_COURT_AVAILABILITY.NONE_CONFIGURED],
      matches: existing,
    };
  }

  const scheduleWindow = windowFromAssignment({
    date,
    startTime,
    matchMinutes,
    matchCount: existing.length,
    bufferMinutes,
  });

  const availabilityResult = adapter.getCourtAvailability({
    clubId,
    tenantId,
    competitionId,
    actorId,
    physicalCourtIds,
    ...scheduleWindow,
    includeUnavailable: true,
  });
  if (availabilityResult?.ok === false || availabilityResult?.failClosed) {
    return {
      ok: false,
      code: availabilityResult?.code || COMPETITION_COURT_ERROR_CODE.DATA_UNAVAILABLE,
      error: availabilityResult?.error || "Không đọc được availability sân từ Court Contract V1.",
      matches: existing,
      failClosed: true,
    };
  }

  const availableRows = (availabilityResult?.courts || []).filter(
    (row) => !isUnavailableCourtRow(row)
  );
  const availableIds = [
    ...new Set(availableRows.map(physicalCourtIdOf).filter(Boolean)),
  ];
  if (availableIds.length === 0) {
    return {
      ok: false,
      code: INTERNAL_COURT_AVAILABILITY.ALL_UNAVAILABLE,
      error: INTERNAL_COURT_COPY[INTERNAL_COURT_AVAILABILITY.ALL_UNAVAILABLE],
      matches: existing,
      failClosed: true,
    };
  }

  const slot = Number(matchMinutes) + Number(bufferMinutes);
  const start = parseStartMinutes(startTime);
  const timedMatches = existing.map((match, index) => {
    const startMinutes = start + index * slot;
    return {
      match,
      matchId: String(match.id || match.matchId || ""),
      scheduledStart: toIso(date, startMinutes),
      scheduledEnd: toIso(date, startMinutes + Number(matchMinutes)),
      slotWindow: matchSlotWindow(date, startMinutes, matchMinutes),
    };
  });

  const displayById = new Map(
    seedCourts.map((court) => [court.physicalCourtId, court])
  );
  for (const row of availableRows) {
    const id = physicalCourtIdOf(row);
    if (!id) continue;
    if (!displayById.has(id)) {
      displayById.set(id, projectInternalScheduleCourt(row));
    }
  }

  let assignmentResult;
  try {
    assignmentResult = assignCourtsDeterministic({
      schemaVersion: CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
      requestId: `internal-schedule-${competitionId || "competition"}-${date}`,
      tenantId: tenantId || "tenant-unscoped",
      clubId: clubId || "club-unscoped",
      venueId: venueId || clubId || "venue-unscoped",
      competitionId: competitionId || "competition-unscoped",
      timezone: "UTC",
      matches: timedMatches.map((item) => ({
        matchId: item.matchId,
        competitionId: competitionId || "competition-unscoped",
        tenantId: tenantId || "tenant-unscoped",
        clubId: clubId || "club-unscoped",
        venueId: venueId || clubId || "venue-unscoped",
        scheduledStart: item.scheduledStart,
        scheduledEnd: item.scheduledEnd,
        durationMinutes: Number(matchMinutes),
        status: "scheduled",
        isBye: false,
      })),
      courts: availableIds.map((courtId, index) => ({
        courtId,
        tenantId: tenantId || "tenant-unscoped",
        venueId: venueId || clubId || "venue-unscoped",
        clubId: clubId || "club-unscoped",
        availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
        active: true,
        eligible: true,
        priority: index,
        availabilityIntervals: [
          {
            start: toIso(date, start),
            end: toIso(date, start + Math.max(1, existing.length) * slot),
          },
        ],
      })),
      lockedAssignments: [],
      constraints: [],
      policy: {
        policyId: "internal-schedule-court-assignment-v1",
        policyVersion: CORE12_POLICY_VERSION,
        partialAssignmentAllowed: false,
        requireVenueTimezone: false,
        requireAvailabilitySnapshot: false,
      },
      availabilitySnapshotRef: {
        snapshotId: `availability-${competitionId || "competition"}-${date}`,
        snapshotVersion: "v1",
        fingerprint: `avail-${availableIds.join("-") || "none"}`,
      },
      scheduleSnapshotRef: {
        snapshotId: `schedule-${competitionId || "competition"}-${date}`,
        snapshotVersion: "v1",
        fingerprint: `sched-${timedMatches.map((item) => item.matchId).join("-")}`,
      },
    });
  } catch (err) {
    return {
      ok: false,
      code: COMPETITION_COURT_ERROR_CODE.SHARED_CONTRACT_CAPABILITY_GAP,
      error:
        err instanceof Error
          ? err.message
          : "Canonical CORE-12 court assignment failed.",
      matches: existing,
      failClosed: true,
      sharedContractCapabilityGap: true,
    };
  }

  if (assignmentResult?.status !== COURT_ASSIGNMENT_STATUS.SUCCESS) {
    const unassigned = assignmentResult?.unassigned || [];
    return {
      ok: false,
      code: assignmentResult?.rejectionCode || assignmentResult?.status || "COURT_ASSIGNMENT_FAILED",
      error:
        unassigned[0]?.message ||
        unassigned[0]?.reason ||
        assignmentResult?.message ||
        "Canonical Court Assignment không xếp được đủ sân cho mọi trận.",
      matches: existing,
      failClosed: true,
      assignmentResult,
    };
  }

  const assignments = Array.isArray(assignmentResult?.assignments)
    ? assignmentResult.assignments
    : [];
  if (assignments.length !== timedMatches.length) {
    return {
      ok: false,
      code: "PARTIAL_COURT_ASSIGNMENT_DENIED",
      error: "Canonical Court Assignment trả về thiếu trận — fail closed.",
      matches: existing,
      failClosed: true,
    };
  }

  const assignmentByMatch = new Map(
    assignments.map((row) => [String(row.matchId), row])
  );
  const next = [];
  for (const item of timedMatches) {
    const assigned = assignmentByMatch.get(item.matchId);
    const physicalCourtId = String(assigned?.courtId || "").trim();
    if (!physicalCourtId) {
      return {
        ok: false,
        code: "MISSING_ASSIGNED_COURT",
        error: `Thiếu physicalCourtId canonical cho trận ${item.matchId}.`,
        matches: existing,
        failClosed: true,
      };
    }
    if (typeof adapter.validateMatchAssignment !== "function") {
      return {
        ok: false,
        code: COMPETITION_COURT_ERROR_CODE.SHARED_CONTRACT_CAPABILITY_GAP,
        error: "Competition Court Adapter Contract V1 validateMatchAssignment is required.",
        matches: existing,
        failClosed: true,
        sharedContractCapabilityGap: true,
      };
    }
    const validated = adapter.validateMatchAssignment({
      clubId,
      tenantId,
      competitionId,
      actorId,
      matchId: item.matchId,
      physicalCourtId,
      ...item.slotWindow,
    });
    if (validated?.ok === false || validated?.valid === false || validated?.failClosed) {
      return {
        ok: false,
        code: validated?.code || COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION,
        error:
          validated?.error ||
          `validateMatchAssignment fail-closed cho trận ${item.matchId}.`,
        matches: existing,
        failClosed: true,
      };
    }
    const display = displayById.get(physicalCourtId);
    next.push({
      ...item.match,
      courtId: physicalCourtId,
      physicalCourtId,
      courtName: display?.name || physicalCourtId,
      scheduledStart: item.scheduledStart,
      scheduledEnd: item.scheduledEnd,
    });
  }

  const nextIds = next.map((match) => String(match.id || ""));
  if (nextIds.join("|") !== ids.join("|")) {
    return {
      ok: false,
      code: "ID_MUTATION",
      error: "Không được đổi mã trận khi xếp sân.",
      matches: existing,
    };
  }

  const reservedIds = [...new Set(next.map((match) => match.physicalCourtId).filter(Boolean))];
  if (typeof adapter.reserveCourts !== "function") {
    return {
      ok: false,
      code: COMPETITION_COURT_ERROR_CODE.SHARED_CONTRACT_CAPABILITY_GAP,
      error: "Competition Court Adapter Contract V1 reserveCourts is required.",
      matches: existing,
      failClosed: true,
      sharedContractCapabilityGap: true,
    };
  }
  const reserved = adapter.reserveCourts({
    clubId,
    tenantId,
    competitionId,
    actorId,
    physicalCourtIds: reservedIds,
    ...scheduleWindow,
  });
  if (reserved?.ok === false || reserved?.failClosed) {
    return {
      ok: false,
      code: reserved?.code || COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION,
      error: reserved?.error || "Không đặt được sân — sân đang thuộc reservation khác.",
      matches: existing,
      failClosed: true,
    };
  }

  return {
    ok: true,
    matches: next,
    matchCount: next.length,
    duplicateCount: 0,
    availability: classifyInternalCourtAvailability(
      availableIds.map((id) => displayById.get(id)).filter(Boolean)
    ),
    validated: true,
    reservedPhysicalCourtIds: reservedIds,
    authority: INTERNAL_COURT_AUTHORITY,
    assignmentSource: "CORE12_COURT_ASSIGNMENT",
  };
}

/**
 * Release Competition-owned court reservations through Contract V1.
 */
export function releaseInternalScheduleCourts({
  courtAdapter = null,
  physicalCourtIds = [],
  competitionId = "",
  clubId = "",
  tenantId = "",
  actorId = "",
  date,
  startTime,
  endTime,
} = {}) {
  const adapter = courtAdapter || createInternalTournamentCourtAdapter();
  const ids = [...new Set((physicalCourtIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!ids.length) {
    return { ok: true, released: [], skipped: true };
  }
  if (typeof adapter.releaseCourts !== "function") {
    return {
      ok: false,
      code: COMPETITION_COURT_ERROR_CODE.SHARED_CONTRACT_CAPABILITY_GAP,
      error: "Competition Court Adapter Contract V1 releaseCourts is required.",
      failClosed: true,
      sharedContractCapabilityGap: true,
    };
  }
  return adapter.releaseCourts({
    clubId,
    tenantId,
    competitionId,
    actorId,
    physicalCourtIds: ids,
    date,
    startTime,
    endTime,
  });
}

/**
 * Test/double helper — Contract V1 surface only. Not an Internal court authority.
 */
export function createInternalCourtContractTestDouble(overrides = {}) {
  return {
    listEligibleCourts:
      overrides.listEligibleCourts ||
      (() => ({
        ok: true,
        courts: (overrides.courts || []).map((court) => ({
          physicalCourtId: court.physicalCourtId || court.id,
          displayName: court.name,
          active: true,
        })),
      })),
    getCourtAvailability:
      overrides.getCourtAvailability ||
      ((input = {}) => ({
        ok: true,
        courts: (input.physicalCourtIds || []).map((id) => ({
          physicalCourtId: id,
          courtId: id,
          available: true,
          resultCode: COMPETITION_COURT_RESULT_CODE.AVAILABLE,
        })),
      })),
    reserveCourts:
      overrides.reserveCourts ||
      ((input = {}) => ({
        ok: true,
        reserved: (input.physicalCourtIds || []).map((id) => ({ physicalCourtId: id })),
      })),
    releaseCourts:
      overrides.releaseCourts ||
      ((input = {}) => ({
        ok: true,
        released: (input.physicalCourtIds || []).map((id) => ({ physicalCourtId: id })),
      })),
    validateMatchAssignment:
      overrides.validateMatchAssignment ||
      (() => ({
        ok: true,
        valid: true,
        code: COMPETITION_COURT_RESULT_CODE.ASSIGNMENT_VALID,
      })),
    ...overrides,
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
