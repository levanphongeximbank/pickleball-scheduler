/**
 * CORE-11 Phase 1E — deterministic abstract time-slot generation (pure).
 *
 * Buffer policy (Phase 1):
 *   slot occupancy = match duration + configured buffer
 * Match end = start + duration (buffer excluded from match end).
 * Capacity release = match end + buffer (occupancy holds the lane until then).
 *
 * No physical court / referee identity. No Date.now / Math.random / localeCompare.
 */

import { SCHEDULE_DIAGNOSTIC_SEVERITY } from "./scheduleConstants.js";
import {
  SCHEDULE_DIAGNOSTIC_CODE,
  createScheduleDiagnostic,
  sortScheduleDiagnostics,
} from "./scheduleDiagnostics.js";
import { convertCivilScheduleTimeToAbsolute } from "./scheduleCivilTime.js";
import {
  isNonNegativeInteger,
  isPositiveInteger,
  isValidCivilDate,
  isValidIanaTimezone,
  isValidIdentifier,
  isValidMinutesFromMidnight,
  normalizeIdentifier,
  stableSortByKeys,
} from "./scheduleTypes.js";

/**
 * @typedef {Object} AbstractScheduleSlot
 * @property {string} slotId
 * @property {string} date
 * @property {string} timezone
 * @property {number} startMinutes
 * @property {number} endMinutes - match end (duration only; exclusive of buffer)
 * @property {number} capacityReleaseMinutes - start + duration + buffer
 * @property {number} startUtcMs
 * @property {number} endUtcMs
 * @property {string} startUtcIso
 * @property {string} endUtcIso
 * @property {number} capacityReleaseUtcMs
 * @property {string} capacityReleaseUtcIso
 * @property {string} [sessionId]
 * @property {number} abstractSlotIndex - same as concurrencyIndex
 * @property {number} concurrencyIndex
 * @property {string} sourceWindowId
 * @property {number} sequence
 * @property {number} durationMinutes
 * @property {number} bufferMinutes
 */

/**
 * @typedef {Object} GenerateAbstractScheduleSlotsResult
 * @property {boolean} ok
 * @property {AbstractScheduleSlot[]} slots
 * @property {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 */

/**
 * Generate deterministic abstract slots from normalized windows/sessions.
 *
 * Session policy:
 * - non-empty sessionWindows → generate only inside sessions (no operating fallback);
 * - empty sessionWindows → generate from operatingWindows.
 *
 * @param {{
 *   operatingWindows?: unknown,
 *   sessionWindows?: unknown,
 *   durationMinutes?: unknown,
 *   bufferMinutes?: unknown,
 *   maxConcurrentMatches?: unknown,
 *   timezone?: unknown,
 * }} [input]
 * @returns {GenerateAbstractScheduleSlotsResult}
 */
export function generateAbstractScheduleSlots(input = {}) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  const durationMinutes = input.durationMinutes;
  const bufferMinutes =
    input.bufferMinutes === undefined || input.bufferMinutes === null
      ? 0
      : input.bufferMinutes;
  const maxConcurrentMatches = input.maxConcurrentMatches;
  const timezone = normalizeIdentifier(input.timezone);

  if (!isPositiveInteger(durationMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID,
      path: "durationMinutes",
      message: "durationMinutes must be a positive integer",
      details: { durationMinutes: durationMinutes ?? null },
    });
  }
  if (!isNonNegativeInteger(bufferMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.BUFFER_DURATION_INVALID,
      path: "bufferMinutes",
      message: "bufferMinutes must be a non-negative integer",
      details: { bufferMinutes },
    });
  }
  if (!isPositiveInteger(maxConcurrentMatches)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_POLICY_INVALID,
      path: "maxConcurrentMatches",
      message: "maxConcurrentMatches must be a positive integer",
      details: { maxConcurrentMatches: maxConcurrentMatches ?? null },
    });
  }
  if (!timezone) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
      path: "timezone",
      message: "timezone is required (explicit IANA; no host-local default)",
    });
  } else if (!isValidIanaTimezone(timezone)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
      path: "timezone",
      message: `timezone is not a supported IANA id: ${timezone}`,
      details: { timezone },
    });
  }

  if (diagnostics.length > 0) {
    return {
      ok: false,
      slots: [],
      diagnostics: sortScheduleDiagnostics(diagnostics),
    };
  }

  const sessions = coerceWindowList(input.sessionWindows);
  const operating = coerceWindowList(input.operatingWindows);
  const useSessions = sessions.length > 0;
  const sources = useSessions ? sessions : operating;

  if (sources.length === 0) {
    return {
      ok: true,
      slots: [],
      diagnostics: sortScheduleDiagnostics(diagnostics),
    };
  }

  /** @type {AbstractScheduleSlot[]} */
  const slots = [];
  let sequence = 0;
  const occupancy =
    /** @type {number} */ (durationMinutes) +
    /** @type {number} */ (bufferMinutes);

  const sortedSources = stableSortByKeys(sources, (w) => [
    w.date,
    w.startMinutes,
    w.endMinutes,
    w.id,
  ]);

  for (const source of sortedSources) {
    const validation = validateSourceWindow(source, timezone, useSessions);
    diagnostics.push(...validation.diagnostics);
    if (!validation.ok || !validation.window) continue;

    const window = validation.window;
    let startMinutes = window.startMinutes;
    while (
      startMinutes + /** @type {number} */ (durationMinutes) <=
      window.endMinutes
    ) {
      const endMinutes =
        startMinutes + /** @type {number} */ (durationMinutes);
      const capacityReleaseMinutes = startMinutes + occupancy;

      const startAbs = convertCivilScheduleTimeToAbsolute(
        {
          date: window.date,
          minutesFromMidnight: startMinutes,
          timezone,
        },
        timezone,
        `slots[${window.id}].start`
      );
      const endAbs = convertCivilScheduleTimeToAbsolute(
        {
          date: window.date,
          minutesFromMidnight: endMinutes,
          timezone,
        },
        timezone,
        `slots[${window.id}].end`
      );
      diagnostics.push(...startAbs.diagnostics, ...endAbs.diagnostics);
      if (!startAbs.ok || !endAbs.ok) {
        break;
      }

      const capacityReleaseUtcMs =
        /** @type {number} */ (endAbs.utcMs) +
        /** @type {number} */ (bufferMinutes) * 60_000;

      for (
        let concurrencyIndex = 0;
        concurrencyIndex < /** @type {number} */ (maxConcurrentMatches);
        concurrencyIndex += 1
      ) {
        const slotId = buildSlotId({
          date: window.date,
          startMinutes,
          endMinutes,
          concurrencyIndex,
          sourceWindowId: window.id,
          timezone,
        });
        /** @type {AbstractScheduleSlot} */
        const slot = {
          slotId,
          date: window.date,
          timezone,
          startMinutes,
          endMinutes,
          capacityReleaseMinutes,
          startUtcMs: /** @type {number} */ (startAbs.utcMs),
          endUtcMs: /** @type {number} */ (endAbs.utcMs),
          startUtcIso: /** @type {string} */ (startAbs.utcIso),
          endUtcIso: /** @type {string} */ (endAbs.utcIso),
          capacityReleaseUtcMs,
          capacityReleaseUtcIso: new Date(capacityReleaseUtcMs).toISOString(),
          abstractSlotIndex: concurrencyIndex,
          concurrencyIndex,
          sourceWindowId: window.id,
          sequence,
          durationMinutes: /** @type {number} */ (durationMinutes),
          bufferMinutes: /** @type {number} */ (bufferMinutes),
        };
        if (window.sessionId) {
          slot.sessionId = window.sessionId;
        }
        slots.push(slot);
        sequence += 1;
      }

      startMinutes += occupancy;
    }
  }

  const sortedDiagnostics = sortScheduleDiagnostics(diagnostics);
  const hasError = sortedDiagnostics.some(
    (d) => d.severity === SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR
  );

  const orderedSlots = stableSortByKeys(slots, (s) => [
    s.date,
    s.startMinutes,
    s.concurrencyIndex,
    s.sourceWindowId,
    s.slotId,
  ]);

  // Re-assign sequence after canonical sort for full determinism.
  orderedSlots.forEach((slot, index) => {
    slot.sequence = index;
  });

  return {
    ok: !hasError,
    slots: orderedSlots,
    diagnostics: sortedDiagnostics,
  };
}

/**
 * @param {{
 *   date: string,
 *   startMinutes: number,
 *   endMinutes: number,
 *   concurrencyIndex: number,
 *   sourceWindowId: string,
 *   timezone: string,
 * }} parts
 * @returns {string}
 */
export function buildSlotId(parts) {
  return [
    "slot",
    parts.date,
    String(parts.startMinutes),
    String(parts.endMinutes),
    String(parts.concurrencyIndex),
    parts.sourceWindowId,
    parts.timezone,
  ].join(":");
}

/**
 * @param {unknown} list
 * @returns {Array<Record<string, unknown>>}
 */
function coerceWindowList(list) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item != null && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const w = /** @type {Record<string, unknown>} */ (item);
      const sessionId = normalizeIdentifier(w.sessionId);
      const windowId = normalizeIdentifier(w.windowId);
      const id =
        sessionId ||
        windowId ||
        `anon:${normalizeIdentifier(w.date)}:${w.startMinutes}:${w.endMinutes}`;
      return {
        ...w,
        id,
        sessionId: sessionId || undefined,
        date: normalizeIdentifier(w.date),
        startMinutes: w.startMinutes,
        endMinutes: w.endMinutes,
      };
    });
}

/**
 * @param {Record<string, unknown>} source
 * @param {string} timezone
 * @param {boolean} isSession
 * @returns {{
 *   ok: boolean,
 *   window: null|{
 *     id: string,
 *     date: string,
 *     startMinutes: number,
 *     endMinutes: number,
 *     sessionId?: string,
 *   },
 *   diagnostics: import('./scheduleDiagnostics.js').ScheduleDiagnostic[],
 * }}
 */
function validateSourceWindow(source, timezone, isSession) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const path = isSession
    ? `sessionWindows[${source.id}]`
    : `operatingWindows[${source.id}]`;

  const date = normalizeIdentifier(source.date);
  const startMinutes = source.startMinutes;
  const endMinutes = source.endMinutes;
  let ok = true;

  if (!isValidCivilDate(date)) {
    diagnostics.push(
      createScheduleDiagnostic({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_DATE,
        path: `${path}.date`,
        message: "date must be a valid civil YYYY-MM-DD",
      })
    );
    ok = false;
  }
  if (!isValidMinutesFromMidnight(startMinutes)) {
    diagnostics.push(
      createScheduleDiagnostic({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
        path: `${path}.startMinutes`,
        message: "startMinutes must be an integer 0..1439",
      })
    );
    ok = false;
  }
  if (!isValidMinutesFromMidnight(endMinutes)) {
    diagnostics.push(
      createScheduleDiagnostic({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
        path: `${path}.endMinutes`,
        message: "endMinutes must be an integer 0..1439",
      })
    );
    ok = false;
  }
  if (
    isValidMinutesFromMidnight(startMinutes) &&
    isValidMinutesFromMidnight(endMinutes) &&
    /** @type {number} */ (endMinutes) <= /** @type {number} */ (startMinutes)
  ) {
    diagnostics.push(
      createScheduleDiagnostic({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
        path,
        message: "endMinutes must be greater than startMinutes (end exclusive)",
      })
    );
    ok = false;
  }

  const id = normalizeIdentifier(source.id);
  if (!isValidIdentifier(id)) {
    diagnostics.push(
      createScheduleDiagnostic({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
        path: `${path}.id`,
        message: "window/session identity is required",
      })
    );
    ok = false;
  }

  if (!ok) {
    return { ok: false, window: null, diagnostics };
  }

  /** @type {{ id: string, date: string, startMinutes: number, endMinutes: number, sessionId?: string }} */
  const window = {
    id,
    date,
    startMinutes: /** @type {number} */ (startMinutes),
    endMinutes: /** @type {number} */ (endMinutes),
  };
  const sessionId = normalizeIdentifier(source.sessionId);
  if (sessionId) window.sessionId = sessionId;

  // Silence unused — windows inherit request TZ validated at caller.
  void timezone;

  return { ok: true, window, diagnostics };
}
