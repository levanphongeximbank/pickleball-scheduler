/**
 * Integration health / readiness projection.
 * credentialPresent is an external input flag — never reads secrets/env.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  CONNECTOR_ENVIRONMENT_VALUES,
  OPERATIONAL_STATUS,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireBoolean,
  requireEnumMember,
  requireNonEmptyString,
} from "./shared.js";

export const HEALTH_READINESS_ERROR = Object.freeze({
  INVALID: "HEALTH_READINESS_INVALID",
  CONNECTOR_INVALID: "HEALTH_READINESS_CONNECTOR_INVALID",
  FLAG_INVALID: "HEALTH_READINESS_FLAG_INVALID",
  ENVIRONMENT_INVALID: "HEALTH_READINESS_ENVIRONMENT_INVALID",
});

/**
 * @param {*} input
 */
export function projectIntegrationReadiness(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        HEALTH_READINESS_ERROR.INVALID,
        "Readiness projection input must be a plain object"
      )
    );
  }

  const connectorId = requireNonEmptyString(
    input.connectorId,
    "connectorId",
    HEALTH_READINESS_ERROR.CONNECTOR_INVALID,
    "connectorId"
  );
  if (!connectorId.ok) return connectorId;

  const configured = requireBoolean(
    input.configured ?? false,
    "configured",
    HEALTH_READINESS_ERROR.FLAG_INVALID
  );
  if (!configured.ok) return configured;

  const credentialRequired = requireBoolean(
    input.credentialRequired ?? false,
    "credentialRequired",
    HEALTH_READINESS_ERROR.FLAG_INVALID
  );
  if (!credentialRequired.ok) return credentialRequired;

  const credentialPresent = requireBoolean(
    input.credentialPresent ?? false,
    "credentialPresent",
    HEALTH_READINESS_ERROR.FLAG_INVALID
  );
  if (!credentialPresent.ok) return credentialPresent;

  const capabilityReady = requireBoolean(
    input.capabilityReady ?? false,
    "capabilityReady",
    HEALTH_READINESS_ERROR.FLAG_INVALID
  );
  if (!capabilityReady.ok) return capabilityReady;

  const environment = requireEnumMember(
    input.environment ?? "TEST",
    CONNECTOR_ENVIRONMENT_VALUES,
    "environment",
    HEALTH_READINESS_ERROR.ENVIRONMENT_INVALID,
    "environment"
  );
  if (!environment.ok) return environment;

  const environmentEligible = requireBoolean(
    input.environmentEligible ?? true,
    "environmentEligible",
    HEALTH_READINESS_ERROR.FLAG_INVALID
  );
  if (!environmentEligible.ok) return environmentEligible;

  /** @type {string|undefined} */
  let degradedReason;
  if ("degradedReason" in input && input.degradedReason !== undefined) {
    const reason = requireNonEmptyString(
      input.degradedReason,
      "degradedReason",
      HEALTH_READINESS_ERROR.FLAG_INVALID,
      "degradedReason"
    );
    if (!reason.ok) return reason;
    degradedReason = reason.value;
  }

  let lastObservationAt;
  if ("lastObservationAt" in input && input.lastObservationAt !== undefined) {
    const obs = requireNonEmptyString(
      input.lastObservationAt,
      "lastObservationAt",
      HEALTH_READINESS_ERROR.FLAG_INVALID,
      "lastObservationAt"
    );
    if (!obs.ok) return obs;
    lastObservationAt = obs.value;
  }

  const credentialOk =
    !credentialRequired.value || credentialPresent.value === true;

  /** @type {string} */
  let operationalStatus = OPERATIONAL_STATUS.READY;
  /** @type {string|undefined} */
  let unavailableReason;

  if (!environmentEligible.value) {
    operationalStatus = OPERATIONAL_STATUS.UNAVAILABLE;
    unavailableReason = "environment_not_eligible";
  } else if (!configured.value) {
    operationalStatus = OPERATIONAL_STATUS.NOT_READY;
    unavailableReason = "not_configured";
  } else if (!credentialOk) {
    operationalStatus = OPERATIONAL_STATUS.NOT_READY;
    unavailableReason = "credential_required_missing";
  } else if (!capabilityReady.value) {
    operationalStatus = OPERATIONAL_STATUS.NOT_READY;
    unavailableReason = "capability_not_ready";
  } else if (degradedReason) {
    operationalStatus = OPERATIONAL_STATUS.DEGRADED;
  }

  return ok(
    deepFreeze({
      connectorId: connectorId.value,
      configured: configured.value,
      credentialRequired: credentialRequired.value,
      credentialPresent: credentialPresent.value,
      capabilityReady: capabilityReady.value,
      environment: environment.value,
      environmentEligible: environmentEligible.value,
      operationalStatus,
      ...(degradedReason ? { degradedReason } : {}),
      ...(unavailableReason ? { unavailableReason } : {}),
      ...(lastObservationAt ? { lastObservationAt } : {}),
    })
  );
}
