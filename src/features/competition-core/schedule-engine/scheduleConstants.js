/**
 * CORE-11 Schedule Engine — identity, schema, severity, forbidden fields.
 * Phase 1B: contracts & validation only (no scheduler / graph / adapters).
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
 * Phase 1 overnight policy: REJECT.
 * Every scheduling window must remain inside one civil date.
 */
export const OVERNIGHT_POLICY = Object.freeze({
  PHASE_1: "REJECT",
});

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
