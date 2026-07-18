/**
 * Phase 2B — Competition ↔ Venue & Court availability wiring.
 *
 * Filters courts via getCompetitionCourtAvailability before schedule/assign.
 * Does not change assignment algorithms; availability is an input gate only.
 */

import { getCompetitionCourtAvailability as getCompetitionCourtAvailabilityDefault } from "../../venue-court/index.js";

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function minutesToTimeString(totalMinutes) {
  const wrapped = ((Number(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTimeToMinutes(timeStr) {
  const [h, m] = String(timeStr || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Convert ISO instant to venue-local civil HH:mm on a known civil date.
 * Uses the same local-midnight basis as scheduleEngine (no invented timezone).
 */
export function isoToCivilHhmm(iso, dateStr) {
  if (!iso || !dateStr || !DATE_RE.test(String(dateStr))) {
    return null;
  }
  const start = new Date(iso).getTime();
  if (!Number.isFinite(start)) {
    return null;
  }
  const base = new Date(`${dateStr}T00:00:00`).getTime();
  if (!Number.isFinite(base)) {
    return null;
  }
  const minutes = Math.round((start - base) / 60000);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes >= 1440) {
    return null;
  }
  return minutesToTimeString(minutes);
}

/**
 * Resolve a civil schedule window from scheduleConfig (and optional sessions).
 * @returns {{ date: string, startTime: string, endTime: string } | null}
 */
export function resolveScheduleConfigWindow(scheduleConfig = {}) {
  const date =
    scheduleConfig.date && DATE_RE.test(String(scheduleConfig.date).trim())
      ? String(scheduleConfig.date).trim()
      : null;
  if (!date) {
    return null;
  }

  if (Array.isArray(scheduleConfig.sessions) && scheduleConfig.sessions.length > 0) {
    const starts = scheduleConfig.sessions
      .map((s) => s?.startTime)
      .filter((t) => HHMM_RE.test(String(t || "").trim()));
    const ends = scheduleConfig.sessions
      .map((s) => s?.endTime)
      .filter((t) => HHMM_RE.test(String(t || "").trim()));
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
  if (!HHMM_RE.test(startTime) || !HHMM_RE.test(endTime)) {
    return null;
  }
  if (parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) {
    return null;
  }
  return { date, startTime, endTime };
}

/**
 * Resolve a per-match civil window from ISO scheduledStart/End + civil date.
 */
export function resolveMatchCivilWindow(match = {}, fallbackDate = null) {
  const dateCandidate =
    (fallbackDate && DATE_RE.test(String(fallbackDate).trim()) && String(fallbackDate).trim()) ||
    (match.scheduledStart && String(match.scheduledStart).slice(0, 10)) ||
    null;
  if (!dateCandidate || !DATE_RE.test(dateCandidate)) {
    return null;
  }

  const startTime = isoToCivilHhmm(match.scheduledStart, dateCandidate);
  const endTime = isoToCivilHhmm(match.scheduledEnd || match.scheduledStart, dateCandidate);
  if (!startTime || !endTime) {
    return null;
  }
  if (parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) {
    return null;
  }
  return { date: dateCandidate, startTime, endTime };
}

/**
 * Create a cached per-window availability checker.
 *
 * When clubId is missing → enabled:false (legacy behavior; no VC gate).
 * When enabled and getCompetitionCourtAvailability throws DATA_UNAVAILABLE /
 * validation errors → caller should treat as hard failure (do not fall back).
 */
export function createCompetitionAvailabilityChecker({
  clubId,
  venueId = null,
  courtIds = null,
  context = null,
} = {}) {
  const resolvedClubId =
    clubId != null && String(clubId).trim() !== "" ? String(clubId).trim() : null;
  const resolvedVenueId =
    venueId != null && String(venueId).trim() !== "" ? String(venueId).trim() : null;
  const courtIdList = Array.isArray(courtIds)
    ? courtIds.map((id) => String(id)).filter(Boolean)
    : null;

  const cache = new Map();
  const warnings = [];

  if (!resolvedClubId) {
    return {
      enabled: false,
      skippedReason: "CLUB_SCOPE_MISSING",
      warnings,
      isCourtAvailable() {
        return true;
      },
      filterCourts(courts = []) {
        return { ok: true, courts: [...courts], availableCourtIds: null, skipped: true };
      },
    };
  }

  function loadWindow(date, startTime, endTime) {
    const key = `${date}|${startTime}|${endTime}`;
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
      context: context || undefined,
      includeUnavailable: true,
    });

    const available = new Set((result.availableCourtIds || []).map(String));
    const entry = {
      available,
      unavailableCourts: result.unavailableCourts || [],
    };
    cache.set(key, entry);
    return entry;
  }

  return {
    enabled: true,
    skippedReason: null,
    warnings,
    isCourtAvailable(courtId, date, startTime, endTime) {
      if (!courtId || !date || !startTime || !endTime) {
        return true;
      }
      const entry = loadWindow(date, startTime, endTime);
      return entry.available.has(String(courtId));
    },
    /**
     * Filter a court list for one civil window.
     * @returns {{ ok: boolean, courts: object[], availableCourtIds: string[], unavailableCourts?: object[], errors?: string[], warnings?: string[] }}
     */
    filterCourts(courts = [], date, startTime, endTime) {
      try {
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
        const code = error?.code || "DATA_UNAVAILABLE";
        return {
          ok: false,
          courts: [],
          availableCourtIds: [],
          errors: [
            code === "DATA_UNAVAILABLE"
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
 * Pre-filter courts for a known schedule window (used by generateSchedule).
 */
export function filterCourtsForScheduleWindow({
  clubId,
  venueId = null,
  courts = [],
  scheduleConfig = {},
  context = null,
} = {}) {
  const checker = createCompetitionAvailabilityChecker({
    clubId,
    venueId,
    courtIds: (courts || []).map((c) => c.id),
    context,
  });

  if (!checker.enabled) {
    return {
      ok: true,
      courts: [...(courts || [])],
      skipped: true,
      warnings: [],
    };
  }

  const window = resolveScheduleConfigWindow(scheduleConfig);
  if (!window) {
    return {
      ok: true,
      courts: [...(courts || [])],
      skipped: true,
      warnings: [
        "Bỏ qua Venue & Court availability: thiếu date/startTime/endTime hợp lệ trên scheduleConfig.",
      ],
    };
  }

  return checker.filterCourts(courts, window.date, window.startTime, window.endTime);
}
