/**
 * Adapter readiness projection — injected flags only (no env / secrets).
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  ADAPTER_LIFECYCLE,
  ADAPTER_READINESS,
  CONNECTOR_ENVIRONMENT,
  CONNECTOR_ENVIRONMENT_VALUES,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireBoolean,
  requireEnumMember,
} from "./shared.js";
import { isProviderAdapterDescriptor } from "./providerAdapterDescriptor.js";

export const PROVIDER_ADAPTER_READINESS_ERROR = Object.freeze({
  INVALID: "PROVIDER_ADAPTER_READINESS_INVALID",
  DESCRIPTOR_INVALID: "PROVIDER_ADAPTER_READINESS_DESCRIPTOR_INVALID",
  FLAG_INVALID: "PROVIDER_ADAPTER_READINESS_FLAG_INVALID",
  ENVIRONMENT_INVALID: "PROVIDER_ADAPTER_READINESS_ENVIRONMENT_INVALID",
});

const ACTIVE_LIFECYCLES = Object.freeze([
  ADAPTER_LIFECYCLE.ACTIVE,
  ADAPTER_LIFECYCLE.DEGRADED,
]);

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function projectProviderAdapterReadiness(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        PROVIDER_ADAPTER_READINESS_ERROR.INVALID,
        "Adapter readiness input must be a plain object"
      )
    );
  }

  if (!isProviderAdapterDescriptor(input.descriptor)) {
    return fail(
      contractError(
        PROVIDER_ADAPTER_READINESS_ERROR.DESCRIPTOR_INVALID,
        "descriptor must be a valid ProviderAdapterDescriptor",
        "descriptor"
      )
    );
  }
  const descriptor = input.descriptor;

  const environment = requireEnumMember(
    input.environment ?? "TEST",
    CONNECTOR_ENVIRONMENT_VALUES,
    "environment",
    PROVIDER_ADAPTER_READINESS_ERROR.ENVIRONMENT_INVALID,
    "environment"
  );
  if (!environment.ok) return environment;

  const credentialPresent = requireBoolean(
    input.credentialPresent ?? false,
    "credentialPresent",
    PROVIDER_ADAPTER_READINESS_ERROR.FLAG_INVALID
  );
  if (!credentialPresent.ok) return credentialPresent;

  const capabilityId =
    typeof input.capabilityId === "string" ? input.capabilityId.trim() : "";

  const registered = true;
  const lifecycleActive = ACTIVE_LIFECYCLES.includes(descriptor.lifecycleState);
  const environmentEligible = descriptor.supportedEnvironments.includes(
    environment.value
  );
  const capabilitySupported =
    capabilityId.length === 0 ||
    descriptor.supportedCapabilityIds.includes(capabilityId);
  const credentialRequired =
    descriptor.credentialRequirement === "REQUIRED";
  // ECO-03: Production requests are always blocked. Metadata marker is advisory
  // for non-production environments (enabled ≠ production-ready).
  const productionBlocked =
    environment.value === CONNECTOR_ENVIRONMENT.PRODUCTION;

  /** @type {string[]} */
  const flags = [ADAPTER_READINESS.REGISTERED];
  if (lifecycleActive) flags.push(ADAPTER_READINESS.LIFECYCLE_ACTIVE);
  if (environmentEligible) flags.push(ADAPTER_READINESS.ENVIRONMENT_ELIGIBLE);
  if (capabilitySupported) flags.push(ADAPTER_READINESS.CAPABILITY_SUPPORTED);
  if (credentialRequired) flags.push(ADAPTER_READINESS.CREDENTIAL_REQUIRED);
  if (credentialPresent.value) flags.push(ADAPTER_READINESS.CREDENTIAL_PRESENT);
  if (productionBlocked) flags.push(ADAPTER_READINESS.PRODUCTION_BLOCKED);

  /** @type {string} */
  let readinessStatus = ADAPTER_READINESS.OPERATIONALLY_READY;
  /** @type {string|undefined} */
  let blockedReason;

  // Enabled flag alone must never imply ready.
  if (!descriptor.enabled) {
    readinessStatus = ADAPTER_READINESS.NOT_READY;
    blockedReason = "adapter_disabled";
  } else if (productionBlocked) {
    readinessStatus = ADAPTER_READINESS.PRODUCTION_BLOCKED;
    blockedReason = "production_activation_blocked";
  } else if (!lifecycleActive) {
    readinessStatus = ADAPTER_READINESS.UNAVAILABLE;
    blockedReason = "lifecycle_not_active";
  } else if (!environmentEligible) {
    readinessStatus = ADAPTER_READINESS.UNAVAILABLE;
    blockedReason = "environment_not_eligible";
  } else if (!capabilitySupported) {
    readinessStatus = ADAPTER_READINESS.NOT_READY;
    blockedReason = "capability_unsupported";
  } else if (credentialRequired && !credentialPresent.value) {
    readinessStatus = ADAPTER_READINESS.NOT_READY;
    blockedReason = "credential_required_absent";
  } else if (descriptor.lifecycleState === ADAPTER_LIFECYCLE.DEGRADED) {
    readinessStatus = ADAPTER_READINESS.DEGRADED;
  } else {
    flags.push(ADAPTER_READINESS.OPERATIONALLY_READY);
  }

  const operationallyReady =
    readinessStatus === ADAPTER_READINESS.OPERATIONALLY_READY ||
    readinessStatus === ADAPTER_READINESS.DEGRADED;

  return ok(
    deepFreeze({
      adapterId: descriptor.adapterId,
      providerKey: descriptor.providerKey,
      connectorKind: descriptor.connectorKind,
      environment: environment.value,
      ...(capabilityId ? { capabilityId } : {}),
      registered,
      lifecycleActive,
      environmentEligible,
      capabilitySupported,
      credentialRequired,
      credentialPresent: credentialPresent.value,
      enabled: descriptor.enabled,
      productionBlocked,
      operationallyReady,
      readinessStatus,
      readinessFlags: Object.freeze(flags),
      ...(blockedReason ? { blockedReason } : {}),
    })
  );
}
