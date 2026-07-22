/**
 * CORE-10 Phase 1C-B1 — deterministic HardViolation composition.
 */

import { CANDIDATE_EVALUATION_FAILURE_CODE } from "../enums/candidateEvaluationFailureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { compareStableString } from "../deterministic/compare.js";
import { serializeCanonical } from "../deterministic/fingerprint.js";
import { createHardViolation } from "../contracts/hardViolation.js";

/**
 * Identity key material — canonical serialization (no delimiter joining).
 * @param {object} violation
 * @returns {string}
 */
function identityKey(violation) {
  return serializeCanonical({
    sourceModule: violation.sourceModule,
    sourceVersion: violation.sourceVersion,
    violationCode: violation.violationCode,
    constraintId: violation.constraintId,
    affectedIds: [...violation.affectedIds],
  });
}

/**
 * @param {object} violation
 * @returns {string}
 */
function detailsKey(violation) {
  return serializeCanonical([...violation.detailsCodes]);
}

/**
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function compareHardViolations(a, b) {
  let c = compareStableString(a.sourceModule, b.sourceModule);
  if (c !== 0) return c;
  c = compareStableString(a.sourceVersion, b.sourceVersion);
  if (c !== 0) return c;
  c = compareStableString(a.violationCode, b.violationCode);
  if (c !== 0) return c;
  c = compareStableString(a.constraintId, b.constraintId);
  if (c !== 0) return c;
  c = compareStableString(
    serializeCanonical([...a.affectedIds]),
    serializeCanonical([...b.affectedIds])
  );
  if (c !== 0) return c;
  if (a.magnitude !== b.magnitude) return a.magnitude - b.magnitude;
  c = compareStableString(a.messageCode, b.messageCode);
  if (c !== 0) return c;
  return compareStableString(detailsKey(a), detailsKey(b));
}

/**
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
function isExactDuplicate(a, b) {
  return (
    a.sourceModule === b.sourceModule &&
    a.sourceVersion === b.sourceVersion &&
    a.violationCode === b.violationCode &&
    a.constraintId === b.constraintId &&
    a.magnitude === b.magnitude &&
    a.messageCode === b.messageCode &&
    a.severity === b.severity &&
    serializeCanonical([...a.affectedIds]) ===
      serializeCanonical([...b.affectedIds]) &&
    detailsKey(a) === detailsKey(b)
  );
}

/**
 * Compose validated HardViolation arrays into one immutable ordered array.
 * Caller arrays are never mutated. Exact duplicates are deduplicated.
 * Conflicting magnitude / messageCode / detailsCodes fail closed.
 *
 * @param {...readonly object[]} groups
 * @returns {ReadonlyArray<object>}
 */
export function composeHardViolations(...groups) {
  /** @type {object[]} */
  const collected = [];

  for (let g = 0; g < groups.length; g += 1) {
    const group = groups[g];
    if (!Array.isArray(group)) {
      throw new OptimizerContractError(
        CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_HARD_VIOLATION,
        `composeHardViolations group[${g}] must be an array`,
        { index: g }
      );
    }
    // Copy before iteration — never mutate caller array.
    const source = group.slice();
    for (let i = 0; i < source.length; i += 1) {
      const item = source[i];
      collected.push(
        createHardViolation(
          item && typeof item === "object"
            ? { .../** @type {object} */ (item) }
            : {}
        )
      );
    }
  }

  if (collected.length === 0) {
    return Object.freeze([]);
  }

  collected.sort(compareHardViolations);

  /** @type {object[]} */
  const out = [];
  /** @type {Map<string, object>} */
  const byIdentity = new Map();

  for (const violation of collected) {
    const key = identityKey(violation);
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, violation);
      out.push(violation);
      continue;
    }
    if (isExactDuplicate(existing, violation)) {
      // Exact duplicate — keep the first (already sorted).
      continue;
    }
    if (existing.magnitude !== violation.magnitude) {
      throw new OptimizerContractError(
        CANDIDATE_EVALUATION_FAILURE_CODE.HARD_VIOLATION_MAGNITUDE_CONFLICT,
        "Hard violation identity key has conflicting magnitude",
        {
          sourceModule: violation.sourceModule,
          violationCode: violation.violationCode,
          constraintId: violation.constraintId,
          magnitudes: [existing.magnitude, violation.magnitude],
        }
      );
    }
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.DUPLICATE_HARD_VIOLATION,
      "Hard violation identity key has conflicting messageCode or detailsCodes",
      {
        sourceModule: violation.sourceModule,
        violationCode: violation.violationCode,
        constraintId: violation.constraintId,
      }
    );
  }

  return Object.freeze(out);
}
