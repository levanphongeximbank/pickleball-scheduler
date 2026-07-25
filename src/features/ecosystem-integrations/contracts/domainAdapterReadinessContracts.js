/**
 * Domain adapter readiness contracts (payment / messaging / calendar /
 * identity / data-exchange) — contract-only, no live providers.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  CONNECTOR_KIND,
  CONNECTOR_KIND_VALUES,
  DOMAIN_ADAPTER_READINESS_CONTRACT_VERSION,
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

export const DOMAIN_ADAPTER_READINESS_CONTRACT_ERROR = Object.freeze({
  INVALID: "DOMAIN_ADAPTER_READINESS_CONTRACT_INVALID",
  KIND_INVALID: "DOMAIN_ADAPTER_READINESS_CONTRACT_KIND_INVALID",
  FLAG_INVALID: "DOMAIN_ADAPTER_READINESS_CONTRACT_FLAG_INVALID",
});

const DOMAIN_KIND_DEFAULTS = Object.freeze({
  [CONNECTOR_KIND.PAYMENT]: Object.freeze({
    domain: "payment",
    requiredCapabilityIds: Object.freeze(["eco.capability.payment.invoke"]),
    liveProviderAllowed: false,
  }),
  [CONNECTOR_KIND.NOTIFICATION]: Object.freeze({
    domain: "messaging",
    requiredCapabilityIds: Object.freeze(["eco.capability.messaging.invoke"]),
    liveProviderAllowed: false,
  }),
  [CONNECTOR_KIND.CALENDAR]: Object.freeze({
    domain: "calendar",
    requiredCapabilityIds: Object.freeze(["eco.capability.calendar.invoke"]),
    liveProviderAllowed: false,
  }),
  [CONNECTOR_KIND.IDENTITY]: Object.freeze({
    domain: "identity",
    requiredCapabilityIds: Object.freeze(["eco.capability.identity.invoke"]),
    liveProviderAllowed: false,
  }),
  [CONNECTOR_KIND.IMPORT_EXPORT]: Object.freeze({
    domain: "data-exchange",
    requiredCapabilityIds: Object.freeze([
      "eco.capability.data-exchange.invoke",
    ]),
    liveProviderAllowed: false,
  }),
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createDomainAdapterReadinessContract(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        DOMAIN_ADAPTER_READINESS_CONTRACT_ERROR.INVALID,
        "DomainAdapterReadinessContract input must be a plain object"
      )
    );
  }

  const connectorKind = requireEnumMember(
    input.connectorKind ?? input.kind,
    CONNECTOR_KIND_VALUES,
    "connectorKind",
    DOMAIN_ADAPTER_READINESS_CONTRACT_ERROR.KIND_INVALID,
    "connectorKind"
  );
  if (!connectorKind.ok) return connectorKind;

  const defaults = DOMAIN_KIND_DEFAULTS[connectorKind.value];
  if (!defaults) {
    return fail(
      contractError(
        DOMAIN_ADAPTER_READINESS_CONTRACT_ERROR.KIND_INVALID,
        `No domain readiness contract for connectorKind: ${connectorKind.value}`,
        "connectorKind"
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? DOMAIN_ADAPTER_READINESS_CONTRACT_VERSION,
    "contractVersion",
    DOMAIN_ADAPTER_READINESS_CONTRACT_ERROR.INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const requiredCapabilityIds = requireStringArray(
    input.requiredCapabilityIds ?? defaults.requiredCapabilityIds,
    "requiredCapabilityIds",
    DOMAIN_ADAPTER_READINESS_CONTRACT_ERROR.INVALID,
    "requiredCapabilityIds"
  );
  if (!requiredCapabilityIds.ok) return requiredCapabilityIds;

  const liveProviderAllowed = requireBoolean(
    input.liveProviderAllowed ?? defaults.liveProviderAllowed,
    "liveProviderAllowed",
    DOMAIN_ADAPTER_READINESS_CONTRACT_ERROR.FLAG_INVALID
  );
  if (!liveProviderAllowed.ok) return liveProviderAllowed;

  const productionActivationAllowed = requireBoolean(
    input.productionActivationAllowed ?? false,
    "productionActivationAllowed",
    DOMAIN_ADAPTER_READINESS_CONTRACT_ERROR.FLAG_INVALID
  );
  if (!productionActivationAllowed.ok) return productionActivationAllowed;

  const networkAllowed = requireBoolean(
    input.networkAllowed ?? false,
    "networkAllowed",
    DOMAIN_ADAPTER_READINESS_CONTRACT_ERROR.FLAG_INVALID
  );
  if (!networkAllowed.ok) return networkAllowed;

  if (liveProviderAllowed.value === true) {
    return fail(
      contractError(
        DOMAIN_ADAPTER_READINESS_CONTRACT_ERROR.FLAG_INVALID,
        "ECO-03 domain readiness contracts must keep liveProviderAllowed=false",
        "liveProviderAllowed"
      )
    );
  }
  if (productionActivationAllowed.value === true) {
    return fail(
      contractError(
        DOMAIN_ADAPTER_READINESS_CONTRACT_ERROR.FLAG_INVALID,
        "ECO-03 domain readiness contracts must keep productionActivationAllowed=false",
        "productionActivationAllowed"
      )
    );
  }
  if (networkAllowed.value === true) {
    return fail(
      contractError(
        DOMAIN_ADAPTER_READINESS_CONTRACT_ERROR.FLAG_INVALID,
        "ECO-03 domain readiness contracts must keep networkAllowed=false",
        "networkAllowed"
      )
    );
  }

  return ok(
    deepFreeze({
      contractVersion: contractVersion.value,
      connectorKind: connectorKind.value,
      domain: defaults.domain,
      requiredCapabilityIds: requiredCapabilityIds.value,
      liveProviderAllowed: false,
      productionActivationAllowed: false,
      networkAllowed: false,
      contractOnly: true,
      status: "CONTRACT_ONLY_READY",
    })
  );
}

/**
 * Convenience factories — contract-only domain readiness surfaces.
 */
export function createPaymentAdapterReadinessContract(input = {}) {
  return createDomainAdapterReadinessContract({
    ...input,
    connectorKind: CONNECTOR_KIND.PAYMENT,
  });
}

export function createMessagingAdapterReadinessContract(input = {}) {
  return createDomainAdapterReadinessContract({
    ...input,
    connectorKind: CONNECTOR_KIND.NOTIFICATION,
  });
}

export function createCalendarAdapterReadinessContract(input = {}) {
  return createDomainAdapterReadinessContract({
    ...input,
    connectorKind: CONNECTOR_KIND.CALENDAR,
  });
}

export function createIdentityAdapterReadinessContract(input = {}) {
  return createDomainAdapterReadinessContract({
    ...input,
    connectorKind: CONNECTOR_KIND.IDENTITY,
  });
}

export function createDataExchangeAdapterReadinessContract(input = {}) {
  return createDomainAdapterReadinessContract({
    ...input,
    connectorKind: CONNECTOR_KIND.IMPORT_EXPORT,
  });
}
