/**
 * CORE-12 — CourtAssignmentDiagnostics / CourtAssignmentResult / snapshot ref.
 */

import {
  CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
  CORE12_ENGINE_VERSION,
} from "../constants/versions.js";
import {
  COURT_ASSIGNMENT_STATUS,
  COURT_ASSIGNMENT_STATUS_VALUES,
} from "../enums/status.js";
import { COURT_ASSIGNMENT_REJECTION_CODE } from "../enums/conflictCodes.js";
import { CourtAssignmentContractError } from "../errors/CourtAssignmentContractError.js";
import {
  cloneFreezeObject,
  rejectUnknownFields,
  requireEnum,
  requireFiniteNumber,
  requireStableId,
} from "./shared.js";
import {
  createAssignedCourtSlot,
  createCourtAssignmentConflict,
  createUnassignedMatch,
} from "./fragments.js";

const SNAPSHOT_ALLOWED = Object.freeze([
  "snapshotId",
  "snapshotVersion",
  "fingerprint",
]);

/**
 * @param {object} [partial]
 */
export function createSnapshotRef(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    SNAPSHOT_ALLOWED,
    "SnapshotRef"
  );
  return Object.freeze({
    snapshotId: requireStableId(partial.snapshotId, "SnapshotRef.snapshotId"),
    snapshotVersion: requireStableId(
      partial.snapshotVersion,
      "SnapshotRef.snapshotVersion"
    ),
    fingerprint: requireStableId(
      partial.fingerprint,
      "SnapshotRef.fingerprint"
    ),
  });
}

const DIAG_ALLOWED = Object.freeze([
  "engineVersion",
  "inputMatchCount",
  "assignableMatchCount",
  "assignedCount",
  "lockedPreservedCount",
  "unassignedCount",
  "courtCount",
  "orderingVersions",
  "notes",
  "wallClockMs",
]);

/**
 * @param {object} [partial]
 */
export function createCourtAssignmentDiagnostics(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    DIAG_ALLOWED,
    "CourtAssignmentDiagnostics"
  );
  const notes = Array.isArray(partial.notes)
    ? partial.notes.map((n) => String(n))
    : [];
  return Object.freeze({
    engineVersion: requireStableId(
      partial.engineVersion ?? CORE12_ENGINE_VERSION,
      "CourtAssignmentDiagnostics.engineVersion"
    ),
    inputMatchCount: requireFiniteNumber(
      partial.inputMatchCount ?? 0,
      "CourtAssignmentDiagnostics.inputMatchCount",
      0
    ),
    assignableMatchCount: requireFiniteNumber(
      partial.assignableMatchCount ?? 0,
      "CourtAssignmentDiagnostics.assignableMatchCount",
      0
    ),
    assignedCount: requireFiniteNumber(
      partial.assignedCount ?? 0,
      "CourtAssignmentDiagnostics.assignedCount",
      0
    ),
    lockedPreservedCount: requireFiniteNumber(
      partial.lockedPreservedCount ?? 0,
      "CourtAssignmentDiagnostics.lockedPreservedCount",
      0
    ),
    unassignedCount: requireFiniteNumber(
      partial.unassignedCount ?? 0,
      "CourtAssignmentDiagnostics.unassignedCount",
      0
    ),
    courtCount: requireFiniteNumber(
      partial.courtCount ?? 0,
      "CourtAssignmentDiagnostics.courtCount",
      0
    ),
    orderingVersions: cloneFreezeObject(
      partial.orderingVersions ?? {},
      "CourtAssignmentDiagnostics.orderingVersions"
    ),
    notes: Object.freeze(notes),
    wallClockMs:
      partial.wallClockMs == null
        ? null
        : requireFiniteNumber(
            partial.wallClockMs,
            "CourtAssignmentDiagnostics.wallClockMs"
          ),
  });
}

const RESULT_ALLOWED = Object.freeze([
  "schemaVersion",
  "status",
  "requestId",
  "tenantId",
  "clubId",
  "venueId",
  "competitionId",
  "assignments",
  "unassigned",
  "conflicts",
  "diagnostics",
  "replayMetadata",
  "resultFingerprint",
  "failure",
  /**
   * Model B (diagnostic partial): when false, assignments[] are provisional
   * diagnostics only and MUST NOT be persisted by callers.
   * true only for SUCCESS and PARTIAL.
   */
  "committable",
]);

/**
 * @param {object} [partial]
 */
export function createCourtAssignmentResult(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    RESULT_ALLOWED,
    "CourtAssignmentResult"
  );

  const assignments = Array.isArray(partial.assignments)
    ? partial.assignments.map((a) => createAssignedCourtSlot(a))
    : [];
  const unassigned = Array.isArray(partial.unassigned)
    ? partial.unassigned.map((u) => createUnassignedMatch(u))
    : [];
  const conflicts = Array.isArray(partial.conflicts)
    ? partial.conflicts.map((c) => createCourtAssignmentConflict(c))
    : [];

  let failure = null;
  if (partial.failure != null) {
    rejectUnknownFields(
      /** @type {Record<string, unknown>} */ (partial.failure),
      ["code", "message", "details"],
      "CourtAssignmentResult.failure"
    );
    failure = Object.freeze({
      code: requireStableId(
        /** @type {{ code?: unknown }} */ (partial.failure).code,
        "CourtAssignmentResult.failure.code"
      ),
      message: String(
        /** @type {{ message?: unknown }} */ (partial.failure).message ??
          /** @type {{ code?: unknown }} */ (partial.failure).code
      ),
      details: cloneFreezeObject(
        /** @type {{ details?: unknown }} */ (partial.failure).details,
        "CourtAssignmentResult.failure.details"
      ),
    });
  }

  const status = requireEnum(
    partial.status,
    COURT_ASSIGNMENT_STATUS_VALUES,
    "CourtAssignmentResult.status"
  );

  let committable = partial.committable;
  if (committable == null) {
    committable =
      status === COURT_ASSIGNMENT_STATUS.SUCCESS ||
      status === COURT_ASSIGNMENT_STATUS.PARTIAL;
  } else if (typeof committable !== "boolean") {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST,
      "CourtAssignmentResult.committable must be a boolean",
      { value: committable }
    );
  }

  // Enforce Model B: only SUCCESS/PARTIAL may be committable.
  if (
    committable === true &&
    status !== COURT_ASSIGNMENT_STATUS.SUCCESS &&
    status !== COURT_ASSIGNMENT_STATUS.PARTIAL
  ) {
    committable = false;
  }

  return Object.freeze({
    schemaVersion: requireStableId(
      partial.schemaVersion ?? CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
      "CourtAssignmentResult.schemaVersion"
    ),
    status,
    requestId: requireStableId(
      partial.requestId,
      "CourtAssignmentResult.requestId"
    ),
    tenantId: requireStableId(
      partial.tenantId,
      "CourtAssignmentResult.tenantId"
    ),
    clubId: requireStableId(partial.clubId, "CourtAssignmentResult.clubId"),
    venueId: requireStableId(partial.venueId, "CourtAssignmentResult.venueId"),
    competitionId: requireStableId(
      partial.competitionId,
      "CourtAssignmentResult.competitionId"
    ),
    assignments: Object.freeze(assignments),
    unassigned: Object.freeze(unassigned),
    conflicts: Object.freeze(conflicts),
    diagnostics: createCourtAssignmentDiagnostics(partial.diagnostics ?? {}),
    replayMetadata:
      partial.replayMetadata == null
        ? null
        : cloneFreezeObject(
            partial.replayMetadata,
            "CourtAssignmentResult.replayMetadata"
          ),
    resultFingerprint: requireStableId(
      partial.resultFingerprint,
      "CourtAssignmentResult.resultFingerprint"
    ),
    failure,
    committable,
  });
}

export { COURT_ASSIGNMENT_STATUS };
