/**
 * CORE-10 Phase 1C-B1 — CandidateEvaluationDependencies (runtime-only).
 * Not replay-safe fingerprint material. No default registry/port. No singleton.
 * Accepts only frozen Phase 1C-A registry API and frozen Phase 1C-B1 port wrappers.
 */

import { CORE10_CANDIDATE_EVALUATION_DEPENDENCIES_VERSION } from "../constants/versions.js";
import { CANDIDATE_EVALUATION_FAILURE_CODE } from "../enums/candidateEvaluationFailureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { compareStableString } from "../deterministic/compare.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { rejectUnknownFields } from "./shared.js";
import { isConstraintEvaluationPort } from "../ports/constraintEvaluationPort.js";

const ALLOWED = Object.freeze([
  "objectiveRegistry",
  "constraintEvaluationPort",
  "dependenciesVersion",
]);

const REGISTRY_KEYS = Object.freeze([
  "descriptorFingerprint",
  "has",
  "listDefinitions",
  "resolve",
]);

const FAIL =
  CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_DEPENDENCIES;

/**
 * @param {object} obj
 * @param {string} key
 * @returns {unknown}
 */
function ownValue(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

/**
 * Exact Phase 1C-A public registry surface: frozen object with own API methods.
 * @param {unknown} registry
 * @returns {boolean}
 */
function isObjectiveRegistryApi(registry) {
  if (registry == null || typeof registry !== "object" || Array.isArray(registry)) {
    return false;
  }
  if (!Object.isFrozen(registry)) return false;
  const keys = Object.keys(/** @type {object} */ (registry)).sort(
    compareStableString
  );
  if (keys.length !== REGISTRY_KEYS.length) return false;
  for (let i = 0; i < REGISTRY_KEYS.length; i += 1) {
    if (keys[i] !== REGISTRY_KEYS[i]) return false;
  }
  return (
    typeof ownValue(/** @type {object} */ (registry), "resolve") ===
      "function" &&
    typeof ownValue(/** @type {object} */ (registry), "has") === "function" &&
    typeof ownValue(/** @type {object} */ (registry), "listDefinitions") ===
      "function" &&
    typeof ownValue(
      /** @type {object} */ (registry),
      "descriptorFingerprint"
    ) === "function"
  );
}

/**
 * Runtime dependency guard. Freezes the wrapper only — does not clone functions
 * through canonical serialization and does not fingerprint function identity.
 *
 * @param {object} [partial]
 * @returns {Readonly<{
 *   dependenciesVersion: string,
 *   objectiveRegistry: object,
 *   constraintEvaluationPort: object,
 * }>}
 */
export function createCandidateEvaluationDependencies(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationDependencies must be a plain object",
      {}
    );
  }

  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "CandidateEvaluationDependencies",
    FAIL
  );

  const dependenciesVersion =
    ownValue(partial, "dependenciesVersion") == null
      ? CORE10_CANDIDATE_EVALUATION_DEPENDENCIES_VERSION
      : ownValue(partial, "dependenciesVersion");
  if (dependenciesVersion !== CORE10_CANDIDATE_EVALUATION_DEPENDENCIES_VERSION) {
    throw new OptimizerContractError(
      FAIL,
      `Unsupported dependenciesVersion: ${dependenciesVersion}`,
      {
        dependenciesVersion,
        expected: CORE10_CANDIDATE_EVALUATION_DEPENDENCIES_VERSION,
      }
    );
  }

  if (!Object.prototype.hasOwnProperty.call(partial, "objectiveRegistry")) {
    throw new OptimizerContractError(FAIL, "objectiveRegistry is required", {});
  }
  const objectiveRegistry = ownValue(partial, "objectiveRegistry");
  if (objectiveRegistry == null) {
    throw new OptimizerContractError(FAIL, "objectiveRegistry is required", {});
  }
  if (!isObjectiveRegistryApi(objectiveRegistry)) {
    throw new OptimizerContractError(
      FAIL,
      "objectiveRegistry must be a frozen Phase 1C-A registry API object",
      {}
    );
  }

  if (
    !Object.prototype.hasOwnProperty.call(partial, "constraintEvaluationPort")
  ) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_UNAVAILABLE,
      "constraintEvaluationPort is required",
      {}
    );
  }
  const constraintEvaluationPort = ownValue(
    partial,
    "constraintEvaluationPort"
  );
  if (constraintEvaluationPort == null) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_UNAVAILABLE,
      "constraintEvaluationPort is required",
      {}
    );
  }
  if (!isConstraintEvaluationPort(constraintEvaluationPort)) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_INVALID,
      "constraintEvaluationPort must be a frozen Phase 1C-B1 port wrapper",
      {}
    );
  }

  return Object.freeze({
    dependenciesVersion: CORE10_CANDIDATE_EVALUATION_DEPENDENCIES_VERSION,
    objectiveRegistry,
    constraintEvaluationPort,
  });
}
