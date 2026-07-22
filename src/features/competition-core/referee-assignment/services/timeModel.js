/**
 * CORE-13 — deterministic schedule instant helpers.
 * Half-open interval model: [startAt, endAt)
 *
 * Parsing uses Date.parse on validated ISO-like strings only.
 * Never uses Date.now or wall-clock generation.
 */

import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";

/**
 * Parse an explicit instant string to epoch milliseconds.
 * Rejects empty, non-string, NaN, and Date objects.
 *
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
export function parseInstantMs(value, field) {
  if (value instanceof Date) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      `${field} must be an instant string, not a Date object`,
      { field }
    );
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SCHEDULE_WINDOW_REQUIRED,
      `${field} must be a non-empty instant string`,
      { field, value: value ?? null }
    );
  }
  const trimmed = value.trim();
  // Fail closed on ambiguous / invalid — Date.parse returns NaN
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      `${field} is not a valid instant`,
      { field, value: trimmed }
    );
  }
  return ms;
}

/**
 * @param {unknown} startAt
 * @param {unknown} endAt
 * @param {string} [label]
 * @returns {{ startAt: string, endAt: string, startMs: number, endMs: number }}
 */
export function requireHalfOpenWindow(startAt, endAt, label = "window") {
  if (
    startAt == null ||
    startAt === "" ||
    endAt == null ||
    endAt === ""
  ) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SCHEDULE_WINDOW_REQUIRED,
      `${label} requires startAt and endAt`,
      { startAt: startAt ?? null, endAt: endAt ?? null }
    );
  }
  const startMs = parseInstantMs(startAt, `${label}.startAt`);
  const endMs = parseInstantMs(endAt, `${label}.endAt`);
  if (!(endMs > startMs)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      `${label}.endAt must be strictly greater than startAt`,
      { startAt, endAt }
    );
  }
  return {
    startAt: String(startAt).trim(),
    endAt: String(endAt).trim(),
    startMs,
    endMs,
  };
}

/**
 * Optional window — returns null if either bound missing (not an error).
 * @param {unknown} startAt
 * @param {unknown} endAt
 * @param {string} [label]
 * @returns {{ startAt: string, endAt: string, startMs: number, endMs: number }|null}
 */
export function tryHalfOpenWindow(startAt, endAt, label = "window") {
  if (
    startAt == null ||
    startAt === "" ||
    endAt == null ||
    endAt === ""
  ) {
    return null;
  }
  return requireHalfOpenWindow(startAt, endAt, label);
}

/**
 * Half-open overlap: [aStart, aEnd) overlaps [bStart, bEnd) iff aStart < bEnd && bStart < aEnd.
 * Touching endpoints (aEnd === bStart) is NOT an overlap.
 *
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
 * True if coverage [cStart,cEnd) fully covers required [rStart,rEnd).
 * @param {number} cStartMs
 * @param {number} cEndMs
 * @param {number} rStartMs
 * @param {number} rEndMs
 * @returns {boolean}
 */
export function windowFullyCovers(cStartMs, cEndMs, rStartMs, rEndMs) {
  return cStartMs <= rStartMs && cEndMs >= rEndMs;
}

/**
 * Duration in whole minutes (floor). Requires end > start.
 * @param {number} startMs
 * @param {number} endMs
 * @returns {number}
 */
export function durationMinutes(startMs, endMs) {
  if (!(endMs > startMs)) return 0;
  return Math.floor((endMs - startMs) / 60000);
}
