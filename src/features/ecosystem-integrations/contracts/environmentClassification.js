/**
 * Deployment environment classification + eligibility (fail-closed).
 * Production credentials are not eligible in Sandbox and vice versa.
 */

import { fail, ok } from "../../../core/platform/index.js";
import { CONNECTOR_ENVIRONMENT_VALUES } from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireEnumMember,
  requireStringArray,
} from "./shared.js";
import { rejectSecretValueFields } from "./secretBoundaryShared.js";

export const ENVIRONMENT_CLASSIFICATION_ERROR = Object.freeze({
  INVALID: "ENVIRONMENT_CLASSIFICATION_INVALID",
  DEPLOYMENT_INVALID: "ENVIRONMENT_CLASSIFICATION_DEPLOYMENT_INVALID",
  CREDENTIAL_ENV_INVALID: "ENVIRONMENT_CLASSIFICATION_CREDENTIAL_ENV_INVALID",
  ELIGIBILITY_INVALID: "ENVIRONMENT_CLASSIFICATION_ELIGIBILITY_INVALID",
  VALUE_FORBIDDEN: "ENVIRONMENT_CLASSIFICATION_VALUE_FORBIDDEN",
});

/**
 * Deterministic eligibility: credential environment must be listed in
 * eligibleEnvironments AND must not cross Production ↔ Sandbox/Test.
 *
 * @param {string} deploymentEnvironment
 * @param {string} credentialEnvironment
 * @param {ReadonlyArray<string>} eligibleEnvironments
 * @returns {{ eligible: boolean, mismatchReason?: string }}
 */
export function evaluateEnvironmentEligibility(
  deploymentEnvironment,
  credentialEnvironment,
  eligibleEnvironments
) {
  if (!eligibleEnvironments.includes(deploymentEnvironment)) {
    return {
      eligible: false,
      mismatchReason: "deployment_not_in_eligible_set",
    };
  }
  if (!eligibleEnvironments.includes(credentialEnvironment)) {
    return {
      eligible: false,
      mismatchReason: "credential_env_not_in_eligible_set",
    };
  }
  if (deploymentEnvironment !== credentialEnvironment) {
    // Strict pairing: Production credentials never eligible outside Production.
    if (
      credentialEnvironment === "PRODUCTION" &&
      deploymentEnvironment !== "PRODUCTION"
    ) {
      return {
        eligible: false,
        mismatchReason: "production_credential_outside_production",
      };
    }
    if (
      deploymentEnvironment === "PRODUCTION" &&
      credentialEnvironment !== "PRODUCTION"
    ) {
      return {
        eligible: false,
        mismatchReason: "non_production_credential_in_production",
      };
    }
    if (
      credentialEnvironment === "SANDBOX" &&
      deploymentEnvironment === "PRODUCTION"
    ) {
      return {
        eligible: false,
        mismatchReason: "sandbox_credential_in_production",
      };
    }
    if (
      deploymentEnvironment === "SANDBOX" &&
      credentialEnvironment === "PRODUCTION"
    ) {
      return {
        eligible: false,
        mismatchReason: "production_credential_in_sandbox",
      };
    }
    return {
      eligible: false,
      mismatchReason: "environment_mismatch",
    };
  }
  return { eligible: true };
}

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createEnvironmentClassification(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        ENVIRONMENT_CLASSIFICATION_ERROR.INVALID,
        "EnvironmentClassification input must be a plain object"
      )
    );
  }

  const valueReject = rejectSecretValueFields(
    input,
    ENVIRONMENT_CLASSIFICATION_ERROR.VALUE_FORBIDDEN,
    "EnvironmentClassification"
  );
  if (valueReject) return valueReject;

  const deploymentEnvironment = requireEnumMember(
    input.deploymentEnvironment ?? input.environment,
    CONNECTOR_ENVIRONMENT_VALUES,
    "deploymentEnvironment",
    ENVIRONMENT_CLASSIFICATION_ERROR.DEPLOYMENT_INVALID,
    "deploymentEnvironment"
  );
  if (!deploymentEnvironment.ok) return deploymentEnvironment;

  const credentialEnvironment = requireEnumMember(
    input.credentialEnvironment ?? input.deploymentEnvironment ?? input.environment,
    CONNECTOR_ENVIRONMENT_VALUES,
    "credentialEnvironment",
    ENVIRONMENT_CLASSIFICATION_ERROR.CREDENTIAL_ENV_INVALID,
    "credentialEnvironment"
  );
  if (!credentialEnvironment.ok) return credentialEnvironment;

  const environmentsRaw =
    input.eligibleEnvironments ??
    input.environmentEligibility ?? [
      deploymentEnvironment.value,
    ];
  const eligibleEnvironments = requireStringArray(
    environmentsRaw,
    "eligibleEnvironments",
    ENVIRONMENT_CLASSIFICATION_ERROR.ELIGIBILITY_INVALID,
    "eligibleEnvironments"
  );
  if (!eligibleEnvironments.ok) return eligibleEnvironments;
  for (const env of eligibleEnvironments.value) {
    if (!CONNECTOR_ENVIRONMENT_VALUES.includes(env)) {
      return fail(
        contractError(
          ENVIRONMENT_CLASSIFICATION_ERROR.ELIGIBILITY_INVALID,
          `eligibleEnvironments contains unsupported value: ${env}`,
          "eligibleEnvironments"
        )
      );
    }
  }

  const evaluation = evaluateEnvironmentEligibility(
    deploymentEnvironment.value,
    credentialEnvironment.value,
    eligibleEnvironments.value
  );

  return ok(
    deepFreeze({
      deploymentEnvironment: deploymentEnvironment.value,
      credentialEnvironment: credentialEnvironment.value,
      eligibleEnvironments: eligibleEnvironments.value,
      eligible: evaluation.eligible,
      ...(evaluation.mismatchReason
        ? { mismatchReason: evaluation.mismatchReason }
        : {}),
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isEnvironmentClassification(value) {
  return createEnvironmentClassification(value).ok === true;
}
