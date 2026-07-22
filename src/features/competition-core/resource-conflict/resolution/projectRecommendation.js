/**
 * CORE-14 Phase 1E — dry-run recommendation projector.
 * Applies one recommendation to occupancy copies only.
 * Does not mutate caller input. Does not change immutable identity fields.
 */

import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { OCCUPANCY_SOURCE } from "../enums/occupancySource.js";
import { RESOURCE_KIND } from "../enums/resourceKind.js";
import { createResourceOccupancy } from "../domain/ResourceOccupancy.js";
import {
  createCanonicalResourceKey,
  serializeCanonicalResourceKey,
} from "../domain/CanonicalResourceKey.js";
import { sortIdentifiers, compareUtf8Bytewise } from "../deterministic/compare.js";
import { RESOLUTION_ACTION_TYPE, isNonMutatingActionType } from "./actionTypes.js";

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>|null} [details]
 */
function diagnostic(code, message, details = null) {
  return Object.freeze({
    code,
    message,
    path: null,
    resourceKey: null,
    occupancyId: null,
    assignmentId: null,
    details: details ? Object.freeze({ ...details }) : null,
  });
}

/**
 * Shallow-plain copy of a frozen occupancy for mutation of permitted fields.
 * @param {object} occupancy
 * @returns {Record<string, unknown>}
 */
function toMutableCopy(occupancy) {
  return {
    occupancyId: occupancy.occupancyId,
    resourceKey: {
      resourceKind: occupancy.resourceKey.resourceKind,
      resourceId: occupancy.resourceKey.resourceId,
      scopeType: occupancy.resourceKey.scopeType,
      scopeId: occupancy.resourceKey.scopeId,
    },
    assignmentId: occupancy.assignmentId,
    activityId: occupancy.activityId,
    matchId: occupancy.matchId,
    competitionId: occupancy.competitionId,
    venueId: occupancy.venueId,
    startMs: occupancy.startMs,
    endMs: occupancy.endMs,
    capacityUnits: occupancy.capacityUnits,
    locked: occupancy.locked,
    published: occupancy.published,
    source: occupancy.source,
    metadata: occupancy.metadata == null ? null : { ...occupancy.metadata },
  };
}

/**
 * Resolve target occupancy indices for a delta. Fails closed on missing/ambiguous.
 *
 * @param {readonly object[]} occupancies
 * @param {object} delta
 * @returns {{ ok: true, indices: number[] } | { ok: false, diagnostics: object[] }}
 */
function resolveTargetIndices(occupancies, delta) {
  const targetIds = Array.isArray(delta.targetOccupancyIds)
    ? sortIdentifiers(delta.targetOccupancyIds)
    : [];
  if (targetIds.length === 0 && delta.targetAssignmentId) {
    const matches = [];
    for (let i = 0; i < occupancies.length; i += 1) {
      if (occupancies[i].assignmentId === delta.targetAssignmentId) {
        matches.push(i);
      }
    }
    if (matches.length === 0) {
      return {
        ok: false,
        diagnostics: [
          diagnostic(
            INPUT_DIAGNOSTIC_CODE.ASSIGNMENT_ID_MISSING,
            "Delta target assignment not found in baseline occupancies",
            { targetAssignmentId: delta.targetAssignmentId }
          ),
        ],
      };
    }
    if (matches.length > 1 && !delta.targetOccupancyIds) {
      return {
        ok: false,
        diagnostics: [
          diagnostic(
            INPUT_DIAGNOSTIC_CODE.DUPLICATE_ASSIGNMENT,
            "Ambiguous target occupancy for assignmentId",
            {
              targetAssignmentId: delta.targetAssignmentId,
              matchCount: matches.length,
            }
          ),
        ],
      };
    }
    return { ok: true, indices: matches };
  }

  /** @type {number[]} */
  const indices = [];
  for (const id of targetIds) {
    const matches = [];
    for (let i = 0; i < occupancies.length; i += 1) {
      if (occupancies[i].occupancyId === id) matches.push(i);
    }
    if (matches.length === 0) {
      return {
        ok: false,
        diagnostics: [
          diagnostic(
            INPUT_DIAGNOSTIC_CODE.OCCUPANCY_ID_MISSING,
            "Delta target occupancy missing",
            { occupancyId: id }
          ),
        ],
      };
    }
    if (matches.length > 1) {
      return {
        ok: false,
        diagnostics: [
          diagnostic(
            INPUT_DIAGNOSTIC_CODE.DUPLICATE_OCCUPANCY_ID,
            "Ambiguous target occupancy id",
            { occupancyId: id, matchCount: matches.length }
          ),
        ],
      };
    }
    indices.push(matches[0]);
  }
  return { ok: true, indices };
}

/**
 * Project one recommendation onto occupancy copies.
 *
 * @param {{
 *   occupancies: readonly object[],
 *   recommendation: object,
 * }} request
 * @returns {{
 *   ok: true,
 *   projectedOccupancies: object[],
 *   changedAssignmentIds: string[],
 *   changedOccupancyIds: string[],
 *   estimatedShiftMs: number,
 *   crossesScopeBoundary: boolean,
 * } | {
 *   ok: false,
 *   diagnostics: object[],
 * }}
 */
export function projectRecommendation(request) {
  const baseline = Array.isArray(request?.occupancies) ? request.occupancies : [];
  const recommendation = request?.recommendation;
  if (!recommendation || typeof recommendation !== "object") {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
          "recommendation is required for projection"
        ),
      ],
    };
  }

  const copies = baseline.map((o) => toMutableCopy(o));
  if (isNonMutatingActionType(recommendation.actionType)) {
    return {
      ok: true,
      projectedOccupancies: copies.map((c) => createResourceOccupancy(c)),
      changedAssignmentIds: [],
      changedOccupancyIds: [],
      estimatedShiftMs: 0,
      crossesScopeBoundary: false,
    };
  }

  const deltas = Array.isArray(recommendation.proposedChanges)
    ? recommendation.proposedChanges
    : [];
  if (deltas.length === 0) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
          "Mutating recommendation requires proposedChanges"
        ),
      ],
    };
  }

  /** @type {Set<string>} */
  const changedAssignmentIds = new Set();
  /** @type {Set<string>} */
  const changedOccupancyIds = new Set();
  let estimatedShiftMs = 0;
  let crossesScopeBoundary = recommendation.crossesScopeBoundary === true;

  for (const delta of deltas) {
    const resolved = resolveTargetIndices(copies, delta);
    if (!resolved.ok) return resolved;

    for (const index of resolved.indices) {
      const target = copies[index];
      const identitySnapshot = {
        occupancyId: target.occupancyId,
        assignmentId: target.assignmentId,
        activityId: target.activityId,
        matchId: target.matchId,
        competitionId: target.competitionId,
        locked: target.locked,
        published: target.published,
        source: target.source,
      };

      switch (delta.actionType || recommendation.actionType) {
        case RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME:
        case RESOLUTION_ACTION_TYPE.INSERT_REST_GAP: {
          target.startMs = delta.proposedStartMs;
          target.endMs = delta.proposedEndMs;
          const shift = Math.abs(
            typeof delta.shiftMs === "number"
              ? delta.shiftMs
              : delta.proposedStartMs - delta.previousStartMs
          );
          if (shift > estimatedShiftMs) estimatedShiftMs = shift;
          break;
        }
        case RESOLUTION_ACTION_TYPE.REASSIGN_COURT: {
          const proposed = createCanonicalResourceKey(delta.proposedCourtResourceKey);
          if (proposed.resourceKind !== RESOURCE_KIND.COURT) {
            return {
              ok: false,
              diagnostics: [
                diagnostic(
                  INPUT_DIAGNOSTIC_CODE.UNKNOWN_RESOURCE_TYPE,
                  "REASSIGN_COURT requires COURT resourceKind",
                  { resourceKind: proposed.resourceKind }
                ),
              ],
            };
          }
          const previous = createCanonicalResourceKey(
            delta.previousCourtResourceKey || target.resourceKey
          );
          if (
            previous.scopeType !== proposed.scopeType ||
            previous.scopeId !== proposed.scopeId
          ) {
            crossesScopeBoundary = true;
          }
          target.resourceKey = {
            resourceKind: proposed.resourceKind,
            resourceId: proposed.resourceId,
            scopeType: proposed.scopeType,
            scopeId: proposed.scopeId,
          };
          break;
        }
        case RESOLUTION_ACTION_TYPE.REASSIGN_REFEREE: {
          const proposed = createCanonicalResourceKey(delta.proposedRefereeResourceKey);
          if (proposed.resourceKind !== RESOURCE_KIND.REFEREE) {
            return {
              ok: false,
              diagnostics: [
                diagnostic(
                  INPUT_DIAGNOSTIC_CODE.UNKNOWN_RESOURCE_TYPE,
                  "REASSIGN_REFEREE requires REFEREE resourceKind",
                  { resourceKind: proposed.resourceKind }
                ),
              ],
            };
          }
          const previous = createCanonicalResourceKey(
            delta.previousRefereeResourceKey || target.resourceKey
          );
          if (
            previous.scopeType !== proposed.scopeType ||
            previous.scopeId !== proposed.scopeId
          ) {
            crossesScopeBoundary = true;
          }
          target.resourceKey = {
            resourceKind: proposed.resourceKind,
            resourceId: proposed.resourceId,
            scopeType: proposed.scopeType,
            scopeId: proposed.scopeId,
          };
          break;
        }
        case RESOLUTION_ACTION_TYPE.REDUCE_CAPACITY_USAGE: {
          target.capacityUnits = delta.proposedCapacityUnits;
          break;
        }
        default:
          return {
            ok: false,
            diagnostics: [
              diagnostic(
                INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
                "Unsupported projection action type",
                { actionType: delta.actionType ?? recommendation.actionType }
              ),
            ],
          };
      }

      // Provenance may be marked projected for audit; identity fields stay fixed.
      target.source = OCCUPANCY_SOURCE.PROJECTED;

      if (
        target.occupancyId !== identitySnapshot.occupancyId ||
        target.assignmentId !== identitySnapshot.assignmentId ||
        target.activityId !== identitySnapshot.activityId ||
        target.matchId !== identitySnapshot.matchId ||
        target.competitionId !== identitySnapshot.competitionId ||
        target.locked !== identitySnapshot.locked ||
        target.published !== identitySnapshot.published
      ) {
        return {
          ok: false,
          diagnostics: [
            diagnostic(
              INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
              "Projection must preserve immutable identity and lock/published fields"
            ),
          ],
        };
      }

      changedOccupancyIds.add(target.occupancyId);
      if (typeof target.assignmentId === "string" && target.assignmentId.length > 0) {
        changedAssignmentIds.add(target.assignmentId);
      }
    }
  }

  /** @type {object[]} */
  const projectedOccupancies = [];
  for (const copy of copies) {
    const created = createResourceOccupancy(copy);
    projectedOccupancies.push(created);
  }

  return {
    ok: true,
    projectedOccupancies,
    changedAssignmentIds: sortIdentifiers([...changedAssignmentIds]),
    changedOccupancyIds: sortIdentifiers([...changedOccupancyIds]),
    estimatedShiftMs,
    crossesScopeBoundary,
  };
}

/**
 * @param {readonly object[]} occupancies
 * @returns {Map<string, object>}
 */
export function indexOccupanciesById(occupancies) {
  const map = new Map();
  for (const o of occupancies || []) {
    if (o?.occupancyId) map.set(o.occupancyId, o);
  }
  return map;
}

/**
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
export function sameResourceScope(a, b) {
  const left = createCanonicalResourceKey(a);
  const right = createCanonicalResourceKey(b);
  return left.scopeType === right.scopeType && left.scopeId === right.scopeId;
}

/**
 * @param {object} key
 * @returns {string}
 */
export function resourceKeySerialized(key) {
  return serializeCanonicalResourceKey(createCanonicalResourceKey(key));
}

/**
 * Stable compare for projected occupancy lists (by occupancyId).
 * @param {readonly object[]} list
 * @returns {object[]}
 */
export function sortOccupanciesById(list) {
  return [...(list || [])].sort((a, b) =>
    compareUtf8Bytewise(a.occupancyId, b.occupancyId)
  );
}
