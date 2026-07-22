import { createRefereeCandidate } from "../contracts/refereeCandidate.js";
import {
  createEmptySnapshotResult,
  createInvalidSnapshotResult,
  createMissingSnapshotResult,
  createPopulatedSnapshotResult,
} from "./portResult.js";

export const REFEREE_DIRECTORY_PORT_METHODS = Object.freeze([
  "resolveRefereeDirectory",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesRefereeDirectoryPort(port) {
  return Boolean(
    port &&
      typeof port === "object" &&
      typeof /** @type {{ resolveRefereeDirectory?: unknown }} */ (port)
        .resolveRefereeDirectory === "function"
  );
}

/**
 * Fail-closed: always MISSING snapshot (FATAL).
 */
export function createFailClosedRefereeDirectoryPort() {
  return Object.freeze({
    async resolveRefereeDirectory(request) {
      return createMissingSnapshotResult(
        "RefereeDirectoryPort denied: fail-closed double",
        {
          tenantId: request?.tenantId ?? null,
          tournamentId: request?.tournamentId ?? null,
        }
      );
    },
  });
}

/**
 * Fixed directory double.
 * @param {'missing'|'invalid'|'empty'|object[]} modeOrCandidates
 */
export function createFixedRefereeDirectoryPort(modeOrCandidates) {
  if (modeOrCandidates === "missing") {
    return createFailClosedRefereeDirectoryPort();
  }
  if (modeOrCandidates === "invalid") {
    return Object.freeze({
      async resolveRefereeDirectory() {
        return createInvalidSnapshotResult(
          "RefereeDirectoryPort: invalid snapshot double"
        );
      },
    });
  }
  if (modeOrCandidates === "empty") {
    return Object.freeze({
      async resolveRefereeDirectory() {
        return createEmptySnapshotResult("Valid empty referee directory");
      },
    });
  }

  const frozen = Object.freeze(
    (Array.isArray(modeOrCandidates) ? modeOrCandidates : []).map((c) =>
      createRefereeCandidate(c)
    )
  );

  return Object.freeze({
    async resolveRefereeDirectory() {
      return createPopulatedSnapshotResult(
        frozen,
        "Fixed referee directory snapshot"
      );
    },
  });
}
