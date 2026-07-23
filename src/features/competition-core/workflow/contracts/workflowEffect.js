/**
 * CORE-19 — transition effect descriptor and result contracts.
 * Pure descriptors only; no network, persistence, or external execution.
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { WorkflowError } from "../errors/WorkflowError.js";
import {
  compareStableString,
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";

export const WORKFLOW_EFFECT_STATUS = Object.freeze({
  PENDING: "PENDING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
});

/** @type {ReadonlySet<string>} */
export const WORKFLOW_EFFECT_STATUS_VALUES = new Set(
  Object.values(WORKFLOW_EFFECT_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isWorkflowEffectStatus(value) {
  return typeof value === "string" && WORKFLOW_EFFECT_STATUS_VALUES.has(value);
}

/**
 * @typedef {Object} WorkflowEffectDescriptor
 * @property {string} effectId
 * @property {string} effectType
 * @property {boolean} required
 * @property {string|null} [dependency]
 * @property {Readonly<Record<string, unknown>>} [input]
 * @property {number} [order]
 * @property {string|null} [idempotencyKey]
 */

/**
 * @typedef {Object} WorkflowEffectResult
 * @property {string} effectId
 * @property {string} status
 * @property {boolean} ok
 * @property {Readonly<Record<string, unknown>>|null} [output]
 * @property {Readonly<Record<string, unknown>>|null} [error]
 * @property {string|null} [warning]
 * @property {string|null} [dependencyCode]
 * @property {string|null} [explanation]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<WorkflowEffectDescriptor>}
 */
export function createWorkflowEffectDescriptor(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_EFFECT_DEFINITION,
      "WorkflowEffectDescriptor must be a plain object",
      {}
    );
  }

  const effectId = isNonEmptyString(partial.effectId)
    ? String(partial.effectId).trim()
    : "";
  const effectType = isNonEmptyString(partial.effectType)
    ? String(partial.effectType).trim()
    : "";
  if (!effectId || !effectType) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.INVALID_EFFECT_DEFINITION,
      "effectId and effectType are required",
      { effectId, effectType }
    );
  }

  const orderRaw = Number(partial.order);
  const order = Number.isFinite(orderRaw) ? orderRaw : 0;

  return Object.freeze({
    effectId,
    effectType,
    required: partial.required !== false,
    dependency:
      partial.dependency == null || partial.dependency === ""
        ? null
        : String(partial.dependency),
    input: Object.freeze(
      /** @type {Record<string, unknown>} */ (
        deepFreezeClone(isPlainObject(partial.input) ? partial.input : {})
      )
    ),
    order,
    idempotencyKey:
      partial.idempotencyKey == null || partial.idempotencyKey === ""
        ? null
        : String(partial.idempotencyKey),
  });
}

/**
 * @param {unknown} value
 * @returns {Readonly<WorkflowEffectDescriptor>}
 */
export function assertWorkflowEffectDescriptor(value) {
  return createWorkflowEffectDescriptor(value);
}

/**
 * @param {unknown} partial
 * @returns {Readonly<WorkflowEffectResult>}
 */
export function createWorkflowEffectResult(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.TRANSITION_EFFECT_FAILED,
      "WorkflowEffectResult must be a plain object",
      {}
    );
  }

  const effectId = isNonEmptyString(partial.effectId)
    ? String(partial.effectId).trim()
    : "";
  if (!effectId) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.TRANSITION_EFFECT_FAILED,
      "effectId is required on WorkflowEffectResult",
      {}
    );
  }

  let status = isNonEmptyString(partial.status)
    ? String(partial.status).trim().toUpperCase()
    : partial.ok === true
      ? WORKFLOW_EFFECT_STATUS.SUCCEEDED
      : WORKFLOW_EFFECT_STATUS.FAILED;

  if (!isWorkflowEffectStatus(status)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODE.TRANSITION_EFFECT_FAILED,
      "Invalid workflow effect status",
      { status: partial.status }
    );
  }

  const ok =
    partial.ok === true ||
    (partial.ok == null && status === WORKFLOW_EFFECT_STATUS.SUCCEEDED);

  return Object.freeze({
    effectId,
    status,
    ok: ok === true && status === WORKFLOW_EFFECT_STATUS.SUCCEEDED,
    output:
      partial.output == null
        ? null
        : Object.freeze(
            /** @type {Record<string, unknown>} */ (
              deepFreezeClone(
                isPlainObject(partial.output) ? partial.output : { value: partial.output }
              )
            )
          ),
    error:
      partial.error == null
        ? null
        : Object.freeze(
            /** @type {Record<string, unknown>} */ (
              deepFreezeClone(
                isPlainObject(partial.error)
                  ? partial.error
                  : { message: String(partial.error) }
              )
            )
          ),
    warning:
      partial.warning == null || partial.warning === ""
        ? null
        : String(partial.warning),
    dependencyCode:
      partial.dependencyCode == null || partial.dependencyCode === ""
        ? null
        : String(partial.dependencyCode),
    explanation:
      partial.explanation == null || partial.explanation === ""
        ? null
        : String(partial.explanation),
  });
}

/**
 * Stable deterministic ordering: order asc, then effectId asc.
 * @param {ReadonlyArray<WorkflowEffectDescriptor>} descriptors
 * @returns {ReadonlyArray<WorkflowEffectDescriptor>}
 */
export function sortWorkflowEffectDescriptors(descriptors) {
  return Object.freeze(
    [...descriptors].sort((a, b) => {
      const orderCmp = Number(a.order) - Number(b.order);
      if (orderCmp !== 0) return orderCmp;
      return compareStableString(a.effectId, b.effectId);
    })
  );
}
