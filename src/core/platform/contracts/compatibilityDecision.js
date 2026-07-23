/**
 * Compatibility Decision contract (Platform Core Phase 1F–1J).
 *
 * Represents a compatibility outcome already produced by an external
 * evaluator. Does not compare versions, migrate, upgrade, or infer
 * compatibility.
 */

import { fail, ok } from "./result.js";
import { createContractVersion } from "./contractVersion.js";

/**
 * @typedef {{
 *   compatible: boolean,
 *   decisionCode: string,
 *   currentVersion?: string,
 *   requiredVersion?: string,
 *   reason?: string,
 * }} CompatibilityDecision
 */

export const COMPATIBILITY_DECISION_ERROR = Object.freeze({
  INVALID: "COMPATIBILITY_DECISION_INVALID",
  COMPATIBLE_INVALID: "COMPATIBILITY_DECISION_COMPATIBLE_INVALID",
  CODE_INVALID: "COMPATIBILITY_DECISION_CODE_INVALID",
  CURRENT_VERSION_INVALID: "COMPATIBILITY_DECISION_CURRENT_VERSION_INVALID",
  REQUIRED_VERSION_INVALID: "COMPATIBILITY_DECISION_REQUIRED_VERSION_INVALID",
  REASON_INVALID: "COMPATIBILITY_DECISION_REASON_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function compatibilityDecisionError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * @param {*} input
 * @returns {import("./result.js").Result}
 */
export function createCompatibilityDecision(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      compatibilityDecisionError(
        COMPATIBILITY_DECISION_ERROR.INVALID,
        "CompatibilityDecision input must be a plain object"
      )
    );
  }

  if (!("compatible" in input) || typeof input.compatible !== "boolean") {
    return fail(
      compatibilityDecisionError(
        COMPATIBILITY_DECISION_ERROR.COMPATIBLE_INVALID,
        "CompatibilityDecision compatible must be a boolean",
        "compatible"
      )
    );
  }

  if (typeof input.decisionCode !== "string") {
    return fail(
      compatibilityDecisionError(
        COMPATIBILITY_DECISION_ERROR.CODE_INVALID,
        "CompatibilityDecision decisionCode must be a string",
        "decisionCode"
      )
    );
  }

  const decisionCode = input.decisionCode.trim();
  if (decisionCode.length === 0) {
    return fail(
      compatibilityDecisionError(
        COMPATIBILITY_DECISION_ERROR.CODE_INVALID,
        "CompatibilityDecision decisionCode must be a non-empty string",
        "decisionCode"
      )
    );
  }

  /** @type {CompatibilityDecision} */
  const decision = {
    compatible: input.compatible,
    decisionCode,
  };

  if ("currentVersion" in input && input.currentVersion !== undefined) {
    const currentVersionResult = createContractVersion(input.currentVersion);
    if (!currentVersionResult.ok) {
      return fail(
        compatibilityDecisionError(
          COMPATIBILITY_DECISION_ERROR.CURRENT_VERSION_INVALID,
          "CompatibilityDecision currentVersion must be a valid ContractVersion",
          "currentVersion"
        )
      );
    }
    decision.currentVersion = currentVersionResult.value;
  }

  if ("requiredVersion" in input && input.requiredVersion !== undefined) {
    const requiredVersionResult = createContractVersion(input.requiredVersion);
    if (!requiredVersionResult.ok) {
      return fail(
        compatibilityDecisionError(
          COMPATIBILITY_DECISION_ERROR.REQUIRED_VERSION_INVALID,
          "CompatibilityDecision requiredVersion must be a valid ContractVersion",
          "requiredVersion"
        )
      );
    }
    decision.requiredVersion = requiredVersionResult.value;
  }

  if ("reason" in input && input.reason !== undefined) {
    if (typeof input.reason !== "string") {
      return fail(
        compatibilityDecisionError(
          COMPATIBILITY_DECISION_ERROR.REASON_INVALID,
          "CompatibilityDecision reason must be a string",
          "reason"
        )
      );
    }

    const reason = input.reason.trim();
    if (reason.length === 0) {
      return fail(
        compatibilityDecisionError(
          COMPATIBILITY_DECISION_ERROR.REASON_INVALID,
          "CompatibilityDecision reason must be a non-empty string",
          "reason"
        )
      );
    }
    decision.reason = reason;
  }

  return ok(Object.freeze(decision));
}

/**
 * @param {*} value
 * @returns {value is CompatibilityDecision}
 */
export function isCompatibilityDecision(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (
    typeof value.compatible !== "boolean" ||
    typeof value.decisionCode !== "string"
  ) {
    return false;
  }
  return createCompatibilityDecision(value).ok === true;
}
