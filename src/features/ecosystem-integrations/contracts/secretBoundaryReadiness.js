/**
 * Deterministic secret-boundary readiness projection.
 * Consumes presence flags + environment eligibility — never secret values.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  CONNECTOR_ENVIRONMENT_VALUES,
  CREDENTIAL_PRESENCE,
  CREDENTIAL_PRESENCE_VALUES,
  CREDENTIAL_REQUIREMENT_VALUES,
  ENVIRONMENT_CLASS,
  ENVIRONMENT_CLASS_VALUES,
  SECRET_BOUNDARY_READINESS,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireBoolean,
  requireEnumMember,
  requireNonEmptyString,
} from "./shared.js";
import { rejectSecretValueFields } from "./secretBoundaryShared.js";
import { evaluateEnvironmentEligibility } from "./environmentClassification.js";

export const SECRET_BOUNDARY_READINESS_ERROR = Object.freeze({
  INVALID: "SECRET_BOUNDARY_READINESS_INVALID",
  CONNECTOR_INVALID: "SECRET_BOUNDARY_READINESS_CONNECTOR_INVALID",
  FLAG_INVALID: "SECRET_BOUNDARY_READINESS_FLAG_INVALID",
  ENV_INVALID: "SECRET_BOUNDARY_READINESS_ENV_INVALID",
  CLASS_INVALID: "SECRET_BOUNDARY_READINESS_CLASS_INVALID",
  PRESENCE_INVALID: "SECRET_BOUNDARY_READINESS_PRESENCE_INVALID",
  REQUIREMENT_INVALID: "SECRET_BOUNDARY_READINESS_REQUIREMENT_INVALID",
  VALUE_FORBIDDEN: "SECRET_BOUNDARY_READINESS_VALUE_FORBIDDEN",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function projectSecretBoundaryReadiness(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        SECRET_BOUNDARY_READINESS_ERROR.INVALID,
        "SecretBoundaryReadiness input must be a plain object"
      )
    );
  }

  const valueReject = rejectSecretValueFields(
    input,
    SECRET_BOUNDARY_READINESS_ERROR.VALUE_FORBIDDEN,
    "SecretBoundaryReadiness"
  );
  if (valueReject) return valueReject;

  const connectorId = requireNonEmptyString(
    input.connectorId,
    "connectorId",
    SECRET_BOUNDARY_READINESS_ERROR.CONNECTOR_INVALID,
    "connectorId"
  );
  if (!connectorId.ok) return connectorId;

  const requirement = requireEnumMember(
    input.requirement ?? "REQUIRED",
    CREDENTIAL_REQUIREMENT_VALUES,
    "requirement",
    SECRET_BOUNDARY_READINESS_ERROR.REQUIREMENT_INVALID,
    "requirement"
  );
  if (!requirement.ok) return requirement;

  const classification = requireEnumMember(
    input.classification ?? ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
    ENVIRONMENT_CLASS_VALUES,
    "classification",
    SECRET_BOUNDARY_READINESS_ERROR.CLASS_INVALID,
    "classification"
  );
  if (!classification.ok) return classification;

  const presence = requireEnumMember(
    input.presence ?? CREDENTIAL_PRESENCE.UNKNOWN,
    CREDENTIAL_PRESENCE_VALUES,
    "presence",
    SECRET_BOUNDARY_READINESS_ERROR.PRESENCE_INVALID,
    "presence"
  );
  if (!presence.ok) return presence;

  const deploymentEnvironment = requireEnumMember(
    input.deploymentEnvironment ?? input.environment ?? "TEST",
    CONNECTOR_ENVIRONMENT_VALUES,
    "deploymentEnvironment",
    SECRET_BOUNDARY_READINESS_ERROR.ENV_INVALID,
    "deploymentEnvironment"
  );
  if (!deploymentEnvironment.ok) return deploymentEnvironment;

  const credentialEnvironment = requireEnumMember(
    input.credentialEnvironment ?? deploymentEnvironment.value,
    CONNECTOR_ENVIRONMENT_VALUES,
    "credentialEnvironment",
    SECRET_BOUNDARY_READINESS_ERROR.ENV_INVALID,
    "credentialEnvironment"
  );
  if (!credentialEnvironment.ok) return credentialEnvironment;

  const eligibleEnvironments = Array.isArray(input.eligibleEnvironments)
    ? input.eligibleEnvironments
    : [deploymentEnvironment.value];

  for (const env of eligibleEnvironments) {
    if (
      typeof env !== "string" ||
      !CONNECTOR_ENVIRONMENT_VALUES.includes(env)
    ) {
      return fail(
        contractError(
          SECRET_BOUNDARY_READINESS_ERROR.ENV_INVALID,
          `eligibleEnvironments contains unsupported value: ${String(env)}`,
          "eligibleEnvironments"
        )
      );
    }
  }

  const environmentEligibleInput = requireBoolean(
    input.environmentEligible ??
      evaluateEnvironmentEligibility(
        deploymentEnvironment.value,
        credentialEnvironment.value,
        eligibleEnvironments
      ).eligible,
    "environmentEligible",
    SECRET_BOUNDARY_READINESS_ERROR.FLAG_INVALID
  );
  if (!environmentEligibleInput.ok) return environmentEligibleInput;

  /** @type {string} */
  let readinessStatus = SECRET_BOUNDARY_READINESS.READY;
  /** @type {string|undefined} */
  let reason;

  if (
    classification.value === ENVIRONMENT_CLASS.BROWSER_EXPOSED_SECRET_RISK ||
    classification.value === ENVIRONMENT_CLASS.UNSAFE_LOGGING ||
    classification.value === ENVIRONMENT_CLASS.DIRECT_ENV_ACCESS
  ) {
    readinessStatus = SECRET_BOUNDARY_READINESS.CLASSIFICATION_UNSAFE;
    reason = "unsafe_classification";
  } else if (!environmentEligibleInput.value) {
    readinessStatus = SECRET_BOUNDARY_READINESS.BLOCKED_ENVIRONMENT;
    reason = "environment_not_eligible";
  } else if (requirement.value === "REQUIRED") {
    if (
      presence.value === CREDENTIAL_PRESENCE.ABSENT ||
      presence.value === CREDENTIAL_PRESENCE.UNKNOWN
    ) {
      readinessStatus = SECRET_BOUNDARY_READINESS.MISSING_CREDENTIAL;
      reason = "credential_required_missing";
    } else if (presence.value === CREDENTIAL_PRESENCE.REDACTED) {
      readinessStatus = SECRET_BOUNDARY_READINESS.READY;
    }
  } else if (
    requirement.value === "OPTIONAL" &&
    presence.value === CREDENTIAL_PRESENCE.UNKNOWN
  ) {
    readinessStatus = SECRET_BOUNDARY_READINESS.DEGRADED;
    reason = "optional_credential_unknown";
  }

  if (
    "degradedReason" in input &&
    input.degradedReason !== undefined &&
    readinessStatus === SECRET_BOUNDARY_READINESS.READY
  ) {
    const degraded = requireNonEmptyString(
      input.degradedReason,
      "degradedReason",
      SECRET_BOUNDARY_READINESS_ERROR.FLAG_INVALID,
      "degradedReason"
    );
    if (!degraded.ok) return degraded;
    readinessStatus = SECRET_BOUNDARY_READINESS.DEGRADED;
    reason = degraded.value;
  }

  return ok(
    deepFreeze({
      connectorId: connectorId.value,
      requirement: requirement.value,
      classification: classification.value,
      presence: presence.value,
      deploymentEnvironment: deploymentEnvironment.value,
      credentialEnvironment: credentialEnvironment.value,
      eligibleEnvironments: Object.freeze([...eligibleEnvironments]),
      environmentEligible: environmentEligibleInput.value,
      readinessStatus,
      ...(reason ? { reason } : {}),
    })
  );
}
