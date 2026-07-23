/**
 * CORE-19 adapter — CORE-15 Match Runtime prerequisite mapping.
 *
 * Imports only from the CORE-15 public barrel.
 * Never calls applyMatchTransition or mutates lifecycle state.
 */

import { MATCH_STATUS } from "../../matches/index.js";
import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { createTransitionPrerequisiteResult } from "../contracts/workflowDecisions.js";
import {
  compareStableString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";

const DEPENDENCY = "core-15:matches";

/**
 * @param {unknown} item
 * @returns {{ matchId: string, status: string|null, ok: boolean|null, rejected: boolean, raw: object }}
 */
function normalizeMatchSnapshot(item) {
  if (!isPlainObject(item)) {
    return {
      matchId: "",
      status: null,
      ok: null,
      rejected: false,
      raw: {},
    };
  }

  // Match transition result shape (already produced — not executed here).
  if ("toStatus" in item || "fromStatus" in item || "match" in item) {
    const match = isPlainObject(item.match) ? item.match : {};
    const status =
      item.toStatus != null
        ? String(item.toStatus)
        : match.status != null
          ? String(match.status)
          : null;
    const matchId = String(
      match.matchId || match.id || item.matchId || item.id || ""
    );
    return {
      matchId,
      status,
      ok: item.ok === true ? true : item.ok === false ? false : null,
      rejected: item.ok === false,
      raw: item,
    };
  }

  const status =
    item.status != null
      ? String(item.status)
      : item.matchStatus != null
        ? String(item.matchStatus)
        : null;

  return {
    matchId: String(item.matchId || item.id || ""),
    status,
    ok: item.ok === true ? true : item.ok === false ? false : null,
    rejected: item.ok === false || item.rejected === true,
    raw: item,
  };
}

/**
 * Map match lifecycle snapshots / transition results into TransitionPrerequisiteResult.
 *
 * @param {object} [input]
 * @param {unknown} [input.matches]
 * @param {unknown} [input.match]
 * @param {unknown} [input.transitionResult]
 * @param {string[]} [input.requiredStatuses] — default [COMPLETED]
 * @param {string|null} [input.prerequisiteId]
 * @returns {Readonly<import('../contracts/workflowDecisions.js').TransitionPrerequisiteResult>}
 */
export function adaptCore15MatchPrerequisite(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const requiredStatuses = (
    Array.isArray(source.requiredStatuses) && source.requiredStatuses.length > 0
      ? source.requiredStatuses.map(String)
      : [MATCH_STATUS.COMPLETED]
  ).sort(compareStableString);

  const collected = [];
  if (Array.isArray(source.matches)) collected.push(...source.matches);
  if (source.match != null) collected.push(source.match);
  if (source.transitionResult != null) collected.push(source.transitionResult);
  if (
    collected.length === 0 &&
    (source.status != null || source.matchId != null || source.toStatus != null)
  ) {
    collected.push(source);
  }

  const snapshots = collected
    .map(normalizeMatchSnapshot)
    .sort((a, b) => compareStableString(a.matchId, b.matchId));

  const incomplete = [];
  const suspended = [];
  const cancelled = [];
  const rejected = [];
  const completed = [];

  for (const snap of snapshots) {
    if (snap.rejected || snap.ok === false) {
      rejected.push(snap);
      continue;
    }
    if (snap.status === MATCH_STATUS.SUSPENDED) {
      suspended.push(snap);
      incomplete.push(snap);
      continue;
    }
    if (snap.status === MATCH_STATUS.CANCELLED) {
      cancelled.push(snap);
      incomplete.push(snap);
      continue;
    }
    if (snap.status == null || !requiredStatuses.includes(snap.status)) {
      incomplete.push(snap);
      continue;
    }
    completed.push(snap);
  }

  const blocking = [...rejected, ...incomplete].sort((a, b) =>
    compareStableString(a.matchId, b.matchId)
  );
  const satisfied = snapshots.length > 0 && blocking.length === 0;

  const blockingReasons = Object.freeze(
    blocking
      .map((snap) => {
        if (snap.rejected || snap.ok === false) {
          return `Match ${snap.matchId || "unknown"} lifecycle result rejected`;
        }
        if (snap.status === MATCH_STATUS.SUSPENDED) {
          return `Match ${snap.matchId || "unknown"} is SUSPENDED`;
        }
        if (snap.status === MATCH_STATUS.CANCELLED) {
          return `Match ${snap.matchId || "unknown"} is CANCELLED`;
        }
        if (
          snap.status === MATCH_STATUS.SCHEDULED ||
          snap.status === MATCH_STATUS.IN_PROGRESS
        ) {
          return `Match ${snap.matchId || "unknown"} still ${snap.status}`;
        }
        return `Match ${snap.matchId || "unknown"} status ${snap.status || "UNKNOWN"} not in required [${requiredStatuses.join(",")}]`;
      })
      .sort(compareStableString)
  );

  return createTransitionPrerequisiteResult({
    satisfied,
    code: satisfied
      ? "MATCH_PREREQUISITES_SATISFIED"
      : WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
    message: satisfied
      ? "All required matches satisfy lifecycle prerequisite"
      : blockingReasons[0] || "Required match prerequisites not satisfied",
    dependencyRef: DEPENDENCY,
    details: {
      dependency: DEPENDENCY,
      dependencyCode: satisfied
        ? null
        : WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
      prerequisiteId:
        source.prerequisiteId != null ? String(source.prerequisiteId) : null,
      requiredStatuses: Object.freeze([...requiredStatuses]),
      matchIds: Object.freeze(
        snapshots.map((s) => s.matchId).sort(compareStableString)
      ),
      completedMatchIds: Object.freeze(
        completed.map((s) => s.matchId).sort(compareStableString)
      ),
      incompleteMatchIds: Object.freeze(
        incomplete.map((s) => s.matchId).sort(compareStableString)
      ),
      suspendedMatchIds: Object.freeze(
        suspended.map((s) => s.matchId).sort(compareStableString)
      ),
      cancelledMatchIds: Object.freeze(
        cancelled.map((s) => s.matchId).sort(compareStableString)
      ),
      rejectedMatchIds: Object.freeze(
        rejected.map((s) => s.matchId).sort(compareStableString)
      ),
      statuses: Object.freeze(
        snapshots.map((s) => ({
          matchId: s.matchId,
          status: s.status,
        }))
      ),
      blockingReasons,
      warnings: Object.freeze([]),
      // Explicit: adapter does not own/duplicate MATCH_TRANSITION_MATRIX.
      usesCanonicalMatchStatus: true,
    },
  });
}
