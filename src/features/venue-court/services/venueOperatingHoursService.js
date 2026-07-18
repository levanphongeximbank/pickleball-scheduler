/**
 * Venue & Court — Operating hours facade (Phase 1C).
 *
 * SSOT: club_data_v3.data.courtManagement.openHour / closeHour
 * Legacy key pickleball-venue-hours-v1::{tenantId} is read-once, eligibility-gated only.
 */

import {
  DEFAULT_CLOSE_HOUR,
  DEFAULT_OPEN_HOUR,
} from "../../../domain/courtBookingEngine.js";
import {
  loadCourtManagementSettings,
  saveCourtManagementSettings,
  validateOperatingHourIntegers,
} from "../../../domain/courtManagementSettings.js";
import { loadClubs } from "../../../data/club.js";

/** @internal Compatibility-only. Do not dual-write. Do not delete in Phase 1C. */
export const LEGACY_VENUE_HOURS_STORAGE_KEY = "pickleball-venue-hours-v1";

/** Legacy VenueHoursPage weekday ids: "0"=CN … "6"=T7 */
export const LEGACY_REQUIRED_DAY_IDS = Object.freeze(["0", "1", "2", "3", "4", "5", "6"]);

export const LEGACY_IMPORT_REASON = Object.freeze({
  LEGACY_DATA_INVALID: "LEGACY_DATA_INVALID",
  LEGACY_DAILY_HOURS_DIFFER: "LEGACY_DAILY_HOURS_DIFFER",
  LEGACY_MINUTE_PRECISION_UNSUPPORTED: "LEGACY_MINUTE_PRECISION_UNSUPPORTED",
  LEGACY_CLOSED_DAY_UNSUPPORTED: "LEGACY_CLOSED_DAY_UNSUPPORTED",
  VENUE_SCOPE_MISSING: "VENUE_SCOPE_MISSING",
  CLUB_SCOPE_MISSING: "CLUB_SCOPE_MISSING",
  CLUB_VENUE_MISMATCH: "CLUB_VENUE_MISMATCH",
  LEGACY_ALREADY_IMPORTED: "LEGACY_ALREADY_IMPORTED",
  COURT_MANAGEMENT_ALREADY_CONFIGURED: "COURT_MANAGEMENT_ALREADY_CONFIGURED",
  NO_LEGACY_DATA: "NO_LEGACY_DATA",
});

const HHMM_RE = /^([01]\d|2[0-3]|24):([0-5]\d)$/;

const WARNING_REASONS = new Set([
  LEGACY_IMPORT_REASON.LEGACY_DATA_INVALID,
  LEGACY_IMPORT_REASON.LEGACY_DAILY_HOURS_DIFFER,
  LEGACY_IMPORT_REASON.LEGACY_MINUTE_PRECISION_UNSUPPORTED,
  LEGACY_IMPORT_REASON.LEGACY_CLOSED_DAY_UNSUPPORTED,
]);

const defaultDeps = Object.freeze({
  loadCourtManagementSettings,
  saveCourtManagementSettings,
  loadClubs,
  readLegacyVenueHoursPayload,
});

let deps = { ...defaultDeps };

/** @internal Test-only dependency override. */
export function __setVenueOperatingHoursDepsForTests(nextDeps = {}) {
  deps = { ...defaultDeps, ...nextDeps };
}

/** @internal Test-only dependency reset. */
export function __resetVenueOperatingHoursDepsForTests() {
  deps = { ...defaultDeps };
}

/**
 * @param {string} value
 * @returns {{ ok: true, hour: number, minute: number } | { ok: false, message: string }}
 */
export function parseHhmm(value) {
  const text = String(value || "").trim();
  const match = HHMM_RE.exec(text);
  if (!match) {
    return { ok: false, message: "Giờ phải có dạng HH:mm (ví dụ 06:00)." };
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour === 24 && minute !== 0) {
    return { ok: false, message: "24:00 là giá trị đóng cửa hợp lệ duy nhất cho giờ 24." };
  }

  if (hour === 24) {
    return { ok: true, hour: 24, minute: 0 };
  }

  return { ok: true, hour, minute };
}

/**
 * @param {string} value
 * @param {"open"|"close"} role
 */
export function hhmmToOperatingHour(value, role = "open") {
  const parsed = parseHhmm(value);
  if (!parsed.ok) {
    return parsed;
  }

  if (parsed.minute !== 0) {
    return {
      ok: false,
      message: "Chỉ hỗ trợ giờ tròn (phút phải là 00) để khớp Court Management.",
    };
  }

  if (role === "open" && parsed.hour === 24) {
    return { ok: false, message: "Giờ mở cửa không thể là 24:00." };
  }

  if (role === "close" && parsed.hour === 0) {
    return { ok: false, message: "Giờ đóng cửa phải sau giờ mở cửa." };
  }

  return { ok: true, hour: parsed.hour };
}

export function operatingHourToHhmm(hour) {
  const value = Number(hour);
  if (!Number.isFinite(value)) {
    return "00:00";
  }
  if (value >= 24) {
    return "24:00";
  }
  return `${String(Math.max(0, Math.min(23, Math.trunc(value)))).padStart(2, "0")}:00`;
}

function isDefaultOperatingHours(openHour, closeHour) {
  return Number(openHour) === DEFAULT_OPEN_HOUR && Number(closeHour) === DEFAULT_CLOSE_HOUR;
}

export function legacyImportUserMessage(reason) {
  switch (reason) {
    case LEGACY_IMPORT_REASON.LEGACY_DAILY_HOURS_DIFFER:
    case LEGACY_IMPORT_REASON.LEGACY_MINUTE_PRECISION_UNSUPPORTED:
    case LEGACY_IMPORT_REASON.LEGACY_CLOSED_DAY_UNSUPPORTED:
      return "Giờ hoạt động cũ có lịch khác nhau theo ngày hoặc có phút lẻ nên không thể tự chuyển. Hệ thống chưa thay đổi dữ liệu cũ.";
    case LEGACY_IMPORT_REASON.LEGACY_DATA_INVALID:
      return "Dữ liệu giờ mở cửa cũ không hợp lệ nên không thể tự chuyển. Hệ thống chưa thay đổi dữ liệu cũ.";
    case LEGACY_IMPORT_REASON.CLUB_VENUE_MISMATCH:
      return "CLB đang chọn không thuộc cơ sở hiện tại. Hệ thống chưa thay đổi dữ liệu giờ cũ.";
    case LEGACY_IMPORT_REASON.VENUE_SCOPE_MISSING:
      return "Chưa chọn cơ sở nên không thể đối chiếu giờ mở cửa cũ.";
    case LEGACY_IMPORT_REASON.CLUB_SCOPE_MISSING:
      return "Chưa chọn CLB thuộc cơ sở nên không thể đối chiếu giờ mở cửa cũ.";
    default:
      return null;
  }
}

export function shouldWarnLegacyImport(legacyImport) {
  return Boolean(
    legacyImport &&
      legacyImport.status === "not_imported" &&
      WARNING_REASONS.has(legacyImport.reason)
  );
}

/**
 * @internal Compatibility helper — reads legacy orphan payload only.
 * Distinguishes missing key, invalid JSON, and valid array.
 */
export function readLegacyVenueHoursPayload(tenantId) {
  if (!tenantId || typeof localStorage === "undefined") {
    return { ok: false, reason: LEGACY_IMPORT_REASON.VENUE_SCOPE_MISSING, rows: null };
  }

  try {
    const raw = localStorage.getItem(`${LEGACY_VENUE_HOURS_STORAGE_KEY}::${tenantId}`);
    if (raw == null || raw === "") {
      return { ok: true, empty: true, rows: null };
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { ok: false, reason: LEGACY_IMPORT_REASON.LEGACY_DATA_INVALID, rows: null };
    }
    return { ok: true, empty: false, rows: parsed };
  } catch {
    return { ok: false, reason: LEGACY_IMPORT_REASON.LEGACY_DATA_INVALID, rows: null };
  }
}

/**
 * Evaluate whether legacy weekday rows may safely collapse into one CM window.
 *
 * Requires all seven days 0–6 present, identical open/close, minute 00, open < close.
 */
export function evaluateLegacyImportEligibility(rows) {
  if (!Array.isArray(rows)) {
    return { ok: false, reason: LEGACY_IMPORT_REASON.LEGACY_DATA_INVALID };
  }

  if (rows.length === 0) {
    return { ok: false, reason: LEGACY_IMPORT_REASON.LEGACY_DATA_INVALID };
  }

  const byDay = new Map();
  for (const row of rows) {
    if (!row || row.dayOfWeek == null || row.dayOfWeek === "") {
      return { ok: false, reason: LEGACY_IMPORT_REASON.LEGACY_DATA_INVALID };
    }
    const day = String(row.dayOfWeek);
    if (!LEGACY_REQUIRED_DAY_IDS.includes(day)) {
      return { ok: false, reason: LEGACY_IMPORT_REASON.LEGACY_DATA_INVALID };
    }
    if (byDay.has(day)) {
      return { ok: false, reason: LEGACY_IMPORT_REASON.LEGACY_DATA_INVALID };
    }
    byDay.set(day, row);
  }

  for (const day of LEGACY_REQUIRED_DAY_IDS) {
    if (!byDay.has(day)) {
      return { ok: false, reason: LEGACY_IMPORT_REASON.LEGACY_CLOSED_DAY_UNSUPPORTED };
    }
  }

  const openTimes = [];
  const closeTimes = [];

  for (const day of LEGACY_REQUIRED_DAY_IDS) {
    const row = byDay.get(day);
    const openRaw = row.openTime == null ? "" : String(row.openTime).trim().slice(0, 5);
    const closeRaw = row.closeTime == null ? "" : String(row.closeTime).trim().slice(0, 5);

    if (!openRaw || !closeRaw) {
      return { ok: false, reason: LEGACY_IMPORT_REASON.LEGACY_CLOSED_DAY_UNSUPPORTED };
    }

    const openParsed = parseHhmm(openRaw);
    const closeParsed = parseHhmm(closeRaw);
    if (!openParsed.ok || !closeParsed.ok) {
      return { ok: false, reason: LEGACY_IMPORT_REASON.LEGACY_DATA_INVALID };
    }

    if (openParsed.minute !== 0 || closeParsed.minute !== 0) {
      return { ok: false, reason: LEGACY_IMPORT_REASON.LEGACY_MINUTE_PRECISION_UNSUPPORTED };
    }

    openTimes.push(operatingHourToHhmm(openParsed.hour));
    closeTimes.push(operatingHourToHhmm(closeParsed.hour));
  }

  const openHour = openTimes[0];
  const closeHour = closeTimes[0];
  if (openTimes.some((value) => value !== openHour) || closeTimes.some((value) => value !== closeHour)) {
    return { ok: false, reason: LEGACY_IMPORT_REASON.LEGACY_DAILY_HOURS_DIFFER };
  }

  const openInt = hhmmToOperatingHour(openHour, "open");
  const closeInt = hhmmToOperatingHour(closeHour, "close");
  if (!openInt.ok || !closeInt.ok) {
    return { ok: false, reason: LEGACY_IMPORT_REASON.LEGACY_DATA_INVALID };
  }

  const validated = validateOperatingHourIntegers(openInt.hour, closeInt.hour);
  if (!validated.ok) {
    return { ok: false, reason: LEGACY_IMPORT_REASON.LEGACY_DATA_INVALID };
  }

  return {
    ok: true,
    openHour: validated.openHour,
    closeHour: validated.closeHour,
  };
}

/**
 * Resolve venue + active club and verify club.venueId === venueId via loadClubs().
 */
export function resolveOperatingHoursScope(options = {}) {
  const venueId =
    (options.venueId != null && options.venueId !== "" && String(options.venueId)) ||
    (options.tenantId != null && options.tenantId !== "" && String(options.tenantId)) ||
    null;
  const clubId = options.clubId != null && options.clubId !== "" ? String(options.clubId) : null;

  if (!venueId) {
    return { ok: false, reason: LEGACY_IMPORT_REASON.VENUE_SCOPE_MISSING };
  }
  if (!clubId) {
    return { ok: false, reason: LEGACY_IMPORT_REASON.CLUB_SCOPE_MISSING };
  }

  const club = deps.loadClubs().find((item) => item.id === clubId);
  if (!club || club.venueId !== venueId) {
    return { ok: false, reason: LEGACY_IMPORT_REASON.CLUB_VENUE_MISMATCH };
  }

  return { ok: true, clubId, venueId, tenantId: venueId };
}

function toPublicHours(openHour, closeHour, source, legacyImport) {
  return {
    openHour: operatingHourToHhmm(openHour),
    closeHour: operatingHourToHhmm(closeHour),
    source,
    legacyImport: {
      status: legacyImport.status,
      reason: legacyImport.reason || null,
      message: legacyImport.message || legacyImportUserMessage(legacyImport.reason) || null,
    },
  };
}

function notImported(settingsOrDefaults, reason) {
  const openHour = settingsOrDefaults?.openHour ?? DEFAULT_OPEN_HOUR;
  const closeHour = settingsOrDefaults?.closeHour ?? DEFAULT_CLOSE_HOUR;
  return toPublicHours(openHour, closeHour, "courtManagement", {
    status: "not_imported",
    reason,
  });
}

/**
 * @param {{ clubId: string, venueId?: string, tenantId?: string, skipLegacyFallback?: boolean }} options
 */
export function getVenueOperatingHours(options = {}) {
  const scope = resolveOperatingHoursScope(options);
  if (!scope.ok) {
    return notImported(null, scope.reason);
  }

  const { clubId, tenantId } = scope;

  let settings;
  try {
    settings = deps.loadCourtManagementSettings(clubId);
  } catch (error) {
    throw new Error("Failed to load operating hours", { cause: error });
  }

  if (options.skipLegacyFallback === true) {
    return toPublicHours(settings.openHour, settings.closeHour, "courtManagement", {
      status: "not_imported",
      reason: LEGACY_IMPORT_REASON.NO_LEGACY_DATA,
      message: null,
    });
  }

  if (settings.legacyVenueHoursImportedAt) {
    return toPublicHours(settings.openHour, settings.closeHour, "courtManagement", {
      status: "not_imported",
      reason: LEGACY_IMPORT_REASON.LEGACY_ALREADY_IMPORTED,
      message: null,
    });
  }

  if (!isDefaultOperatingHours(settings.openHour, settings.closeHour)) {
    return toPublicHours(settings.openHour, settings.closeHour, "courtManagement", {
      status: "not_imported",
      reason: LEGACY_IMPORT_REASON.COURT_MANAGEMENT_ALREADY_CONFIGURED,
      message: null,
    });
  }

  let legacyPayload;
  try {
    legacyPayload = deps.readLegacyVenueHoursPayload(tenantId);
  } catch (error) {
    throw new Error("Failed to load operating hours", { cause: error });
  }

  if (!legacyPayload.ok) {
    return notImported(settings, legacyPayload.reason);
  }

  if (legacyPayload.empty) {
    return toPublicHours(settings.openHour, settings.closeHour, "courtManagement", {
      status: "not_imported",
      reason: LEGACY_IMPORT_REASON.NO_LEGACY_DATA,
      message: null,
    });
  }

  const eligibility = evaluateLegacyImportEligibility(legacyPayload.rows);
  if (!eligibility.ok) {
    return notImported(settings, eligibility.reason);
  }

  try {
    deps.saveCourtManagementSettings(clubId, {
      openHour: eligibility.openHour,
      closeHour: eligibility.closeHour,
      legacyVenueHoursImportedAt: new Date().toISOString(),
    });
  } catch (error) {
    throw new Error("Failed to import legacy operating hours", { cause: error });
  }

  return toPublicHours(eligibility.openHour, eligibility.closeHour, "legacy-import", {
    status: "imported",
    reason: null,
    message: null,
  });
}

/**
 * @param {{ openHour: string, closeHour: string }} hours HH:mm
 * @param {{ clubId: string, venueId?: string, tenantId?: string }} options
 */
export function updateVenueOperatingHours(hours = {}, options = {}) {
  const scope = resolveOperatingHoursScope(options);
  if (!scope.ok) {
    return {
      ok: false,
      message: legacyImportUserMessage(scope.reason) || "Phạm vi cơ sở/CLB không hợp lệ.",
      reason: scope.reason,
    };
  }

  const { clubId } = scope;

  const openParsed = hhmmToOperatingHour(hours.openHour, "open");
  if (!openParsed.ok) {
    return { ok: false, message: openParsed.message };
  }

  const closeParsed = hhmmToOperatingHour(hours.closeHour, "close");
  if (!closeParsed.ok) {
    return { ok: false, message: closeParsed.message };
  }

  const validated = validateOperatingHourIntegers(openParsed.hour, closeParsed.hour);
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  try {
    const current = deps.loadCourtManagementSettings(clubId);
    deps.saveCourtManagementSettings(clubId, {
      openHour: validated.openHour,
      closeHour: validated.closeHour,
      // Preserve existing import marker only; do not set marker on explicit save.
      ...(current.legacyVenueHoursImportedAt
        ? { legacyVenueHoursImportedAt: current.legacyVenueHoursImportedAt }
        : {}),
    });
  } catch (error) {
    throw new Error("Failed to save operating hours", { cause: error });
  }

  return {
    ok: true,
    hours: toPublicHours(validated.openHour, validated.closeHour, "courtManagement", {
      status: "not_imported",
      reason: LEGACY_IMPORT_REASON.COURT_MANAGEMENT_ALREADY_CONFIGURED,
      message: null,
    }),
  };
}
