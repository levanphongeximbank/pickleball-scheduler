/**
 * CORE-12 — CourtAssignmentRequest factory.
 */

import { CORE12_COURT_ASSIGNMENT_SCHEMA_V1 } from "../constants/versions.js";
import { COURT_ASSIGNMENT_REJECTION_CODE } from "../enums/conflictCodes.js";
import { CourtAssignmentContractError } from "../errors/CourtAssignmentContractError.js";
import { createAvailableCourtInput } from "./availableCourtInput.js";
import { createCourtAssignmentPolicy } from "./courtAssignmentPolicy.js";
import { createSnapshotRef } from "./courtAssignmentResult.js";
import {
  createCourtConstraint,
  createLockedCourtAssignment,
} from "./fragments.js";
import { createScheduledMatchInput } from "./scheduledMatchInput.js";
import {
  cloneFreezeObject,
  rejectUnknownFields,
  requireStableId,
  requireTimezone,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "requestId",
  "tenantId",
  "clubId",
  "venueId",
  "competitionId",
  "timezone",
  "matches",
  "courts",
  "lockedAssignments",
  "constraints",
  "policy",
  "seed",
  "scheduleSnapshotRef",
  "availabilitySnapshotRef",
  "metadata",
]);

/**
 * @param {object} [partial]
 */
export function createCourtAssignmentRequest(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "CourtAssignmentRequest"
  );

  const schemaVersion = requireStableId(
    partial.schemaVersion,
    "CourtAssignmentRequest.schemaVersion",
    COURT_ASSIGNMENT_REJECTION_CODE.SCHEMA_VERSION_MISMATCH
  );
  if (schemaVersion !== CORE12_COURT_ASSIGNMENT_SCHEMA_V1) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.SCHEMA_VERSION_MISMATCH,
      `Unsupported schemaVersion: ${schemaVersion}`,
      { schemaVersion, expected: CORE12_COURT_ASSIGNMENT_SCHEMA_V1 }
    );
  }

  const policy = createCourtAssignmentPolicy(partial.policy ?? {});

  let timezone = null;
  if (partial.timezone != null) {
    timezone = requireTimezone(
      partial.timezone,
      "CourtAssignmentRequest.timezone"
    );
  } else if (policy.requireVenueTimezone) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.TIMEZONE_REQUIRED,
      "CourtAssignmentRequest.timezone is required by policy.requireVenueTimezone",
      {}
    );
  }

  if (!Array.isArray(partial.matches)) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST,
      "CourtAssignmentRequest.matches must be an array",
      {}
    );
  }
  if (!Array.isArray(partial.courts)) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST,
      "CourtAssignmentRequest.courts must be an array",
      {}
    );
  }

  const matches = Object.freeze(
    partial.matches.map((m) =>
      createScheduledMatchInput(m, {
        allowUnscheduled: policy.allowUnscheduledMatches,
      })
    )
  );
  const courts = Object.freeze(
    partial.courts.map((c) => createAvailableCourtInput(c))
  );

  const lockedAssignments = Object.freeze(
    (Array.isArray(partial.lockedAssignments)
      ? partial.lockedAssignments
      : []
    ).map((l) => createLockedCourtAssignment(l))
  );
  const constraints = Object.freeze(
    (Array.isArray(partial.constraints) ? partial.constraints : []).map((c) =>
      createCourtConstraint(c)
    )
  );

  let availabilitySnapshotRef = null;
  if (partial.availabilitySnapshotRef != null) {
    availabilitySnapshotRef = createSnapshotRef(
      partial.availabilitySnapshotRef
    );
  } else if (policy.requireAvailabilitySnapshot) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.AVAILABILITY_SNAPSHOT_REQUIRED,
      "availabilitySnapshotRef is required by policy.requireAvailabilitySnapshot",
      {}
    );
  }

  let scheduleSnapshotRef = null;
  if (partial.scheduleSnapshotRef != null) {
    scheduleSnapshotRef = createSnapshotRef(partial.scheduleSnapshotRef);
  }

  return Object.freeze({
    schemaVersion,
    requestId: requireStableId(
      partial.requestId,
      "CourtAssignmentRequest.requestId"
    ),
    tenantId: requireStableId(
      partial.tenantId,
      "CourtAssignmentRequest.tenantId"
    ),
    clubId: requireStableId(partial.clubId, "CourtAssignmentRequest.clubId"),
    venueId: requireStableId(
      partial.venueId,
      "CourtAssignmentRequest.venueId"
    ),
    competitionId: requireStableId(
      partial.competitionId,
      "CourtAssignmentRequest.competitionId"
    ),
    timezone,
    matches,
    courts,
    lockedAssignments,
    constraints,
    policy,
    seed: partial.seed == null ? null : String(partial.seed),
    scheduleSnapshotRef,
    availabilitySnapshotRef,
    metadata: cloneFreezeObject(
      partial.metadata,
      "CourtAssignmentRequest.metadata"
    ),
  });
}
