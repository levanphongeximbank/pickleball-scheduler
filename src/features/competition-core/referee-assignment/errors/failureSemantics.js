/**
 * CORE-13 — default severity mapping for diagnostic codes.
 * Documented semantics (Phase 1B):
 *
 * 1. Missing required port/snapshot → FATAL
 * 2. Valid directory with zero candidates → NOT automatically malformed;
 *    NO_REFEREE_CANDIDATES is MATCH_RECOVERABLE for assignment planning
 * 3. Missing entire schedule snapshot → FATAL (SNAPSHOT_MISSING / SCHEDULE_WINDOW_REQUIRED)
 * 4. Individual match missing startAt/endAt → MATCH_RECOVERABLE + unassigned requirement
 * 5. Manual rejection envelope → MANUAL_ASSIGNMENT_REJECTED + causedBy/reasonCodes
 * 6. Hard constraints never overridable by manual assignment
 * 7. Soft preferences overridable only when request explicitly permits soft override
 */

import { REFEREE_DIAGNOSTIC_SEVERITY } from "../enums/diagnosticSeverity.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "./diagnosticCodes.js";

const C = REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE;
const S = REFEREE_DIAGNOSTIC_SEVERITY;

/**
 * Default severity by code. Callers may specialize MATCH_RECOVERABLE vs FATAL
 * for context (e.g. manual path treats REFEREE_INACTIVE as reject envelope).
 */
export const REFEREE_DIAGNOSTIC_DEFAULT_SEVERITY = Object.freeze({
  [C.INVALID_ASSIGNMENT_REQUEST]: S.FATAL,
  [C.TENANT_SCOPE_REQUIRED]: S.FATAL,
  [C.TOURNAMENT_SCOPE_REQUIRED]: S.FATAL,
  [C.MATCH_SCOPE_REQUIRED]: S.FATAL,
  [C.SCHEDULE_WINDOW_REQUIRED]: S.MATCH_RECOVERABLE,
  [C.NO_REFEREE_CANDIDATES]: S.MATCH_RECOVERABLE,
  [C.NO_ELIGIBLE_REFEREE]: S.MATCH_RECOVERABLE,
  [C.REFEREE_NOT_FOUND]: S.MATCH_RECOVERABLE,
  [C.REFEREE_INACTIVE]: S.MATCH_RECOVERABLE,
  [C.REFEREE_NOT_QUALIFIED]: S.MATCH_RECOVERABLE,
  [C.REFEREE_UNAVAILABLE]: S.MATCH_RECOVERABLE,
  [C.REFEREE_ALREADY_ASSIGNED]: S.MATCH_RECOVERABLE,
  [C.REFEREE_CONFLICT_OF_INTEREST]: S.MATCH_RECOVERABLE,
  [C.REFEREE_ROLE_UNSUPPORTED]: S.MATCH_RECOVERABLE,
  [C.MANUAL_ASSIGNMENT_REJECTED]: S.FATAL,
  [C.REQUIRED_REFEREE_ROLE_UNFILLED]: S.MATCH_RECOVERABLE,
  [C.ASSIGNMENT_CAPACITY_EXHAUSTED]: S.MATCH_RECOVERABLE,
  [C.NON_DETERMINISTIC_INPUT]: S.FATAL,
  [C.INVALID_REPLACEMENT_REQUEST]: S.FATAL,
  [C.REPLACEMENT_REFEREE_REJECTED]: S.FATAL,
  [C.SNAPSHOT_MISSING]: S.FATAL,
  [C.SNAPSHOT_INVALID]: S.FATAL,
});

/**
 * @param {string} code
 * @returns {string}
 */
export function resolveDefaultDiagnosticSeverity(code) {
  return (
    REFEREE_DIAGNOSTIC_DEFAULT_SEVERITY[code] ||
    REFEREE_DIAGNOSTIC_SEVERITY.FATAL
  );
}
