/**
 * Phase 2B — Competition ↔ Venue & Court availability wiring.
 *
 * Filters courts via getCompetitionCourtAvailability before schedule/assign.
 * Does not change assignment algorithms; availability is an input gate only.
 *
 * Default mode is fail-closed (REQUIRED): missing clubId / civil window → error.
 * LEGACY mode is for isolated unit tests / documented non-runtime callers only.
 */

import { getCompetitionCourtAvailability as getCompetitionCourtAvailabilityDefault } from "../../venue-court/index.js";
import {
  CIVIL_DATE_RE,
  CIVIL_HHMM_RE,
  civilTimeToMinutes,
  isoToCivilHhmmOnDate,
} from "../../../domain/civilTime.js";

export const AVAILABILITY_MODE = Object.freeze({
  /** Production / Phase 2B runtime — require clubId + civil window; never silent legacy. */
  REQUIRED: "required",
  /** Isolated unit tests / documented non-runtime callers only. */
  LEGACY: "legacy",
});

export const AVAILABILITY_ERROR_CODE = Object.freeze({
  CLUB_SCOPE_MISSING: "CLUB_SCOPE_MISSING",
  SCHEDULE_WINDOW_MISSING: "SCHEDULE_WINDOW_MISSING",
  DATA_UNAVAILABLE: "DATA_UNAVAILABLE",
});

const defaultDeps = Object.freeze({
  getCompetitionCourtAvailability: getCompetitionCourtAvailabilityDefault,
});

let deps = { ...defaultDeps };

/** @internal Test-only dependency override. */
export function __setCompetitionAvailabilityGuardDepsForTests(nextDeps = {}) {
  deps = { ...defaultDeps, ...nextDeps };
}

/** @internal Test-only dependency reset. */
export function __resetCompetitionAvailabilityGuardDepsForTests() {
  deps = { ...defaultDeps };
}

/**
 * Resolve availability mode from options / context.
 * Default: REQUIRED (fail-closed).
 */
export function resolveAvailabilityMode(options = {}, context = {}) {
  const raw =
    options.legacyAvailability === true
      ? AVAILABILITY_MODE.LEGACY
      : options.availabilityMode ||
        context.availabilityMode ||
        AVAILABILITY_MODE.REQUIRED;
  return raw === AVAILABILITY_MODE.LEGACY
    ? AVAILABILITY_MODE.LEGACY
    : AVAILABILITY_MODE.REQUIRED;
}

function parseTimeToMinutes(timeStr) {
  try {
    return civilTimeToMinutes(timeStr);
  } catch {
    return 0;
  }
}

function stableCourtIdsKey(courtIds) {
  if (!Array.isArray(courtIds) || courtIds.length === 0) {
    return "";
  }
  return courtIds.map(String).join(",");
}

function stableContextKey(context) {
  if (context == null) {
    return "";
  }
  if (typeof context !== "object") {
    return String(context);
  }
  // Only keys that affect availability evaluation (excludeBookingId, etc.)
  const excludeBookingId =
    context.excludeBookingId != null ? String(context.excludeBookingId) : "";
  const clusterId = context.clusterId != null ? String(context.clusterId) : "";
  return `ex:${excludeBookingId}|cl:${clusterId}`;
}

/**
 * Cache key must include every input that affects availability results.
 * One club/window/filter must never reuse another club/window/filter result.
 */
export function buildAvailabilityCacheKey({
  clubId,
  venueId = null,
  date,
  startTime,
  endTime,
  courtIds = null,
  clusterId = null,
  context = null,
} = {}) {
  return [
    `club:${String(clubId || "")}`,
    `venue:${String(venueId || "")}`,
    `date:${String(date || "")}`,
    `start:${String(startTime || "")}`,
    `end:${String(endTime || "")}`,
    `courts:${stableCourtIdsKey(courtIds)}`,
    `cluster:${String(clusterId || "")}`,
    `ctx:${stableContextKey(context)}`,
  ].join("|");
}

/**
 * Convert ISO instant to venue-local civil HH:mm on a known civil date.
 * Requires options.timezone (IANA). Never uses host local timezone.
 */
export function isoToCivilHhmm(iso, dateStr, options = {}) {
  try {
    return isoToCivilHhmmOnDate(iso, dateStr, options);
  } catch (error) {
    if (error?.code === "TIMEZONE_REQUIRED") {
      throw error;
    }
    return null;
  }
}

/**
 * Resolve a civil schedule window from scheduleConfig (and optional sessions).
 * @returns {{ date: string, startTime: string, endTime: string } | null}
 */
export function resolveScheduleConfigWindow(scheduleConfig = {}) {
  const date =
    scheduleConfig.date && CIVIL_DATE_RE.test(String(scheduleConfig.date).trim())
      ? String(scheduleConfig.date).trim()
      : null;
  if (!date) {
    return null;
  }

  if (Array.isArray(scheduleConfig.sessions) && scheduleConfig.sessions.length > 0) {
    const starts = scheduleConfig.sessions
      .map((s) => s?.startTime)
      .filter((t) => CIVIL_HHMM_RE.test(String(t || "").trim()));
    const ends = scheduleConfig.sessions
      .map((s) => s?.endTime)
      .filter((t) => CIVIL_HHMM_RE.test(String(t || "").trim()));
    if (starts.length && ends.length) {
      const startTime = starts.reduce((a, b) =>
        parseTimeToMinutes(a) <= parseTimeToMinutes(b) ? a : b
      );
      const endTime = ends.reduce((a, b) =>
        parseTimeToMinutes(a) >= parseTimeToMinutes(b) ? a : b
      );
      if (parseTimeToMinutes(endTime) > parseTimeToMinutes(startTime)) {
        return { date, startTime: String(startTime).trim(), endTime: String(endTime).trim() };
      }
    }
  }

  const startTime = String(scheduleConfig.startTime || "").trim();
  const endTime = String(scheduleConfig.endTime || "").trim();
  if (!CIVIL_HHMM_RE.test(startTime) || !CIVIL_HHMM_RE.test(endTime)) {
    return null;
  }
  if (parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) {
    return null;
  }
  return { date, startTime, endTime };
}

/**
 * Resolve a per-match civil window from ISO scheduledStart/End + civil date.
 * Requires options.timezone for absolute→civil conversion.
 */
export function resolveMatchCivilWindow(match = {}, fallbackDate = null, options = {}) {
  const dateCandidate =
    (fallbackDate && CIVIL_DATE_RE.test(String(fallbackDate).trim()) && String(fallbackDate).trim()) ||
    null;
  if (!dateCandidate) {
    return null;
  }

  if (options.timezone == null || String(options.timezone).trim() === "") {
    return null;
  }

  let startTime;
  let endTime;
  try {
    startTime = isoToCivilHhmm(match.scheduledStart, dateCandidate, options);
    endTime = isoToCivilHhmm(match.scheduledEnd || match.scheduledStart, dateCandidate, options);
  } catch {
    return null;
  }
  if (!startTime || !endTime) {
    return null;
  }
  if (parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) {
    return null;
  }
  return { date: dateCandidate, startTime, endTime };
}

/**
 * Resolve Director assign window: match ISO times on civil date, else explicit block window.
 */
export function resolveDirectorAssignWindow({
  match = null,
  date = null,
  startTime = null,
  endTime = null,
  timezone = null,
} = {}) {
  const civilDate =
    date && CIVIL_DATE_RE.test(String(date).trim()) ? String(date).trim() : null;

  if (match?.scheduledStart && civilDate && timezone) {
    const fromMatch = resolveMatchCivilWindow(match, civilDate, { timezone });
    if (fromMatch) {
      return fromMatch;
    }
  }

  const start = String(startTime || "").trim();
  const end = String(endTime || "").trim();
  if (civilDate && CIVIL_HHMM_RE.test(start) && CIVIL_HHMM_RE.test(end) && parseTimeToMinutes(end) > parseTimeToMinutes(start)) {
    return { date: civilDate, startTime: start, endTime: end };
  }

  return null;
}

/**
 * Fail-closed precondition check for Phase 2B runtime engines.
 * @returns {{ ok: true, clubId: string, mode: string } | { ok: false, errors: string[], code: string }}
 */
export function assertRuntimeAvailabilityScope({
  clubId,
  scheduleConfig = null,
  matchWindow = null,
  mode = AVAILABILITY_MODE.REQUIRED,
  requireWindow = true,
} = {}) {
  if (mode === AVAILABILITY_MODE.LEGACY) {
    return { ok: true, clubId: clubId || null, mode };
  }

  const resolvedClubId =
    clubId != null && String(clubId).trim() !== "" ? String(clubId).trim() : null;
  if (!resolvedClubId) {
    return {
      ok: false,
      code: AVAILABILITY_ERROR_CODE.CLUB_SCOPE_MISSING,
      errors: [
        "Thiếu clubId — bắt buộc cho Venue & Court availability (không dùng legacy fallback).",
      ],
    };
  }

  if (requireWindow) {
    const window =
      matchWindow ||
      (scheduleConfig ? resolveScheduleConfigWindow(scheduleConfig) : null);
    if (!window) {
      return {
        ok: false,
        code: AVAILABILITY_ERROR_CODE.SCHEDULE_WINDOW_MISSING,
        errors: [
          "Thiếu khung giờ dân sự (date + startTime + endTime) — bắt buộc cho Venue & Court availability.",
        ],
      };
    }
  }

  return { ok: true, clubId: resolvedClubId, mode };
}

/**
 * Create a cached per-window availability checker.
 *
 * REQUIRED mode without clubId → enabled:false is NOT used; callers must
 * assertRuntimeAvailabilityScope first and fail closed.
 * LEGACY mode without clubId → enabled:false (skip VC).
 */
export function createCompetitionAvailabilityChecker({
  clubId,
  venueId = null,
  courtIds = null,
  clusterId = null,
  context = null,
  mode = AVAILABILITY_MODE.REQUIRED,
} = {}) {
  const resolvedClubId =
    clubId != null && String(clubId).trim() !== "" ? String(clubId).trim() : null;
  const resolvedVenueId =
    venueId != null && String(venueId).trim() !== "" ? String(venueId).trim() : null;
  const resolvedClusterId =
    clusterId != null && String(clusterId).trim() !== ""
      ? String(clusterId).trim()
      : context?.clusterId != null
        ? String(context.clusterId)
        : null;
  const courtIdList = Array.isArray(courtIds)
    ? courtIds.map((id) => String(id)).filter(Boolean)
    : null;

  const cache = new Map();
  const warnings = [];

  if (!resolvedClubId) {
    return {
      enabled: false,
      skippedReason: AVAILABILITY_ERROR_CODE.CLUB_SCOPE_MISSING,
      mode,
      warnings,
      cache,
      isCourtAvailable() {
        // LEGACY only path reaches here without clubId.
        return true;
      },
      filterCourts(courts = []) {
        return { ok: true, courts: [...courts], availableCourtIds: null, skipped: true };
      },
    };
  }

  function loadWindow(date, startTime, endTime) {
    const key = buildAvailabilityCacheKey({
      clubId: resolvedClubId,
      venueId: resolvedVenueId,
      date,
      startTime,
      endTime,
      courtIds: courtIdList,
      clusterId: resolvedClusterId,
      context,
    });
    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = deps.getCompetitionCourtAvailability({
      clubId: resolvedClubId,
      venueId: resolvedVenueId || undefined,
      date,
      startTime,
      endTime,
      courtIds: courtIdList || undefined,
      clusterId: resolvedClusterId || undefined,
      context: context || undefined,
      includeUnavailable: true,
    });

    const available = new Set((result.availableCourtIds || []).map(String));
    const entry = {
      key,
      available,
      unavailableCourts: result.unavailableCourts || [],
    };
    cache.set(key, entry);
    return entry;
  }

  return {
    enabled: true,
    skippedReason: null,
    mode,
    warnings,
    cache,
    isCourtAvailable(courtId, date, startTime, endTime) {
      if (!courtId || !date || !startTime || !endTime) {
        // Fail-closed: incomplete window is never "available".
        return false;
      }
      const entry = loadWindow(date, startTime, endTime);
      return entry.available.has(String(courtId));
    },
    filterCourts(courts = [], date, startTime, endTime) {
      try {
        if (!date || !startTime || !endTime) {
          return {
            ok: false,
            courts: [],
            availableCourtIds: [],
            code: AVAILABILITY_ERROR_CODE.SCHEDULE_WINDOW_MISSING,
            errors: [
              "Thiếu khung giờ dân sự (date + startTime + endTime) — bắt buộc cho Venue & Court availability.",
            ],
          };
        }
        const entry = loadWindow(date, startTime, endTime);
        const filtered = (courts || []).filter((court) =>
          entry.available.has(String(court.id))
        );
        const warningsOut = [];
        if (filtered.length === 0 && (courts || []).length > 0) {
          warningsOut.push(
            "Không có sân khả dụng theo Venue & Court (booking / giờ hoạt động / khóa / bảo trì)."
          );
        } else if (filtered.length < (courts || []).length) {
          const blocked = (courts || []).length - filtered.length;
          warningsOut.push(
            `${blocked} sân bị loại vì không khả dụng (Venue & Court availability).`
          );
        }
        return {
          ok: true,
          courts: filtered,
          availableCourtIds: [...entry.available],
          unavailableCourts: entry.unavailableCourts,
          warnings: warningsOut,
        };
      } catch (error) {
        const code = error?.code || AVAILABILITY_ERROR_CODE.DATA_UNAVAILABLE;
        return {
          ok: false,
          courts: [],
          availableCourtIds: [],
          errors: [
            code === AVAILABILITY_ERROR_CODE.DATA_UNAVAILABLE
              ? "Không tải được availability từ Venue & Court (DATA_UNAVAILABLE)."
              : error?.message || "Lỗi availability Venue & Court.",
          ],
          code,
        };
      }
    },
  };
}

/**
 * Pre-filter courts for a known schedule window.
 * REQUIRED mode fails closed on missing clubId/window.
 */
export function filterCourtsForScheduleWindow({
  clubId,
  venueId = null,
  courts = [],
  scheduleConfig = {},
  context = null,
  clusterId = null,
  availabilityMode = AVAILABILITY_MODE.REQUIRED,
  legacyAvailability = false,
} = {}) {
  const mode = resolveAvailabilityMode({ availabilityMode, legacyAvailability });
  const scope = assertRuntimeAvailabilityScope({
    clubId,
    scheduleConfig,
    mode,
    requireWindow: true,
  });
  if (!scope.ok) {
    return scope;
  }

  if (mode === AVAILABILITY_MODE.LEGACY && !scope.clubId) {
    return {
      ok: true,
      courts: [...(courts || [])],
      skipped: true,
      warnings: [],
    };
  }

  const checker = createCompetitionAvailabilityChecker({
    clubId: scope.clubId,
    venueId,
    courtIds: (courts || []).map((c) => c.id),
    clusterId,
    context,
    mode,
  });

  const window = resolveScheduleConfigWindow(scheduleConfig);
  return checker.filterCourts(courts, window.date, window.startTime, window.endTime);
}
