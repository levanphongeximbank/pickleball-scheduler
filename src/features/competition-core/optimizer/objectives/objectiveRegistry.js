/**
 * CORE-10 Phase 1C-A — immutable objective registry.
 * Nested Map keyed by objectiveId → objectiveVersion (collision-safe).
 * No module-level singleton. Descriptor fingerprint excludes evaluator functions.
 */

import {
  CORE10_OBJECTIVE_DEFINITION_SCHEMA_VERSION,
  CORE10_OBJECTIVE_REGISTRY_VERSION,
} from "../constants/versions.js";
import { OBJECTIVE_EVALUATION_FAILURE_CODE } from "../enums/objectiveEvaluationFailureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { compareStableString } from "../deterministic/compare.js";
import { fingerprintValue } from "../deterministic/fingerprint.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { createObjectiveDefinition } from "../contracts/objectiveDefinition.js";

/**
 * @param {Readonly<object>} a
 * @param {Readonly<object>} b
 * @returns {number}
 */
function compareDefinitions(a, b) {
  const byId = compareStableString(a.objectiveId, b.objectiveId);
  if (byId !== 0) return byId;
  return compareStableString(a.objectiveVersion, b.objectiveVersion);
}

/**
 * Owned immutable clone of a frozen definition (no shared nested aliases).
 * @param {object} definition
 * @returns {Readonly<object>}
 */
function cloneDefinitionOwned(definition) {
  return createObjectiveDefinition({
    objectiveId: definition.objectiveId,
    objectiveVersion: definition.objectiveVersion,
    direction: definition.direction,
    evaluatorRef: definition.evaluatorRef,
    requiredContextRefs: [...definition.requiredContextRefs],
    normalizationPolicy: definition.normalizationPolicy,
    metadataCodes: [...definition.metadataCodes],
  });
}

/**
 * Build an immutable objective registry from entry descriptors.
 * Each entry: { definition, evaluator }.
 * Caller entry objects are not mutated.
 *
 * @param {readonly object[]} [entries]
 * @returns {Readonly<{
 *   resolve: (objectiveId: string, objectiveVersion: string) => { definition: object, evaluator: Function },
 *   has: (objectiveId: string, objectiveVersion: string) => boolean,
 *   listDefinitions: () => ReadonlyArray<object>,
 *   descriptorFingerprint: () => string,
 * }>}
 */
export function createObjectiveRegistry(entries = []) {
  if (!Array.isArray(entries)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_DEFINITION,
      "createObjectiveRegistry entries must be an array",
      {}
    );
  }

  /** @type {Map<string, Map<string, { definition: object, evaluator: Function }>>} */
  const byId = new Map();

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!isPlainObject(entry)) {
      throw new OptimizerContractError(
        OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_DEFINITION,
        `Registry entry[${i}] must be a plain object`,
        { index: i }
      );
    }

    // Owned definition — do not retain caller object reference.
    const definitionInput = Object.prototype.hasOwnProperty.call(entry, "definition")
      ? entry.definition
      : {};
    const definition = createObjectiveDefinition(
      definitionInput && typeof definitionInput === "object"
        ? { .../** @type {object} */ (definitionInput) }
        : {}
    );
    const evaluator = Object.prototype.hasOwnProperty.call(entry, "evaluator")
      ? entry.evaluator
      : undefined;

    if (typeof evaluator !== "function") {
      throw new OptimizerContractError(
        OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATOR_MISSING,
        `Registry entry[${i}] evaluator must be a function`,
        {
          index: i,
          objectiveId: definition.objectiveId,
          objectiveVersion: definition.objectiveVersion,
        }
      );
    }

    let byVersion = byId.get(definition.objectiveId);
    if (!byVersion) {
      byVersion = new Map();
      byId.set(definition.objectiveId, byVersion);
    }
    if (byVersion.has(definition.objectiveVersion)) {
      throw new OptimizerContractError(
        OBJECTIVE_EVALUATION_FAILURE_CODE.DUPLICATE_OBJECTIVE_REGISTRATION,
        `Duplicate objective registration: ${definition.objectiveId}@${definition.objectiveVersion}`,
        {
          objectiveId: definition.objectiveId,
          objectiveVersion: definition.objectiveVersion,
        }
      );
    }

    // Internal entry frozen; never exposed mutably.
    byVersion.set(
      definition.objectiveVersion,
      Object.freeze({ definition, evaluator })
    );
  }

  /** @type {object[]} */
  const allDefinitions = [];
  for (const versionMap of byId.values()) {
    for (const entry of versionMap.values()) {
      allDefinitions.push(entry.definition);
    }
  }
  allDefinitions.sort(compareDefinitions);
  const sortedDefinitions = Object.freeze(allDefinitions);

  const fingerprintMaterial = Object.freeze({
    objectiveDefinitionSchemaVersion: CORE10_OBJECTIVE_DEFINITION_SCHEMA_VERSION,
    objectiveRegistryVersion: CORE10_OBJECTIVE_REGISTRY_VERSION,
    definitions: sortedDefinitions.map((d) => ({
      objectiveId: d.objectiveId,
      objectiveVersion: d.objectiveVersion,
      direction: d.direction,
      evaluatorRef: d.evaluatorRef,
      requiredContextRefs: [...d.requiredContextRefs],
      normalizationPolicy: d.normalizationPolicy,
      metadataCodes: [...d.metadataCodes],
    })),
  });

  const cachedFingerprint = fingerprintValue(fingerprintMaterial);

  const api = Object.freeze({
    /**
     * Returns an owned frozen wrapper. Definition is an owned clone.
     * Evaluator function reference is returned (runtime-only; not serializable).
     * @param {string} objectiveId
     * @param {string} objectiveVersion
     * @returns {{ definition: object, evaluator: Function }}
     */
    resolve(objectiveId, objectiveVersion) {
      if (typeof objectiveId !== "string" || objectiveId.trim() === "") {
        throw new OptimizerContractError(
          OBJECTIVE_EVALUATION_FAILURE_CODE.UNKNOWN_OBJECTIVE,
          "objectiveId required for registry resolve",
          { objectiveId: objectiveId ?? null }
        );
      }
      if (typeof objectiveVersion !== "string" || objectiveVersion.trim() === "") {
        throw new OptimizerContractError(
          OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_VERSION_MISMATCH,
          "objectiveVersion required for registry resolve",
          { objectiveId, objectiveVersion: objectiveVersion ?? null }
        );
      }
      const id = objectiveId.trim();
      const ver = objectiveVersion.trim();
      const versionMap = byId.get(id);
      if (!versionMap) {
        throw new OptimizerContractError(
          OBJECTIVE_EVALUATION_FAILURE_CODE.UNKNOWN_OBJECTIVE,
          `Unknown objective: ${id}@${ver}`,
          { objectiveId: id, objectiveVersion: ver }
        );
      }
      const found = versionMap.get(ver);
      if (!found) {
        throw new OptimizerContractError(
          OBJECTIVE_EVALUATION_FAILURE_CODE.OBJECTIVE_VERSION_MISMATCH,
          `Objective version mismatch for ${id}: ${ver}`,
          { objectiveId: id, objectiveVersion: ver }
        );
      }
      // Owned definition clone — caller cannot mutate internal registry state.
      return Object.freeze({
        definition: cloneDefinitionOwned(found.definition),
        evaluator: found.evaluator,
      });
    },

    /**
     * @param {string} objectiveId
     * @param {string} objectiveVersion
     * @returns {boolean}
     */
    has(objectiveId, objectiveVersion) {
      if (typeof objectiveId !== "string" || typeof objectiveVersion !== "string") {
        return false;
      }
      const versionMap = byId.get(objectiveId.trim());
      if (!versionMap) return false;
      return versionMap.has(objectiveVersion.trim());
    },

    /**
     * Immutable deterministically sorted owned copies of definitions only.
     * Evaluator functions are never included.
     * @returns {ReadonlyArray<object>}
     */
    listDefinitions() {
      return Object.freeze(sortedDefinitions.map((d) => cloneDefinitionOwned(d)));
    },

    /**
     * Fingerprint of objective definitions + schema/registry versions only.
     * Insertion-order independent. Evaluator function source never included.
     * @returns {string}
     */
    descriptorFingerprint() {
      return cachedFingerprint;
    },
  });

  return api;
}
