/**
 * CORE-10 Phase 1C-B1 — ConstraintEvaluationPort contract.
 * Synchronous only. No CORE-01 adapter. No database/network behavior.
 * Raw evaluator remains private in a closure — not exposed as a property.
 */

import { CORE10_CONSTRAINT_EVALUATION_PORT_VERSION } from "../constants/versions.js";
import { CANDIDATE_EVALUATION_FAILURE_CODE } from "../enums/candidateEvaluationFailureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { compareStableString } from "../deterministic/compare.js";
import {
  deepFreezeCanonical,
  isPlainObject,
} from "../deterministic/canonicalize.js";
import { createHardViolation } from "../contracts/hardViolation.js";
import { rejectUnknownFields, requireStableId } from "../contracts/shared.js";

const PORT_ALLOWED = Object.freeze([
  "portId",
  "portVersion",
  "evaluateConstraints",
]);

const RESULT_ALLOWED = Object.freeze(["violations", "noteCodes"]);

const INPUT_ALLOWED = Object.freeze([
  "candidateId",
  "operation",
  "assignments",
  "tenantId",
  "competitionId",
  "snapshotFingerprints",
  "facts",
]);

const ASSIGNMENT_ALLOWED = Object.freeze(["variableId", "valueId"]);

const PORT_PUBLIC_KEYS = Object.freeze([
  "portId",
  "portVersion",
  "evaluateConstraints",
]);

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
 * @returns {boolean}
 */
function isThenable(value) {
  return (
    value != null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof /** @type {{ then?: unknown }} */ (value).then === "function"
  );
}

/**
 * @param {unknown} codes
 * @returns {string[]}
 */
function normalizeNoteCodes(codes) {
  if (codes == null) return [];
  if (!Array.isArray(codes)) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT,
      "noteCodes must be an array of stable strings",
      {}
    );
  }
  const source = codes.slice();
  const out = [];
  const seen = new Set();
  for (let i = 0; i < source.length; i += 1) {
    const code = source[i];
    if (typeof code !== "string" || code.trim() === "") {
      throw new OptimizerContractError(
        CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT,
        `noteCodes[${i}] must be a non-empty stable string`,
        { index: i }
      );
    }
    const trimmed = code.trim();
    if (seen.has(trimmed)) {
      throw new OptimizerContractError(
        CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT,
        `Duplicate noteCodes entry: ${trimmed}`,
        { code: trimmed }
      );
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  out.sort(compareStableString);
  return out;
}

/**
 * @param {unknown} raw
 * @returns {Readonly<object>}
 */
function freezePortInput(raw) {
  if (!isPlainObject(raw)) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT,
      "constraint port input must be a plain object",
      {}
    );
  }
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (raw),
    INPUT_ALLOWED,
    "ConstraintPortInput",
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT
  );

  const assignmentsRaw = ownValue(/** @type {object} */ (raw), "assignments");
  if (!Array.isArray(assignmentsRaw)) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT,
      "ConstraintPortInput.assignments must be an array",
      {}
    );
  }

  const assignments = assignmentsRaw.map((item, i) => {
    if (!isPlainObject(item)) {
      throw new OptimizerContractError(
        CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT,
        `ConstraintPortInput.assignments[${i}] must be a plain object`,
        { index: i }
      );
    }
    rejectUnknownFields(
      /** @type {Record<string, unknown>} */ (item),
      ASSIGNMENT_ALLOWED,
      `ConstraintPortInput.assignments[${i}]`,
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT
    );
    return {
      variableId: requireStableId(
        ownValue(/** @type {object} */ (item), "variableId"),
        `assignments[${i}].variableId`,
        CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT
      ),
      valueId: requireStableId(
        ownValue(/** @type {object} */ (item), "valueId"),
        `assignments[${i}].valueId`,
        CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT
      ),
    };
  });
  assignments.sort((a, b) => compareStableString(a.variableId, b.variableId));

  const snapshotFingerprintsRaw = ownValue(
    /** @type {object} */ (raw),
    "snapshotFingerprints"
  );
  if (!Array.isArray(snapshotFingerprintsRaw)) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT,
      "ConstraintPortInput.snapshotFingerprints must be an array",
      {}
    );
  }
  const snapshotFingerprints = snapshotFingerprintsRaw.map((fp, i) =>
    requireStableId(
      fp,
      `snapshotFingerprints[${i}]`,
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT
    )
  );

  const factsRaw = Object.prototype.hasOwnProperty.call(raw, "facts")
    ? ownValue(/** @type {object} */ (raw), "facts")
    : {};
  const facts = factsRaw == null ? {} : factsRaw;
  if (!isPlainObject(facts)) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT,
      "ConstraintPortInput.facts must be a plain object when present",
      {}
    );
  }

  return /** @type {Readonly<object>} */ (
    deepFreezeCanonical(
      {
        candidateId: requireStableId(
          ownValue(/** @type {object} */ (raw), "candidateId"),
          "ConstraintPortInput.candidateId",
          CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT
        ),
        operation: requireStableId(
          ownValue(/** @type {object} */ (raw), "operation"),
          "ConstraintPortInput.operation",
          CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT
        ),
        assignments,
        tenantId: requireStableId(
          ownValue(/** @type {object} */ (raw), "tenantId"),
          "ConstraintPortInput.tenantId",
          CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT
        ),
        competitionId: requireStableId(
          ownValue(/** @type {object} */ (raw), "competitionId"),
          "ConstraintPortInput.competitionId",
          CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT
        ),
        snapshotFingerprints,
        facts,
      },
      "ConstraintPortInput"
    )
  );
}

/**
 * @param {unknown} rawResult
 * @returns {Readonly<{ violations: ReadonlyArray<object>, noteCodes: ReadonlyArray<string> }>}
 */
function validatePortResult(rawResult) {
  if (!isPlainObject(rawResult)) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT,
      "constraint port result must be a plain object { violations, noteCodes? }",
      {}
    );
  }
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (rawResult),
    RESULT_ALLOWED,
    "ConstraintPortResult",
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT
  );

  if (!Object.prototype.hasOwnProperty.call(rawResult, "violations")) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT,
      "ConstraintPortResult.violations is required",
      {}
    );
  }

  const violationsRaw = ownValue(/** @type {object} */ (rawResult), "violations");
  if (!Array.isArray(violationsRaw)) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT,
      "ConstraintPortResult.violations must be an array",
      {}
    );
  }

  // Copy before mapping — never retain aliases into evaluator arrays.
  const violationsSource = violationsRaw.slice();
  const violations = violationsSource.map((item, i) => {
    try {
      return createHardViolation(
        item && typeof item === "object"
          ? { .../** @type {object} */ (item) }
          : {}
      );
    } catch (err) {
      if (err instanceof OptimizerContractError) {
        throw new OptimizerContractError(
          CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT,
          `ConstraintPortResult.violations[${i}] invalid`,
          { index: i, causeCode: err.code }
        );
      }
      throw err;
    }
  });

  const noteCodes = normalizeNoteCodes(
    Object.prototype.hasOwnProperty.call(rawResult, "noteCodes")
      ? ownValue(/** @type {object} */ (rawResult), "noteCodes")
      : undefined
  );

  return Object.freeze({
    violations: Object.freeze(violations),
    noteCodes: Object.freeze(noteCodes),
  });
}

/**
 * Internal guard used by CandidateEvaluationDependencies.
 * Accepts only frozen wrappers produced by createConstraintEvaluationPort.
 * @param {unknown} port
 * @returns {boolean}
 */
export function isConstraintEvaluationPort(port) {
  if (port == null || typeof port !== "object" || Array.isArray(port)) {
    return false;
  }
  if (!Object.isFrozen(port)) return false;
  const expectedKeys = [...PORT_PUBLIC_KEYS].sort(compareStableString);
  const keys = Object.keys(/** @type {object} */ (port)).sort(
    compareStableString
  );
  if (keys.length !== expectedKeys.length) return false;
  for (let i = 0; i < expectedKeys.length; i += 1) {
    if (keys[i] !== expectedKeys[i]) return false;
  }
  const portId = ownValue(/** @type {object} */ (port), "portId");
  const portVersion = ownValue(/** @type {object} */ (port), "portVersion");
  const evaluateConstraints = ownValue(
    /** @type {object} */ (port),
    "evaluateConstraints"
  );
  return (
    typeof portId === "string" &&
    portId.trim() !== "" &&
    typeof portVersion === "string" &&
    portVersion.trim() !== "" &&
    typeof evaluateConstraints === "function"
  );
}

/**
 * Create a frozen ConstraintEvaluationPort wrapping a synchronous evaluator.
 * The raw evaluator is closed over and is not exposed as a port property.
 *
 * @param {object} [partial]
 * @returns {Readonly<{
 *   portId: string,
 *   portVersion: string,
 *   evaluateConstraints: (input: unknown) => Readonly<{
 *     violations: ReadonlyArray<object>,
 *     noteCodes: ReadonlyArray<string>,
 *   }>,
 * }>}
 */
export function createConstraintEvaluationPort(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_INVALID,
      "ConstraintEvaluationPort must be a plain object",
      {}
    );
  }

  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    PORT_ALLOWED,
    "ConstraintEvaluationPort",
    CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_INVALID
  );

  const portId = requireStableId(
    ownValue(partial, "portId"),
    "ConstraintEvaluationPort.portId",
    CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_INVALID
  );
  const portVersion = requireStableId(
    ownValue(partial, "portVersion") ?? CORE10_CONSTRAINT_EVALUATION_PORT_VERSION,
    "ConstraintEvaluationPort.portVersion",
    CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_INVALID
  );

  const evaluator = ownValue(partial, "evaluateConstraints");
  if (typeof evaluator !== "function") {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_INVALID,
      "ConstraintEvaluationPort.evaluateConstraints must be a function",
      { portId }
    );
  }

  /**
   * Controlled evaluate method — not the raw evaluator reference.
   * @param {unknown} rawInput
   */
  function evaluateConstraints(rawInput) {
    const frozenInput = freezePortInput(rawInput);

    let rawResult;
    try {
      rawResult = /** @type {Function} */ (evaluator)(frozenInput);
    } catch (err) {
      if (err instanceof OptimizerContractError) {
        throw err;
      }
      throw new OptimizerContractError(
        CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_EXCEPTION,
        "Constraint evaluation port threw an exception",
        { portId, portVersion }
      );
    }

    if (isThenable(rawResult)) {
      throw new OptimizerContractError(
        CANDIDATE_EVALUATION_FAILURE_CODE.ASYNC_CONSTRAINT_PORT_UNSUPPORTED,
        "Async constraint evaluation ports are unsupported in Phase 1C-B1",
        { portId, portVersion }
      );
    }

    return validatePortResult(rawResult);
  }

  return Object.freeze({
    portId,
    portVersion,
    evaluateConstraints,
  });
}
