/**
 * Immutable webhook route descriptor — no Production HTTP binding.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  CONNECTOR_ENVIRONMENT_VALUES,
  CONNECTOR_KIND_VALUES,
  ENDPOINT_CLASS_VALUES,
  WEBHOOK_ROUTE_DESCRIPTOR_VERSION,
  WEBHOOK_ROUTE_LIFECYCLE_VALUES,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  normalizeOpaquePayload,
  requireBoolean,
  requireEnumMember,
  requireNonEmptyString,
  requireStringArray,
} from "./shared.js";

export const WEBHOOK_ROUTE_DESCRIPTOR_ERROR = Object.freeze({
  INVALID: "WEBHOOK_ROUTE_DESCRIPTOR_INVALID",
  VERSION_INVALID: "WEBHOOK_ROUTE_DESCRIPTOR_VERSION_INVALID",
  REFERENCE_INVALID: "WEBHOOK_ROUTE_DESCRIPTOR_REFERENCE_INVALID",
  ENVIRONMENT_INVALID: "WEBHOOK_ROUTE_DESCRIPTOR_ENVIRONMENT_INVALID",
  LIFECYCLE_INVALID: "WEBHOOK_ROUTE_DESCRIPTOR_LIFECYCLE_INVALID",
  ENDPOINT_INVALID: "WEBHOOK_ROUTE_DESCRIPTOR_ENDPOINT_INVALID",
  KIND_INVALID: "WEBHOOK_ROUTE_DESCRIPTOR_KIND_INVALID",
  METADATA_INVALID: "WEBHOOK_ROUTE_DESCRIPTOR_METADATA_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createWebhookRouteDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        WEBHOOK_ROUTE_DESCRIPTOR_ERROR.INVALID,
        "WebhookRouteDescriptor input must be a plain object"
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? WEBHOOK_ROUTE_DESCRIPTOR_VERSION,
    "contractVersion",
    WEBHOOK_ROUTE_DESCRIPTOR_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const routeId = requireNonEmptyString(
    input.routeId,
    "routeId",
    WEBHOOK_ROUTE_DESCRIPTOR_ERROR.REFERENCE_INVALID,
    "routeId"
  );
  if (!routeId.ok) return routeId;

  const routeKey = requireNonEmptyString(
    input.routeKey ?? input.pathKey,
    "routeKey",
    WEBHOOK_ROUTE_DESCRIPTOR_ERROR.REFERENCE_INVALID,
    "routeKey"
  );
  if (!routeKey.ok) return routeKey;

  const connectorId = requireNonEmptyString(
    input.connectorId,
    "connectorId",
    WEBHOOK_ROUTE_DESCRIPTOR_ERROR.REFERENCE_INVALID,
    "connectorId"
  );
  if (!connectorId.ok) return connectorId;

  const connectorKind = requireEnumMember(
    input.connectorKind ?? "WEBHOOK",
    CONNECTOR_KIND_VALUES,
    "connectorKind",
    WEBHOOK_ROUTE_DESCRIPTOR_ERROR.KIND_INVALID,
    "connectorKind"
  );
  if (!connectorKind.ok) return connectorKind;

  const lifecycleState = requireEnumMember(
    input.lifecycleState ?? "DECLARED",
    WEBHOOK_ROUTE_LIFECYCLE_VALUES,
    "lifecycleState",
    WEBHOOK_ROUTE_DESCRIPTOR_ERROR.LIFECYCLE_INVALID,
    "lifecycleState"
  );
  if (!lifecycleState.ok) return lifecycleState;

  const endpointClass = requireEnumMember(
    input.endpointClass ?? "MOCK",
    ENDPOINT_CLASS_VALUES,
    "endpointClass",
    WEBHOOK_ROUTE_DESCRIPTOR_ERROR.ENDPOINT_INVALID,
    "endpointClass"
  );
  if (!endpointClass.ok) return endpointClass;

  if (endpointClass.value === "PRODUCTION") {
    return fail(
      contractError(
        WEBHOOK_ROUTE_DESCRIPTOR_ERROR.ENDPOINT_INVALID,
        "Production webhook routes are blocked in ECO-04",
        "endpointClass"
      )
    );
  }

  const environments = requireStringArray(
    input.supportedEnvironments ?? input.environments ?? ["TEST", "SANDBOX"],
    "supportedEnvironments",
    WEBHOOK_ROUTE_DESCRIPTOR_ERROR.ENVIRONMENT_INVALID,
    "supportedEnvironments"
  );
  if (!environments.ok) return environments;

  for (const env of environments.value) {
    if (!CONNECTOR_ENVIRONMENT_VALUES.includes(env)) {
      return fail(
        contractError(
          WEBHOOK_ROUTE_DESCRIPTOR_ERROR.ENVIRONMENT_INVALID,
          `unsupported environment: ${env}`,
          "supportedEnvironments"
        )
      );
    }
    if (env === "PRODUCTION") {
      return fail(
        contractError(
          WEBHOOK_ROUTE_DESCRIPTOR_ERROR.ENVIRONMENT_INVALID,
          "PRODUCTION environment routes are blocked in ECO-04",
          "supportedEnvironments"
        )
      );
    }
  }

  const enabled = requireBoolean(
    input.enabled ?? true,
    "enabled",
    WEBHOOK_ROUTE_DESCRIPTOR_ERROR.INVALID
  );
  if (!enabled.ok) return enabled;

  const verificationRequired = requireBoolean(
    input.verificationRequired ?? true,
    "verificationRequired",
    WEBHOOK_ROUTE_DESCRIPTOR_ERROR.INVALID
  );
  if (!verificationRequired.ok) return verificationRequired;

  const priority =
    input.priority != null && Number.isFinite(Number(input.priority))
      ? Number(input.priority)
      : 100;

  const eventTypes = requireStringArray(
    input.eventTypes ?? [],
    "eventTypes",
    WEBHOOK_ROUTE_DESCRIPTOR_ERROR.REFERENCE_INVALID,
    "eventTypes"
  );
  if (!eventTypes.ok) return eventTypes;

  let publicMetadata = Object.freeze({});
  if ("publicMetadata" in input && input.publicMetadata !== undefined) {
    const meta = normalizeOpaquePayload(
      input.publicMetadata,
      "publicMetadata",
      WEBHOOK_ROUTE_DESCRIPTOR_ERROR.METADATA_INVALID
    );
    if (!meta.ok) return meta;
    publicMetadata = meta.value;
  }

  return ok(
    deepFreeze({
      contractVersion: contractVersion.value,
      routeId: routeId.value,
      routeKey: routeKey.value,
      connectorId: connectorId.value,
      connectorKind: connectorKind.value,
      lifecycleState: lifecycleState.value,
      endpointClass: endpointClass.value,
      supportedEnvironments: environments.value,
      enabled: enabled.value,
      verificationRequired: verificationRequired.value,
      priority,
      eventTypes: eventTypes.value,
      publicMetadata,
      productionBlocked: true,
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isWebhookRouteDescriptor(value) {
  return (
    isPlainObject(value) &&
    value.contractVersion === WEBHOOK_ROUTE_DESCRIPTOR_VERSION &&
    typeof value.routeId === "string" &&
    typeof value.routeKey === "string" &&
    value.productionBlocked === true
  );
}
