/**
 * CORE-12 Phase 1D-B1 — exact absolute + civil query window (same-day only).
 */

import {
  assertIanaTimezone,
  absoluteToCivilParts,
  civilDateTimeToUtcMs,
  civilTimeToMinutes,
  CIVIL_TIME_ERROR,
} from "../../../../domain/civilTime.js";
import { requireHalfOpenInterval } from "../deterministic/intervals.js";
import { CourtAssignmentContractError } from "../errors/CourtAssignmentContractError.js";
import { AVAILABILITY_BRIDGE_CODE } from "./availabilityBridgeCodes.js";
import {
  rejectUnknownFields,
  requireStableId,
  requireTimezone,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "windowStart",
  "windowEnd",
  "timezone",
  "civilDate",
  "civilStartTime",
  "civilEndTime",
]);

const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CIVIL_HHMM_RE = /^\d{2}:\d{2}$/;

/**
 * @param {Record<string, unknown>} partial
 * @returns {Record<string, unknown>}
 */
function omitInternalFields(partial) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(partial || {})) {
    if (key.startsWith("_") || key === "derived") continue;
    out[key] = value;
  }
  return out;
}

/**
 * @param {unknown} err
 * @param {string} fallbackCode
 * @param {string} message
 * @param {object} details
 */
function rethrowCivil(err, fallbackCode, message, details) {
  const code =
    err && typeof err === "object" && "code" in err
      ? /** @type {{ code?: string }} */ (err).code
      : null;
  if (
    code === CIVIL_TIME_ERROR.TIMEZONE_REQUIRED ||
    code === "TIMEZONE_REQUIRED"
  ) {
    throw new CourtAssignmentContractError(
      AVAILABILITY_BRIDGE_CODE.INVALID_TIMEZONE,
      message || (err instanceof Error ? err.message : "Invalid timezone"),
      details
    );
  }
  if (
    code === CIVIL_TIME_ERROR.AMBIGUOUS_LOCAL_TIME ||
    code === CIVIL_TIME_ERROR.INVALID_TIME ||
    code === CIVIL_TIME_ERROR.INVALID_DATE ||
    code === CIVIL_TIME_ERROR.INVALID_TIME_WINDOW
  ) {
    throw new CourtAssignmentContractError(
      AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW,
      message || (err instanceof Error ? err.message : "Invalid civil window"),
      { ...details, civilCode: code }
    );
  }
  throw new CourtAssignmentContractError(
    fallbackCode,
    message || (err instanceof Error ? err.message : "Query window error"),
    details
  );
}

/**
 * Normalize and validate an exact same-day availability query window.
 * @param {object} [partial]
 */
export function createExactAvailabilityQueryWindow(partial = {}) {
  const cleaned = omitInternalFields(
    /** @type {Record<string, unknown>} */ (partial)
  );
  rejectUnknownFields(
    cleaned,
    ALLOWED,
    "ExactAvailabilityQueryWindow",
    AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW
  );

  let timezone;
  try {
    timezone = requireTimezone(
      cleaned.timezone,
      "ExactAvailabilityQueryWindow.timezone"
    );
    assertIanaTimezone(timezone);
  } catch (err) {
    if (err instanceof CourtAssignmentContractError) {
      throw new CourtAssignmentContractError(
        AVAILABILITY_BRIDGE_CODE.INVALID_TIMEZONE,
        err.message,
        err.details
      );
    }
    rethrowCivil(
      err,
      AVAILABILITY_BRIDGE_CODE.INVALID_TIMEZONE,
      "ExactAvailabilityQueryWindow.timezone is not a valid IANA timezone",
      { timezone: cleaned.timezone ?? null }
    );
  }

  let interval;
  try {
    interval = requireHalfOpenInterval(
      cleaned.windowStart,
      cleaned.windowEnd,
      "ExactAvailabilityQueryWindow"
    );
  } catch (err) {
    if (err instanceof CourtAssignmentContractError) {
      throw new CourtAssignmentContractError(
        AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW,
        err.message,
        err.details
      );
    }
    throw err;
  }

  const civilDate = requireStableId(
    cleaned.civilDate,
    "ExactAvailabilityQueryWindow.civilDate",
    AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW
  );
  const civilStartTime = requireStableId(
    cleaned.civilStartTime,
    "ExactAvailabilityQueryWindow.civilStartTime",
    AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW
  );
  const civilEndTime = requireStableId(
    cleaned.civilEndTime,
    "ExactAvailabilityQueryWindow.civilEndTime",
    AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW
  );

  if (!CIVIL_DATE_RE.test(civilDate)) {
    throw new CourtAssignmentContractError(
      AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW,
      "ExactAvailabilityQueryWindow.civilDate must be YYYY-MM-DD",
      { civilDate }
    );
  }
  if (!CIVIL_HHMM_RE.test(civilStartTime) || !CIVIL_HHMM_RE.test(civilEndTime)) {
    throw new CourtAssignmentContractError(
      AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW,
      "ExactAvailabilityQueryWindow civil times must be HH:mm",
      { civilStartTime, civilEndTime }
    );
  }
  if (!(civilStartTime < civilEndTime)) {
    throw new CourtAssignmentContractError(
      AVAILABILITY_BRIDGE_CODE.UNSUPPORTED_OVERNIGHT_WINDOW,
      "ExactAvailabilityQueryWindow does not support overnight or zero-length civil windows",
      { civilStartTime, civilEndTime }
    );
  }

  let startParts;
  let endParts;
  try {
    startParts = absoluteToCivilParts(interval.start, timezone);
    endParts = absoluteToCivilParts(interval.end, timezone);
  } catch (err) {
    rethrowCivil(
      err,
      AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW,
      "Failed absolute→civil conversion for query window",
      { timezone }
    );
  }

  if (startParts.date !== endParts.date) {
    throw new CourtAssignmentContractError(
      AVAILABILITY_BRIDGE_CODE.UNSUPPORTED_OVERNIGHT_WINDOW,
      "ExactAvailabilityQueryWindow absolute range crosses civil midnight",
      {
        startCivilDate: startParts.date,
        endCivilDate: endParts.date,
      }
    );
  }
  if (
    startParts.date !== civilDate ||
    startParts.time !== civilStartTime ||
    endParts.time !== civilEndTime ||
    endParts.date !== civilDate
  ) {
    throw new CourtAssignmentContractError(
      AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW,
      "Civil fields must represent the same absolute windowStart/windowEnd range",
      {
        civilDate,
        civilStartTime,
        civilEndTime,
        absoluteStartCivil: startParts,
        absoluteEndCivil: endParts,
      }
    );
  }

  let startMs;
  let endMs;
  try {
    startMs = civilDateTimeToUtcMs(
      civilDate,
      civilTimeToMinutes(civilStartTime),
      timezone
    );
    endMs = civilDateTimeToUtcMs(
      civilDate,
      civilTimeToMinutes(civilEndTime),
      timezone
    );
  } catch (err) {
    rethrowCivil(
      err,
      AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW,
      "Civil→absolute conversion failed (DST gap/ambiguous or invalid civil time)",
      { civilDate, civilStartTime, civilEndTime, timezone }
    );
  }

  if (startMs !== interval.startMs || endMs !== interval.endMs) {
    throw new CourtAssignmentContractError(
      AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW,
      "Civil date/times do not round-trip to the supplied absolute window",
      {
        expectedStartMs: interval.startMs,
        expectedEndMs: interval.endMs,
        civilStartMs: startMs,
        civilEndMs: endMs,
      }
    );
  }

  return Object.freeze({
    windowStart: interval.start,
    windowEnd: interval.end,
    timezone,
    civilDate,
    civilStartTime,
    civilEndTime,
    _startMs: interval.startMs,
    _endMs: interval.endMs,
  });
}
