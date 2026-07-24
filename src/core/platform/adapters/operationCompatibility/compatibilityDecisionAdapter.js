/**
 * Compatibility Decision Adapter — projects an externally resolved
 * compatibility outcome into Platform Core CompatibilityDecision.
 *
 * Does not compare versions, infer compatibility, migrate, select fallbacks,
 * inspect schemas, load a version registry, or alter decisionCode beyond
 * canonical contract trimming.
 */

import { fail } from "../../contracts/result.js";
import { createCompatibilityDecision } from "../../contracts/compatibilityDecision.js";
import { projectContractVersion } from "./contractVersionAdapter.js";

export const COMPATIBILITY_DECISION_ADAPTER_ERROR = Object.freeze({
  INVALID: "COMPATIBILITY_DECISION_ADAPTER_INVALID",
  COMPATIBLE_REQUIRED: "COMPATIBILITY_DECISION_ADAPTER_COMPATIBLE_REQUIRED",
  DECISION_CODE_REQUIRED:
    "COMPATIBILITY_DECISION_ADAPTER_DECISION_CODE_REQUIRED",
  CURRENT_VERSION_INVALID:
    "COMPATIBILITY_DECISION_ADAPTER_CURRENT_VERSION_INVALID",
  REQUIRED_VERSION_INVALID:
    "COMPATIBILITY_DECISION_ADAPTER_REQUIRED_VERSION_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function adapterError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * Project an already-resolved compatibility outcome.
 *
 * Expects explicit `compatible` (strict boolean) and `decisionCode`.
 * Optional currentVersion / requiredVersion are projected through
 * projectContractVersion when supplied.
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectCompatibilityDecision(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      adapterError(
        COMPATIBILITY_DECISION_ADAPTER_ERROR.INVALID,
        "Compatibility decision input must be a plain object"
      )
    );
  }

  if (!("compatible" in input) || input.compatible === undefined) {
    return fail(
      adapterError(
        COMPATIBILITY_DECISION_ADAPTER_ERROR.COMPATIBLE_REQUIRED,
        "Compatibility decision projection requires an explicit compatible boolean",
        "compatible"
      )
    );
  }

  if (!("decisionCode" in input) || input.decisionCode === undefined) {
    return fail(
      adapterError(
        COMPATIBILITY_DECISION_ADAPTER_ERROR.DECISION_CODE_REQUIRED,
        "Compatibility decision projection requires an explicit decisionCode",
        "decisionCode"
      )
    );
  }

  /** @type {{
   *   compatible: *,
   *   decisionCode: *,
   *   currentVersion?: *,
   *   requiredVersion?: *,
   *   reason?: *,
   * }} */
  const payload = {
    compatible: input.compatible,
    decisionCode: input.decisionCode,
  };

  if ("currentVersion" in input && input.currentVersion !== undefined) {
    const currentResult = projectContractVersion(input.currentVersion);
    if (!currentResult.ok) {
      return fail(
        adapterError(
          COMPATIBILITY_DECISION_ADAPTER_ERROR.CURRENT_VERSION_INVALID,
          "Compatibility decision currentVersion must be a valid ContractVersion",
          "currentVersion"
        )
      );
    }
    payload.currentVersion = currentResult.value;
  }

  if ("requiredVersion" in input && input.requiredVersion !== undefined) {
    const requiredResult = projectContractVersion(input.requiredVersion);
    if (!requiredResult.ok) {
      return fail(
        adapterError(
          COMPATIBILITY_DECISION_ADAPTER_ERROR.REQUIRED_VERSION_INVALID,
          "Compatibility decision requiredVersion must be a valid ContractVersion",
          "requiredVersion"
        )
      );
    }
    payload.requiredVersion = requiredResult.value;
  }

  if ("reason" in input && input.reason !== undefined) {
    payload.reason = input.reason;
  }

  return createCompatibilityDecision(payload);
}
