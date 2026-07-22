/**
 * Competition-core integration — public surface.
 *
 * Phase 1H-B: CORE-11 certified schedule → CORE-12 court-assignment handoff.
 * One-way dependency on public schedule-engine and court-assignment barrels.
 * CORE-11 and CORE-12 must not import this layer.
 *
 * Projection builders and other internals stay private to
 * `./scheduleToCourtAssignment.js`. Consumers fingerprint via
 * `fingerprintCourtAssignmentRequest` only.
 */

export {
  SCHEDULE_TO_COURT_ASSIGNMENT_HANDOFF_RESULT_STATUS,
  CERTIFIED_SCHEDULE_COURT_ASSIGNMENT_RESULT_STATUS,
  HANDOFF_DIAGNOSTIC_CODE,
  HANDOFF_DIAGNOSTIC_CODE_VALUES,
  HANDOFF_REQUEST_FINGERPRINT_PROJECTION_VERSION,
  HANDOFF_RESULT_FINGERPRINT_VERIFICATION,
  HANDOFF_AVAILABILITY_SNAPSHOT_TRUST_MODEL,
  fingerprintCourtAssignmentRequest,
  createCourtAssignmentRequestFromCertifiedSchedule,
  assignCourtsFromCertifiedSchedule,
} from "./scheduleToCourtAssignment.js";
