/**
 * Client-safe public configuration projection.
 * Rejects secret-shaped keys; never carries credential values.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  CLIENT_SAFE_PUBLIC_CONFIG_VERSION,
  CONNECTOR_ENVIRONMENT_VALUES,
  OPERATIONAL_STATUS_VALUES,
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
  findSecretShapedKeyPath,
  isSecretShapedKey,
  rejectSecretValueFields,
} from "./secretBoundaryShared.js";

export const CLIENT_SAFE_PUBLIC_CONFIG_ERROR = Object.freeze({
  INVALID: "CLIENT_SAFE_PUBLIC_CONFIG_INVALID",
  PROVIDER_INVALID: "CLIENT_SAFE_PUBLIC_CONFIG_PROVIDER_INVALID",
  ENV_INVALID: "CLIENT_SAFE_PUBLIC_CONFIG_ENV_INVALID",
  STATUS_INVALID: "CLIENT_SAFE_PUBLIC_CONFIG_STATUS_INVALID",
  CAPABILITY_INVALID: "CLIENT_SAFE_PUBLIC_CONFIG_CAPABILITY_INVALID",
  SECRET_KEY: "CLIENT_SAFE_PUBLIC_CONFIG_SECRET_KEY",
  VALUE_FORBIDDEN: "CLIENT_SAFE_PUBLIC_CONFIG_VALUE_FORBIDDEN",
  ENDPOINT_INVALID: "CLIENT_SAFE_PUBLIC_CONFIG_ENDPOINT_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function projectClientSafePublicConfig(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        CLIENT_SAFE_PUBLIC_CONFIG_ERROR.INVALID,
        "ClientSafePublicConfig input must be a plain object"
      )
    );
  }

  const valueReject = rejectSecretValueFields(
    input,
    CLIENT_SAFE_PUBLIC_CONFIG_ERROR.VALUE_FORBIDDEN,
    "ClientSafePublicConfig"
  );
  if (valueReject) return valueReject;

  // Top-level secret-shaped keys are always rejected.
  for (const key of Object.keys(input)) {
    if (isSecretShapedKey(key)) {
      return fail(
        contractError(
          CLIENT_SAFE_PUBLIC_CONFIG_ERROR.SECRET_KEY,
          `public projection must not include secret-shaped key: ${key}`,
          key
        )
      );
    }
  }

  const nestedHit = findSecretShapedKeyPath(input);
  if (nestedHit) {
    return fail(
      contractError(
        CLIENT_SAFE_PUBLIC_CONFIG_ERROR.SECRET_KEY,
        `public projection must not include secret-shaped key: ${nestedHit}`,
        nestedHit
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? CLIENT_SAFE_PUBLIC_CONFIG_VERSION,
    "contractVersion",
    CLIENT_SAFE_PUBLIC_CONFIG_ERROR.INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const providerKey = requireNonEmptyString(
    input.providerKey ?? input.publicProviderId,
    "providerKey",
    CLIENT_SAFE_PUBLIC_CONFIG_ERROR.PROVIDER_INVALID,
    "providerKey"
  );
  if (!providerKey.ok) return providerKey;

  const environmentLabel = requireEnumMember(
    input.environmentLabel ?? input.environment ?? "TEST",
    CONNECTOR_ENVIRONMENT_VALUES,
    "environmentLabel",
    CLIENT_SAFE_PUBLIC_CONFIG_ERROR.ENV_INVALID,
    "environmentLabel"
  );
  if (!environmentLabel.ok) return environmentLabel;

  const readinessStatus = requireEnumMember(
    input.readinessStatus ?? input.operationalStatus ?? "NOT_READY",
    OPERATIONAL_STATUS_VALUES,
    "readinessStatus",
    CLIENT_SAFE_PUBLIC_CONFIG_ERROR.STATUS_INVALID,
    "readinessStatus"
  );
  if (!readinessStatus.ok) return readinessStatus;

  const capabilities = requireStringArray(
    input.capabilities ?? input.supportedCapabilities ?? [],
    "capabilities",
    CLIENT_SAFE_PUBLIC_CONFIG_ERROR.CAPABILITY_INVALID,
    "capabilities"
  );
  if (!capabilities.ok) return capabilities;

  /** @type {ReadonlyArray<string>} */
  let publicEndpointClasses = Object.freeze([]);
  if (
    "publicEndpointClasses" in input &&
    input.publicEndpointClasses !== undefined
  ) {
    const endpoints = requireStringArray(
      input.publicEndpointClasses,
      "publicEndpointClasses",
      CLIENT_SAFE_PUBLIC_CONFIG_ERROR.ENDPOINT_INVALID,
      "publicEndpointClasses"
    );
    if (!endpoints.ok) return endpoints;
    publicEndpointClasses = endpoints.value;
  }

  /** @type {Record<string, boolean>} */
  const featureAvailability = {};
  if (
    "featureAvailability" in input &&
    input.featureAvailability !== undefined
  ) {
    if (!isPlainObject(input.featureAvailability)) {
      return fail(
        contractError(
          CLIENT_SAFE_PUBLIC_CONFIG_ERROR.INVALID,
          "featureAvailability must be a plain object",
          "featureAvailability"
        )
      );
    }
    for (const [key, value] of Object.entries(input.featureAvailability)) {
      if (isSecretShapedKey(key)) {
        return fail(
          contractError(
            CLIENT_SAFE_PUBLIC_CONFIG_ERROR.SECRET_KEY,
            `featureAvailability must not include secret-shaped key: ${key}`,
            "featureAvailability"
          )
        );
      }
      if (typeof value !== "boolean") {
        return fail(
          contractError(
            CLIENT_SAFE_PUBLIC_CONFIG_ERROR.INVALID,
            `featureAvailability.${key} must be a boolean`,
            "featureAvailability"
          )
        );
      }
      featureAvailability[key] = value;
    }
  }

  return ok(
    deepFreeze({
      contractVersion: contractVersion.value,
      providerKey: providerKey.value,
      environmentLabel: environmentLabel.value,
      readinessStatus: readinessStatus.value,
      capabilities: capabilities.value,
      publicEndpointClasses,
      featureAvailability: deepFreeze({ ...featureAvailability }),
      // Explicit marker — projection never carries credentials.
      containsSecrets: false,
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isClientSafePublicConfig(value) {
  return projectClientSafePublicConfig(value).ok === true;
}
