/**
 * CORE-19 — workflow definition contract / factory / assertion.
 *
 * Future CORE-18 standings adapter expectation (not implemented here):
 * STANDINGS_UNRESOLVED_TIE may be non-blocking only when standings result is ok,
 * typedErrors is empty, a complete deterministic final ranking exists, and every
 * entry has a stable final position. It must block workflow completion when no
 * complete deterministic final ordering exists. CORE-19 must never implement a
 * replacement tie-break.
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { WorkflowError } from "../errors/WorkflowError.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";
import { createWorkflowStep } from "./workflowStep.js";
import { createWorkflowTransitionDefinition } from "./workflowTransition.js";

/**
 * @typedef {Object} WorkflowDefinition
 * @property {string} definitionId
 * @property {string} definitionVersion
 * @property {string|null} [name]
 * @property {ReadonlyArray<import('./workflowStep.js').WorkflowStep>} steps
 * @property {ReadonlyArray<import('./workflowTransition.js').WorkflowTransitionDefinition>} transitions
 * @property {Readonly<Record<string, unknown>>} [metadata]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<WorkflowDefinition>}
 */
export function createWorkflowDefinition(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION,
      "WorkflowDefinition must be a plain object",
      {}
    );
  }

  const definitionId = isNonEmptyString(partial.definitionId)
    ? String(partial.definitionId).trim()
    : "";
  const definitionVersion = isNonEmptyString(partial.definitionVersion)
    ? String(partial.definitionVersion).trim()
    : "";
  if (!definitionId || !definitionVersion) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION,
      "definitionId and definitionVersion are required",
      { definitionId, definitionVersion }
    );
  }

  if (!Array.isArray(partial.steps) || partial.steps.length === 0) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION,
      "WorkflowDefinition.steps must be a non-empty array",
      {}
    );
  }
  if (!Array.isArray(partial.transitions)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION,
      "WorkflowDefinition.transitions must be an array",
      {}
    );
  }

  const steps = partial.steps.map((step) => createWorkflowStep(step));
  const stepIds = new Set(steps.map((s) => s.stepId));
  if (stepIds.size !== steps.length) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION,
      "WorkflowDefinition.steps must have unique stepId values",
      {}
    );
  }

  const transitions = partial.transitions.map((t) =>
    createWorkflowTransitionDefinition(t)
  );
  const transitionIds = new Set(transitions.map((t) => t.transitionId));
  if (transitionIds.size !== transitions.length) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION,
      "WorkflowDefinition.transitions must have unique transitionId values",
      {}
    );
  }

  for (const transition of transitions) {
    if (!stepIds.has(transition.fromStepId) || !stepIds.has(transition.toStepId)) {
      throw new WorkflowError(
        WORKFLOW_ERROR_CODE.INVALID_WORKFLOW_DEFINITION,
        "Transition step references must exist in definition.steps",
        {
          transitionId: transition.transitionId,
          fromStepId: transition.fromStepId,
          toStepId: transition.toStepId,
        }
      );
    }
  }

  return Object.freeze({
    definitionId,
    definitionVersion,
    name:
      partial.name == null || partial.name === ""
        ? null
        : String(partial.name),
    steps: Object.freeze([...steps]),
    transitions: Object.freeze([...transitions]),
    metadata: Object.freeze(
      /** @type {Record<string, unknown>} */ (
        deepFreezeClone(
          isPlainObject(partial.metadata) ? partial.metadata : {}
        )
      )
    ),
  });
}

/**
 * @param {unknown} value
 * @returns {Readonly<WorkflowDefinition>}
 */
export function assertWorkflowDefinition(value) {
  return createWorkflowDefinition(value);
}

/**
 * @param {Readonly<WorkflowDefinition>} definition
 * @param {string} transitionId
 * @returns {import('./workflowTransition.js').WorkflowTransitionDefinition|null}
 */
export function findWorkflowTransitionById(definition, transitionId) {
  const id = String(transitionId || "").trim();
  if (!id || !definition || !Array.isArray(definition.transitions)) return null;
  return definition.transitions.find((t) => t.transitionId === id) || null;
}

/**
 * @param {Readonly<WorkflowDefinition>} definition
 * @param {string} stepId
 * @returns {import('./workflowStep.js').WorkflowStep|null}
 */
export function findWorkflowStepById(definition, stepId) {
  const id = String(stepId || "").trim();
  if (!id || !definition || !Array.isArray(definition.steps)) return null;
  return definition.steps.find((s) => s.stepId === id) || null;
}
