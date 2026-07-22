/**
 * CORE-11 — structured diagnostic codes and ScheduleDiagnostic factory.
 * Codes are stable; free-text messages are diagnostic only.
 */

import {
  SCHEDULE_DIAGNOSTIC_SEVERITY,
  isScheduleDiagnosticSeverity,
} from "./scheduleConstants.js";
import { asciiCompare, copyPlainObject, normalizeIdentifier } from "./scheduleTypes.js";

/**
 * Stable diagnostic codes (Phase 1B declares deferred-check codes without
 * implementing their detection where noted).
 */
export const SCHEDULE_DIAGNOSTIC_CODE = Object.freeze({
  INVALID_SCHEDULE_REQUEST: "INVALID_SCHEDULE_REQUEST",
  INVALID_SCHEDULE_PLAN: "INVALID_SCHEDULE_PLAN",
  INVALID_IDENTIFIER: "INVALID_IDENTIFIER",
  DUPLICATE_MATCH_ID: "DUPLICATE_MATCH_ID",
  DUPLICATE_SESSION_ID: "DUPLICATE_SESSION_ID",
  INVALID_TIMEZONE: "INVALID_TIMEZONE",
  /** Window timezone differs from ScheduleRequest timezone. */
  TIMEZONE_MISMATCH: "TIMEZONE_MISMATCH",
  INVALID_DATE: "INVALID_DATE",
  INVALID_TIME_WINDOW: "INVALID_TIME_WINDOW",
  OVERLAPPING_TIME_WINDOW: "OVERLAPPING_TIME_WINDOW",
  OVERNIGHT_WINDOW_NOT_SUPPORTED: "OVERNIGHT_WINDOW_NOT_SUPPORTED",
  /** Equivalent operating windows in the same scope. */
  DUPLICATE_OPERATING_WINDOW: "DUPLICATE_OPERATING_WINDOW",
  /** Equivalent session windows (same civil interval) in the same scope. */
  DUPLICATE_SESSION_WINDOW: "DUPLICATE_SESSION_WINDOW",
  /** Session not fully contained in any single operating window. */
  SESSION_OUTSIDE_OPERATING_WINDOW: "SESSION_OUTSIDE_OPERATING_WINDOW",
  /** Session intersects / bridges more than one operating window. */
  SESSION_SPANS_INCOMPATIBLE_WINDOWS: "SESSION_SPANS_INCOMPATIBLE_WINDOWS",
  /** Unmapped or generic civil→absolute conversion failure. */
  ABSOLUTE_CONVERSION_FAILURE: "ABSOLUTE_CONVERSION_FAILURE",
  /**
   * Emitted only when civilTime.js throws CIVIL_TIME_ERROR.AMBIGUOUS_LOCAL_TIME
   * (today: nonexistent spring-forward local times). Fall-back ambiguous local
   * times that civilTime.js resolves to an instant do NOT produce this code —
   * CORE-11 does not independently detect or reject fall-back ambiguity.
   */
  AMBIGUOUS_CIVIL_TIME: "AMBIGUOUS_CIVIL_TIME",
  MATCH_DURATION_INVALID: "MATCH_DURATION_INVALID",
  BUFFER_DURATION_INVALID: "BUFFER_DURATION_INVALID",
  REST_POLICY_INVALID: "REST_POLICY_INVALID",
  CAPACITY_POLICY_INVALID: "CAPACITY_POLICY_INVALID",
  /** Existence of unknown sourceMatchId when full match set is available. */
  UNKNOWN_MATCH_DEPENDENCY: "UNKNOWN_MATCH_DEPENDENCY",
  /** Match depends on itself. */
  SELF_MATCH_DEPENDENCY: "SELF_MATCH_DEPENDENCY",
  /** Duplicate (sourceMatchId, type) edge on the same match. */
  DUPLICATE_MATCH_DEPENDENCY: "DUPLICATE_MATCH_DEPENDENCY",
  /** Cycle in the dependency graph. */
  CYCLIC_MATCH_DEPENDENCY: "CYCLIC_MATCH_DEPENDENCY",
  /** Required predecessors are not yet ready for scheduling decisions. */
  DEPENDENCY_NOT_READY: "DEPENDENCY_NOT_READY",
  /** Required predecessor end timing is unavailable for earliest-start bound. */
  DEPENDENCY_TIMING_UNAVAILABLE: "DEPENDENCY_TIMING_UNAVAILABLE",
  /** Topological / ordering invariant failure (deferred placement phases). */
  DEPENDENCY_ORDER_VIOLATION: "DEPENDENCY_ORDER_VIOLATION",
  /** Deferred. */
  PARTICIPANT_OVERLAP: "PARTICIPANT_OVERLAP",
  /** Deferred. */
  TEAM_OVERLAP: "TEAM_OVERLAP",
  /** Deferred (hard min-rest enforcement at schedule time). */
  INSUFFICIENT_REST: "INSUFFICIENT_REST",
  /** Deferred. */
  CAPACITY_EXCEEDED: "CAPACITY_EXCEEDED",
  /** Deferred. */
  MATCH_OUTSIDE_ALLOWED_WINDOW: "MATCH_OUTSIDE_ALLOWED_WINDOW",
  /** Deferred. */
  UNSCHEDULABLE_MATCH: "UNSCHEDULABLE_MATCH",
  /** Deferred. */
  SCHEDULE_INCOMPLETE: "SCHEDULE_INCOMPLETE",
  NON_DETERMINISTIC_RESULT: "NON_DETERMINISTIC_RESULT",
  OPTIMIZER_RESULT_INVALID: "OPTIMIZER_RESULT_INVALID",
  COURT_ASSIGNMENT_BOUNDARY_VIOLATION: "COURT_ASSIGNMENT_BOUNDARY_VIOLATION",
  REFEREE_ASSIGNMENT_BOUNDARY_VIOLATION: "REFEREE_ASSIGNMENT_BOUNDARY_VIOLATION",
  BYE_NO_SCHEDULE_REQUIRED: "BYE_NO_SCHEDULE_REQUIRED",
});

/** @type {ReadonlySet<string>} */
export const SCHEDULE_DIAGNOSTIC_CODE_VALUES = new Set(
  Object.values(SCHEDULE_DIAGNOSTIC_CODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isScheduleDiagnosticCode(value) {
  return (
    typeof value === "string" && SCHEDULE_DIAGNOSTIC_CODE_VALUES.has(value)
  );
}

/**
 * @typedef {Object} ScheduleDiagnostic
 * @property {string} code
 * @property {string} severity
 * @property {string} path
 * @property {string} message
 * @property {string[]} relatedMatchIds
 * @property {Readonly<Record<string, unknown>>} details
 */

/**
 * @param {Partial<ScheduleDiagnostic> & { code?: string }} partial
 * @returns {ScheduleDiagnostic}
 */
export function createScheduleDiagnostic(partial) {
  if (partial == null || typeof partial !== "object") {
    return {
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
      severity: SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR,
      path: "",
      message: "ScheduleDiagnostic partial must be an object",
      relatedMatchIds: [],
      details: Object.freeze({}),
    };
  }

  // Preserve unknown codes as-is so plan validation can fail closed.
  // Only fall back when code is missing/blank.
  const rawCode = typeof partial.code === "string" ? partial.code.trim() : "";
  const code = rawCode
    ? rawCode
    : SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST;

  let severity = SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR;
  if (partial.severity !== undefined && partial.severity !== null) {
    severity = isScheduleDiagnosticSeverity(partial.severity)
      ? partial.severity
      : SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR;
  }

  const relatedRaw = Array.isArray(partial.relatedMatchIds)
    ? partial.relatedMatchIds
    : [];
  const relatedMatchIds = [
    ...new Set(
      relatedRaw
        .map((id) => normalizeIdentifier(id))
        .filter((id) => id.length > 0)
    ),
  ].sort(asciiCompare);

  return {
    code,
    severity,
    path: String(partial.path ?? ""),
    message: String(partial.message || code),
    relatedMatchIds,
    details: Object.freeze(copyPlainObject(partial.details || {})),
  };
}

/**
 * Deterministic diagnostic ordering:
 * code ASC → path ASC → message ASC → relatedMatchIds joined ASC → details JSON ASC.
 * Uses ASCII/code-point compare — never localeCompare.
 *
 * @param {ScheduleDiagnostic[]} diagnostics
 * @returns {ScheduleDiagnostic[]}
 */
export function sortScheduleDiagnostics(diagnostics) {
  return [...(diagnostics || [])].sort((a, b) => {
    let c = asciiCompare(a.code, b.code);
    if (c !== 0) return c;
    c = asciiCompare(a.path, b.path);
    if (c !== 0) return c;
    c = asciiCompare(a.message, b.message);
    if (c !== 0) return c;
    c = asciiCompare(
      (a.relatedMatchIds || []).join("\0"),
      (b.relatedMatchIds || []).join("\0")
    );
    if (c !== 0) return c;
    return asciiCompare(
      JSON.stringify(a.details || {}),
      JSON.stringify(b.details || {})
    );
  });
}

/**
 * @param {string} fieldKey
 * @returns {string}
 */
export function assignmentBoundaryCodeForField(fieldKey) {
  if (
    fieldKey === "refereeId" ||
    fieldKey === "assignedReferee"
  ) {
    return SCHEDULE_DIAGNOSTIC_CODE.REFEREE_ASSIGNMENT_BOUNDARY_VIOLATION;
  }
  return SCHEDULE_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_BOUNDARY_VIOLATION;
}
