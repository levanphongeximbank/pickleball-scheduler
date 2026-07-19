/**
 * Venue & Court — Canonical civil / absolute time helpers (Phase 2E remediation).
 *
 * A) Civil-input helpers — YYYY-MM-DD / HH:mm only; no Date timezone behavior.
 * B) Absolute-to-civil helpers — require explicit IANA timezone; never use
 *    environment/browser/server local getters for venue decisions.
 *
 * Browser-display helpers are named explicitly and must not be used for
 * venue booking / automation decisions.
 *
 * See docs/venue-court/PHASE_2E_TIME_MODEL.md.
 */

import { loadClubs } from "../data/club.js";
import { loadVenues } from "../data/venue.js";

function findClubById(clubId) {
  if (clubId == null || String(clubId).trim() === "") {
    return null;
  }
  return loadClubs().find((club) => club.id === String(clubId).trim()) || null;
}

function findVenueById(venueId) {
  if (venueId == null || String(venueId).trim() === "") {
    return null;
  }
  return loadVenues().find((venue) => venue.id === String(venueId).trim()) || null;
}

export const CIVIL_TIME_ERROR = Object.freeze({
  INVALID_DATE: "INVALID_DATE",
  INVALID_TIME: "INVALID_TIME",
  INVALID_TIME_WINDOW: "INVALID_TIME_WINDOW",
  TIMEZONE_REQUIRED: "TIMEZONE_REQUIRED",
  AMBIGUOUS_LOCAL_TIME: "AMBIGUOUS_LOCAL_TIME",
  DATA_UNAVAILABLE: "DATA_UNAVAILABLE",
});

export const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const CIVIL_HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function createCivilTimeError(code, message) {
  return Object.assign(new Error(message), { code });
}

// ---------------------------------------------------------------------------
// A) Civil-input helpers (no environment timezone)
// ---------------------------------------------------------------------------

export function isValidCivilDate(value) {
  if (typeof value !== "string" || !CIVIL_DATE_RE.test(value.trim())) {
    return false;
  }
  const text = value.trim();
  const [y, m, d] = text.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return false;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return false;
  }
  // UTC calendar probe — independent of host timezone.
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

export function isValidCivilTime(value) {
  return typeof value === "string" && CIVIL_HHMM_RE.test(value.trim());
}

export function parseCivilDateStrict(value) {
  const text = value != null ? String(value).trim() : "";
  if (!isValidCivilDate(text)) {
    throw createCivilTimeError(
      CIVIL_TIME_ERROR.INVALID_DATE,
      "date phải có dạng YYYY-MM-DD hợp lệ."
    );
  }
  return text;
}

export function parseCivilTimeStrict(value, label = "time") {
  const text = value != null ? String(value).trim() : "";
  if (!isValidCivilTime(text)) {
    throw createCivilTimeError(
      CIVIL_TIME_ERROR.INVALID_TIME,
      `${label} phải có dạng HH:mm.`
    );
  }
  return text;
}

export function civilTimeToMinutes(time) {
  const text = parseCivilTimeStrict(time, "time");
  const [hours, minutes] = text.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToCivilTime(totalMinutes) {
  const n = Number(totalMinutes);
  if (!Number.isFinite(n) || n < 0 || n >= 1440 || Math.floor(n) !== n) {
    throw createCivilTimeError(
      CIVIL_TIME_ERROR.INVALID_TIME,
      "minutes phải là số nguyên 0..1439."
    );
  }
  const hours = Math.floor(n / 60);
  const minutes = n % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function minutesToCivilTimeWrapped(totalMinutes) {
  const wrapped = ((Number(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function normalizeCivilWindow({ date, startTime, endTime } = {}) {
  let d;
  let start;
  let end;
  try {
    d = parseCivilDateStrict(date);
    start = parseCivilTimeStrict(startTime, "startTime");
    end = parseCivilTimeStrict(endTime, "endTime");
  } catch {
    return null;
  }
  if (civilTimeToMinutes(end) <= civilTimeToMinutes(start)) {
    return null;
  }
  return { date: d, startTime: start, endTime: end };
}

export function assertCivilWindow({ date, startTime, endTime } = {}) {
  const window = normalizeCivilWindow({ date, startTime, endTime });
  if (!window) {
    throw createCivilTimeError(
      CIVIL_TIME_ERROR.INVALID_TIME_WINDOW,
      "Khung giờ không hợp lệ — yêu cầu date YYYY-MM-DD và startTime/endTime HH:mm (end > start, cùng ngày)."
    );
  }
  return window;
}

function formatCivilDateFromUtcParts(y, m, d) {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Add calendar days to a civil date using UTC calendar math (host-TZ independent). */
export function addDaysToCivilDate(dateStr, days) {
  const date = parseCivilDateStrict(dateStr);
  const [y, m, d] = date.split("-").map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  cursor.setUTCDate(cursor.getUTCDate() + Number(days || 0));
  return formatCivilDateFromUtcParts(
    cursor.getUTCFullYear(),
    cursor.getUTCMonth() + 1,
    cursor.getUTCDate()
  );
}

/**
 * List civil dates matching weekday in [startDate, endDate] inclusive.
 * Weekday uses UTC noon of each civil date (calendar-invariant).
 */
export function listCivilDatesForWeekday(startDate, endDate, weekday) {
  if (!startDate || !endDate) {
    return [];
  }
  const start = parseCivilDateStrict(startDate);
  const end = parseCivilDateStrict(endDate);
  const target = Number(weekday);
  if (!Number.isFinite(target) || target < 0 || target > 6) {
    throw createCivilTimeError(
      CIVIL_TIME_ERROR.INVALID_DATE,
      "weekday phải là 0..6."
    );
  }

  const dates = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const cursor = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));
  const last = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));

  while (cursor.getTime() <= last.getTime()) {
    if (cursor.getUTCDay() === target) {
      dates.push(
        formatCivilDateFromUtcParts(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth() + 1,
          cursor.getUTCDate()
        )
      );
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

// ---------------------------------------------------------------------------
// B) Absolute → civil (IANA timezone required)
// ---------------------------------------------------------------------------

export function assertIanaTimezone(timezone) {
  const tz = timezone != null ? String(timezone).trim() : "";
  if (!tz) {
    throw createCivilTimeError(
      CIVIL_TIME_ERROR.TIMEZONE_REQUIRED,
      "Thiếu timezone IANA tường minh cho chuyển đổi tuyệt đối → giờ dân sự."
    );
  }
  try {
    // RangeError on invalid IANA ids in modern engines.
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(0);
  } catch {
    throw createCivilTimeError(
      CIVIL_TIME_ERROR.TIMEZONE_REQUIRED,
      `Timezone IANA không hợp lệ: ${tz}`
    );
  }
  return tz;
}

export function parseIsoTimestamp(value) {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Convert an absolute instant to venue civil parts using IANA timezone.
 * Deterministic across host environments for the same instant + timezone.
 */
export function absoluteToCivilParts(instant, timezone) {
  const tz = assertIanaTimezone(timezone);
  const ms = parseIsoTimestamp(instant);
  if (ms == null) {
    throw createCivilTimeError(
      CIVIL_TIME_ERROR.INVALID_TIME,
      "Không đọc được timestamp tuyệt đối."
    );
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));

  const map = Object.create(null);
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  const date = `${map.year}-${map.month}-${map.day}`;
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  if (!isValidCivilDate(date) || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw createCivilTimeError(
      CIVIL_TIME_ERROR.DATA_UNAVAILABLE,
      "Không tách được ngày/giờ dân sự từ timezone."
    );
  }

  const time = minutesToCivilTime(hour * 60 + minute);
  return {
    date,
    time,
    minutes: hour * 60 + minute,
    timezone: tz,
  };
}

export function absoluteToCivilDate(instant, timezone) {
  return absoluteToCivilParts(instant, timezone).date;
}

export function absoluteToCivilMinutes(instant, timezone) {
  return absoluteToCivilParts(instant, timezone).minutes;
}

export function absoluteToCivilTime(instant, timezone) {
  return absoluteToCivilParts(instant, timezone).time;
}

/**
 * Convert venue civil date + minutes-from-midnight to UTC epoch ms (IANA).
 * Fail-closed on DST gaps / non-convergent local times.
 */
export function civilDateTimeToUtcMs(dateStr, minutesFromMidnight, timezone) {
  const tz = assertIanaTimezone(timezone);
  const date = parseCivilDateStrict(dateStr);
  const minutes = Number(minutesFromMidnight);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes >= 1440 || Math.floor(minutes) !== minutes) {
    throw createCivilTimeError(
      CIVIL_TIME_ERROR.INVALID_TIME,
      "minutesFromMidnight phải là số nguyên 0..1439."
    );
  }

  const [y, m, d] = date.split("-").map(Number);
  const h = Math.floor(minutes / 60);
  const min = minutes % 60;
  let guess = Date.UTC(y, m - 1, d, h, min, 0);

  for (let i = 0; i < 5; i += 1) {
    const parts = absoluteToCivilParts(guess, tz);
    const [py, pm, pd] = parts.date.split("-").map(Number);
    const dayDeltaMs = Date.UTC(y, m - 1, d) - Date.UTC(py, pm - 1, pd);
    const minuteDeltaMs = (minutes - parts.minutes) * 60000;
    const delta = dayDeltaMs + minuteDeltaMs;
    if (delta === 0) {
      break;
    }
    guess += delta;
  }

  const verify = absoluteToCivilParts(guess, tz);
  if (verify.date !== date || verify.minutes !== minutes) {
    throw createCivilTimeError(
      CIVIL_TIME_ERROR.AMBIGUOUS_LOCAL_TIME,
      `Không ánh xạ được ${date} ${minutesToCivilTime(minutes)} trong ${tz} (DST/gap).`
    );
  }
  return guess;
}

/**
 * Build same-day civil window from absolute "now" in an IANA timezone.
 */
export function buildVenueCivilWindow(durationMinutes = 20, now = new Date(), timezone) {
  let parts;
  try {
    parts = absoluteToCivilParts(now, timezone);
  } catch (error) {
    return {
      ok: false,
      code: error?.code || CIVIL_TIME_ERROR.TIMEZONE_REQUIRED,
      error: error?.message || "Không tạo được khung giờ dân sự.",
    };
  }

  const duration = Math.max(1, Number(durationMinutes) || 20);
  const endMins = parts.minutes + duration;
  if (endMins > 24 * 60 - 1) {
    return {
      ok: false,
      code: CIVIL_TIME_ERROR.INVALID_TIME_WINDOW,
      error:
        "Khung giờ vượt quá ngày dân sự — không hỗ trợ overnight (Phase 2E).",
    };
  }

  return {
    ok: true,
    date: parts.date,
    startTime: minutesToCivilTime(parts.minutes),
    endTime: minutesToCivilTime(endMins),
    timezone: parts.timezone,
  };
}

/**
 * ISO instant → civil HH:mm on a known civil date in an IANA timezone.
 * Requires timezone. Returns null if the instant falls on a different civil day.
 */
export function isoToCivilHhmmOnDate(iso, dateStr, options = {}) {
  const timezone = options.timezone;
  if (timezone == null || String(timezone).trim() === "") {
    throw createCivilTimeError(
      CIVIL_TIME_ERROR.TIMEZONE_REQUIRED,
      "Chuyển ISO → giờ dân sự yêu cầu timezone IANA tường minh."
    );
  }

  let expected;
  try {
    expected = parseCivilDateStrict(dateStr);
  } catch {
    return null;
  }

  let parts;
  try {
    parts = absoluteToCivilParts(iso, timezone);
  } catch {
    return null;
  }

  if (parts.date !== expected) {
    return null;
  }
  return parts.time;
}

/**
 * Resolve venue IANA timezone for a club.
 *
 * Preferred source: venue.timezone (via club.venueId).
 * Explicit options.timezone always wins when provided.
 *
 * No browser/server local fallback. No silent DEFAULT_TIMEZONE injection here —
 * if the venue record has no timezone (or no venue is linked), fail closed.
 */
export function resolveVenueTimezoneForClub(clubId, options = {}) {
  if (options.timezone != null && String(options.timezone).trim() !== "") {
    try {
      return {
        ok: true,
        timezone: assertIanaTimezone(options.timezone),
        source: "explicit",
      };
    } catch (error) {
      return {
        ok: false,
        code: error.code || CIVIL_TIME_ERROR.TIMEZONE_REQUIRED,
        error: error.message,
        source: "explicit",
      };
    }
  }

  if (clubId == null || String(clubId).trim() === "") {
    return {
      ok: false,
      code: CIVIL_TIME_ERROR.TIMEZONE_REQUIRED,
      error: "Thiếu clubId để resolve venue.timezone.",
      source: null,
    };
  }

  const club = (() => {
    try {
      return findClubById(String(clubId).trim());
    } catch {
      return null;
    }
  })();
  if (!club) {
    return {
      ok: false,
      code: CIVIL_TIME_ERROR.TIMEZONE_REQUIRED,
      error: "Không tìm thấy club để resolve venue.timezone.",
      source: null,
    };
  }

  if (!club.venueId) {
    return {
      ok: false,
      code: CIVIL_TIME_ERROR.TIMEZONE_REQUIRED,
      error:
        "Club chưa gắn venue — không có venue.timezone cho quyết định giờ dân sự.",
      source: null,
    };
  }

  const venue = findVenueById(club.venueId);
  const raw = venue?.timezone != null ? String(venue.timezone).trim() : "";
  if (!raw) {
    return {
      ok: false,
      code: CIVIL_TIME_ERROR.TIMEZONE_REQUIRED,
      error: "Venue không có timezone IANA — TIMEZONE_REQUIRED.",
      source: "venue.timezone",
    };
  }

  try {
    return {
      ok: true,
      timezone: assertIanaTimezone(raw),
      source: "venue.timezone",
      venueId: club.venueId,
    };
  } catch (error) {
    return {
      ok: false,
      code: error.code || CIVIL_TIME_ERROR.TIMEZONE_REQUIRED,
      error: error.message,
      source: "venue.timezone",
      venueId: club.venueId,
    };
  }
}

// ---------------------------------------------------------------------------
// Browser-display only (NOT for venue booking decisions)
// ---------------------------------------------------------------------------

/**
 * USER-DISPLAY ONLY. Uses environment local getters.
 * Must not drive booking automation, availability "today", or Court Engine windows.
 */
export function getBrowserDisplayCivilDate(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) {
    throw createCivilTimeError(
      CIVIL_TIME_ERROR.INVALID_DATE,
      "Không đọc được ngày hiển thị trình duyệt."
    );
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * @deprecated Environment-local — not venue-safe.
 * Prefer absoluteToCivilDate(instant, timezone) for venue decisions.
 */
export function getLocalCivilDate(now = new Date()) {
  return getBrowserDisplayCivilDate(now);
}

/**
 * @deprecated Environment-local — not venue-safe.
 */
export function getLocalCivilMinutes(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) {
    throw createCivilTimeError(
      CIVIL_TIME_ERROR.INVALID_TIME,
      "Không đọc được giờ hiển thị trình duyệt."
    );
  }
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * @deprecated Environment-local — not venue-safe.
 */
export function getLocalCivilTime(now = new Date()) {
  return minutesToCivilTime(getLocalCivilMinutes(now));
}

/**
 * @deprecated Use buildVenueCivilWindow(duration, now, timezone).
 */
export function buildLocalCivilWindow(durationMinutes = 20, now = new Date(), timezone) {
  if (timezone == null || String(timezone).trim() === "") {
    return {
      ok: false,
      code: CIVIL_TIME_ERROR.TIMEZONE_REQUIRED,
      error:
        "buildLocalCivilWindow yêu cầu timezone IANA — không dùng giờ máy chủ/trình duyệt.",
    };
  }
  return buildVenueCivilWindow(durationMinutes, now, timezone);
}
