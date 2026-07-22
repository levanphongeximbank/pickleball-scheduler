/**
 * CORE-14 Phase 1E — structured change deltas (proposal only).
 * Deltas contain only plain frozen data — no functions, classes, or DB records.
 */

import { RESOLUTION_ACTION_TYPE } from "./actionTypes.js";
import {
  createCanonicalResourceKey,
  serializeCanonicalResourceKey,
} from "../domain/CanonicalResourceKey.js";
import { sortIdentifiers, compareUtf8Bytewise } from "../deterministic/compare.js";
import { canonicalSerialize } from "../deterministic/serialize.js";

/**
 * @param {object} delta
 * @returns {object}
 */
function freezeDelta(delta) {
  return Object.freeze({ ...delta });
}

/**
 * @param {{
 *   targetAssignmentId: string | null,
 *   targetOccupancyIds: readonly string[],
 *   previousStartMs: number,
 *   previousEndMs: number,
 *   proposedStartMs: number,
 *   proposedEndMs: number,
 * }} input
 */
export function buildMoveAssignmentTimeDelta(input) {
  const targetOccupancyIds = Object.freeze(sortIdentifiers(input.targetOccupancyIds || []));
  const shiftMs = input.proposedStartMs - input.previousStartMs;
  return freezeDelta({
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetAssignmentId: input.targetAssignmentId ?? null,
    targetOccupancyIds,
    previousStartMs: input.previousStartMs,
    previousEndMs: input.previousEndMs,
    proposedStartMs: input.proposedStartMs,
    proposedEndMs: input.proposedEndMs,
    shiftMs,
  });
}

/**
 * @param {{
 *   targetAssignmentId: string | null,
 *   targetOccupancyIds: readonly string[],
 *   previousCourtResourceKey: object,
 *   proposedCourtResourceKey: object,
 * }} input
 */
export function buildReassignCourtDelta(input) {
  return freezeDelta({
    actionType: RESOLUTION_ACTION_TYPE.REASSIGN_COURT,
    targetAssignmentId: input.targetAssignmentId ?? null,
    targetOccupancyIds: Object.freeze(sortIdentifiers(input.targetOccupancyIds || [])),
    previousCourtResourceKey: createCanonicalResourceKey(input.previousCourtResourceKey),
    proposedCourtResourceKey: createCanonicalResourceKey(input.proposedCourtResourceKey),
  });
}

/**
 * @param {{
 *   targetAssignmentId: string | null,
 *   targetOccupancyIds: readonly string[],
 *   previousRefereeResourceKey: object,
 *   proposedRefereeResourceKey: object,
 * }} input
 */
export function buildReassignRefereeDelta(input) {
  return freezeDelta({
    actionType: RESOLUTION_ACTION_TYPE.REASSIGN_REFEREE,
    targetAssignmentId: input.targetAssignmentId ?? null,
    targetOccupancyIds: Object.freeze(sortIdentifiers(input.targetOccupancyIds || [])),
    previousRefereeResourceKey: createCanonicalResourceKey(input.previousRefereeResourceKey),
    proposedRefereeResourceKey: createCanonicalResourceKey(input.proposedRefereeResourceKey),
  });
}

/**
 * @param {{
 *   targetAssignmentId: string | null,
 *   targetOccupancyIds: readonly string[],
 *   previousStartMs: number,
 *   previousEndMs: number,
 *   proposedStartMs: number,
 *   proposedEndMs: number,
 *   resultingRestMs: number,
 * }} input
 */
export function buildInsertRestGapDelta(input) {
  return freezeDelta({
    actionType: RESOLUTION_ACTION_TYPE.INSERT_REST_GAP,
    targetAssignmentId: input.targetAssignmentId ?? null,
    targetOccupancyIds: Object.freeze(sortIdentifiers(input.targetOccupancyIds || [])),
    previousStartMs: input.previousStartMs,
    previousEndMs: input.previousEndMs,
    proposedStartMs: input.proposedStartMs,
    proposedEndMs: input.proposedEndMs,
    resultingRestMs: input.resultingRestMs,
  });
}

/**
 * @param {{
 *   targetAssignmentId: string | null,
 *   targetOccupancyIds: readonly string[],
 *   previousCapacityUnits: number,
 *   proposedCapacityUnits: number,
 * }} input
 */
export function buildReduceCapacityUsageDelta(input) {
  return freezeDelta({
    actionType: RESOLUTION_ACTION_TYPE.REDUCE_CAPACITY_USAGE,
    targetAssignmentId: input.targetAssignmentId ?? null,
    targetOccupancyIds: Object.freeze(sortIdentifiers(input.targetOccupancyIds || [])),
    previousCapacityUnits: input.previousCapacityUnits,
    proposedCapacityUnits: input.proposedCapacityUnits,
  });
}

/**
 * @param {{ reason: string, blockedConstraints?: readonly string[] }} input
 */
export function buildManualReviewDelta(input) {
  return freezeDelta({
    actionType: RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
    reason: String(input.reason || "NO_SAFE_DETERMINISTIC_CANDIDATE"),
    blockedConstraints: Object.freeze(
      sortIdentifiers(input.blockedConstraints || [])
    ),
  });
}

/**
 * @param {{ reason: string, blockedConstraints?: readonly string[] }} input
 */
export function buildNoSafeAutomaticResolutionDelta(input) {
  return freezeDelta({
    actionType: RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
    reason: String(input.reason || "BLOCKED_CONSTRAINTS"),
    blockedConstraints: Object.freeze(
      sortIdentifiers(input.blockedConstraints || [])
    ),
  });
}

/**
 * Canonical serialization material for proposedChanges (identity).
 * @param {readonly object[]} proposedChanges
 * @returns {object[]}
 */
export function canonicalizeProposedChanges(proposedChanges) {
  const list = Array.isArray(proposedChanges) ? [...proposedChanges] : [];
  const material = list.map((delta) => canonicalizeOneDelta(delta));
  material.sort((a, b) =>
    compareUtf8Bytewise(canonicalSerialize(a), canonicalSerialize(b))
  );
  return material;
}

/**
 * @param {object} delta
 * @returns {object}
 */
function canonicalizeOneDelta(delta) {
  if (!delta || typeof delta !== "object") return Object.freeze({});
  const actionType = delta.actionType;
  switch (actionType) {
    case RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME:
    case RESOLUTION_ACTION_TYPE.INSERT_REST_GAP:
      return Object.freeze({
        actionType,
        targetAssignmentId: delta.targetAssignmentId ?? null,
        targetOccupancyIds: sortIdentifiers(delta.targetOccupancyIds || []),
        previousStartMs: delta.previousStartMs,
        previousEndMs: delta.previousEndMs,
        proposedStartMs: delta.proposedStartMs,
        proposedEndMs: delta.proposedEndMs,
        shiftMs: delta.shiftMs ?? null,
        resultingRestMs: delta.resultingRestMs ?? null,
      });
    case RESOLUTION_ACTION_TYPE.REASSIGN_COURT:
      return Object.freeze({
        actionType,
        targetAssignmentId: delta.targetAssignmentId ?? null,
        targetOccupancyIds: sortIdentifiers(delta.targetOccupancyIds || []),
        previousCourtResourceKey: serializeCanonicalResourceKey(delta.previousCourtResourceKey),
        proposedCourtResourceKey: serializeCanonicalResourceKey(delta.proposedCourtResourceKey),
      });
    case RESOLUTION_ACTION_TYPE.REASSIGN_REFEREE:
      return Object.freeze({
        actionType,
        targetAssignmentId: delta.targetAssignmentId ?? null,
        targetOccupancyIds: sortIdentifiers(delta.targetOccupancyIds || []),
        previousRefereeResourceKey: serializeCanonicalResourceKey(
          delta.previousRefereeResourceKey
        ),
        proposedRefereeResourceKey: serializeCanonicalResourceKey(
          delta.proposedRefereeResourceKey
        ),
      });
    case RESOLUTION_ACTION_TYPE.REDUCE_CAPACITY_USAGE:
      return Object.freeze({
        actionType,
        targetAssignmentId: delta.targetAssignmentId ?? null,
        targetOccupancyIds: sortIdentifiers(delta.targetOccupancyIds || []),
        previousCapacityUnits: delta.previousCapacityUnits,
        proposedCapacityUnits: delta.proposedCapacityUnits,
      });
    case RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW:
    case RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION:
      return Object.freeze({
        actionType,
        reason: delta.reason ?? null,
        blockedConstraints: sortIdentifiers(delta.blockedConstraints || []),
      });
    default:
      return Object.freeze({ actionType: actionType ?? null });
  }
}
