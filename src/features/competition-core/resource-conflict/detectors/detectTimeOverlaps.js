/**
 * CORE-14 Phase 1D — time-overlap detector.
 * Groups by CanonicalResourceKey; active sweep O(n log n + k).
 * Half-open intervals: adjacent do not overlap.
 */

import { compareUtf8Bytewise, compareSafeInteger } from "../deterministic/compare.js";
import { intervalsOverlap, intervalIntersection } from "../time/interval.js";
import { serializeCanonicalResourceKey } from "../domain/CanonicalResourceKey.js";
import { resolveActivityIdentity } from "../domain/LogicalAssignmentKey.js";
import { createResourceFinding } from "../domain/ResourceFinding.js";
import {
  OVERLAP_POLICY_VERSION,
  resolveOverlapFindingCode,
} from "../policy/overlapPolicy.js";

/**
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function compareOccupancyForSweep(a, b) {
  const c1 = compareSafeInteger(a.startMs, b.startMs);
  if (c1 !== 0) return c1;
  const c2 = compareSafeInteger(a.endMs, b.endMs);
  if (c2 !== 0) return c2;
  return compareUtf8Bytewise(a.occupancyId, b.occupancyId);
}

/**
 * @param {object} occupancy
 * @returns {string[]}
 */
function activityIdentities(occupancy) {
  const ids = [];
  if (typeof occupancy.assignmentId === "string" && occupancy.assignmentId.length > 0) {
    ids.push(occupancy.assignmentId);
  }
  if (typeof occupancy.activityId === "string" && occupancy.activityId.length > 0) {
    ids.push(occupancy.activityId);
  }
  if (typeof occupancy.matchId === "string" && occupancy.matchId.length > 0) {
    ids.push(occupancy.matchId);
  }
  return ids;
}

/**
 * Detect time overlaps over validated ResourceOccupancy values.
 * Does not mutate input. Invalid occupancies are not accepted here —
 * callers must validate first.
 *
 * @param {readonly object[]} occupancies
 * @param {{
 *   exclusiveLocationKeys?: ReadonlySet<string>,
 *   policyVersion?: string,
 * }} [options]
 * @returns {object[]} ResourceFinding[]
 */
export function detectTimeOverlaps(occupancies, options = {}) {
  const list = Array.isArray(occupancies) ? occupancies : [];
  const exclusiveLocationKeys = options.exclusiveLocationKeys || new Set();
  const policyVersion = options.policyVersion || OVERLAP_POLICY_VERSION;

  /** @type {Map<string, object[]>} */
  const groups = new Map();
  for (const occ of list) {
    const canonical = serializeCanonicalResourceKey(occ.resourceKey);
    const arr = groups.get(canonical) || [];
    arr.push(occ);
    groups.set(canonical, arr);
  }

  /** @type {object[]} */
  const findings = [];
  const groupKeys = [...groups.keys()].sort(compareUtf8Bytewise);

  for (const canonical of groupKeys) {
    const group = [.../** @type {object[]} */ (groups.get(canonical))].sort(compareOccupancyForSweep);
    if (group.length < 2) continue;

    const kind = group[0].resourceKey.resourceKind;
    const exclusive = exclusiveLocationKeys.has(canonical);
    const findingCode = resolveOverlapFindingCode(kind, { exclusive });
    if (!findingCode) continue;

    // Active sweep: intervals sorted by start; active sorted by end then id.
    /** @type {object[]} */
    const active = [];
    for (const current of group) {
      // Drop non-overlapping completed intervals (half-open: end <= start → no overlap).
      let write = 0;
      for (let i = 0; i < active.length; i += 1) {
        if (active[i].endMs > current.startMs) {
          active[write] = active[i];
          write += 1;
        }
      }
      active.length = write;

      for (const prior of active) {
        if (
          !intervalsOverlap(prior.startMs, prior.endMs, current.startMs, current.endMs)
        ) {
          continue;
        }
        const intersection = intervalIntersection(
          prior.startMs,
          prior.endMs,
          current.startMs,
          current.endMs
        );
        if (!intersection) continue;

        const occupancyIds = [prior.occupancyId, current.occupancyId];
        const assignmentIds = [
          ...activityIdentities(prior),
          ...activityIdentities(current),
        ];
        const priorIdentity = resolveActivityIdentity(prior);
        const currentIdentity = resolveActivityIdentity(current);

        findings.push(
          createResourceFinding({
            code: findingCode,
            resourceKey: current.resourceKey,
            occupancyIds,
            assignmentIds,
            violationStartMs: intersection.startMs,
            violationEndMs: intersection.endMs,
            policyVersion,
            evidence: Object.freeze({
              resourceKeyCanonical: canonical,
              occupancyIdsSorted: Object.freeze(
                [...occupancyIds].sort(compareUtf8Bytewise)
              ),
              activityIdentitiesSorted: Object.freeze(
                [...assignmentIds].sort(compareUtf8Bytewise)
              ),
              intersectionStartMs: intersection.startMs,
              intersectionEndMs: intersection.endMs,
              priorOccupancyId: prior.occupancyId,
              nextOccupancyId: current.occupancyId,
              priorActivityIdentity: priorIdentity.ok
                ? Object.freeze({
                    type: priorIdentity.activityIdentityType,
                    value: priorIdentity.activityIdentityValue,
                  })
                : null,
              nextActivityIdentity: currentIdentity.ok
                ? Object.freeze({
                    type: currentIdentity.activityIdentityType,
                    value: currentIdentity.activityIdentityValue,
                  })
                : null,
              policyVersion,
            }),
          })
        );
      }

      active.push(current);
      active.sort((a, b) => {
        const c1 = compareSafeInteger(a.endMs, b.endMs);
        if (c1 !== 0) return c1;
        return compareUtf8Bytewise(a.occupancyId, b.occupancyId);
      });
    }
  }

  return findings;
}
