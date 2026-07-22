/**
 * CORE-14 Phase 1E — root-conflict continuity key.
 *
 * Exact finding ID equality tracks identity including violation intervals.
 * Continuity key tracks materially equivalent root conflicts excluding the
 * exact violation interval so a small time shift that leaves the same
 * resources overlapping is not falsely reported as resolved.
 *
 * Does not change the Phase 1D finding ID contract.
 */

import { CORE14_FP_V1 } from "../constants/versions.js";
import { sortIdentifiers, compareUtf8Bytewise } from "../deterministic/compare.js";
import { fingerprintValue } from "../deterministic/fingerprint.js";
import {
  createCanonicalResourceKey,
  serializeCanonicalResourceKey,
} from "../domain/CanonicalResourceKey.js";
import { resolveActivityIdentity } from "../domain/LogicalAssignmentKey.js";

export const ROOT_CONFLICT_CONTINUITY_VERSION = "core14-root-conflict-continuity-v1";
export const CORE14_RCK_V1 = "CORE14_RCK_V1";

/**
 * Build sorted logical assignment / activity identity tokens for a finding.
 * Prefers assignmentIds on the finding; falls back to occupancy activity identity
 * when occupancy lookup map is supplied.
 *
 * @param {object} finding
 * @param {ReadonlyMap<string, object> | null} [occupancyById]
 * @returns {string[]}
 */
export function collectLogicalIdentityTokens(finding, occupancyById = null) {
  const tokens = [];
  const assignmentIds = Array.isArray(finding?.assignmentIds) ? finding.assignmentIds : [];
  for (const id of assignmentIds) {
    if (typeof id === "string" && id.length > 0) {
      tokens.push(`ASSIGNMENT_ID:${id}`);
    }
  }
  if (tokens.length === 0 && occupancyById && Array.isArray(finding?.occupancyIds)) {
    for (const occId of finding.occupancyIds) {
      const occ = occupancyById.get(occId);
      if (!occ) continue;
      const identity = resolveActivityIdentity(occ);
      if (identity.ok) {
        tokens.push(`${identity.activityIdentityType}:${identity.activityIdentityValue}`);
      }
    }
  }
  return sortIdentifiers(tokens);
}

/**
 * Deterministic root-conflict continuity key.
 * Excludes violationStartMs / violationEndMs.
 *
 * @param {object} finding
 * @param {{ occupancyById?: ReadonlyMap<string, object> | null }} [options]
 * @returns {string}
 */
export function createRootConflictContinuityKey(finding, options = {}) {
  const resourceKeyCanonical = finding?.resourceKey
    ? serializeCanonicalResourceKey(createCanonicalResourceKey(finding.resourceKey))
    : "";
  const logicalIdentities = collectLogicalIdentityTokens(
    finding,
    options.occupancyById ?? null
  );
  const material = {
    continuityVersion: ROOT_CONFLICT_CONTINUITY_VERSION,
    fingerprintVersion: CORE14_FP_V1,
    findingCode: finding?.code ?? null,
    resourceKeyCanonical,
    logicalIdentities,
    policyVersion: finding?.policyVersion ?? null,
    reasonCode: finding?.reasonCode ?? null,
  };
  const hex = fingerprintValue(material, { includeMetadata: false });
  return `${CORE14_RCK_V1}:${hex}`;
}

/**
 * Compare baseline vs projected findings using exact IDs and continuity keys.
 *
 * @param {readonly object[]} baselineFindings
 * @param {readonly object[]} projectedFindings
 * @param {{
 *   targetConflictIds?: readonly string[],
 *   baselineOccupancyById?: ReadonlyMap<string, object> | null,
 *   projectedOccupancyById?: ReadonlyMap<string, object> | null,
 * }} [options]
 */
export function compareFindingsWithContinuity(
  baselineFindings,
  projectedFindings,
  options = {}
) {
  const baseline = Array.isArray(baselineFindings) ? baselineFindings : [];
  const projected = Array.isArray(projectedFindings) ? projectedFindings : [];
  const targetIds = new Set(options.targetConflictIds || []);

  const baselineById = new Map(baseline.map((f) => [f.findingId, f]));
  const projectedById = new Map(projected.map((f) => [f.findingId, f]));

  const baselineContinuity = new Map();
  for (const f of baseline) {
    const key = createRootConflictContinuityKey(f, {
      occupancyById: options.baselineOccupancyById ?? null,
    });
    if (!baselineContinuity.has(key)) baselineContinuity.set(key, []);
    baselineContinuity.get(key).push(f);
  }

  const projectedContinuity = new Map();
  for (const f of projected) {
    const key = createRootConflictContinuityKey(f, {
      occupancyById: options.projectedOccupancyById ?? null,
    });
    if (!projectedContinuity.has(key)) projectedContinuity.set(key, []);
    projectedContinuity.get(key).push(f);
  }

  /** Exact ID secondary: in projected, not in baseline */
  const secondaryConflictIds = [];
  for (const id of projectedById.keys()) {
    if (!baselineById.has(id)) secondaryConflictIds.push(id);
  }
  secondaryConflictIds.sort(compareUtf8Bytewise);

  /** Exact ID resolved: in baseline, not in projected */
  const exactResolvedIds = [];
  for (const id of baselineById.keys()) {
    if (!projectedById.has(id)) exactResolvedIds.push(id);
  }
  exactResolvedIds.sort(compareUtf8Bytewise);

  /**
   * Material continuity: a baseline target is still open if its continuity key
   * remains present in projected findings (even when findingId changed).
   */
  const unresolvedConflictIds = [];
  const resolvedConflictIds = [];
  const targets =
    targetIds.size > 0
      ? baseline.filter((f) => targetIds.has(f.findingId))
      : baseline;

  for (const f of targets) {
    const continuityKey = createRootConflictContinuityKey(f, {
      occupancyById: options.baselineOccupancyById ?? null,
    });
    const stillPresentById = projectedById.has(f.findingId);
    const stillPresentByContinuity = projectedContinuity.has(continuityKey);
    if (stillPresentById || stillPresentByContinuity) {
      unresolvedConflictIds.push(f.findingId);
    } else {
      resolvedConflictIds.push(f.findingId);
    }
  }
  unresolvedConflictIds.sort(compareUtf8Bytewise);
  resolvedConflictIds.sort(compareUtf8Bytewise);

  /**
   * Continuity-based secondary: projected continuity keys absent from baseline.
   * Used to avoid classifying unchanged pre-existing conflicts as secondary when
   * only the finding ID changed.
   */
  const secondaryByContinuityIds = [];
  for (const [key, findings] of projectedContinuity.entries()) {
    if (!baselineContinuity.has(key)) {
      for (const f of findings) {
        secondaryByContinuityIds.push(f.findingId);
      }
    }
  }
  secondaryByContinuityIds.sort(compareUtf8Bytewise);

  return Object.freeze({
    exactResolvedIds: Object.freeze(exactResolvedIds),
    resolvedConflictIds: Object.freeze(resolvedConflictIds),
    unresolvedConflictIds: Object.freeze(unresolvedConflictIds),
    secondaryConflictIds: Object.freeze(secondaryConflictIds),
    secondaryByContinuityIds: Object.freeze(secondaryByContinuityIds),
    originalConflictsResolved: unresolvedConflictIds.length === 0 && targets.length > 0
      ? true
      : unresolvedConflictIds.length === 0 && targets.length === 0
        ? true
        : unresolvedConflictIds.length === 0,
  });
}
