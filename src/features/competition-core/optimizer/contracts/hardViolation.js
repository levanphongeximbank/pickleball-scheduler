/**
 * CORE-10 Phase 1C-B1 — HardViolation contract (replay-safe).
 * Sibling to Phase 1B ConstraintEvaluation — that contract is unchanged.
 * Own-property reads only. No free-text human message, localized strings, or stacks.
 */

import { CONSTRAINT_KIND } from "../enums/constraintKind.js";
import { CANDIDATE_EVALUATION_FAILURE_CODE } from "../enums/candidateEvaluationFailureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { compareStableString } from "../deterministic/compare.js";
import {
  deepFreezeCanonical,
  isPlainObject,
} from "../deterministic/canonicalize.js";
import { rejectUnknownFields, requireStableId } from "./shared.js";

const ALLOWED = Object.freeze([
  "violationCode",
  "constraintId",
  "sourceModule",
  "sourceVersion",
  "severity",
  "affectedIds",
  "magnitude",
  "messageCode",
  "detailsCodes",
]);

const FAIL = CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_HARD_VIOLATION;

/**
 * @param {object} obj
 * @param {string} key
 * @returns {unknown}
 */
function ownValue(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requireNonNegativeSafeInt(value, field) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new OptimizerContractError(
      FAIL,
      `${field} must be a non-negative safe integer`,
      { field, value: value ?? null }
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

/**
 * Copy, reject duplicates, stable-sort. Never mutates caller array.
 * @param {unknown} codes
 * @param {string} field
 * @returns {string[]}
 */
function normalizeStableIdList(codes, field) {
  if (codes == null) {
    throw new OptimizerContractError(FAIL, `${field} is required`, { field });
  }
  if (!Array.isArray(codes)) {
    throw new OptimizerContractError(
      FAIL,
      `${field} must be an array of stable strings`,
      { field }
    );
  }
  const source = codes.slice();
  const out = [];
  const seen = new Set();
  for (let i = 0; i < source.length; i += 1) {
    const code = source[i];
    if (typeof code !== "string" || code.trim() === "") {
      throw new OptimizerContractError(
        FAIL,
        `${field}[${i}] must be a non-empty stable string`,
        { field, index: i }
      );
    }
    const trimmed = code.trim();
    if (seen.has(trimmed)) {
      throw new OptimizerContractError(
        FAIL,
        `Duplicate entry in ${field}: ${trimmed}`,
        { field, code: trimmed }
      );
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  out.sort(compareStableString);
  return out;
}

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createHardViolation(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "HardViolation must be a plain object",
      {}
    );
  }

  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "HardViolation",
    FAIL
  );

  const severity = ownValue(partial, "severity");
  if (severity !== CONSTRAINT_KIND.HARD) {
    throw new OptimizerContractError(
      FAIL,
      `HardViolation.severity must be exactly ${CONSTRAINT_KIND.HARD}`,
      { severity: severity ?? null }
    );
  }

  const detailsCodesRaw = Object.prototype.hasOwnProperty.call(
    partial,
    "detailsCodes"
  )
    ? ownValue(partial, "detailsCodes")
    : [];

  return /** @type {Readonly<object>} */ (
    deepFreezeCanonical(
      {
        violationCode: requireStableId(
          ownValue(partial, "violationCode"),
          "HardViolation.violationCode",
          FAIL
        ),
        constraintId: requireStableId(
          ownValue(partial, "constraintId"),
          "HardViolation.constraintId",
          FAIL
        ),
        sourceModule: requireStableId(
          ownValue(partial, "sourceModule"),
          "HardViolation.sourceModule",
          FAIL
        ),
        sourceVersion: requireStableId(
          ownValue(partial, "sourceVersion"),
          "HardViolation.sourceVersion",
          FAIL
        ),
        severity: CONSTRAINT_KIND.HARD,
        affectedIds: normalizeStableIdList(
          ownValue(partial, "affectedIds"),
          "HardViolation.affectedIds"
        ),
        magnitude: requireNonNegativeSafeInt(
          ownValue(partial, "magnitude"),
          "HardViolation.magnitude"
        ),
        messageCode: requireStableId(
          ownValue(partial, "messageCode"),
          "HardViolation.messageCode",
          FAIL
        ),
        detailsCodes: normalizeStableIdList(
          detailsCodesRaw,
          "HardViolation.detailsCodes"
        ),
      },
      "HardViolation"
    )
  );
}
