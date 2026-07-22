import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import {
  REFEREE_ASSIGNMENT_SOURCE,
  REFEREE_ASSIGNMENT_SOURCE_VALUES,
} from "../enums/assignmentSource.js";
import {
  REFEREE_ASSIGNMENT_STATUS,
  REFEREE_ASSIGNMENT_STATUS_VALUES,
} from "../enums/assignmentStatus.js";
import { REFEREE_ROLE_CODE, normalizeRefereeRoleCode } from "../enums/roleCodes.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import { normalizeStableIdArray } from "../deterministic/normalize.js";
import {
  normalizeMetadata,
  ownedFreeze,
  rejectUnknownFields,
  requireEnum,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "assignmentId",
  "matchId",
  "refereeId",
  "roleCode",
  "status",
  "source",
  "constraintsSatisfied",
  "metadata",
]);

/**
 * Single role fill for a match.
 * @param {object} [partial]
 */
export function createRefereeAssignment(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeAssignment"
  );

  const roleCode = normalizeRefereeRoleCode(partial.roleCode);
  if (!roleCode || roleCode === REFEREE_ROLE_CODE.ANY) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      "RefereeAssignment.roleCode must be a concrete role (ANY is not assignable)",
      { field: "roleCode", roleCode: roleCode || null }
    );
  }

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    assignmentId: requireStableId(
      partial.assignmentId,
      "RefereeAssignment.assignmentId"
    ),
    matchId: requireStableId(
      partial.matchId,
      "RefereeAssignment.matchId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED
    ),
    refereeId: requireStableId(
      partial.refereeId,
      "RefereeAssignment.refereeId"
    ),
    roleCode,
    status: requireEnum(
      partial.status ?? REFEREE_ASSIGNMENT_STATUS.PLANNED,
      "RefereeAssignment.status",
      REFEREE_ASSIGNMENT_STATUS_VALUES
    ),
    source: requireEnum(
      partial.source ?? REFEREE_ASSIGNMENT_SOURCE.AUTO,
      "RefereeAssignment.source",
      REFEREE_ASSIGNMENT_SOURCE_VALUES
    ),
    constraintsSatisfied: Object.freeze(
      normalizeStableIdArray(partial.constraintsSatisfied, {
        field: "constraintsSatisfied",
        sort: true,
        unique: true,
      })
    ),
    metadata: normalizeMetadata(partial.metadata, "RefereeAssignment.metadata"),
  });
}
