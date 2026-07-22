/**
 * CORE-13 — deterministic input fingerprint *preparation* (Phase 1B).
 * Does not compute final assignment-plan fingerprints (Phase 1D).
 */

import { compareStableString, sortedObjectKeys } from "./compare.js";
import { deepFreezeCanonical, isPlainObject } from "./canonicalize.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";

/**
 * Project a value into a canonical structure suitable for later fingerprinting.
 * Object keys are sorted; arrays preserve order unless options.sortArray=true.
 *
 * @param {unknown} value
 * @param {object} [options]
 * @param {boolean} [options.sortArray]
 * @returns {unknown}
 */
export function prepareFingerprintMaterial(value, options = {}) {
  const frozen = deepFreezeCanonical(value);
  if (!options.sortArray) {
    return frozen;
  }
  return sortArraysDeep(frozen);
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sortArraysDeep(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    const mapped = value.map(sortArraysDeep);
    const allStrings = mapped.every((item) => typeof item === "string");
    if (allStrings) {
      return Object.freeze([...mapped].sort(compareStableString));
    }
    return Object.freeze(mapped);
  }
  if (!isPlainObject(value)) return value;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of sortedObjectKeys(/** @type {Record<string, unknown>} */ (value))) {
    out[key] = sortArraysDeep(
      /** @type {Record<string, unknown>} */ (value)[key]
    );
  }
  return Object.freeze(out);
}

/**
 * Build a stable key→value projection for request/context material.
 * Rejects non-plain roots.
 *
 * @param {Record<string, unknown>} obj
 * @returns {Readonly<Record<string, unknown>>}
 */
export function prepareCanonicalObjectProjection(obj) {
  if (!isPlainObject(obj)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      "Fingerprint projection root must be a plain object",
      {}
    );
  }
  return /** @type {Readonly<Record<string, unknown>>} */ (
    prepareFingerprintMaterial(obj)
  );
}
