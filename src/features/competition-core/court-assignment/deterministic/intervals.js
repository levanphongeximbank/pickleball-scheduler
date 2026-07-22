/**
 * CORE-12 absolute interval helpers.
 *
 * Overlap mode HALF_OPEN: [start, end)
 * overlaps(A, B) ⇔ A.startMs < B.endMs && B.startMs < A.endMs
 * Adjacent A.end === B.start does NOT overlap.
 */

import { COURT_ASSIGNMENT_REJECTION_CODE } from "../enums/conflictCodes.js";
import { CourtAssignmentContractError } from "../errors/CourtAssignmentContractError.js";

/**
 * Absolute ISO-8601 instant with explicit Z or numeric offset.
 * Rejects timezone-less local forms (ambiguous).
 * Rejects invalid calendar dates that Date.parse would silently normalize
 * (e.g. 2026-02-30 → 2026-03-02).
 */
const ABSOLUTE_INSTANT_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Ensure parsed epoch matches the written calendar/clock components in the
 * declared offset (or Z). Prevents silent Date normalization.
 * @param {string} trimmed
 * @param {number} ms
 * @param {string} field
 */
function assertInstantComponentsMatch(trimmed, ms, field) {
  const match = trimmed.match(ABSOLUTE_INSTANT_RE);
  if (!match) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW,
      `${field} failed component parse`,
      { field, value: trimmed }
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const tz = match[7];

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW,
      `${field} has out-of-range calendar or clock components`,
      { field, value: trimmed }
    );
  }

  let offsetMinutes = 0;
  if (tz !== "Z") {
    const sign = tz[0] === "-" ? -1 : 1;
    const oh = Number(tz.slice(1, 3));
    const om = Number(tz.slice(4, 6));
    if (!Number.isFinite(oh) || !Number.isFinite(om) || oh > 23 || om > 59) {
      throw new CourtAssignmentContractError(
        COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW,
        `${field} has an invalid numeric offset`,
        { field, value: trimmed }
      );
    }
    offsetMinutes = sign * (oh * 60 + om);
  }

  // Shift UTC epoch by offset so UTC getters yield the written local components.
  const localAsUtc = new Date(ms + offsetMinutes * 60000);
  if (
    localAsUtc.getUTCFullYear() !== year ||
    localAsUtc.getUTCMonth() + 1 !== month ||
    localAsUtc.getUTCDate() !== day ||
    localAsUtc.getUTCHours() !== hour ||
    localAsUtc.getUTCMinutes() !== minute ||
    localAsUtc.getUTCSeconds() !== second
  ) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW,
      `${field} is not a valid calendar instant (silent Date normalization rejected)`,
      { field, value: trimmed, parsedMs: ms }
    );
  }
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireAbsoluteInstant(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW,
      `${field} must be a non-empty absolute ISO-8601 instant`,
      { field, value: value ?? null }
    );
  }
  const trimmed = value.trim();
  if (!ABSOLUTE_INSTANT_RE.test(trimmed)) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW,
      `${field} must be a normalized absolute instant with Z or offset (no ambiguous local time)`,
      { field, value: trimmed }
    );
  }
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW,
      `${field} is not a finite absolute instant`,
      { field, value: trimmed }
    );
  }
  assertInstantComponentsMatch(trimmed, ms, field);
  return trimmed;
}

/**
 * @param {string} instant
 * @returns {number}
 */
export function instantToEpochMs(instant) {
  const ms = Date.parse(instant);
  if (!Number.isFinite(ms)) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW,
      "Instant is not a finite absolute value",
      { instant }
    );
  }
  return ms;
}

/**
 * Validate half-open interval: start < end (strictly positive duration).
 * @param {string} start
 * @param {string} end
 * @param {string} path
 * @returns {{ start: string, end: string, startMs: number, endMs: number }}
 */
export function requireHalfOpenInterval(start, end, path) {
  const startNorm = requireAbsoluteInstant(start, `${path}.start`);
  const endNorm = requireAbsoluteInstant(end, `${path}.end`);
  const startMs = instantToEpochMs(startNorm);
  const endMs = instantToEpochMs(endNorm);
  if (!(startMs < endMs)) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW,
      `${path} must be a half-open interval with start < end (zero-length and reversed are invalid)`,
      { path, start: startNorm, end: endNorm, startMs, endMs }
    );
  }
  return { start: startNorm, end: endNorm, startMs, endMs };
}

/**
 * HALF_OPEN overlap: [aStart, aEnd) intersects [bStart, bEnd).
 * @param {number} aStartMs
 * @param {number} aEndMs
 * @param {number} bStartMs
 * @param {number} bEndMs
 * @returns {boolean}
 */
export function intervalsOverlapHalfOpen(aStartMs, aEndMs, bStartMs, bEndMs) {
  return aStartMs < bEndMs && bStartMs < aEndMs;
}

/**
 * True when match [mStart, mEnd) is fully covered by availability [aStart, aEnd).
 * @param {number} mStartMs
 * @param {number} mEndMs
 * @param {number} aStartMs
 * @param {number} aEndMs
 * @returns {boolean}
 */
export function intervalFullyCovers(mStartMs, mEndMs, aStartMs, aEndMs) {
  return aStartMs <= mStartMs && mEndMs <= aEndMs;
}
