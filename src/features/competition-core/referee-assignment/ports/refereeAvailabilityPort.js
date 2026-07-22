import { createRefereeAvailabilityWindow } from "../contracts/refereeAvailabilityWindow.js";
import {
  createEmptySnapshotResult,
  createInvalidSnapshotResult,
  createMissingSnapshotResult,
  createPopulatedSnapshotResult,
} from "./portResult.js";

export const REFEREE_AVAILABILITY_PORT_METHODS = Object.freeze([
  "resolveRefereeAvailability",
]);

export function matchesRefereeAvailabilityPort(port) {
  return Boolean(
    port &&
      typeof port === "object" &&
      typeof /** @type {{ resolveRefereeAvailability?: unknown }} */ (port)
        .resolveRefereeAvailability === "function"
  );
}

export function createFailClosedRefereeAvailabilityPort() {
  return Object.freeze({
    async resolveRefereeAvailability(request) {
      return createMissingSnapshotResult(
        "RefereeAvailabilityPort denied: fail-closed double",
        { refereeId: request?.refereeId ?? null }
      );
    },
  });
}

/**
 * @param {'missing'|'invalid'|'empty'|object[]} modeOrItems
 */
export function createFixedRefereeAvailabilityPort(modeOrItems) {
  if (modeOrItems === "missing") {
    return createFailClosedRefereeAvailabilityPort();
  }
  if (modeOrItems === "invalid") {
    return Object.freeze({
      async resolveRefereeAvailability() {
        return createInvalidSnapshotResult(
          "RefereeAvailabilityPort: invalid snapshot double"
        );
      },
    });
  }
  if (modeOrItems === "empty") {
    return Object.freeze({
      async resolveRefereeAvailability() {
        return createEmptySnapshotResult("Valid empty availability");
      },
    });
  }
  const frozen = Object.freeze(
    (Array.isArray(modeOrItems) ? modeOrItems : []).map((w) =>
      createRefereeAvailabilityWindow(w)
    )
  );
  return Object.freeze({
    async resolveRefereeAvailability() {
      return createPopulatedSnapshotResult(frozen);
    },
  });
}
