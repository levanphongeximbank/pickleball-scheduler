/**
 * Phase 2D — Court Engine ↔ Venue & Court availability guard.
 *
 * Read-only adapter: Court Engine consults getCourtAvailability before occupying
 * a court. Does not write bookings, merge occupancy models, or replace CE session rules.
 *
 * Default mode: REQUIRED (fail-closed). LEGACY is for isolated unit tests only.
 */

import { getCourtAvailability as getCourtAvailabilityDefault } from "../../venue-court/index.js";
import { AVAILABILITY_REASON } from "../../venue-court/services/courtAvailabilityService.js";
import {
  CIVIL_TIME_ERROR,
  buildVenueCivilWindow,
  normalizeCivilWindow as normalizeCivilWindowCore,
} from "../../../domain/civilTime.js";

export const CE_AVAILABILITY_MODE = Object.freeze({
  REQUIRED: "required",
  LEGACY: "legacy",
});

export const CE_AVAILABILITY_ERROR = Object.freeze({
  CLUB_REQUIRED: "CLUB_REQUIRED",
  INVALID_TIME_WINDOW: "INVALID_TIME_WINDOW",
  TIMEZONE_REQUIRED: "TIMEZONE_REQUIRED",
  DATA_UNAVAILABLE: "DATA_UNAVAILABLE",
  BOOKING_CONFLICT: "BOOKING_CONFLICT",
  TOURNAMENT_BOOKING_CONFLICT: "TOURNAMENT_BOOKING_CONFLICT",
  OUTSIDE_OPERATING_HOURS: "OUTSIDE_OPERATING_HOURS",
  MAINTENANCE: "MAINTENANCE",
  COURT_LOCKED: "COURT_LOCKED",
  COURT_INACTIVE: "COURT_INACTIVE",
  COURT_NOT_FOUND: "COURT_NOT_FOUND",
  COURT_UNAVAILABLE: "COURT_UNAVAILABLE",
  DUPLICATE_COURT: "DUPLICATE_COURT",
  SESSION_COURT_BUSY: "SESSION_COURT_BUSY",
});

const VENUE_TO_CE_REASON = Object.freeze({
  [AVAILABILITY_REASON.BOOKING_CONFLICT]: CE_AVAILABILITY_ERROR.BOOKING_CONFLICT,
  [AVAILABILITY_REASON.TOURNAMENT_BOOKING_CONFLICT]:
    CE_AVAILABILITY_ERROR.TOURNAMENT_BOOKING_CONFLICT,
  [AVAILABILITY_REASON.MAINTENANCE_BOOKING]: CE_AVAILABILITY_ERROR.MAINTENANCE,
  [AVAILABILITY_REASON.OUTSIDE_VENUE_HOURS]: CE_AVAILABILITY_ERROR.OUTSIDE_OPERATING_HOURS,
  [AVAILABILITY_REASON.COURT_LOCKED]: CE_AVAILABILITY_ERROR.COURT_LOCKED,
  [AVAILABILITY_REASON.COURT_MAINTENANCE]: CE_AVAILABILITY_ERROR.MAINTENANCE,
  [AVAILABILITY_REASON.COURT_INACTIVE]: CE_AVAILABILITY_ERROR.COURT_INACTIVE,
  [AVAILABILITY_REASON.COURT_NOT_FOUND]: CE_AVAILABILITY_ERROR.COURT_NOT_FOUND,
  [AVAILABILITY_REASON.DATA_UNAVAILABLE]: CE_AVAILABILITY_ERROR.DATA_UNAVAILABLE,
  [AVAILABILITY_REASON.CLUB_SCOPE_MISSING]: CE_AVAILABILITY_ERROR.CLUB_REQUIRED,
  [AVAILABILITY_REASON.INVALID_TIME_RANGE]: CE_AVAILABILITY_ERROR.INVALID_TIME_WINDOW,
});

const defaultDeps = Object.freeze({
  getCourtAvailability: getCourtAvailabilityDefault,
});

let deps = { ...defaultDeps };

/** @internal Test-only dependency override. */
export function __setCourtEngineAvailabilityGuardDepsForTests(nextDeps = {}) {
  deps = { ...defaultDeps, ...nextDeps };
}

/** @internal Test-only dependency reset. */
export function __resetCourtEngineAvailabilityGuardDepsForTests() {
  deps = { ...defaultDeps };
}

export function resolveCeAvailabilityMode(options = {}) {
  if (options.legacyAvailability === true) {
    return CE_AVAILABILITY_MODE.LEGACY;
  }
  if (options.availabilityMode === CE_AVAILABILITY_MODE.LEGACY) {
    return CE_AVAILABILITY_MODE.LEGACY;
  }
  return CE_AVAILABILITY_MODE.REQUIRED;
}

/**
 * Build venue-local civil window from an absolute instant + IANA timezone.
 * Overnight windows are rejected (Phase 2E overnight policy).
 */
export function buildLocalCivilWindow(durationMinutes = 20, now = new Date(), timezone) {
  if (timezone == null || String(timezone).trim() === "") {
    return {
      ok: false,
      code: CE_AVAILABILITY_ERROR.TIMEZONE_REQUIRED,
      error:
        "Thiếu timezone IANA — Court Engine không dùng giờ máy chủ/trình duyệt cho khung dân sự.",
    };
  }
  const built = buildVenueCivilWindow(durationMinutes, now, timezone);
  if (!built.ok) {
    return {
      ok: false,
      code:
        built.code === CIVIL_TIME_ERROR.TIMEZONE_REQUIRED
          ? CE_AVAILABILITY_ERROR.TIMEZONE_REQUIRED
          : CE_AVAILABILITY_ERROR.INVALID_TIME_WINDOW,
      error: built.error,
    };
  }
  return built;
}

export function normalizeCivilWindow({ date, startTime, endTime } = {}) {
  return normalizeCivilWindowCore({ date, startTime, endTime });
}

export function mapVenueReasonToCeError(codeOrReason) {
  const key = String(codeOrReason || "");
  return VENUE_TO_CE_REASON[key] || CE_AVAILABILITY_ERROR.COURT_UNAVAILABLE;
}

export function buildCeAvailabilityCacheKey({
  clubId,
  venueId = null,
  date,
  startTime,
  endTime,
  courtIds = null,
  clusterId = null,
  context = null,
} = {}) {
  const courtsKey = Array.isArray(courtIds) ? courtIds.map(String).join(",") : "";
  const exclude =
    context?.excludeBookingId != null ? String(context.excludeBookingId) : "";
  return [
    `club:${String(clubId || "")}`,
    `venue:${String(venueId || "")}`,
    `date:${String(date || "")}`,
    `start:${String(startTime || "")}`,
    `end:${String(endTime || "")}`,
    `courts:${courtsKey}`,
    `cluster:${String(clusterId || "")}`,
    `ex:${exclude}`,
  ].join("|");
}

/**
 * Resolve availability scope for a Court Engine operation.
 * REQUIRED: clubId + civil window mandatory.
 */
export function resolveCourtEngineAvailabilityContext({
  session = null,
  clubId = null,
  venueId = null,
  date = null,
  startTime = null,
  endTime = null,
  durationMinutes = null,
  now = null,
  options = {},
} = {}) {
  const mode = resolveCeAvailabilityMode(options);
  if (mode === CE_AVAILABILITY_MODE.LEGACY) {
    return { ok: true, mode, skipped: true };
  }

  const resolvedClubId =
    (clubId != null && String(clubId).trim()) ||
    (session?.clubId != null && String(session.clubId).trim()) ||
    null;

  if (!resolvedClubId) {
    return {
      ok: false,
      mode,
      code: CE_AVAILABILITY_ERROR.CLUB_REQUIRED,
      error: "Thiếu clubId — bắt buộc cho Venue & Court availability (Court Engine).",
    };
  }

  const hasAnyWindowField =
    (date != null && String(date).trim() !== "") ||
    (startTime != null && String(startTime).trim() !== "") ||
    (endTime != null && String(endTime).trim() !== "");

  let window = normalizeCivilWindow({ date, startTime, endTime });
  if (!window) {
    // Production REQUIRED: callers must pass an explicit civil window (or opt into LEGACY).
    // Optional duration/now fallback is only for helpers that already validated (e.g. UI).
    if (options.allowDerivedWindow === true && !hasAnyWindowField) {
      const rawDuration =
        durationMinutes != null
          ? durationMinutes
          : session?.config?.defaultMatchMinutes;
      const duration = Number(rawDuration);
      const timezone =
        (options.timezone != null && String(options.timezone).trim()) || null;
      const built = buildLocalCivilWindow(
        Number.isFinite(duration) && duration > 0 ? duration : 20,
        now || new Date(),
        timezone
      );
      if (!built.ok) {
        return { ok: false, mode, code: built.code, error: built.error };
      }
      window = { date: built.date, startTime: built.startTime, endTime: built.endTime };
    } else {
      return {
        ok: false,
        mode,
        code: CE_AVAILABILITY_ERROR.INVALID_TIME_WINDOW,
        error:
          "Thiếu hoặc khung giờ không hợp lệ — yêu cầu date YYYY-MM-DD và startTime/endTime HH:mm (end > start, cùng ngày).",
      };
    }
  }

  return {
    ok: true,
    mode,
    clubId: resolvedClubId,
    venueId:
      (venueId != null && String(venueId).trim()) ||
      (session?.venueId != null && String(session.venueId).trim()) ||
      null,
    ...window,
  };
}

/**
 * Cached per-operation checker over getCourtAvailability.
 */
export function createCourtEngineAvailabilityChecker({
  clubId,
  venueId = null,
  courtIds = null,
  clusterId = null,
  context = null,
} = {}) {
  const cache = new Map();
  const courtIdList = Array.isArray(courtIds)
    ? courtIds.map((id) => String(id)).filter(Boolean)
    : null;

  function load(date, startTime, endTime) {
    const key = buildCeAvailabilityCacheKey({
      clubId,
      venueId,
      date,
      startTime,
      endTime,
      courtIds: courtIdList,
      clusterId,
      context,
    });
    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = deps.getCourtAvailability({
      clubId,
      venueId: venueId || undefined,
      date,
      startTime,
      endTime,
      courtIds: courtIdList || undefined,
      clusterId: clusterId || undefined,
      context: context || undefined,
      includeUnavailable: true,
    });

    const byId = new Map();
    for (const row of result.courts || []) {
      byId.set(String(row.courtId), row);
    }
    const entry = { key, byId, raw: result };
    cache.set(key, entry);
    return entry;
  }

  return {
    cache,
    evaluateCourt(courtId, date, startTime, endTime) {
      const entry = load(date, startTime, endTime);
      const row = entry.byId.get(String(courtId));
      if (!row) {
        return {
          available: false,
          code: CE_AVAILABILITY_ERROR.COURT_NOT_FOUND,
          error: `Không tìm thấy sân ${courtId} trong availability.`,
          reasons: [],
          conflicts: [],
        };
      }
      if (row.available) {
        return { available: true, code: null, error: null, reasons: [], conflicts: [] };
      }
      const conflictCode = row.conflicts?.[0]?.code;
      const reasonCode = Array.isArray(row.reasons) ? row.reasons[0] : null;
      // reasons may be human strings; prefer conflict.code
      const mapped = mapVenueReasonToCeError(conflictCode || reasonCode);
      return {
        available: false,
        code: mapped,
        error:
          row.conflicts?.[0]?.message ||
          (typeof reasonCode === "string" ? reasonCode : null) ||
          `Sân ${courtId} không khả dụng (Venue & Court).`,
        reasons: row.reasons || [],
        conflicts: row.conflicts || [],
        venueReason: conflictCode || reasonCode || null,
      };
    },
  };
}

/**
 * Validate a batch of courtIds for one civil window (fail-closed).
 * Also rejects duplicate courtIds in the batch.
 */
export function validateCourtsForCourtEngine({
  clubId,
  venueId = null,
  date,
  startTime,
  endTime,
  courtIds = [],
  clusterId = null,
  context = null,
  options = {},
} = {}) {
  const mode = resolveCeAvailabilityMode(options);
  if (mode === CE_AVAILABILITY_MODE.LEGACY) {
    return { ok: true, mode, skipped: true, unavailable: [] };
  }

  const scope = resolveCourtEngineAvailabilityContext({
    clubId,
    venueId,
    date,
    startTime,
    endTime,
    options,
  });
  if (!scope.ok) {
    return scope;
  }

  const ids = (courtIds || []).map((id) => String(id));
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) {
      return {
        ok: false,
        mode,
        code: CE_AVAILABILITY_ERROR.DUPLICATE_COURT,
        error: `Trùng sân ${id} trong cùng một batch assignment.`,
        unavailable: [{ courtId: id, code: CE_AVAILABILITY_ERROR.DUPLICATE_COURT }],
      };
    }
    seen.add(id);
  }

  try {
    const checker = createCourtEngineAvailabilityChecker({
      clubId: scope.clubId,
      venueId: scope.venueId,
      courtIds: ids,
      clusterId,
      context,
    });

    const unavailable = [];
    for (const id of ids) {
      const result = checker.evaluateCourt(
        id,
        scope.date,
        scope.startTime,
        scope.endTime
      );
      if (!result.available) {
        unavailable.push({ courtId: id, ...result });
      }
    }

    if (unavailable.length > 0) {
      return {
        ok: false,
        mode,
        code: unavailable[0].code || CE_AVAILABILITY_ERROR.COURT_UNAVAILABLE,
        error: unavailable[0].error,
        unavailable,
        date: scope.date,
        startTime: scope.startTime,
        endTime: scope.endTime,
      };
    }

    return {
      ok: true,
      mode,
      clubId: scope.clubId,
      venueId: scope.venueId,
      date: scope.date,
      startTime: scope.startTime,
      endTime: scope.endTime,
      unavailable: [],
    };
  } catch (error) {
    const code = error?.code
      ? mapVenueReasonToCeError(error.code)
      : CE_AVAILABILITY_ERROR.DATA_UNAVAILABLE;
    return {
      ok: false,
      mode,
      code:
        code === CE_AVAILABILITY_ERROR.DATA_UNAVAILABLE ||
        error?.code === AVAILABILITY_REASON.DATA_UNAVAILABLE
          ? CE_AVAILABILITY_ERROR.DATA_UNAVAILABLE
          : code,
      error:
        code === CE_AVAILABILITY_ERROR.DATA_UNAVAILABLE ||
        error?.code === AVAILABILITY_REASON.DATA_UNAVAILABLE
          ? "Không tải được availability từ Venue & Court (DATA_UNAVAILABLE)."
          : error?.message || "Lỗi availability Venue & Court.",
      unavailable: [],
    };
  }
}
