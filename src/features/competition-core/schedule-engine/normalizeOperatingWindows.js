/**
 * CORE-11 Phase 1C — operating-window normalization (pure).
 *
 * Half-open [startMinutes, endMinutes) on one civil date.
 * Overnight rejected. Overlaps / duplicates rejected.
 * Output order is deterministic (not input order).
 */

import { SCHEDULE_DIAGNOSTIC_SEVERITY } from "./scheduleConstants.js";
import {
  SCHEDULE_DIAGNOSTIC_CODE,
  createScheduleDiagnostic,
  sortScheduleDiagnostics,
} from "./scheduleDiagnostics.js";
import {
  civilWindowsOverlap,
  copyPlainObject,
  deriveOperatingWindowId,
  isValidCivilDate,
  isValidIanaTimezone,
  isValidIdentifier,
  isValidMinutesFromMidnight,
  normalizeIdentifier,
  stableSortByKeys,
} from "./scheduleTypes.js";

/**
 * @typedef {Object} NormalizedOperatingWindow
 * @property {string} windowId
 * @property {string} date
 * @property {number} startMinutes
 * @property {number} endMinutes
 * @property {string} timezone
 * @property {number} sequence
 * @property {string} [label]
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @typedef {Object} NormalizeOperatingWindowsResult
 * @property {boolean} ok
 * @property {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 * @property {NormalizedOperatingWindow[]} windows
 */

/**
 * @param {unknown} windows
 * @param {{ timezone: unknown, pathPrefix?: string }} options
 * @returns {NormalizeOperatingWindowsResult}
 */
export function normalizeOperatingWindows(windows, options) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  const pathPrefix =
    options && typeof options.pathPrefix === "string" && options.pathPrefix
      ? options.pathPrefix
      : "operatingWindows";
  const requestTimezone = normalizeIdentifier(options?.timezone);

  if (!requestTimezone) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
      path: "timezone",
      message: "timezone is required before operating-window normalization",
    });
    return {
      ok: false,
      diagnostics: sortScheduleDiagnostics(diagnostics),
      windows: [],
    };
  }
  if (!isValidIanaTimezone(requestTimezone)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
      path: "timezone",
      message: `timezone is not a supported IANA id: ${requestTimezone}`,
      details: { timezone: requestTimezone },
    });
    return {
      ok: false,
      diagnostics: sortScheduleDiagnostics(diagnostics),
      windows: [],
    };
  }

  if (windows === undefined || windows === null) {
    return {
      ok: true,
      diagnostics: sortScheduleDiagnostics(diagnostics),
      windows: [],
    };
  }
  if (!Array.isArray(windows)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
      path: pathPrefix,
      message: "operatingWindows must be an array when provided",
    });
    return {
      ok: false,
      diagnostics: sortScheduleDiagnostics(diagnostics),
      windows: [],
    };
  }

  /** @type {{ date: string, startMinutes: number, endMinutes: number, timezone: string, windowId: string, label?: string, metadata?: Readonly<Record<string, unknown>>, path: string, inputIndex: number }[]} */
  const validated = [];

  windows.forEach((raw, index) => {
    const path = `${pathPrefix}[${index}]`;
    const parsed = parseOperatingWindow(raw, path, requestTimezone, push);
    if (parsed) {
      validated.push({ ...parsed, inputIndex: index, path });
    }
  });

  // Duplicate equivalent intervals (date+start+end+timezone), deterministic order.
  /** @type {Map<string, string>} */
  const intervalOwners = new Map();
  for (const row of stableSortByKeys(validated, (w) => [
    w.date,
    w.startMinutes,
    w.endMinutes,
    w.windowId,
    w.path,
  ])) {
    const key = `${row.date}\0${row.startMinutes}\0${row.endMinutes}\0${row.timezone}`;
    const owner = intervalOwners.get(key);
    if (owner != null) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_OPERATING_WINDOW,
        path: row.path,
        message: `duplicate equivalent operating window of ${owner}`,
        details: {
          leftPath: owner,
          rightPath: row.path,
          date: row.date,
          startMinutes: row.startMinutes,
          endMinutes: row.endMinutes,
          timezone: row.timezone,
        },
      });
    } else {
      intervalOwners.set(key, row.path);
    }
  }

  // Duplicate explicit windowIds.
  /** @type {Map<string, string>} */
  const idOwners = new Map();
  for (const row of stableSortByKeys(validated, (w) => [w.windowId, w.path])) {
    const owner = idOwners.get(row.windowId);
    if (owner != null) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
        path: `${row.path}.windowId`,
        message: `duplicate operating windowId: ${row.windowId}`,
        details: { windowId: row.windowId, leftPath: owner, rightPath: row.path },
      });
    } else {
      idOwners.set(row.windowId, row.path);
    }
  }

  // Overlaps on same civil date.
  const overlapOrdered = stableSortByKeys(validated, (w) => [
    w.date,
    w.startMinutes,
    w.endMinutes,
    w.windowId,
    w.path,
  ]);
  for (let i = 0; i < overlapOrdered.length; i += 1) {
    for (let j = i + 1; j < overlapOrdered.length; j += 1) {
      const a = overlapOrdered[i];
      const b = overlapOrdered[j];
      if (a.date !== b.date) continue;
      if (civilWindowsOverlap(a, b)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.OVERLAPPING_TIME_WINDOW,
          path: b.path,
          message: `window overlaps ${a.path} on ${a.date}`,
          details: {
            leftPath: a.path,
            rightPath: b.path,
            date: a.date,
            left: { startMinutes: a.startMinutes, endMinutes: a.endMinutes },
            right: { startMinutes: b.startMinutes, endMinutes: b.endMinutes },
          },
        });
      }
    }
  }

  const sortedDiagnostics = sortScheduleDiagnostics(diagnostics);
  const hasError = sortedDiagnostics.some(
    (d) => d.severity === SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR
  );
  if (hasError) {
    return { ok: false, diagnostics: sortedDiagnostics, windows: [] };
  }

  const ordered = stableSortByKeys(validated, (w) => [
    w.date,
    w.startMinutes,
    w.endMinutes,
    w.windowId,
  ]);

  /** @type {NormalizedOperatingWindow[]} */
  const normalized = ordered.map((w, sequence) => {
    /** @type {NormalizedOperatingWindow} */
    const out = {
      windowId: w.windowId,
      date: w.date,
      startMinutes: w.startMinutes,
      endMinutes: w.endMinutes,
      timezone: w.timezone,
      sequence,
    };
    if (w.label != null) out.label = w.label;
    if (w.metadata) out.metadata = w.metadata;
    return out;
  });

  return {
    ok: true,
    diagnostics: sortedDiagnostics,
    windows: normalized,
  };
}

/**
 * @param {unknown} raw
 * @param {string} path
 * @param {string} requestTimezone
 * @param {(partial: Partial<import('./scheduleDiagnostics.js').ScheduleDiagnostic> & { code: string }) => void} push
 * @returns {{ date: string, startMinutes: number, endMinutes: number, timezone: string, windowId: string, label?: string, metadata?: Readonly<Record<string, unknown>> }|null}
 */
function parseOperatingWindow(raw, path, requestTimezone, push) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
      path,
      message: "window must be an object",
    });
    return null;
  }

  const w = /** @type {Record<string, unknown>} */ (raw);
  const date = normalizeIdentifier(w.date);
  let ok = true;

  if (!isValidCivilDate(date)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_DATE,
      path: `${path}.date`,
      message: "date must be a valid civil YYYY-MM-DD",
      details: { date },
    });
    ok = false;
  }

  if (!isValidMinutesFromMidnight(w.startMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
      path: `${path}.startMinutes`,
      message: "startMinutes must be an integer 0..1439",
    });
    ok = false;
  }
  if (!isValidMinutesFromMidnight(w.endMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
      path: `${path}.endMinutes`,
      message: "endMinutes must be an integer 0..1439",
    });
    ok = false;
  }

  if (
    isValidMinutesFromMidnight(w.startMinutes) &&
    isValidMinutesFromMidnight(w.endMinutes)
  ) {
    const start = /** @type {number} */ (w.startMinutes);
    const end = /** @type {number} */ (w.endMinutes);
    if (end <= start) {
      if (end < start) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.OVERNIGHT_WINDOW_NOT_SUPPORTED,
          path,
          message:
            "Phase 1 overnight policy is REJECT — window must remain inside one civil date (endMinutes > startMinutes)",
          details: { startMinutes: start, endMinutes: end, overnightPolicy: "REJECT" },
        });
      } else {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
          path,
          message: "endMinutes must be greater than startMinutes (end exclusive)",
          details: { startMinutes: start, endMinutes: end },
        });
      }
      ok = false;
    }
  }

  let timezone = requestTimezone;
  if (w.timezone !== undefined && w.timezone !== null && String(w.timezone).trim()) {
    const windowTz = normalizeIdentifier(w.timezone);
    if (!isValidIanaTimezone(windowTz)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
        path: `${path}.timezone`,
        message: `timezone is not a supported IANA id: ${windowTz}`,
        details: { timezone: windowTz },
      });
      ok = false;
    } else if (windowTz !== requestTimezone) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.TIMEZONE_MISMATCH,
        path: `${path}.timezone`,
        message: `window timezone ${windowTz} does not match request timezone ${requestTimezone}`,
        details: { windowTimezone: windowTz, requestTimezone },
      });
      ok = false;
    } else {
      timezone = windowTz;
    }
  }

  let windowId = "";
  if (w.windowId !== undefined && w.windowId !== null) {
    windowId = normalizeIdentifier(w.windowId);
    if (!isValidIdentifier(windowId)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
        path: `${path}.windowId`,
        message: "windowId must be a non-empty trimmed string when supplied",
      });
      ok = false;
    }
  }

  let label;
  if (w.label !== undefined && w.label !== null) {
    if (typeof w.label !== "string") {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
        path: `${path}.label`,
        message: "label must be a string when provided",
      });
      ok = false;
    } else if (String(w.label).trim()) {
      label = String(w.label).trim();
    }
  }

  let metadata;
  if (w.metadata !== undefined && w.metadata !== null) {
    if (typeof w.metadata !== "object" || Array.isArray(w.metadata)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
        path: `${path}.metadata`,
        message: "metadata must be a plain object when provided",
      });
      ok = false;
    } else {
      metadata = Object.freeze(copyPlainObject(w.metadata));
    }
  }

  if (!ok) return null;

  if (!windowId) {
    windowId = deriveOperatingWindowId({
      date,
      startMinutes: /** @type {number} */ (w.startMinutes),
      endMinutes: /** @type {number} */ (w.endMinutes),
      timezone,
    });
  }

  /** @type {{ date: string, startMinutes: number, endMinutes: number, timezone: string, windowId: string, label?: string, metadata?: Readonly<Record<string, unknown>> }} */
  const out = {
    date,
    startMinutes: /** @type {number} */ (w.startMinutes),
    endMinutes: /** @type {number} */ (w.endMinutes),
    timezone,
    windowId,
  };
  if (label != null) out.label = label;
  if (metadata) out.metadata = metadata;
  return out;
}
