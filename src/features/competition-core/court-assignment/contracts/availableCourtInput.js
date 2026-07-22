/**
 * CORE-12 — AvailableCourtInput (immutable availability snapshot DTO).
 * Absolute availabilityIntervals are used for coverage checks.
 * Empty intervals + AVAILABLE means unrestricted coverage within the snapshot.
 */

import {
  COURT_AVAILABILITY_STATUS,
  COURT_AVAILABILITY_STATUS_VALUES,
} from "../enums/availabilityStatus.js";
import { COURT_ASSIGNMENT_REJECTION_CODE } from "../enums/conflictCodes.js";
import { CourtAssignmentContractError } from "../errors/CourtAssignmentContractError.js";
import { requireHalfOpenInterval } from "../deterministic/intervals.js";
import {
  cloneFreezeObject,
  rejectUnknownFields,
  requireBoolean,
  requireEnum,
  requireFiniteNumber,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "courtId",
  "tenantId",
  "venueId",
  "clubId",
  "availabilityStatus",
  "active",
  "eligible",
  "unavailableReasons",
  "capabilities",
  "priority",
  "availabilityIntervals",
  "availabilityWindows",
  "metadata",
]);

/**
 * @param {unknown} intervals
 * @param {string} path
 */
function normalizeAvailabilityIntervals(intervals, path) {
  if (intervals == null) return Object.freeze([]);
  if (!Array.isArray(intervals)) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW,
      `${path} must be an array`,
      { path }
    );
  }
  const out = [];
  for (let i = 0; i < intervals.length; i += 1) {
    const item = intervals[i];
    rejectUnknownFields(
      /** @type {Record<string, unknown>} */ (item),
      ["start", "end"],
      `${path}[${i}]`
    );
    const interval = requireHalfOpenInterval(
      /** @type {{ start?: unknown }} */ (item).start,
      /** @type {{ end?: unknown }} */ (item).end,
      `${path}[${i}]`
    );
    out.push(
      Object.freeze({
        start: interval.start,
        end: interval.end,
        _startMs: interval.startMs,
        _endMs: interval.endMs,
      })
    );
  }
  return Object.freeze(out);
}

/**
 * @param {unknown} caps
 * @param {string} path
 */
function normalizeCapabilities(caps, path) {
  if (caps == null) return Object.freeze({});
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
  return cloneFreezeObject(caps, path);
}

/**
 * @param {object} [partial]
 */
export function createAvailableCourtInput(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "AvailableCourtInput"
  );

  const unavailableReasons = partial.unavailableReasons;
  let reasons = Object.freeze([]);
  if (unavailableReasons != null) {
    if (!Array.isArray(unavailableReasons)) {
      throw new CourtAssignmentContractError(
        COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST,
        "AvailableCourtInput.unavailableReasons must be an array of strings",
        {}
      );
    }
    reasons = Object.freeze(
      unavailableReasons.map((r, i) => {
        if (typeof r !== "string" || r.trim() === "") {
          throw new CourtAssignmentContractError(
            COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST,
            `AvailableCourtInput.unavailableReasons[${i}] must be a non-empty string`,
            { index: i }
          );
        }
        return r.trim();
      })
    );
  }

  return Object.freeze({
    courtId: requireStableId(partial.courtId, "AvailableCourtInput.courtId"),
    tenantId:
      partial.tenantId == null
        ? null
        : requireStableId(partial.tenantId, "AvailableCourtInput.tenantId"),
    venueId: requireStableId(partial.venueId, "AvailableCourtInput.venueId"),
    clubId: requireStableId(partial.clubId, "AvailableCourtInput.clubId"),
    availabilityStatus: requireEnum(
      partial.availabilityStatus ?? COURT_AVAILABILITY_STATUS.AVAILABLE,
      COURT_AVAILABILITY_STATUS_VALUES,
      "AvailableCourtInput.availabilityStatus"
    ),
    active: requireBoolean(
      partial.active ?? true,
      "AvailableCourtInput.active"
    ),
    eligible: requireBoolean(
      partial.eligible ?? true,
      "AvailableCourtInput.eligible"
    ),
    unavailableReasons: reasons,
    capabilities: normalizeCapabilities(
      partial.capabilities,
      "AvailableCourtInput.capabilities"
    ),
    priority: requireFiniteNumber(
      partial.priority,
      "AvailableCourtInput.priority",
      0
    ),
    availabilityIntervals: normalizeAvailabilityIntervals(
      partial.availabilityIntervals,
      "AvailableCourtInput.availabilityIntervals"
    ),
    availabilityWindows: Object.freeze(
      Array.isArray(partial.availabilityWindows)
        ? partial.availabilityWindows.map((w, i) =>
            cloneFreezeObject(w, `AvailableCourtInput.availabilityWindows[${i}]`)
          )
        : []
    ),
    metadata: cloneFreezeObject(
      partial.metadata,
      "AvailableCourtInput.metadata"
    ),
  });
}
