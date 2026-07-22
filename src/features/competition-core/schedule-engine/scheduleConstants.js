/**
 * CORE-11 Schedule Engine — identity, schema, severity, forbidden fields.
 * Phase 1B–1F: contracts through hard-constraint certification.
 */

/** Schema version for CORE-11 schedule-engine domain objects. */
export const SCHEDULE_SCHEMA_VERSION = "core11.schedule-engine.v1";

/**
 * Canonical engine identity.
 * Bump version when stable contract / fingerprint material changes.
 */
export const SCHEDULE_ENGINE_IDENTITY = Object.freeze({
  id: "CORE11_SCHEDULE_ENGINE",
  version: "core11-v1",
});

/** @deprecated Prefer SCHEDULE_ENGINE_IDENTITY.id */
export const CORE11_SCHEDULE_ENGINE = SCHEDULE_ENGINE_IDENTITY.id;

/** @deprecated Prefer SCHEDULE_ENGINE_IDENTITY.version */
export const CORE11_ENGINE_VERSION = SCHEDULE_ENGINE_IDENTITY.version;

/**
 * Candidate / certification markers.
 * Phase 1E candidates remain BASELINE_ONLY until Phase 1F certifies.
 * HARD_CONSTRAINTS_* belong to the separate certification result — never
 * rewrite a baseline candidate into a Production schedule.
 */
export const CONSTRAINT_CERTIFICATION = Object.freeze({
  BASELINE_ONLY: "BASELINE_ONLY",
  HARD_CONSTRAINTS_CERTIFIED: "HARD_CONSTRAINTS_CERTIFIED",
  HARD_CONSTRAINTS_REJECTED: "HARD_CONSTRAINTS_REJECTED",
});

/** @type {ReadonlySet<string>} */
export const CONSTRAINT_CERTIFICATION_VALUES = new Set(
  Object.values(CONSTRAINT_CERTIFICATION)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isConstraintCertification(value) {
  return (
    typeof value === "string" && CONSTRAINT_CERTIFICATION_VALUES.has(value)
  );
}

/** Phase 1E / 1F candidate envelope status (not a publish decision). */
export const BASELINE_CANDIDATE_STATUS = "BASELINE_SCHEDULE_CANDIDATE";

/** Phase 1F certification result envelope status. */
export const CONSTRAINT_CERTIFICATION_RESULT_STATUS =
  "CONSTRAINT_CERTIFICATION_RESULT";

/**
 * Participant reference kinds for constraint identity (Phase 1F).
 */
export const PARTICIPANT_REFERENCE_KIND = Object.freeze({
  PLAYER: "PLAYER",
  TEAM: "TEAM",
  ENTRY: "ENTRY",
  PLACEHOLDER: "PLACEHOLDER",
});

/** @type {ReadonlySet<string>} */
export const PARTICIPANT_REFERENCE_KIND_VALUES = new Set(
  Object.values(PARTICIPANT_REFERENCE_KIND)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isParticipantReferenceKind(value) {
  return (
    typeof value === "string" && PARTICIPANT_REFERENCE_KIND_VALUES.has(value)
  );
}

/**
 * Phase 1 overnight policy: REJECT.
 * Every scheduling window must remain inside one civil date.
 */
export const OVERNIGHT_POLICY = Object.freeze({
  PHASE_1: "REJECT",
});

/**
 * Canonical ScheduleDependency.type values (Phase 1D).
 * Unsupported / blank types fail closed during graph construction.
 */
export const SCHEDULE_DEPENDENCY_TYPE = Object.freeze({
  WINNER_OF: "WINNER_OF",
  LOSER_OF: "LOSER_OF",
  PREVIOUS_ROUND: "PREVIOUS_ROUND",
  GROUP_STAGE_COMPLETE: "GROUP_STAGE_COMPLETE",
  QUALIFICATION: "QUALIFICATION",
});

/** @type {ReadonlySet<string>} */
export const SCHEDULE_DEPENDENCY_TYPE_VALUES = new Set(
  Object.values(SCHEDULE_DEPENDENCY_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isScheduleDependencyType(value) {
  return (
    typeof value === "string" && SCHEDULE_DEPENDENCY_TYPE_VALUES.has(value)
  );
}

/**
 * Predecessor state for graph-domain readiness (not match-result ownership).
 */
export const SCHEDULE_PREDECESSOR_STATE = Object.freeze({
  UNRESOLVED: "UNRESOLVED",
  SCHEDULED: "SCHEDULED",
  COMPLETED: "COMPLETED",
  BYE: "BYE",
  INVALID: "INVALID",
});

/** @type {ReadonlySet<string>} */
export const SCHEDULE_PREDECESSOR_STATE_VALUES = new Set(
  Object.values(SCHEDULE_PREDECESSOR_STATE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSchedulePredecessorState(value) {
  return (
    typeof value === "string" && SCHEDULE_PREDECESSOR_STATE_VALUES.has(value)
  );
}

export const SCHEDULE_DIAGNOSTIC_SEVERITY = Object.freeze({
  ERROR: "ERROR",
  WARNING: "WARNING",
  INFO: "INFO",
});

/** @type {ReadonlySet<string>} */
export const SCHEDULE_DIAGNOSTIC_SEVERITY_VALUES = new Set(
  Object.values(SCHEDULE_DIAGNOSTIC_SEVERITY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isScheduleDiagnosticSeverity(value) {
  return (
    typeof value === "string" && SCHEDULE_DIAGNOSTIC_SEVERITY_VALUES.has(value)
  );
}

/**
 * Physical court / referee assignment fields forbidden on canonical CORE-11
 * decision surfaces. Opaque metadata may carry legacy hints but must not drive
 * canonical invariants (validators do not read metadata for decisions).
 *
 * @type {ReadonlySet<string>}
 */
export const FORBIDDEN_CANONICAL_ASSIGNMENT_FIELDS = Object.freeze(
  new Set([
    "courtId",
    "courtName",
    "courtNumber",
    "assignedCourt",
    "refereeId",
    "assignedReferee",
  ])
);

/** Minutes-from-midnight inclusive range for civil schedule times. */
export const MINUTES_FROM_MIDNIGHT_MIN = 0;
export const MINUTES_FROM_MIDNIGHT_MAX = 1439;

/** Civil date pattern YYYY-MM-DD (validated further via calendar probe). */
export const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
