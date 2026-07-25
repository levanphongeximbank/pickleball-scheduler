/**
 * Credential requirement descriptor — declares what is needed, never the value.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  CONNECTOR_ENVIRONMENT_VALUES,
  CREDENTIAL_REQUIREMENT_DESCRIPTOR_VERSION,
  CREDENTIAL_REQUIREMENT_VALUES,
  ENVIRONMENT_CLASS,
  ENVIRONMENT_CLASS_VALUES,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireEnumMember,
  requireNonEmptyString,
  requireStringArray,
} from "./shared.js";
import { rejectSecretValueFields } from "./secretBoundaryShared.js";
import { createSecretReference } from "./secretReference.js";

export const CREDENTIAL_REQUIREMENT_DESCRIPTOR_ERROR = Object.freeze({
  INVALID: "CREDENTIAL_REQUIREMENT_DESCRIPTOR_INVALID",
  ID_INVALID: "CREDENTIAL_REQUIREMENT_DESCRIPTOR_ID_INVALID",
  REQUIREMENT_INVALID: "CREDENTIAL_REQUIREMENT_DESCRIPTOR_REQUIREMENT_INVALID",
  CLASS_INVALID: "CREDENTIAL_REQUIREMENT_DESCRIPTOR_CLASS_INVALID",
  ENV_INVALID: "CREDENTIAL_REQUIREMENT_DESCRIPTOR_ENV_INVALID",
  REFERENCE_INVALID: "CREDENTIAL_REQUIREMENT_DESCRIPTOR_REFERENCE_INVALID",
  VALUE_FORBIDDEN: "CREDENTIAL_REQUIREMENT_DESCRIPTOR_VALUE_FORBIDDEN",
  CONNECTOR_INVALID: "CREDENTIAL_REQUIREMENT_DESCRIPTOR_CONNECTOR_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createCredentialRequirementDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        CREDENTIAL_REQUIREMENT_DESCRIPTOR_ERROR.INVALID,
        "CredentialRequirementDescriptor input must be a plain object"
      )
    );
  }

  const valueReject = rejectSecretValueFields(
    input,
    CREDENTIAL_REQUIREMENT_DESCRIPTOR_ERROR.VALUE_FORBIDDEN,
    "CredentialRequirementDescriptor"
  );
  if (valueReject) return valueReject;

  const credentialId = requireNonEmptyString(
    input.credentialId,
    "credentialId",
    CREDENTIAL_REQUIREMENT_DESCRIPTOR_ERROR.ID_INVALID,
    "credentialId"
  );
  if (!credentialId.ok) return credentialId;

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? CREDENTIAL_REQUIREMENT_DESCRIPTOR_VERSION,
    "contractVersion",
    CREDENTIAL_REQUIREMENT_DESCRIPTOR_ERROR.INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const connectorId = requireNonEmptyString(
    input.connectorId,
    "connectorId",
    CREDENTIAL_REQUIREMENT_DESCRIPTOR_ERROR.CONNECTOR_INVALID,
    "connectorId"
  );
  if (!connectorId.ok) return connectorId;

  const requirement = requireEnumMember(
    input.requirement ?? "REQUIRED",
    CREDENTIAL_REQUIREMENT_VALUES,
    "requirement",
    CREDENTIAL_REQUIREMENT_DESCRIPTOR_ERROR.REQUIREMENT_INVALID,
    "requirement"
  );
  if (!requirement.ok) return requirement;

  const classification = requireEnumMember(
    input.classification ?? ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
    ENVIRONMENT_CLASS_VALUES,
    "classification",
    CREDENTIAL_REQUIREMENT_DESCRIPTOR_ERROR.CLASS_INVALID,
    "classification"
  );
  if (!classification.ok) return classification;

  const environmentsRaw =
    input.eligibleEnvironments ?? input.environmentEligibility ?? ["TEST", "SANDBOX"];
  const eligibleEnvironments = requireStringArray(
    environmentsRaw,
    "eligibleEnvironments",
    CREDENTIAL_REQUIREMENT_DESCRIPTOR_ERROR.ENV_INVALID,
    "eligibleEnvironments"
  );
  if (!eligibleEnvironments.ok) return eligibleEnvironments;
  for (const env of eligibleEnvironments.value) {
    if (!CONNECTOR_ENVIRONMENT_VALUES.includes(env)) {
      return fail(
        contractError(
          CREDENTIAL_REQUIREMENT_DESCRIPTOR_ERROR.ENV_INVALID,
          `eligibleEnvironments contains unsupported value: ${env}`,
          "eligibleEnvironments"
        )
      );
    }
  }

  /** @type {object|undefined} */
  let secretReference;
  if ("secretReference" in input && input.secretReference !== undefined) {
    const refResult = createSecretReference(input.secretReference);
    if (!refResult.ok) {
      return fail(
        contractError(
          CREDENTIAL_REQUIREMENT_DESCRIPTOR_ERROR.REFERENCE_INVALID,
          refResult.error.message,
          "secretReference"
        )
      );
    }
    secretReference = refResult.value;
  }

  return ok(
    deepFreeze({
      credentialId: credentialId.value,
      contractVersion: contractVersion.value,
      connectorId: connectorId.value,
      requirement: requirement.value,
      classification: classification.value,
      eligibleEnvironments: eligibleEnvironments.value,
      ...(secretReference ? { secretReference } : {}),
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isCredentialRequirementDescriptor(value) {
  return createCredentialRequirementDescriptor(value).ok === true;
}
