/**
 * CORE-12 — ScheduledMatchInput (capability-local DTO; not final CORE-11 contract).
 */

import { COURT_ASSIGNMENT_REJECTION_CODE } from "../enums/conflictCodes.js";
import { CourtAssignmentContractError } from "../errors/CourtAssignmentContractError.js";
import { requireHalfOpenInterval } from "../deterministic/intervals.js";
import {
  cloneFreezeObject,
  rejectUnknownFields,
  requireBoolean,
  requireFiniteNumber,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "matchId",
  "competitionId",
  "tenantId",
  "clubId",
  "venueId",
  "scheduledStart",
  "scheduledEnd",
  "civilWindow",
  "timezone",
  "durationMinutes",
  "status",
  "priority",
  "stage",
  "requiredCapabilities",
  "existingCourtId",
  "manualCourtLock",
  "isBye",
  "metadata",
]);

/**
 * @param {unknown} caps
 * @param {string} path
 * @returns {ReadonlyArray<string>|Readonly<Record<string, unknown>>|null}
 */
function normalizeCapabilities(caps, path) {
  if (caps == null) return null;
  if (Array.isArray(caps)) {
    const out = [];
    for (let i = 0; i < caps.length; i += 1) {
      const c = caps[i];
      if (typeof c !== "string" || c.trim() === "") {
        throw new CourtAssignmentContractError(
          COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST,
          `${path}[${i}] must be a non-empty string`,
          { path, index: i }
        );
      }
      out.push(c.trim());
    }
    return Object.freeze(out);
  }
  if (typeof caps === "object") {
    return cloneFreezeObject(caps, path);
  }
  throw new CourtAssignmentContractError(
    COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST,
    `${path} must be a string array or plain object`,
    { path }
  );
}

/**
 * @param {unknown} civil
 * @param {string} path
 * @returns {Readonly<{ date: string, startTime: string, endTime: string }>|null}
 */
function normalizeCivilWindow(civil, path) {
  if (civil == null) return null;
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (civil),
    ["date", "startTime", "endTime"],
    path
  );
  const date = requireStableId(
    /** @type {{ date?: unknown }} */ (civil).date,
    `${path}.date`
  );
  const startTime = requireStableId(
    /** @type {{ startTime?: unknown }} */ (civil).startTime,
    `${path}.startTime`
  );
  const endTime = requireStableId(
    /** @type {{ endTime?: unknown }} */ (civil).endTime,
    `${path}.endTime`
  );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_CIVIL_WINDOW,
      `${path}.date must be YYYY-MM-DD`,
      { path, date }
    );
  }
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_CIVIL_WINDOW,
      `${path} times must be HH:mm`,
      { path, startTime, endTime }
    );
  }
  if (!(startTime < endTime)) {
    // Current Competition Availability Adapter does not support overnight civil windows.
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_CIVIL_WINDOW,
      `${path} civil window is not representable (overnight / reversed / zero-length unsupported)`,
      { path, startTime, endTime }
    );
  }
  return Object.freeze({ date, startTime, endTime });
}

/**
 * @param {object} [partial]
 * @param {{ allowUnscheduled?: boolean }} [opts]
 */
export function createScheduledMatchInput(partial = {}, opts = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "ScheduledMatchInput"
  );

  const matchId = requireStableId(partial.matchId, "ScheduledMatchInput.matchId");
  const competitionId = requireStableId(
    partial.competitionId,
    "ScheduledMatchInput.competitionId"
  );

  const allowUnscheduled = opts.allowUnscheduled === true;
  let scheduledStart = null;
  let scheduledEnd = null;
  let startMs = null;
  let endMs = null;

  if (partial.scheduledStart != null || partial.scheduledEnd != null) {
    const interval = requireHalfOpenInterval(
      partial.scheduledStart,
      partial.scheduledEnd,
      "ScheduledMatchInput"
    );
    scheduledStart = interval.start;
    scheduledEnd = interval.end;
    startMs = interval.startMs;
    endMs = interval.endMs;
  } else if (!allowUnscheduled) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW,
      "ScheduledMatchInput requires scheduledStart and scheduledEnd",
      { matchId }
    );
  }

  if (partial.durationMinutes != null) {
    const durationMinutes = requireFiniteNumber(
      partial.durationMinutes,
      "ScheduledMatchInput.durationMinutes"
    );
    if (startMs != null && endMs != null) {
      const expected = (endMs - startMs) / 60000;
      if (Math.abs(expected - durationMinutes) > 0.0001) {
        throw new CourtAssignmentContractError(
          COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW,
          "ScheduledMatchInput.durationMinutes does not match scheduled window",
          { matchId, durationMinutes, expected }
        );
      }
    }
  }

  return Object.freeze({
    matchId,
    competitionId,
    tenantId:
      partial.tenantId == null
        ? null
        : requireStableId(partial.tenantId, "ScheduledMatchInput.tenantId"),
    clubId:
      partial.clubId == null
        ? null
        : requireStableId(partial.clubId, "ScheduledMatchInput.clubId"),
    venueId:
      partial.venueId == null
        ? null
        : requireStableId(partial.venueId, "ScheduledMatchInput.venueId"),
    scheduledStart,
    scheduledEnd,
    civilWindow: normalizeCivilWindow(
      partial.civilWindow,
      "ScheduledMatchInput.civilWindow"
    ),
    timezone:
      partial.timezone == null
        ? null
        : requireStableId(partial.timezone, "ScheduledMatchInput.timezone"),
    durationMinutes:
      partial.durationMinutes == null
        ? null
        : requireFiniteNumber(
            partial.durationMinutes,
            "ScheduledMatchInput.durationMinutes"
          ),
    status:
      partial.status == null
        ? null
        : requireStableId(partial.status, "ScheduledMatchInput.status"),
    priority: requireFiniteNumber(
      partial.priority,
      "ScheduledMatchInput.priority",
      0
    ),
    stage:
      partial.stage == null
        ? null
        : requireStableId(partial.stage, "ScheduledMatchInput.stage"),
    requiredCapabilities: normalizeCapabilities(
      partial.requiredCapabilities,
      "ScheduledMatchInput.requiredCapabilities"
    ),
    existingCourtId:
      partial.existingCourtId == null
        ? null
        : requireStableId(
            partial.existingCourtId,
            "ScheduledMatchInput.existingCourtId"
          ),
    manualCourtLock: requireBoolean(
      partial.manualCourtLock ?? false,
      "ScheduledMatchInput.manualCourtLock"
    ),
    isBye: requireBoolean(partial.isBye ?? false, "ScheduledMatchInput.isBye"),
    metadata: cloneFreezeObject(
      partial.metadata,
      "ScheduledMatchInput.metadata"
    ),
    _startMs: startMs,
    _endMs: endMs,
  });
}
