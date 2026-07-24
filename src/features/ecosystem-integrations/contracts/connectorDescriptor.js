/**
 * Connector descriptor — provider-neutral, immutable, no credentials / clients.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  CONNECTOR_DESCRIPTOR_VERSION,
  CONNECTOR_DIRECTION_VALUES,
  CONNECTOR_ENVIRONMENT_VALUES,
  CONNECTOR_KIND_VALUES,
  CONNECTOR_LIFECYCLE_VALUES,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireEnumMember,
  requireNonEmptyString,
  requireStringArray,
} from "./shared.js";

export const CONNECTOR_DESCRIPTOR_ERROR = Object.freeze({
  INVALID: "CONNECTOR_DESCRIPTOR_INVALID",
  ID_INVALID: "CONNECTOR_DESCRIPTOR_ID_INVALID",
  KIND_INVALID: "CONNECTOR_DESCRIPTOR_KIND_INVALID",
  PROVIDER_KEY_INVALID: "CONNECTOR_DESCRIPTOR_PROVIDER_KEY_INVALID",
  DIRECTION_INVALID: "CONNECTOR_DESCRIPTOR_DIRECTION_INVALID",
  CAPABILITIES_INVALID: "CONNECTOR_DESCRIPTOR_CAPABILITIES_INVALID",
  ENVIRONMENTS_INVALID: "CONNECTOR_DESCRIPTOR_ENVIRONMENTS_INVALID",
  LIFECYCLE_INVALID: "CONNECTOR_DESCRIPTOR_LIFECYCLE_INVALID",
  METADATA_INVALID: "CONNECTOR_DESCRIPTOR_METADATA_INVALID",
  VERSION_INVALID: "CONNECTOR_DESCRIPTOR_VERSION_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createConnectorDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        CONNECTOR_DESCRIPTOR_ERROR.INVALID,
        "ConnectorDescriptor input must be a plain object"
      )
    );
  }

  const connectorId = requireNonEmptyString(
    input.connectorId,
    "connectorId",
    CONNECTOR_DESCRIPTOR_ERROR.ID_INVALID,
    "connectorId"
  );
  if (!connectorId.ok) return connectorId;

  const kind = requireEnumMember(
    input.kind ?? input.connectorKind,
    CONNECTOR_KIND_VALUES,
    "kind",
    CONNECTOR_DESCRIPTOR_ERROR.KIND_INVALID,
    "kind"
  );
  if (!kind.ok) return kind;

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? CONNECTOR_DESCRIPTOR_VERSION,
    "contractVersion",
    CONNECTOR_DESCRIPTOR_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const providerKey = requireNonEmptyString(
    input.providerKey,
    "providerKey",
    CONNECTOR_DESCRIPTOR_ERROR.PROVIDER_KEY_INVALID,
    "providerKey"
  );
  if (!providerKey.ok) return providerKey;

  // Reject obvious vendor model leakage in providerKey namespace? Allow opaque keys;
  // vendor-specific *models* are banned elsewhere. Keys like "payment.mock" are fine.
  if (/[/:\\]/.test(providerKey.value)) {
    return fail(
      contractError(
        CONNECTOR_DESCRIPTOR_ERROR.PROVIDER_KEY_INVALID,
        "providerKey must be an opaque key without path separators",
        "providerKey"
      )
    );
  }

  const direction = requireEnumMember(
    input.direction ?? input.supportedDirection,
    CONNECTOR_DIRECTION_VALUES,
    "direction",
    CONNECTOR_DESCRIPTOR_ERROR.DIRECTION_INVALID,
    "direction"
  );
  if (!direction.ok) return direction;

  const capabilities = requireStringArray(
    input.supportedCapabilities ?? input.capabilities ?? [],
    "supportedCapabilities",
    CONNECTOR_DESCRIPTOR_ERROR.CAPABILITIES_INVALID,
    "supportedCapabilities"
  );
  if (!capabilities.ok) return capabilities;

  const environmentsRaw = input.environmentEligibility ?? input.environments ?? [
    "TEST",
    "SANDBOX",
  ];
  const environments = requireStringArray(
    environmentsRaw,
    "environmentEligibility",
    CONNECTOR_DESCRIPTOR_ERROR.ENVIRONMENTS_INVALID,
    "environmentEligibility"
  );
  if (!environments.ok) return environments;
  for (const env of environments.value) {
    if (!CONNECTOR_ENVIRONMENT_VALUES.includes(env)) {
      return fail(
        contractError(
          CONNECTOR_DESCRIPTOR_ERROR.ENVIRONMENTS_INVALID,
          `environmentEligibility contains unsupported value: ${env}`,
          "environmentEligibility"
        )
      );
    }
  }

  const lifecycle = requireEnumMember(
    input.lifecycleState ?? input.lifecycle ?? "DECLARED",
    CONNECTOR_LIFECYCLE_VALUES,
    "lifecycleState",
    CONNECTOR_DESCRIPTOR_ERROR.LIFECYCLE_INVALID,
    "lifecycleState"
  );
  if (!lifecycle.ok) return lifecycle;

  let publicMetadata = Object.freeze({});
  if ("publicMetadata" in input && input.publicMetadata !== undefined) {
    if (!isPlainObject(input.publicMetadata)) {
      return fail(
        contractError(
          CONNECTOR_DESCRIPTOR_ERROR.METADATA_INVALID,
          "publicMetadata must be a plain object",
          "publicMetadata"
        )
      );
    }
    for (const key of Object.keys(input.publicMetadata)) {
      if (/(secret|password|token|api[_-]?key|credential)/i.test(key)) {
        return fail(
          contractError(
            CONNECTOR_DESCRIPTOR_ERROR.METADATA_INVALID,
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
      connectorId: connectorId.value,
      kind: kind.value,
      contractVersion: contractVersion.value,
      providerKey: providerKey.value,
      direction: direction.value,
      supportedCapabilities: capabilities.value,
      environmentEligibility: environments.value,
      lifecycleState: lifecycle.value,
      publicMetadata,
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isConnectorDescriptor(value) {
  return createConnectorDescriptor(value).ok === true;
}
