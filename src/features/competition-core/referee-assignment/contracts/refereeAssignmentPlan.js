import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import { createRefereeAssignment } from "./refereeAssignment.js";
import { createRefereeWorkload } from "./refereeWorkload.js";
import { createUnassignedRefereeRequirement } from "./unassignedRefereeRequirement.js";
import {
  normalizeMetadata,
  ownedFreeze,
  rejectUnknownFields,
  requireStableId,
} from "./shared.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { normalizeOptionalStableId } from "../deterministic/normalize.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "planId",
  "requestId",
  "assignments",
  "unassigned",
  "workloads",
  "diagnostics",
  "planFingerprint",
  "replayMetadata",
  "metadata",
]);

/**
 * Phase 1B: plan contract shape only — planner not implemented.
 * planFingerprint may be null until Phase 1D.
 * @param {object} [partial]
 */
export function createRefereeAssignmentPlan(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeAssignmentPlan"
  );

  const assignments = Object.freeze(
    (Array.isArray(partial.assignments) ? partial.assignments : []).map(
      (item, i) => {
        if (!isPlainObject(item)) {
          throw new RefereeAssignmentContractError(
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
            `assignments[${i}] must be a plain object`,
            { index: i }
          );
        }
        return createRefereeAssignment(item);
      }
    )
  );

  const unassigned = Object.freeze(
    (Array.isArray(partial.unassigned) ? partial.unassigned : []).map(
      (item, i) => {
        if (!isPlainObject(item)) {
          throw new RefereeAssignmentContractError(
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
            `unassigned[${i}] must be a plain object`,
            { index: i }
          );
        }
        return createUnassignedRefereeRequirement(item);
      }
    )
  );

  const workloads = Object.freeze(
    (Array.isArray(partial.workloads) ? partial.workloads : []).map(
      (item, i) => {
        if (!isPlainObject(item)) {
          throw new RefereeAssignmentContractError(
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
            `workloads[${i}] must be a plain object`,
            { index: i }
          );
        }
        return createRefereeWorkload(item);
      }
    )
  );

  const diagnostics = Object.freeze(
    (Array.isArray(partial.diagnostics) ? partial.diagnostics : []).map(
      (item, i) => {
        if (!isPlainObject(item)) {
          throw new RefereeAssignmentContractError(
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
            `diagnostics[${i}] must be a plain object`,
            { index: i }
          );
        }
        return ownedFreeze(item);
      }
    )
  );

  let replayMetadata = null;
  if (partial.replayMetadata != null) {
    if (!isPlainObject(partial.replayMetadata)) {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
        "replayMetadata must be a plain object or null",
        {}
      );
    }
    replayMetadata = ownedFreeze(partial.replayMetadata);
  }

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    planId: requireStableId(partial.planId, "RefereeAssignmentPlan.planId"),
    requestId: requireStableId(
      partial.requestId,
      "RefereeAssignmentPlan.requestId"
    ),
    assignments,
    unassigned,
    workloads,
    diagnostics,
    planFingerprint: normalizeOptionalStableId(
      partial.planFingerprint,
      "RefereeAssignmentPlan.planFingerprint"
    ),
    replayMetadata,
    metadata: normalizeMetadata(
      partial.metadata,
      "RefereeAssignmentPlan.metadata"
    ),
  });
}
