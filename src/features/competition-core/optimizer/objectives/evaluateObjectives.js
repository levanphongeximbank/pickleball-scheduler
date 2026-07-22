/**
 * CORE-10 Phase 1C-A — ordered multi-objective evaluation.
 *
 * Execution order is exactly the caller-supplied executionSpecs array order.
 * Registry insertion order is ignored. Specs are never auto-sorted or mutated.
 *
 * Empty executionSpecs: returns an empty frozen array; no evaluator is invoked.
 * Duplicate ID/version pairs are rejected before any evaluator runs.
 * Failures throw immediately — no partial-success envelope in Phase 1C-A.
 */

import { OBJECTIVE_EVALUATION_FAILURE_CODE } from "../enums/objectiveEvaluationFailureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { createObjectiveExecutionSpec } from "../contracts/objectiveExecutionSpec.js";
import { evaluateObjective } from "./evaluateObjective.js";

/**
 * @param {string} objectiveId
 * @param {string} objectiveVersion
 * @returns {string}
 */
function executionKey(objectiveId, objectiveVersion) {
  // Internal only — not a registry key. Specs already validated as distinct pairs.
  return `${objectiveId}\u0000${objectiveVersion}`;
}

/**
 * Evaluate objectives in declared executionSpecs order.
 *
 * @param {object} args
 * @param {{ resolve: Function }} args.registry
 * @param {readonly object[]} args.executionSpecs
 * @param {unknown} [args.evaluationInput]
 * @returns {ReadonlyArray<object>}
 */
export function evaluateObjectives({
  registry,
  executionSpecs,
  evaluationInput = {},
}) {
  if (!Array.isArray(executionSpecs)) {
    throw new OptimizerContractError(
      OBJECTIVE_EVALUATION_FAILURE_CODE.INVALID_OBJECTIVE_EXECUTION_SPEC,
      "executionSpecs must be an array",
      {}
    );
  }

  if (executionSpecs.length === 0) {
    return Object.freeze([]);
  }

  // Phase 1: validate specs + reject duplicates before any evaluator runs.
  const seen = new Set();
  /** @type {object[]} */
  const specs = [];
  for (let i = 0; i < executionSpecs.length; i += 1) {
    const spec = createObjectiveExecutionSpec(executionSpecs[i]);
    const key = executionKey(spec.objectiveId, spec.objectiveVersion);
    if (seen.has(key)) {
      throw new OptimizerContractError(
        OBJECTIVE_EVALUATION_FAILURE_CODE.DUPLICATE_OBJECTIVE_EXECUTION,
        `Duplicate objective in executionSpecs: ${spec.objectiveId}@${spec.objectiveVersion}`,
        {
          objectiveId: spec.objectiveId,
          objectiveVersion: spec.objectiveVersion,
          index: i,
        }
      );
    }
    seen.add(key);
    specs.push(spec);
  }

  // Phase 2: synchronous sequential evaluation; stop on first failure.
  /** @type {object[]} */
  const records = [];
  for (let i = 0; i < specs.length; i += 1) {
    records.push(
      evaluateObjective({
        registry,
        executionSpec: specs[i],
        evaluationInput,
        executionIndex: i,
      })
    );
  }

  return Object.freeze(records);
}
