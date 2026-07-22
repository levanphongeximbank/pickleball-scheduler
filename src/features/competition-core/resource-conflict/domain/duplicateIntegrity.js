/**
 * CORE-14 — duplicate occupancy / logical assignment integrity.
 * DUPLICATE_OCCUPANCY_ID has primary precedence over DUPLICATE_ASSIGNMENT.
 * Does not implement resource overlap detection.
 */

import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { sortIdentifiers, compareUtf8Bytewise } from "../deterministic/compare.js";
import { serializeLogicalAssignmentKeyV1 } from "./LogicalAssignmentKey.js";
import { serializeCanonicalResourceKey } from "./CanonicalResourceKey.js";

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} details
 */
function diagnostic(code, message, details) {
  return Object.freeze({
    code,
    message,
    path: null,
    resourceKey: null,
    occupancyId: typeof details.occupancyId === "string" ? details.occupancyId : null,
    assignmentId: typeof details.activityIdentityValue === "string" ? details.activityIdentityValue : null,
    details: Object.freeze({ ...details }),
  });
}

/**
 * Evaluate duplicate occupancy IDs and duplicate logical assignments.
 * Input is treated as an ordered list for occurrence indexes only (not as identity).
 *
 * @param {readonly object[]} occupancies normalized ResourceOccupancy-like objects
 * @returns {{
 *   ok: boolean,
 *   diagnostics: object[],
 *   duplicateOccupancyIds: string[],
 *   duplicateLogicalAssignmentKeys: string[],
 * }}
 */
export function evaluateDuplicateIntegrity(occupancies) {
  const list = Array.isArray(occupancies) ? occupancies : [];
  /** @type {Map<string, number[]>} */
  const byOccupancyId = new Map();
  /** @type {Map<string, { indexes: number[], occupancyIds: string[], activityIdentityType: string, activityIdentityValue: string }>} */
  const byLak = new Map();

  for (let i = 0; i < list.length; i += 1) {
    const occ = list[i];
    const occupancyId = typeof occ?.occupancyId === "string" ? occ.occupancyId : "";
    if (occupancyId) {
      const arr = byOccupancyId.get(occupancyId) || [];
      arr.push(i);
      byOccupancyId.set(occupancyId, arr);
    }

    try {
      const lak = serializeLogicalAssignmentKeyV1({
        resourceKey: occ.resourceKey,
        assignmentId: occ.assignmentId,
        activityId: occ.activityId,
        matchId: occ.matchId,
      });
      const identity = (() => {
        if (typeof occ.assignmentId === "string" && occ.assignmentId.length > 0) {
          return { activityIdentityType: "ASSIGNMENT_ID", activityIdentityValue: occ.assignmentId };
        }
        if (typeof occ.activityId === "string" && occ.activityId.length > 0) {
          return { activityIdentityType: "ACTIVITY_ID", activityIdentityValue: occ.activityId };
        }
        return { activityIdentityType: "MATCH_ID", activityIdentityValue: String(occ.matchId || "") };
      })();
      const entry = byLak.get(lak) || {
        indexes: [],
        occupancyIds: [],
        activityIdentityType: identity.activityIdentityType,
        activityIdentityValue: identity.activityIdentityValue,
      };
      entry.indexes.push(i);
      if (occupancyId) entry.occupancyIds.push(occupancyId);
      byLak.set(lak, entry);
    } catch {
      // Skip LAK grouping when activity identity / key invalid; occupancy validation owns that path.
    }
  }

  /** @type {object[]} */
  const diagnostics = [];
  /** @type {Set<string>} */
  const duplicateOccupancyIdSet = new Set();
  /** @type {Set<number>} */
  const indexesCoveredByDupOccupancyId = new Set();

  const occupancyIdsSorted = [...byOccupancyId.keys()].sort(compareUtf8Bytewise);
  for (const occupancyId of occupancyIdsSorted) {
    const indexes = byOccupancyId.get(occupancyId) || [];
    if (indexes.length < 2) continue;
    duplicateOccupancyIdSet.add(occupancyId);
    for (const idx of indexes) indexesCoveredByDupOccupancyId.add(idx);
    diagnostics.push(
      diagnostic(INPUT_DIAGNOSTIC_CODE.DUPLICATE_OCCUPANCY_ID, "Duplicate occupancyId in evaluation request", {
        occupancyId,
        occurrenceCount: indexes.length,
        occurrenceIndexesSorted: [...indexes].sort((a, b) => a - b),
      })
    );
  }

  /** @type {string[]} */
  const duplicateLakKeys = [];
  const lakKeysSorted = [...byLak.keys()].sort(compareUtf8Bytewise);
  for (const lak of lakKeysSorted) {
    const entry = byLak.get(lak);
    if (!entry || entry.indexes.length < 2) continue;

    // Distinct occupancyIds among this LAK group (excluding pure same-id duplicates already primary).
    const distinctIds = [...new Set(entry.occupancyIds)];
    if (distinctIds.length < 2) {
      // Only repeated same occupancyId — already covered by DUPLICATE_OCCUPANCY_ID primary.
      continue;
    }

    // If every index in this group is already covered solely by dup occupancy id of the same id,
    // and there are no distinct ids — skipped above. Here distinct ids exist → emit DUPLICATE_ASSIGNMENT.
    // When both apply to overlapping records, occupancy-id diagnostic remains primary; still emit
    // assignment diagnostic only when materially distinct occupancyIds share LAK.
    duplicateLakKeys.push(lak);
    diagnostics.push(
      diagnostic(INPUT_DIAGNOSTIC_CODE.DUPLICATE_ASSIGNMENT, "Duplicate LogicalAssignmentKeyV1 across distinct occupancyIds", {
        logicalAssignmentKeyCanonical: lak,
        activityIdentityType: entry.activityIdentityType,
        activityIdentityValue: entry.activityIdentityValue,
        occupancyIdsSorted: sortIdentifiers(distinctIds),
        occurrenceIndexesSorted: [...entry.indexes].sort((a, b) => a - b),
        resourceKeyCanonical: (() => {
          try {
            return serializeCanonicalResourceKey(list[entry.indexes[0]].resourceKey);
          } catch {
            return null;
          }
        })(),
      })
    );
  }

  // Order diagnostics: all DUPLICATE_OCCUPANCY_ID first (already), then DUPLICATE_ASSIGNMENT.
  // They were appended in that order already.

  return Object.freeze({
    ok: diagnostics.length === 0,
    diagnostics: Object.freeze(diagnostics),
    duplicateOccupancyIds: Object.freeze([...duplicateOccupancyIdSet].sort(compareUtf8Bytewise)),
    duplicateLogicalAssignmentKeys: Object.freeze(duplicateLakKeys.sort(compareUtf8Bytewise)),
  });
}
