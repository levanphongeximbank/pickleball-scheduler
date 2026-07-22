/**
 * CORE-11 — thin civil→absolute adapter.
 *
 * Delegates all timezone/DST conversion to `src/domain/civilTime.js`
 * via `civilDateTimeToUtcMs` only.
 * Does not implement absolute→civil conversion in CORE-11.
 * Does not copy conversion algorithms. Does not inject Date.now / locale.
 * Does not independently detect or reject DST fall-back ambiguity —
 * `AMBIGUOUS_CIVIL_TIME` maps only when civilTime.js throws
 * `CIVIL_TIME_ERROR.AMBIGUOUS_LOCAL_TIME`.
 * Expected domain-invalid inputs return structured diagnostics (no bare throws).
 */

import {
  CIVIL_TIME_ERROR,
  civilDateTimeToUtcMs,
} from "../../../domain/civilTime.js";
import { SCHEDULE_DIAGNOSTIC_SEVERITY } from "./scheduleConstants.js";
import {
  SCHEDULE_DIAGNOSTIC_CODE,
  createScheduleDiagnostic,
  sortScheduleDiagnostics,
} from "./scheduleDiagnostics.js";
import {
  isValidCivilDate,
  isValidIanaTimezone,
  isValidMinutesFromMidnight,
  normalizeIdentifier,
} from "./scheduleTypes.js";

/**
 * @typedef {Object} AbsoluteCivilInstant
 * @property {number} utcMs
 * @property {string} utcIso
 */

/**
 * @typedef {Object} CivilAbsoluteConversionResult
 * @property {boolean} ok
 * @property {number|null} utcMs
 * @property {string|null} utcIso
 * @property {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 */

/**
 * @typedef {Object} SchedulingWindowAbsoluteRangeResult
 * @property {boolean} ok
 * @property {AbsoluteCivilInstant|null} start
 * @property {AbsoluteCivilInstant|null} end
 * @property {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 */

/**
 * Map civilTime.js error codes to CORE-11 diagnostics.
 *
 * @param {string|undefined} civilCode
 * @returns {string}
 */
function mapCivilErrorCode(civilCode) {
  if (civilCode === CIVIL_TIME_ERROR.AMBIGUOUS_LOCAL_TIME) {
    return SCHEDULE_DIAGNOSTIC_CODE.AMBIGUOUS_CIVIL_TIME;
  }
  if (civilCode === CIVIL_TIME_ERROR.INVALID_DATE) {
    return SCHEDULE_DIAGNOSTIC_CODE.INVALID_DATE;
  }
  if (civilCode === CIVIL_TIME_ERROR.TIMEZONE_REQUIRED) {
    return SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE;
  }
  if (
    civilCode === CIVIL_TIME_ERROR.INVALID_TIME ||
    civilCode === CIVIL_TIME_ERROR.INVALID_TIME_WINDOW
  ) {
    return SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW;
  }
  return SCHEDULE_DIAGNOSTIC_CODE.ABSOLUTE_CONVERSION_FAILURE;
}

/**
 * @param {unknown} civil
 * @param {unknown} [timezoneArg]
 * @param {string} [path]
 * @returns {CivilAbsoluteConversionResult}
 */
export function convertCivilScheduleTimeToAbsolute(
  civil,
  timezoneArg,
  path = ""
) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  if (civil == null || typeof civil !== "object" || Array.isArray(civil)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.ABSOLUTE_CONVERSION_FAILURE,
      path,
      message: "CivilScheduleTime must be a plain object",
    });
    return failAbsolute(diagnostics);
  }

  const record = /** @type {Record<string, unknown>} */ (civil);
  const date = normalizeIdentifier(record.date);
  const minutes = record.minutesFromMidnight;
  const timezone = normalizeIdentifier(
    timezoneArg != null && String(timezoneArg).trim()
      ? timezoneArg
      : record.timezone
  );

  let structurallyOk = true;
  if (!isValidCivilDate(date)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_DATE,
      path: path ? `${path}.date` : "date",
      message: "date must be a valid civil YYYY-MM-DD",
      details: { date },
    });
    structurallyOk = false;
  }
  if (!isValidMinutesFromMidnight(minutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
      path: path ? `${path}.minutesFromMidnight` : "minutesFromMidnight",
      message: "minutesFromMidnight must be an integer 0..1439",
      details: { minutesFromMidnight: minutes ?? null },
    });
    structurallyOk = false;
  }
  if (!timezone) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
      path: path ? `${path}.timezone` : "timezone",
      message: "timezone is required (explicit IANA; no host-local default)",
    });
    structurallyOk = false;
  } else if (!isValidIanaTimezone(timezone)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
      path: path ? `${path}.timezone` : "timezone",
      message: `timezone is not a supported IANA id: ${timezone}`,
      details: { timezone },
    });
    structurallyOk = false;
  }

  if (!structurallyOk) {
    return failAbsolute(diagnostics);
  }

  try {
    const utcMs = civilDateTimeToUtcMs(
      date,
      /** @type {number} */ (minutes),
      timezone
    );
    const utcIso = new Date(utcMs).toISOString();
    return {
      ok: true,
      utcMs,
      utcIso,
      diagnostics: sortScheduleDiagnostics(diagnostics),
    };
  } catch (error) {
    const civilCode =
      error && typeof error === "object" && "code" in error
        ? String(/** @type {{ code?: unknown }} */ (error).code || "")
        : "";
    const mapped = mapCivilErrorCode(civilCode || undefined);
    push({
      code: mapped,
      severity: SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR,
      path,
      message:
        error instanceof Error
          ? error.message
          : "civil→absolute conversion failed",
      details: {
        date,
        minutesFromMidnight: minutes,
        timezone,
        civilTimeErrorCode: civilCode || null,
      },
    });
    return failAbsolute(diagnostics);
  }
}

/**
 * Convert a same-day scheduling window to an absolute half-open UTC range.
 * End uses endMinutes as an exclusive civil boundary (same civil date).
 *
 * @param {unknown} window
 * @param {unknown} [timezoneArg]
 * @param {string} [path]
 * @returns {SchedulingWindowAbsoluteRangeResult}
 */
export function convertSchedulingWindowToAbsoluteRange(
  window,
  timezoneArg,
  path = ""
) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  if (window == null || typeof window !== "object" || Array.isArray(window)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
      path,
      message: "scheduling window must be a plain object",
    });
    return failRange(diagnostics);
  }

  const w = /** @type {Record<string, unknown>} */ (window);
  const date = normalizeIdentifier(w.date);
  const timezone = normalizeIdentifier(
    timezoneArg != null && String(timezoneArg).trim()
      ? timezoneArg
      : w.timezone
  );
  const startMinutes = w.startMinutes;
  const endMinutes = w.endMinutes;

  let structurallyOk = true;
  if (!isValidCivilDate(date)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_DATE,
      path: path ? `${path}.date` : "date",
      message: "date must be a valid civil YYYY-MM-DD",
      details: { date },
    });
    structurallyOk = false;
  }
  if (!isValidMinutesFromMidnight(startMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
      path: path ? `${path}.startMinutes` : "startMinutes",
      message: "startMinutes must be an integer 0..1439",
    });
    structurallyOk = false;
  }
  if (!isValidMinutesFromMidnight(endMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
      path: path ? `${path}.endMinutes` : "endMinutes",
      message: "endMinutes must be an integer 0..1439",
    });
    structurallyOk = false;
  }
  if (
    isValidMinutesFromMidnight(startMinutes) &&
    isValidMinutesFromMidnight(endMinutes) &&
    /** @type {number} */ (endMinutes) <= /** @type {number} */ (startMinutes)
  ) {
    if (/** @type {number} */ (endMinutes) < /** @type {number} */ (startMinutes)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.OVERNIGHT_WINDOW_NOT_SUPPORTED,
        path,
        message:
          "Phase 1 overnight policy is REJECT — absolute range requires same-day endMinutes > startMinutes",
        details: { startMinutes, endMinutes, overnightPolicy: "REJECT" },
      });
    } else {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
        path,
        message: "endMinutes must be greater than startMinutes (end exclusive)",
        details: { startMinutes, endMinutes },
      });
    }
    structurallyOk = false;
  }
  if (!timezone) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
      path: path ? `${path}.timezone` : "timezone",
      message: "timezone is required (explicit IANA; no host-local default)",
    });
    structurallyOk = false;
  } else if (!isValidIanaTimezone(timezone)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
      path: path ? `${path}.timezone` : "timezone",
      message: `timezone is not a supported IANA id: ${timezone}`,
      details: { timezone },
    });
    structurallyOk = false;
  }

  if (!structurallyOk) {
    return failRange(diagnostics);
  }

  const startResult = convertCivilScheduleTimeToAbsolute(
    {
      date,
      minutesFromMidnight: startMinutes,
      timezone,
    },
    timezone,
    path ? `${path}.start` : "start"
  );
  diagnostics.push(...startResult.diagnostics);

  const endResult = convertCivilScheduleTimeToAbsolute(
    {
      date,
      minutesFromMidnight: endMinutes,
      timezone,
    },
    timezone,
    path ? `${path}.end` : "end"
  );
  diagnostics.push(...endResult.diagnostics);

  const sorted = sortScheduleDiagnostics(diagnostics);
  if (!startResult.ok || !endResult.ok) {
    return {
      ok: false,
      start: null,
      end: null,
      diagnostics: sorted,
    };
  }

  return {
    ok: true,
    start: {
      utcMs: /** @type {number} */ (startResult.utcMs),
      utcIso: /** @type {string} */ (startResult.utcIso),
    },
    end: {
      utcMs: /** @type {number} */ (endResult.utcMs),
      utcIso: /** @type {string} */ (endResult.utcIso),
    },
    diagnostics: sorted,
  };
}

/**
 * @param {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 * @returns {CivilAbsoluteConversionResult}
 */
function failAbsolute(diagnostics) {
  return {
    ok: false,
    utcMs: null,
    utcIso: null,
    diagnostics: sortScheduleDiagnostics(diagnostics),
  };
}

/**
 * @param {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 * @returns {SchedulingWindowAbsoluteRangeResult}
 */
function failRange(diagnostics) {
  return {
    ok: false,
    start: null,
    end: null,
    diagnostics: sortScheduleDiagnostics(diagnostics),
  };
}
