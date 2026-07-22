import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import { createRefereeAssignment } from "./refereeAssignment.js";
import { createRefereeAssignmentFailure } from "./refereeAssignmentFailure.js";
import {
  normalizeMetadata,
  ownedFreeze,
  rejectUnknownFields,
  requireBoolean,
  requireStableId,
} from "./shared.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { normalizeOptionalStableId } from "../deterministic/normalize.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "requestId",
  "ok",
  "outgoingAssignment",
  "incomingAssignment",
  "failure",
  "metadata",
]);

/**
 * Replacement result — either ok with assignments or failure envelope.
 * @param {object} [partial]
 */
export function createRefereeReplacementResult(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeReplacementResult"
  );

  const ok = requireBoolean(partial.ok, "RefereeReplacementResult.ok");

  let outgoingAssignment = null;
  let incomingAssignment = null;
  let failure = null;

  if (ok) {
    if (!isPlainObject(partial.incomingAssignment)) {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
        "ok replacement requires incomingAssignment",
        {}
      );
    }
    incomingAssignment = createRefereeAssignment(partial.incomingAssignment);
    if (partial.outgoingAssignment != null) {
      if (!isPlainObject(partial.outgoingAssignment)) {
        throw new RefereeAssignmentContractError(
          REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
          "outgoingAssignment must be a plain object or null",
          {}
        );
      }
      outgoingAssignment = createRefereeAssignment(partial.outgoingAssignment);
    }
  } else {
    if (!isPlainObject(partial.failure)) {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REPLACEMENT_REFEREE_REJECTED,
        "failed replacement requires failure envelope",
        {}
      );
    }
    failure = createRefereeAssignmentFailure(partial.failure);
  }

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    requestId: requireStableId(
      partial.requestId,
      "RefereeReplacementResult.requestId"
    ),
    ok,
    outgoingAssignment,
    incomingAssignment,
    failure,
    metadata: normalizeMetadata(
      partial.metadata,
      "RefereeReplacementResult.metadata"
    ),
  });
}

void normalizeOptionalStableId;
