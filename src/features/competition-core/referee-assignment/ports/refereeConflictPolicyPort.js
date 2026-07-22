import {
  createEmptySnapshotResult,
  createInvalidSnapshotResult,
  createMissingSnapshotResult,
  createPopulatedSnapshotResult,
  createPortResolveResult,
} from "./portResult.js";
import { REFEREE_SNAPSHOT_STATUS } from "../enums/snapshotStatus.js";
import { ownedFreeze } from "../contracts/shared.js";
import { isPlainObject } from "../deterministic/canonicalize.js";

export const REFEREE_CONFLICT_POLICY_PORT_METHODS = Object.freeze([
  "resolveConflictPolicy",
]);

export function matchesRefereeConflictPolicyPort(port) {
  return Boolean(
    port &&
      typeof port === "object" &&
      typeof /** @type {{ resolveConflictPolicy?: unknown }} */ (port)
        .resolveConflictPolicy === "function"
  );
}

export function createFailClosedRefereeConflictPolicyPort() {
  return Object.freeze({
    async resolveConflictPolicy(request) {
      return createMissingSnapshotResult(
        "RefereeConflictPolicyPort denied: fail-closed double",
        { tournamentId: request?.tournamentId ?? null }
      );
    },
  });
}

/**
 * @param {'missing'|'invalid'|'empty'|object} modeOrPolicy
 */
export function createFixedRefereeConflictPolicyPort(modeOrPolicy) {
  if (modeOrPolicy === "missing") {
    return createFailClosedRefereeConflictPolicyPort();
  }
  if (modeOrPolicy === "invalid") {
    return Object.freeze({
      async resolveConflictPolicy() {
        return createInvalidSnapshotResult(
          "RefereeConflictPolicyPort: invalid snapshot double"
        );
      },
    });
  }
  if (modeOrPolicy === "empty") {
    return Object.freeze({
      async resolveConflictPolicy() {
        return createEmptySnapshotResult("Valid empty conflict policy");
      },
    });
  }

  if (!isPlainObject(modeOrPolicy)) {
    return createFailClosedRefereeConflictPolicyPort();
  }

  const policy = ownedFreeze({
    policyId: String(modeOrPolicy.policyId || "conflict-policy"),
    prohibitSamePlayerId: modeOrPolicy.prohibitSamePlayerId !== false,
    prohibitSameClubId: modeOrPolicy.prohibitSameClubId !== false,
    prohibitSameOrganizationId:
      modeOrPolicy.prohibitSameOrganizationId !== false,
    matchExclusions: Array.isArray(modeOrPolicy.matchExclusions)
      ? [...modeOrPolicy.matchExclusions]
      : [],
  });

  return Object.freeze({
    async resolveConflictPolicy() {
      return createPortResolveResult({
        status: REFEREE_SNAPSHOT_STATUS.POPULATED,
        message: "Fixed conflict policy",
        items: [policy],
      });
    },
  });
}

void createPopulatedSnapshotResult;
