/**
 * Provider capability descriptor — metadata only, no credentials.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  CREDENTIAL_REQUIREMENT_VALUES,
  INVOCATION_MODE_VALUES,
  PROVIDER_CAPABILITY_VERSION,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireBoolean,
  requireEnumMember,
  requireNonEmptyString,
  requireStringArray,
} from "./shared.js";

export const PROVIDER_CAPABILITY_DESCRIPTOR_ERROR = Object.freeze({
  INVALID: "PROVIDER_CAPABILITY_DESCRIPTOR_INVALID",
  ID_INVALID: "PROVIDER_CAPABILITY_DESCRIPTOR_ID_INVALID",
  VERSION_INVALID: "PROVIDER_CAPABILITY_DESCRIPTOR_VERSION_INVALID",
  OPERATIONS_INVALID: "PROVIDER_CAPABILITY_DESCRIPTOR_OPERATIONS_INVALID",
  MODES_INVALID: "PROVIDER_CAPABILITY_DESCRIPTOR_MODES_INVALID",
  CREDENTIAL_INVALID: "PROVIDER_CAPABILITY_DESCRIPTOR_CREDENTIAL_INVALID",
  FLAG_INVALID: "PROVIDER_CAPABILITY_DESCRIPTOR_FLAG_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createProviderCapabilityDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        PROVIDER_CAPABILITY_DESCRIPTOR_ERROR.INVALID,
        "ProviderCapabilityDescriptor input must be a plain object"
      )
    );
  }

  const capabilityId = requireNonEmptyString(
    input.capabilityId,
    "capabilityId",
    PROVIDER_CAPABILITY_DESCRIPTOR_ERROR.ID_INVALID,
    "capabilityId"
  );
  if (!capabilityId.ok) return capabilityId;

  const capabilityVersion = requireNonEmptyString(
    input.capabilityVersion ?? PROVIDER_CAPABILITY_VERSION,
    "capabilityVersion",
    PROVIDER_CAPABILITY_DESCRIPTOR_ERROR.VERSION_INVALID,
    "capabilityVersion"
  );
  if (!capabilityVersion.ok) return capabilityVersion;

  const supportedOperations = requireStringArray(
    input.supportedOperations ?? [],
    "supportedOperations",
    PROVIDER_CAPABILITY_DESCRIPTOR_ERROR.OPERATIONS_INVALID,
    "supportedOperations"
  );
  if (!supportedOperations.ok) return supportedOperations;

  const modesRaw = input.deliveryModes ?? input.invocationModes ?? ["SYNC"];
  const deliveryModes = requireStringArray(
    modesRaw,
    "deliveryModes",
    PROVIDER_CAPABILITY_DESCRIPTOR_ERROR.MODES_INVALID,
    "deliveryModes"
  );
  if (!deliveryModes.ok) return deliveryModes;
  for (const mode of deliveryModes.value) {
    if (!INVOCATION_MODE_VALUES.includes(mode)) {
      return fail(
        contractError(
          PROVIDER_CAPABILITY_DESCRIPTOR_ERROR.MODES_INVALID,
          `deliveryModes contains unsupported value: ${mode}`,
          "deliveryModes"
        )
      );
    }
  }

  const sandboxSupport = requireBoolean(
    input.sandboxSupport ?? true,
    "sandboxSupport",
    PROVIDER_CAPABILITY_DESCRIPTOR_ERROR.FLAG_INVALID
  );
  if (!sandboxSupport.ok) return sandboxSupport;

  const idempotencySupport = requireBoolean(
    input.idempotencySupport ?? true,
    "idempotencySupport",
    PROVIDER_CAPABILITY_DESCRIPTOR_ERROR.FLAG_INVALID
  );
  if (!idempotencySupport.ok) return idempotencySupport;

  const webhookSupport = requireBoolean(
    input.webhookSupport ?? false,
    "webhookSupport",
    PROVIDER_CAPABILITY_DESCRIPTOR_ERROR.FLAG_INVALID
  );
  if (!webhookSupport.ok) return webhookSupport;

  const credentialRequirement = requireEnumMember(
    input.credentialRequirement ?? "NONE",
    CREDENTIAL_REQUIREMENT_VALUES,
    "credentialRequirement",
    PROVIDER_CAPABILITY_DESCRIPTOR_ERROR.CREDENTIAL_INVALID,
    "credentialRequirement"
  );
  if (!credentialRequirement.ok) return credentialRequirement;

  let retrySemantics = Object.freeze({
    supportsRetry: true,
    maxAttemptsHint: 3,
  });
  if ("retrySemantics" in input && input.retrySemantics !== undefined) {
    if (!isPlainObject(input.retrySemantics)) {
      return fail(
        contractError(
          PROVIDER_CAPABILITY_DESCRIPTOR_ERROR.FLAG_INVALID,
          "retrySemantics must be a plain object",
          "retrySemantics"
        )
      );
    }
    const supportsRetry = requireBoolean(
      input.retrySemantics.supportsRetry ?? true,
      "retrySemantics.supportsRetry",
      PROVIDER_CAPABILITY_DESCRIPTOR_ERROR.FLAG_INVALID
    );
    if (!supportsRetry.ok) return supportsRetry;
    const maxAttemptsHint =
      input.retrySemantics.maxAttemptsHint === undefined
        ? 3
        : Number(input.retrySemantics.maxAttemptsHint);
    if (!Number.isInteger(maxAttemptsHint) || maxAttemptsHint < 0) {
      return fail(
        contractError(
          PROVIDER_CAPABILITY_DESCRIPTOR_ERROR.FLAG_INVALID,
          "retrySemantics.maxAttemptsHint must be a non-negative integer",
          "retrySemantics"
        )
      );
    }
    retrySemantics = deepFreeze({
      supportsRetry: supportsRetry.value,
      maxAttemptsHint,
    });
  }

  return ok(
    deepFreeze({
      capabilityId: capabilityId.value,
      capabilityVersion: capabilityVersion.value,
      supportedOperations: supportedOperations.value,
      deliveryModes: deliveryModes.value,
      sandboxSupport: sandboxSupport.value,
      idempotencySupport: idempotencySupport.value,
      webhookSupport: webhookSupport.value,
      retrySemantics,
      credentialRequirement: credentialRequirement.value,
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isProviderCapabilityDescriptor(value) {
  return createProviderCapabilityDescriptor(value).ok === true;
}
