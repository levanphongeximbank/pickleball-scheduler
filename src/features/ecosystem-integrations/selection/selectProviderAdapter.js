/**
 * Deterministic provider adapter selection — no env, no network.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  ADAPTER_SELECTION_OUTCOME,
  CONNECTOR_ENVIRONMENT,
  CONNECTOR_KIND_VALUES,
} from "../constants/catalogues.js";
import { projectProviderAdapterReadiness } from "../contracts/providerAdapterReadiness.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireEnumMember,
  requireNonEmptyString,
} from "../contracts/shared.js";

export const PROVIDER_ADAPTER_SELECTION_ERROR = Object.freeze({
  INVALID: "PROVIDER_ADAPTER_SELECTION_INVALID",
  REGISTRY_INVALID: "PROVIDER_ADAPTER_SELECTION_REGISTRY_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function selectProviderAdapter(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        PROVIDER_ADAPTER_SELECTION_ERROR.INVALID,
        "selectProviderAdapter input must be a plain object"
      )
    );
  }

  const registry = input.registry;
  if (
    !registry ||
    typeof registry.listAdapters !== "function" ||
    typeof registry.findAdaptersByCapability !== "function"
  ) {
    return fail(
      contractError(
        PROVIDER_ADAPTER_SELECTION_ERROR.REGISTRY_INVALID,
        "registry must be a ProviderAdapterRegistry",
        "registry"
      )
    );
  }

  const capabilityId = requireNonEmptyString(
    input.capabilityId,
    "capabilityId",
    PROVIDER_ADAPTER_SELECTION_ERROR.INVALID,
    "capabilityId"
  );
  if (!capabilityId.ok) return capabilityId;

  const environment = requireEnumMember(
    input.environment ?? "TEST",
    Object.values(CONNECTOR_ENVIRONMENT),
    "environment",
    PROVIDER_ADAPTER_SELECTION_ERROR.INVALID,
    "environment"
  );
  if (!environment.ok) return environment;

  /** @type {string|undefined} */
  let connectorKind;
  if ("connectorKind" in input && input.connectorKind !== undefined) {
    const kind = requireEnumMember(
      input.connectorKind,
      CONNECTOR_KIND_VALUES,
      "connectorKind",
      PROVIDER_ADAPTER_SELECTION_ERROR.INVALID,
      "connectorKind"
    );
    if (!kind.ok) return kind;
    connectorKind = kind.value;
  }

  const credentialPresenceByAdapter =
    input.credentialPresenceByAdapter &&
    isPlainObject(input.credentialPresenceByAdapter)
      ? input.credentialPresenceByAdapter
      : {};

  const candidatesResult = registry.findAdaptersByCapability(capabilityId.value);
  if (!candidatesResult.ok) return candidatesResult;

  let candidates = candidatesResult.value;
  if (connectorKind) {
    candidates = Object.freeze(
      candidates.filter((adapter) => adapter.connectorKind === connectorKind)
    );
  }

  if (candidates.length === 0) {
    return ok(
      deepFreeze({
        outcome: ADAPTER_SELECTION_OUTCOME.UNSUPPORTED_CAPABILITY,
        capabilityId: capabilityId.value,
        environment: environment.value,
        ...(connectorKind ? { connectorKind } : {}),
        selectedAdapterId: null,
        reason: "no_adapter_declares_capability",
      })
    );
  }

  /** @type {object[]} */
  const readinessProjections = [];
  for (const adapter of candidates) {
    const readiness = projectProviderAdapterReadiness({
      descriptor: adapter,
      environment: environment.value,
      capabilityId: capabilityId.value,
      credentialPresent:
        credentialPresenceByAdapter[adapter.adapterId] === true,
    });
    if (!readiness.ok) return readiness;
    readinessProjections.push(readiness.value);
  }

  const ready = readinessProjections
    .filter((r) => r.operationallyReady === true)
    .sort((a, b) => {
      const adapterA = candidates.find((c) => c.adapterId === a.adapterId);
      const adapterB = candidates.find((c) => c.adapterId === b.adapterId);
      const priorityA = adapterA?.priority ?? 100;
      const priorityB = adapterB?.priority ?? 100;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.adapterId.localeCompare(b.adapterId);
    });

  if (ready.length > 0) {
    const selected = ready[0];
    return ok(
      deepFreeze({
        outcome: ADAPTER_SELECTION_OUTCOME.SELECTED,
        capabilityId: capabilityId.value,
        environment: environment.value,
        ...(connectorKind ? { connectorKind } : {}),
        selectedAdapterId: selected.adapterId,
        readiness: selected,
        candidates: Object.freeze(readinessProjections),
      })
    );
  }

  // Deterministic primary blocker classification from first candidate order.
  const orderedBlockers = readinessProjections.slice().sort((a, b) => {
    const adapterA = candidates.find((c) => c.adapterId === a.adapterId);
    const adapterB = candidates.find((c) => c.adapterId === b.adapterId);
    const priorityA = adapterA?.priority ?? 100;
    const priorityB = adapterB?.priority ?? 100;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.adapterId.localeCompare(b.adapterId);
  });
  const primary = orderedBlockers[0];
  let outcome = ADAPTER_SELECTION_OUTCOME.NO_READY_ADAPTER;
  if (primary?.blockedReason === "production_activation_blocked") {
    outcome = ADAPTER_SELECTION_OUTCOME.PRODUCTION_BLOCKED;
  } else if (primary?.blockedReason === "lifecycle_not_active") {
    outcome = ADAPTER_SELECTION_OUTCOME.LIFECYCLE_BLOCKED;
  } else if (primary?.blockedReason === "environment_not_eligible") {
    outcome = ADAPTER_SELECTION_OUTCOME.ENVIRONMENT_INELIGIBLE;
  } else if (primary?.blockedReason === "credential_required_absent") {
    outcome = ADAPTER_SELECTION_OUTCOME.CREDENTIAL_ABSENT;
  }

  return ok(
    deepFreeze({
      outcome,
      capabilityId: capabilityId.value,
      environment: environment.value,
      ...(connectorKind ? { connectorKind } : {}),
      selectedAdapterId: null,
      reason: primary?.blockedReason ?? "no_ready_adapter",
      candidates: Object.freeze(readinessProjections),
    })
  );
}
