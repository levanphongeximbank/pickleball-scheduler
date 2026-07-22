import { createRefereeWorkload } from "../contracts/refereeWorkload.js";
import {
  createEmptySnapshotResult,
  createInvalidSnapshotResult,
  createMissingSnapshotResult,
  createPopulatedSnapshotResult,
} from "./portResult.js";

export const REFEREE_WORKLOAD_HISTORY_PORT_METHODS = Object.freeze([
  "resolveWorkloadHistory",
]);

export function matchesRefereeWorkloadHistoryPort(port) {
  return Boolean(
    port &&
      typeof port === "object" &&
      typeof /** @type {{ resolveWorkloadHistory?: unknown }} */ (port)
        .resolveWorkloadHistory === "function"
  );
}

export function createFailClosedRefereeWorkloadHistoryPort() {
  return Object.freeze({
    async resolveWorkloadHistory(request) {
      return createMissingSnapshotResult(
        "RefereeWorkloadHistoryPort denied: fail-closed double",
        { tournamentId: request?.tournamentId ?? null }
      );
    },
  });
}

/**
 * Optional port — empty is a valid “no history” snapshot.
 * @param {'missing'|'invalid'|'empty'|object[]} modeOrItems
 */
export function createFixedRefereeWorkloadHistoryPort(modeOrItems) {
  if (modeOrItems === "missing") {
    return createFailClosedRefereeWorkloadHistoryPort();
  }
  if (modeOrItems === "invalid") {
    return Object.freeze({
      async resolveWorkloadHistory() {
        return createInvalidSnapshotResult(
          "RefereeWorkloadHistoryPort: invalid snapshot double"
        );
      },
    });
  }
  if (modeOrItems === "empty" || modeOrItems == null) {
    return Object.freeze({
      async resolveWorkloadHistory() {
        return createEmptySnapshotResult("Valid empty workload history");
      },
    });
  }
  const frozen = Object.freeze(
    (Array.isArray(modeOrItems) ? modeOrItems : []).map((w) =>
      createRefereeWorkload(w)
    )
  );
  return Object.freeze({
    async resolveWorkloadHistory() {
      return createPopulatedSnapshotResult(frozen);
    },
  });
}
