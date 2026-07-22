/**
 * CORE-14 Phase 1D — capacity-exceeded detector.
 * Event scan with release-before-acquire at identical timestamps.
 * Emits one finding per maximal contiguous over-capacity interval.
 */

import { compareUtf8Bytewise, compareSafeInteger } from "../deterministic/compare.js";
import { serializeCanonicalResourceKey } from "../domain/CanonicalResourceKey.js";
import { createResourceFinding } from "../domain/ResourceFinding.js";
import {
  CAPACITY_POLICY_VERSION,
  resolveResourceCapacity,
  resolveCapacityFindingCode,
} from "../policy/capacityPolicy.js";

/**
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function compareEvents(a, b) {
  const c1 = compareSafeInteger(a.t, b.t);
  if (c1 !== 0) return c1;
  // Releases (delta < 0) before acquisitions (delta > 0).
  if (a.delta < 0 && b.delta > 0) return -1;
  if (a.delta > 0 && b.delta < 0) return 1;
  const c2 = compareSafeInteger(a.delta, b.delta);
  if (c2 !== 0) return c2;
  return compareUtf8Bytewise(a.occupancyId, b.occupancyId);
}

/**
 * @param {readonly object[]} occupancies
 * @param {{
 *   capacityPolicy: {
 *     capacityByResourceKey: ReadonlyMap<string, number>,
 *     exclusiveLocationKeys: ReadonlySet<string>,
 *     policyVersion?: string,
 *   },
 * }} options
 * @returns {{ findings: object[], diagnostics: object[] }}
 */
export function detectCapacityExceeded(occupancies, options) {
  const list = Array.isArray(occupancies) ? occupancies : [];
  const policy = options.capacityPolicy;
  const policyVersion = policy.policyVersion || CAPACITY_POLICY_VERSION;

  /** @type {Map<string, object[]>} */
  const groups = new Map();
  /** @type {object[]} */
  const diagnostics = [];
  /** @type {Set<string>} */
  const capacityResolved = new Set();

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
    const group = /** @type {object[]} */ (groups.get(canonical));
    const sample = group[0];
    const resolved = resolveResourceCapacity(sample, policy);
    if (!resolved.ok) {
      // Emit fail-closed diagnostics once per resource key.
      if (!capacityResolved.has(canonical)) {
        capacityResolved.add(canonical);
        diagnostics.push(...resolved.diagnostics);
      }
      continue;
    }
    if (resolved.skipCapacityFinding) {
      continue;
    }

    const capacity = resolved.capacity;
    /** @type {object[]} */
    const events = [];
    for (const occ of group) {
      events.push({
        t: occ.startMs,
        delta: occ.capacityUnits,
        occupancyId: occ.occupancyId,
        kind: "acquire",
      });
      events.push({
        t: occ.endMs,
        delta: -occ.capacityUnits,
        occupancyId: occ.occupancyId,
        kind: "release",
      });
    }
    events.sort(compareEvents);

    let activeUnits = 0;
    /** @type {Set<string>} */
    const activeIds = new Set();
    let inViolation = false;
    let violationStartMs = null;
    let peakUnits = 0;
    /** @type {Set<string>} */
    const contributing = new Set();

    const flushViolation = (endMs) => {
      if (!inViolation || violationStartMs == null) return;
      if (violationStartMs >= endMs) {
        inViolation = false;
        violationStartMs = null;
        peakUnits = 0;
        contributing.clear();
        return;
      }
      findings.push(
        createResourceFinding({
          code: resolveCapacityFindingCode(sample.resourceKey.resourceKind),
          resourceKey: sample.resourceKey,
          occupancyIds: [...contributing],
          assignmentIds: [],
          violationStartMs,
          violationEndMs: endMs,
          policyVersion,
          evidence: Object.freeze({
            resourceKeyCanonical: canonical,
            violationStartMs,
            violationEndMs: endMs,
            resourceCapacity: capacity,
            peakCapacityUnits: peakUnits,
            contributingOccupancyIdsSorted: Object.freeze(
              [...contributing].sort(compareUtf8Bytewise)
            ),
            policyVersion,
          }),
        })
      );
      inViolation = false;
      violationStartMs = null;
      peakUnits = 0;
      contributing.clear();
    };

    for (const event of events) {
      if (event.delta < 0) {
        activeUnits += event.delta;
        activeIds.delete(event.occupancyId);
      } else {
        activeUnits += event.delta;
        activeIds.add(event.occupancyId);
      }

      if (activeUnits > capacity) {
        if (!inViolation) {
          inViolation = true;
          violationStartMs = event.t;
          peakUnits = activeUnits;
          for (const id of activeIds) contributing.add(id);
        } else {
          if (activeUnits > peakUnits) peakUnits = activeUnits;
          for (const id of activeIds) contributing.add(id);
        }
      } else if (inViolation) {
        flushViolation(event.t);
      }
    }
  }

  return { findings, diagnostics };
}
