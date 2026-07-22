/**
 * CORE-11 Phase 1C — session-window normalization + containment (pure).
 *
 * Sessions are half-open [start, end) on one civil date, must lie entirely
 * inside exactly one operating window for that date, and must not overlap
 * each other. Empty session lists are allowed when operating windows exist
 * for later generic slot generation.
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
  isCivilWindowContained,
  isValidCivilDate,
  isValidIanaTimezone,
  isValidIdentifier,
  isValidMinutesFromMidnight,
  normalizeIdentifier,
  stableSortByKeys,
} from "./scheduleTypes.js";

/**
 * @typedef {Object} NormalizedSessionWindow
 * @property {string} sessionId
 * @property {string} date
 * @property {number} startMinutes
 * @property {number} endMinutes
 * @property {string} timezone
 * @property {number} sequence
 * @property {string} [label]
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @typedef {Object} NormalizeSessionWindowsResult
 * @property {boolean} ok
 * @property {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 * @property {NormalizedSessionWindow[]} windows
 */

/**
 * @param {unknown} sessionWindows
 * @param {Array<{ date: string, startMinutes: number, endMinutes: number, timezone?: string, windowId?: string }>} operatingWindows
 * @param {{ timezone: unknown, pathPrefix?: string }} options
 * @returns {NormalizeSessionWindowsResult}
 */
export function normalizeSessionWindows(sessionWindows, operatingWindows, options) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  const pathPrefix =
    options && typeof options.pathPrefix === "string" && options.pathPrefix
      ? options.pathPrefix
      : "sessionWindows";
  const requestTimezone = normalizeIdentifier(options?.timezone);

  if (!requestTimezone) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
      path: "timezone",
      message: "timezone is required before session-window normalization",
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

  const operating = Array.isArray(operatingWindows) ? operatingWindows : [];

  if (sessionWindows === undefined || sessionWindows === null) {
    return {
      ok: true,
      diagnostics: sortScheduleDiagnostics(diagnostics),
      windows: [],
    };
  }
  if (!Array.isArray(sessionWindows)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
      path: pathPrefix,
      message: "sessionWindows must be an array when provided",
    });
    return {
      ok: false,
      diagnostics: sortScheduleDiagnostics(diagnostics),
      windows: [],
    };
  }

  /** @type {{ sessionId: string, date: string, startMinutes: number, endMinutes: number, timezone: string, label?: string, metadata?: Readonly<Record<string, unknown>>, path: string }[]} */
  const validated = [];
  /** @type {Map<string, string>} */
  const sessionIdOwners = new Map();

  sessionWindows.forEach((raw, index) => {
    const path = `${pathPrefix}[${index}]`;
    const parsed = parseSessionWindow(raw, path, requestTimezone, push);
    if (!parsed) return;

    const owner = sessionIdOwners.get(parsed.sessionId);
    if (owner != null) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_SESSION_ID,
        path: `${path}.sessionId`,
        message: `duplicate sessionId: ${parsed.sessionId}`,
        details: { sessionId: parsed.sessionId, leftPath: owner, rightPath: path },
      });
    } else {
      sessionIdOwners.set(parsed.sessionId, path);
    }

    const containment = validateSessionContainment(parsed, operating);
    if (!containment.ok) {
      push({
        code: containment.code,
        path,
        message: containment.message,
        details: containment.details,
      });
    }

    validated.push({ ...parsed, path });
  });

  // Duplicate equivalent intervals (independent of sessionId).
  /** @type {Map<string, string>} */
  const intervalOwners = new Map();
  for (const row of stableSortByKeys(validated, (w) => [
    w.date,
    w.startMinutes,
    w.endMinutes,
    w.sessionId,
    w.path,
  ])) {
    const key = `${row.date}\0${row.startMinutes}\0${row.endMinutes}\0${row.timezone}`;
    const owner = intervalOwners.get(key);
    if (owner != null) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_SESSION_WINDOW,
        path: row.path,
        message: `duplicate equivalent session window of ${owner}`,
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

  // Overlaps on same civil date.
  const overlapOrdered = stableSortByKeys(validated, (w) => [
    w.date,
    w.startMinutes,
    w.endMinutes,
    w.sessionId,
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
          message: `session window overlaps ${a.path} on ${a.date}`,
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
    w.sessionId,
  ]);

  /** @type {NormalizedSessionWindow[]} */
  const normalized = ordered.map((w, sequence) => {
    /** @type {NormalizedSessionWindow} */
    const out = {
      sessionId: w.sessionId,
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
 * Pure containment check for one session against operating windows.
 *
 * @param {{ date: string, startMinutes: number, endMinutes: number }} session
 * @param {Array<{ date: string, startMinutes: number, endMinutes: number }>} operatingWindows
 * @returns {{ ok: true } | { ok: false, code: string, message: string, details: Record<string, unknown> }}
 */
export function validateSessionContainment(session, operatingWindows) {
  const operating = Array.isArray(operatingWindows) ? operatingWindows : [];
  const sameDate = operating.filter((ow) => ow.date === session.date);

  if (sameDate.length === 0) {
    return {
      ok: false,
      code: SCHEDULE_DIAGNOSTIC_CODE.SESSION_OUTSIDE_OPERATING_WINDOW,
      message: `session date ${session.date} has no operating window`,
      details: {
        date: session.date,
        startMinutes: session.startMinutes,
        endMinutes: session.endMinutes,
        reason: "NO_OPERATING_WINDOW_ON_DATE",
      },
    };
  }

  const containers = sameDate.filter((ow) => isCivilWindowContained(session, ow));
  if (containers.length >= 1) {
    return { ok: true };
  }

  const intersecting = sameDate.filter((ow) => civilWindowsOverlap(session, ow));
  if (intersecting.length >= 2) {
    return {
      ok: false,
      code: SCHEDULE_DIAGNOSTIC_CODE.SESSION_SPANS_INCOMPATIBLE_WINDOWS,
      message:
        "session crosses more than one operating window and is not fully contained in a single window",
      details: {
        date: session.date,
        startMinutes: session.startMinutes,
        endMinutes: session.endMinutes,
        intersectingCount: intersecting.length,
        reason: "SPANS_MULTIPLE_OPERATING_WINDOWS",
      },
    };
  }

  // Adjacent bridge: session covers a gap between two OWs without overlapping both
  // (e.g. OW [480,600)+[600,720), session [540,660) overlaps both — caught above).
  // Also catch session that starts in one and ends past into another when they are
  // abutting: overlap count >= 2 already covers that.
  // Partially / entirely outside a single candidate:
  if (intersecting.length === 1) {
    return {
      ok: false,
      code: SCHEDULE_DIAGNOSTIC_CODE.SESSION_OUTSIDE_OPERATING_WINDOW,
      message: "session is only partially inside an operating window",
      details: {
        date: session.date,
        startMinutes: session.startMinutes,
        endMinutes: session.endMinutes,
        operatingStartMinutes: intersecting[0].startMinutes,
        operatingEndMinutes: intersecting[0].endMinutes,
        reason: "PARTIAL_OUTSIDE_OPERATING_WINDOW",
      },
    };
  }

  return {
    ok: false,
    code: SCHEDULE_DIAGNOSTIC_CODE.SESSION_OUTSIDE_OPERATING_WINDOW,
    message: "session lies entirely outside all operating windows on its date",
    details: {
      date: session.date,
      startMinutes: session.startMinutes,
      endMinutes: session.endMinutes,
      reason: "ENTIRELY_OUTSIDE_OPERATING_WINDOW",
    },
  };
}

/**
 * @param {unknown} raw
 * @param {string} path
 * @param {string} requestTimezone
 * @param {(partial: Partial<import('./scheduleDiagnostics.js').ScheduleDiagnostic> & { code: string }) => void} push
 * @returns {{ sessionId: string, date: string, startMinutes: number, endMinutes: number, timezone: string, label?: string, metadata?: Readonly<Record<string, unknown>> }|null}
 */
function parseSessionWindow(raw, path, requestTimezone, push) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
      path,
      message: "session window must be an object",
    });
    return null;
  }

  const w = /** @type {Record<string, unknown>} */ (raw);
  const sessionId = normalizeIdentifier(w.sessionId);
  const date = normalizeIdentifier(w.date);
  let ok = true;

  if (!isValidIdentifier(sessionId)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
      path: `${path}.sessionId`,
      message: "sessionId must be a non-empty trimmed string",
    });
    ok = false;
  }

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
            "Phase 1 overnight policy is REJECT — session must remain inside one civil date (endMinutes > startMinutes)",
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
    const sessionTz = normalizeIdentifier(w.timezone);
    if (!isValidIanaTimezone(sessionTz)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
        path: `${path}.timezone`,
        message: `timezone is not a supported IANA id: ${sessionTz}`,
        details: { timezone: sessionTz },
      });
      ok = false;
    } else if (sessionTz !== requestTimezone) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.TIMEZONE_MISMATCH,
        path: `${path}.timezone`,
        message: `session timezone ${sessionTz} does not match request timezone ${requestTimezone}`,
        details: { sessionTimezone: sessionTz, requestTimezone },
      });
      ok = false;
    } else {
      timezone = sessionTz;
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

  /** @type {{ sessionId: string, date: string, startMinutes: number, endMinutes: number, timezone: string, label?: string, metadata?: Readonly<Record<string, unknown>> }} */
  const out = {
    sessionId,
    date,
    startMinutes: /** @type {number} */ (w.startMinutes),
    endMinutes: /** @type {number} */ (w.endMinutes),
    timezone,
  };
  if (label != null) out.label = label;
  if (metadata) out.metadata = metadata;
  return out;
}
