import { createRefereeQualification } from "../contracts/refereeQualification.js";
import {
  createEmptySnapshotResult,
  createInvalidSnapshotResult,
  createMissingSnapshotResult,
  createPopulatedSnapshotResult,
} from "./portResult.js";

export const REFEREE_QUALIFICATION_PORT_METHODS = Object.freeze([
  "resolveRefereeQualifications",
]);

export function matchesRefereeQualificationPort(port) {
  return Boolean(
    port &&
      typeof port === "object" &&
      typeof /** @type {{ resolveRefereeQualifications?: unknown }} */ (port)
        .resolveRefereeQualifications === "function"
  );
}

export function createFailClosedRefereeQualificationPort() {
  return Object.freeze({
    async resolveRefereeQualifications(request) {
      return createMissingSnapshotResult(
        "RefereeQualificationPort denied: fail-closed double",
        { refereeId: request?.refereeId ?? null }
      );
    },
  });
}

/**
 * @param {'missing'|'invalid'|'empty'|object[]} modeOrItems
 */
export function createFixedRefereeQualificationPort(modeOrItems) {
  if (modeOrItems === "missing") {
    return createFailClosedRefereeQualificationPort();
  }
  if (modeOrItems === "invalid") {
    return Object.freeze({
      async resolveRefereeQualifications() {
        return createInvalidSnapshotResult(
          "RefereeQualificationPort: invalid snapshot double"
        );
      },
    });
  }
  if (modeOrItems === "empty") {
    return Object.freeze({
      async resolveRefereeQualifications() {
        return createEmptySnapshotResult("Valid empty qualifications");
      },
    });
  }
  const frozen = Object.freeze(
    (Array.isArray(modeOrItems) ? modeOrItems : []).map((q) =>
      createRefereeQualification(q)
    )
  );
  return Object.freeze({
    async resolveRefereeQualifications() {
      return createPopulatedSnapshotResult(frozen);
    },
  });
}
