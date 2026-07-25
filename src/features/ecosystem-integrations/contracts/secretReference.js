/**
 * Secret reference contract — names / paths only, never secret values.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  CONNECTOR_ENVIRONMENT_VALUES,
  ENVIRONMENT_CLASS,
  ENVIRONMENT_CLASS_VALUES,
  SECRET_REFERENCE_SOURCE_VALUES,
  SECRET_REFERENCE_VERSION,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireEnumMember,
  requireNonEmptyString,
  requireStringArray,
} from "./shared.js";
import {
  isBrowserExposedSecretName,
  rejectSecretValueFields,
} from "./secretBoundaryShared.js";

export const SECRET_REFERENCE_ERROR = Object.freeze({
  INVALID: "SECRET_REFERENCE_INVALID",
  ID_INVALID: "SECRET_REFERENCE_ID_INVALID",
  SOURCE_INVALID: "SECRET_REFERENCE_SOURCE_INVALID",
  NAME_INVALID: "SECRET_REFERENCE_NAME_INVALID",
  CLASS_INVALID: "SECRET_REFERENCE_CLASS_INVALID",
  ENV_INVALID: "SECRET_REFERENCE_ENV_INVALID",
  VALUE_FORBIDDEN: "SECRET_REFERENCE_VALUE_FORBIDDEN",
  BROWSER_EXPOSED: "SECRET_REFERENCE_BROWSER_EXPOSED",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createSecretReference(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        SECRET_REFERENCE_ERROR.INVALID,
        "SecretReference input must be a plain object"
      )
    );
  }

  const valueReject = rejectSecretValueFields(
    input,
    SECRET_REFERENCE_ERROR.VALUE_FORBIDDEN,
    "SecretReference"
  );
  if (valueReject) return valueReject;

  const referenceId = requireNonEmptyString(
    input.referenceId,
    "referenceId",
    SECRET_REFERENCE_ERROR.ID_INVALID,
    "referenceId"
  );
  if (!referenceId.ok) return referenceId;

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? SECRET_REFERENCE_VERSION,
    "contractVersion",
    SECRET_REFERENCE_ERROR.INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const sourceKind = requireEnumMember(
    input.sourceKind ?? "ENV_NAME",
    SECRET_REFERENCE_SOURCE_VALUES,
    "sourceKind",
    SECRET_REFERENCE_ERROR.SOURCE_INVALID,
    "sourceKind"
  );
  if (!sourceKind.ok) return sourceKind;

  const referenceName = requireNonEmptyString(
    input.referenceName,
    "referenceName",
    SECRET_REFERENCE_ERROR.NAME_INVALID,
    "referenceName"
  );
  if (!referenceName.ok) return referenceName;

  const classification = requireEnumMember(
    input.classification ?? ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
    ENVIRONMENT_CLASS_VALUES,
    "classification",
    SECRET_REFERENCE_ERROR.CLASS_INVALID,
    "classification"
  );
  if (!classification.ok) return classification;

  // Canonical server-only secrets must not use browser-bundled VITE_* secret names.
  if (
    classification.value === ENVIRONMENT_CLASS.SERVER_ONLY_SECRET &&
    isBrowserExposedSecretName(referenceName.value)
  ) {
    return fail(
      contractError(
        SECRET_REFERENCE_ERROR.BROWSER_EXPOSED,
        "SERVER_ONLY_SECRET must not use browser-exposed VITE_* secret-shaped names",
        "referenceName"
      )
    );
  }

  if (
    classification.value === ENVIRONMENT_CLASS.CANONICAL_BOUNDARY &&
    isBrowserExposedSecretName(referenceName.value)
  ) {
    return fail(
      contractError(
        SECRET_REFERENCE_ERROR.BROWSER_EXPOSED,
        "CANONICAL_BOUNDARY must not use browser-exposed VITE_* secret-shaped names",
        "referenceName"
      )
    );
  }

  const environmentsRaw =
    input.eligibleEnvironments ?? input.environmentEligibility ?? ["TEST", "SANDBOX"];
  const eligibleEnvironments = requireStringArray(
    environmentsRaw,
    "eligibleEnvironments",
    SECRET_REFERENCE_ERROR.ENV_INVALID,
    "eligibleEnvironments"
  );
  if (!eligibleEnvironments.ok) return eligibleEnvironments;
  for (const env of eligibleEnvironments.value) {
    if (!CONNECTOR_ENVIRONMENT_VALUES.includes(env)) {
      return fail(
        contractError(
          SECRET_REFERENCE_ERROR.ENV_INVALID,
          `eligibleEnvironments contains unsupported value: ${env}`,
          "eligibleEnvironments"
        )
      );
    }
  }

  return ok(
    deepFreeze({
      referenceId: referenceId.value,
      contractVersion: contractVersion.value,
      sourceKind: sourceKind.value,
      referenceName: referenceName.value,
      classification: classification.value,
      eligibleEnvironments: eligibleEnvironments.value,
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isSecretReference(value) {
  return createSecretReference(value).ok === true;
}
