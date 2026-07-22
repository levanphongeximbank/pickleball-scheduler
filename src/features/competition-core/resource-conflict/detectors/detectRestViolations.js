/**
 * CORE-14 Phase 1D — rest detector (PLAYER / TEAM only).
 * Negative gaps are left to the overlap detector (no duplicate rest finding).
 */

import { compareUtf8Bytewise, compareSafeInteger } from "../deterministic/compare.js";
import { serializeCanonicalResourceKey } from "../domain/CanonicalResourceKey.js";
import { resolveActivityIdentity } from "../domain/LogicalAssignmentKey.js";
import { createResourceFinding } from "../domain/ResourceFinding.js";
import { RESOURCE_FINDING_CODE } from "../enums/findingCode.js";
import { REST_MODE, REST_POLICY_VERSION } from "../policy/restPolicy.js";

/**
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function compareOccupancyForRest(a, b) {
  const c1 = compareSafeInteger(a.startMs, b.startMs);
  if (c1 !== 0) return c1;
  const c2 = compareSafeInteger(a.endMs, b.endMs);
  if (c2 !== 0) return c2;
  return compareUtf8Bytewise(a.occupancyId, b.occupancyId);
}

/**
 * @param {object} occupancy
 * @returns {string | null}
 */
function activityKey(occupancy) {
  const identity = resolveActivityIdentity(occupancy);
  if (!identity.ok) return null;
  return `${identity.activityIdentityType}|${identity.activityIdentityValue}`;
}

/**
 * @param {readonly object[]} occupancies
 * @param {{
 *   restPolicy: {
 *     restMode: string,
 *     minimumRestMs: number,
 *     applicableResourceKinds: readonly string[],
 *     policyVersion: string,
 *   },
 * }} options
 * @returns {object[]}
 */
export function detectRestViolations(occupancies, options) {
  const policy = options.restPolicy;
  if (!policy) return [];

  const applicable = new Set(policy.applicableResourceKinds || []);
  const policyVersion = policy.policyVersion || REST_POLICY_VERSION;
  const minimumRestMs = policy.minimumRestMs;
  const list = Array.isArray(occupancies) ? occupancies : [];

  /** @type {Map<string, object[]>} */
  const groups = new Map();
  for (const occ of list) {
    const kind = occ.resourceKey.resourceKind;
    if (!applicable.has(kind)) continue;
    const canonical = serializeCanonicalResourceKey(occ.resourceKey);
    const arr = groups.get(canonical) || [];
    arr.push(occ);
    groups.set(canonical, arr);
  }

  /** @type {object[]} */
  const findings = [];
  const groupKeys = [...groups.keys()].sort(compareUtf8Bytewise);

  for (const canonical of groupKeys) {
    const group = [.../** @type {object[]} */ (groups.get(canonical))].sort(
      compareOccupancyForRest
    );
    for (let i = 0; i < group.length - 1; i += 1) {
      const previous = group[i];
      const next = group[i + 1];
      const prevKey = activityKey(previous);
      const nextKey = activityKey(next);
      if (prevKey && nextKey && prevKey === nextKey) {
        // Same activity — not a consecutive distinct-activity rest pair.
        continue;
      }

      const restGapMs = next.startMs - previous.endMs;
      if (restGapMs < 0) {
        // Overlap root cause owned by overlap detector.
        continue;
      }
      if (restGapMs >= minimumRestMs) {
        continue;
      }

      const code =
        policy.restMode === REST_MODE.MANDATORY
          ? RESOURCE_FINDING_CODE.MANDATORY_REST_VIOLATION
          : RESOURCE_FINDING_CODE.PREFERRED_REST_WARNING;

      const prevIdentity = resolveActivityIdentity(previous);
      const nextIdentity = resolveActivityIdentity(next);
      const assignmentIds = [];
      if (prevIdentity.ok) assignmentIds.push(prevIdentity.activityIdentityValue);
      if (nextIdentity.ok) assignmentIds.push(nextIdentity.activityIdentityValue);

      findings.push(
        createResourceFinding({
          code,
          resourceKey: previous.resourceKey,
          occupancyIds: [previous.occupancyId, next.occupancyId],
          assignmentIds,
          violationStartMs: previous.endMs,
          violationEndMs: next.startMs,
          policyVersion,
          evidence: Object.freeze({
            resourceKeyCanonical: canonical,
            previousOccupancyId: previous.occupancyId,
            nextOccupancyId: next.occupancyId,
            previousActivity: prevIdentity.ok
              ? Object.freeze({
                  type: prevIdentity.activityIdentityType,
                  value: prevIdentity.activityIdentityValue,
                })
              : null,
            nextActivity: nextIdentity.ok
              ? Object.freeze({
                  type: nextIdentity.activityIdentityType,
                  value: nextIdentity.activityIdentityValue,
                })
              : null,
            previousEndMs: previous.endMs,
            nextStartMs: next.startMs,
            actualRestMs: restGapMs,
            requiredRestMs: minimumRestMs,
            restMode: policy.restMode,
            policyVersion,
          }),
        })
      );
    }
  }

  return findings;
}
