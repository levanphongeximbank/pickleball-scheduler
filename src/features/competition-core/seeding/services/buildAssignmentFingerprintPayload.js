import { deepFreeze } from "../domain/deepFreeze.js";

/**
 * Canonical JSON with sorted object keys for deterministic fingerprint payloads.
 * Arrays preserve order (caller must supply already-deterministic array order).
 *
 * @param {unknown} value
 * @returns {string}
 */
export function stringifyCanonicalJson(value) {
  return JSON.stringify(sortKeysDeep(value));
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sortKeysDeep(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sortKeysDeep(item));
  }
  const obj = /** @type {Record<string, unknown>} */ (value);
  const keys = Object.keys(obj).sort();
  /** @type {Record<string, unknown>} */
  const out = {};
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    out[key] = sortKeysDeep(obj[key]);
  }
  return out;
}

/**
 * Build assignment-level fingerprint payload (excludes generatedAt).
 *
 * @param {import('../domain/createSeedAssignment.js').SeedAssignment} assignment
 * @returns {Readonly<Record<string, unknown>>}
 */
export function buildAssignmentFingerprintPayload(assignment) {
  return deepFreeze({
    entryId: assignment.entryId,
    seedNumber: assignment.seedNumber,
    assignmentSource: assignment.assignmentSource,
    scoreValuesUsed: assignment.scoreValuesUsed,
    orderedTieBreakValues: assignment.orderedTieBreakValues,
    policyId: assignment.policyId,
    policyVersion: assignment.policyVersion,
    snapshotId: assignment.snapshotId,
    overrideId: assignment.overrideId,
    reasonCodes: assignment.reasonCodes,
    deterministicOrdinal: assignment.deterministicOrdinal,
  });
}
