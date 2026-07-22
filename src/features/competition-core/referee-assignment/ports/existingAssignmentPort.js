import { createRefereeAssignment } from "../contracts/refereeAssignment.js";
import {
  createEmptySnapshotResult,
  createInvalidSnapshotResult,
  createMissingSnapshotResult,
  createPopulatedSnapshotResult,
} from "./portResult.js";

export const EXISTING_ASSIGNMENT_PORT_METHODS = Object.freeze([
  "resolveExistingAssignments",
]);

export function matchesExistingAssignmentPort(port) {
  return Boolean(
    port &&
      typeof port === "object" &&
      typeof /** @type {{ resolveExistingAssignments?: unknown }} */ (port)
        .resolveExistingAssignments === "function"
  );
}

export function createFailClosedExistingAssignmentPort() {
  return Object.freeze({
    async resolveExistingAssignments(request) {
      return createMissingSnapshotResult(
        "ExistingAssignmentPort denied: fail-closed double",
        {
          tenantId: request?.tenantId ?? null,
          tournamentId: request?.tournamentId ?? null,
        }
      );
    },
  });
}

/**
 * @param {'missing'|'invalid'|'empty'|object[]} modeOrItems
 */
export function createFixedExistingAssignmentPort(modeOrItems) {
  if (modeOrItems === "missing") {
    return createFailClosedExistingAssignmentPort();
  }
  if (modeOrItems === "invalid") {
    return Object.freeze({
      async resolveExistingAssignments() {
        return createInvalidSnapshotResult(
          "ExistingAssignmentPort: invalid snapshot double"
        );
      },
    });
  }
  if (modeOrItems === "empty") {
    return Object.freeze({
      async resolveExistingAssignments() {
        return createEmptySnapshotResult("Valid empty existing assignments");
      },
    });
  }
  const frozen = Object.freeze(
    (Array.isArray(modeOrItems) ? modeOrItems : []).map((a) =>
      createRefereeAssignment(a)
    )
  );
  return Object.freeze({
    async resolveExistingAssignments() {
      return createPopulatedSnapshotResult(frozen);
    },
  });
}
