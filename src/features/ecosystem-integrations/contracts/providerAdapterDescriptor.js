/**
 * Provider adapter descriptor — provider-neutral, immutable.
 * No credentials, vendor SDKs, network clients, or env reads.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  ADAPTER_LIFECYCLE_VALUES,
  CONNECTOR_ENVIRONMENT_VALUES,
  CONNECTOR_KIND_VALUES,
  CREDENTIAL_REQUIREMENT_VALUES,
  INVOCATION_MODE_VALUES,
  PROVIDER_ADAPTER_DESCRIPTOR_VERSION,
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

export const PROVIDER_ADAPTER_DESCRIPTOR_ERROR = Object.freeze({
  INVALID: "PROVIDER_ADAPTER_DESCRIPTOR_INVALID",
  ID_INVALID: "PROVIDER_ADAPTER_DESCRIPTOR_ID_INVALID",
  VERSION_INVALID: "PROVIDER_ADAPTER_DESCRIPTOR_VERSION_INVALID",
  PROVIDER_KEY_INVALID: "PROVIDER_ADAPTER_DESCRIPTOR_PROVIDER_KEY_INVALID",
  KIND_INVALID: "PROVIDER_ADAPTER_DESCRIPTOR_KIND_INVALID",
  CAPABILITIES_INVALID: "PROVIDER_ADAPTER_DESCRIPTOR_CAPABILITIES_INVALID",
  MODES_INVALID: "PROVIDER_ADAPTER_DESCRIPTOR_MODES_INVALID",
  ENVIRONMENTS_INVALID: "PROVIDER_ADAPTER_DESCRIPTOR_ENVIRONMENTS_INVALID",
  LIFECYCLE_INVALID: "PROVIDER_ADAPTER_DESCRIPTOR_LIFECYCLE_INVALID",
  CREDENTIAL_INVALID: "PROVIDER_ADAPTER_DESCRIPTOR_CREDENTIAL_INVALID",
  METADATA_INVALID: "PROVIDER_ADAPTER_DESCRIPTOR_METADATA_INVALID",
  FLAG_INVALID: "PROVIDER_ADAPTER_DESCRIPTOR_FLAG_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createProviderAdapterDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        PROVIDER_ADAPTER_DESCRIPTOR_ERROR.INVALID,
        "ProviderAdapterDescriptor input must be a plain object"
      )
    );
  }

  const adapterId = requireNonEmptyString(
    input.adapterId,
    "adapterId",
    PROVIDER_ADAPTER_DESCRIPTOR_ERROR.ID_INVALID,
    "adapterId"
  );
  if (!adapterId.ok) return adapterId;

  const adapterVersion = requireNonEmptyString(
    input.adapterVersion ?? PROVIDER_ADAPTER_DESCRIPTOR_VERSION,
    "adapterVersion",
    PROVIDER_ADAPTER_DESCRIPTOR_ERROR.VERSION_INVALID,
    "adapterVersion"
  );
  if (!adapterVersion.ok) return adapterVersion;

  const providerKey = requireNonEmptyString(
    input.providerKey,
    "providerKey",
    PROVIDER_ADAPTER_DESCRIPTOR_ERROR.PROVIDER_KEY_INVALID,
    "providerKey"
  );
  if (!providerKey.ok) return providerKey;
  if (/[/:\\]/.test(providerKey.value)) {
    return fail(
      contractError(
        PROVIDER_ADAPTER_DESCRIPTOR_ERROR.PROVIDER_KEY_INVALID,
        "providerKey must be an opaque key without path separators",
        "providerKey"
      )
    );
  }

  const connectorKind = requireEnumMember(
    input.connectorKind ?? input.kind,
    CONNECTOR_KIND_VALUES,
    "connectorKind",
    PROVIDER_ADAPTER_DESCRIPTOR_ERROR.KIND_INVALID,
    "connectorKind"
  );
  if (!connectorKind.ok) return connectorKind;

  const supportedCapabilityIds = requireStringArray(
    input.supportedCapabilityIds ?? input.supportedCapabilities ?? [],
    "supportedCapabilityIds",
    PROVIDER_ADAPTER_DESCRIPTOR_ERROR.CAPABILITIES_INVALID,
    "supportedCapabilityIds"
  );
  if (!supportedCapabilityIds.ok) return supportedCapabilityIds;

  const modesRaw = input.supportedInvocationModes ?? input.invocationModes ?? [
    "SYNC",
  ];
  const supportedInvocationModes = requireStringArray(
    modesRaw,
    "supportedInvocationModes",
    PROVIDER_ADAPTER_DESCRIPTOR_ERROR.MODES_INVALID,
    "supportedInvocationModes"
  );
  if (!supportedInvocationModes.ok) return supportedInvocationModes;
  for (const mode of supportedInvocationModes.value) {
    if (!INVOCATION_MODE_VALUES.includes(mode)) {
      return fail(
        contractError(
          PROVIDER_ADAPTER_DESCRIPTOR_ERROR.MODES_INVALID,
          `supportedInvocationModes contains unsupported value: ${mode}`,
          "supportedInvocationModes"
        )
      );
    }
  }

  const environmentsRaw = input.supportedEnvironments ??
    input.environmentEligibility ?? ["TEST", "SANDBOX"];
  const supportedEnvironments = requireStringArray(
    environmentsRaw,
    "supportedEnvironments",
    PROVIDER_ADAPTER_DESCRIPTOR_ERROR.ENVIRONMENTS_INVALID,
    "supportedEnvironments"
  );
  if (!supportedEnvironments.ok) return supportedEnvironments;
  for (const env of supportedEnvironments.value) {
    if (!CONNECTOR_ENVIRONMENT_VALUES.includes(env)) {
      return fail(
        contractError(
          PROVIDER_ADAPTER_DESCRIPTOR_ERROR.ENVIRONMENTS_INVALID,
          `supportedEnvironments contains unsupported value: ${env}`,
          "supportedEnvironments"
        )
      );
    }
  }

  const lifecycleState = requireEnumMember(
    input.lifecycleState ?? input.lifecycle ?? "DECLARED",
    ADAPTER_LIFECYCLE_VALUES,
    "lifecycleState",
    PROVIDER_ADAPTER_DESCRIPTOR_ERROR.LIFECYCLE_INVALID,
    "lifecycleState"
  );
  if (!lifecycleState.ok) return lifecycleState;

  const credentialRequirement = requireEnumMember(
    input.credentialRequirement ?? "NONE",
    CREDENTIAL_REQUIREMENT_VALUES,
    "credentialRequirement",
    PROVIDER_ADAPTER_DESCRIPTOR_ERROR.CREDENTIAL_INVALID,
    "credentialRequirement"
  );
  if (!credentialRequirement.ok) return credentialRequirement;

  /** @type {ReadonlyArray<string>} */
  let credentialRequirementRefs = Object.freeze([]);
  if (
    "credentialRequirementRefs" in input &&
    input.credentialRequirementRefs !== undefined
  ) {
    const refs = requireStringArray(
      input.credentialRequirementRefs,
      "credentialRequirementRefs",
      PROVIDER_ADAPTER_DESCRIPTOR_ERROR.CREDENTIAL_INVALID,
      "credentialRequirementRefs"
    );
    if (!refs.ok) return refs;
    credentialRequirementRefs = refs.value;
  }

  const retrySupport = requireBoolean(
    input.retrySupport ?? false,
    "retrySupport",
    PROVIDER_ADAPTER_DESCRIPTOR_ERROR.FLAG_INVALID
  );
  if (!retrySupport.ok) return retrySupport;

  const idempotencySupport = requireBoolean(
    input.idempotencySupport ?? false,
    "idempotencySupport",
    PROVIDER_ADAPTER_DESCRIPTOR_ERROR.FLAG_INVALID
  );
  if (!idempotencySupport.ok) return idempotencySupport;

  const webhookSupport = requireBoolean(
    input.webhookSupport ?? false,
    "webhookSupport",
    PROVIDER_ADAPTER_DESCRIPTOR_ERROR.FLAG_INVALID
  );
  if (!webhookSupport.ok) return webhookSupport;

  const enabled = requireBoolean(
    input.enabled ?? true,
    "enabled",
    PROVIDER_ADAPTER_DESCRIPTOR_ERROR.FLAG_INVALID
  );
  if (!enabled.ok) return enabled;

  const priority = Number.isInteger(input.priority) ? input.priority : 100;
  if (!Number.isInteger(priority) || priority < 0) {
    return fail(
      contractError(
        PROVIDER_ADAPTER_DESCRIPTOR_ERROR.FLAG_INVALID,
        "priority must be a non-negative integer",
        "priority"
      )
    );
  }

  let publicMetadata = Object.freeze({});
  if ("publicMetadata" in input && input.publicMetadata !== undefined) {
    if (!isPlainObject(input.publicMetadata)) {
      return fail(
        contractError(
          PROVIDER_ADAPTER_DESCRIPTOR_ERROR.METADATA_INVALID,
          "publicMetadata must be a plain object",
          "publicMetadata"
        )
      );
    }
    for (const key of Object.keys(input.publicMetadata)) {
      if (/(secret|password|token|api[_-]?key|credential)/i.test(key)) {
        return fail(
          contractError(
            PROVIDER_ADAPTER_DESCRIPTOR_ERROR.METADATA_INVALID,
            `publicMetadata must not include credential-like key: ${key}`,
            "publicMetadata"
          )
        );
      }
    }
    publicMetadata = deepFreeze({ ...input.publicMetadata });
  }

  return ok(
    deepFreeze({
      adapterId: adapterId.value,
      adapterVersion: adapterVersion.value,
      providerKey: providerKey.value,
      connectorKind: connectorKind.value,
      supportedCapabilityIds: supportedCapabilityIds.value,
      supportedInvocationModes: supportedInvocationModes.value,
      supportedEnvironments: supportedEnvironments.value,
      lifecycleState: lifecycleState.value,
      credentialRequirement: credentialRequirement.value,
      credentialRequirementRefs,
      retrySupport: retrySupport.value,
      idempotencySupport: idempotencySupport.value,
      webhookSupport: webhookSupport.value,
      enabled: enabled.value,
      priority,
      publicMetadata,
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isProviderAdapterDescriptor(value) {
  return createProviderAdapterDescriptor(value).ok === true;
}
