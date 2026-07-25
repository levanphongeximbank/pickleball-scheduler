/**
 * Safe observability metadata for adapter invocations.
 */

import { fail, ok } from "../../../core/platform/index.js";
import { PROVIDER_ADAPTER_OBSERVATION_VERSION } from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireIsoInstant,
  requireNonEmptyString,
} from "./shared.js";
import { createRedactedDiagnostics } from "./redactedDiagnostics.js";

export const PROVIDER_ADAPTER_OBSERVATION_ERROR = Object.freeze({
  INVALID: "PROVIDER_ADAPTER_OBSERVATION_INVALID",
  REFERENCE_INVALID: "PROVIDER_ADAPTER_OBSERVATION_REFERENCE_INVALID",
  TIMESTAMP_INVALID: "PROVIDER_ADAPTER_OBSERVATION_TIMESTAMP_INVALID",
  VERSION_INVALID: "PROVIDER_ADAPTER_OBSERVATION_VERSION_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createProviderAdapterObservation(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        PROVIDER_ADAPTER_OBSERVATION_ERROR.INVALID,
        "ProviderAdapterObservation input must be a plain object"
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? PROVIDER_ADAPTER_OBSERVATION_VERSION,
    "contractVersion",
    PROVIDER_ADAPTER_OBSERVATION_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const observationId = requireNonEmptyString(
    input.observationId,
    "observationId",
    PROVIDER_ADAPTER_OBSERVATION_ERROR.REFERENCE_INVALID,
    "observationId"
  );
  if (!observationId.ok) return observationId;

  const adapterId = requireNonEmptyString(
    input.adapterId,
    "adapterId",
    PROVIDER_ADAPTER_OBSERVATION_ERROR.REFERENCE_INVALID,
    "adapterId"
  );
  if (!adapterId.ok) return adapterId;

  const requestId = requireNonEmptyString(
    input.requestId,
    "requestId",
    PROVIDER_ADAPTER_OBSERVATION_ERROR.REFERENCE_INVALID,
    "requestId"
  );
  if (!requestId.ok) return requestId;

  const observedAt = requireIsoInstant(
    input.observedAt ?? new Date().toISOString(),
    "observedAt",
    PROVIDER_ADAPTER_OBSERVATION_ERROR.TIMESTAMP_INVALID
  );
  if (!observedAt.ok) return observedAt;

  const eventType = requireNonEmptyString(
    input.eventType ?? "adapter.invocation",
    "eventType",
    PROVIDER_ADAPTER_OBSERVATION_ERROR.REFERENCE_INVALID,
    "eventType"
  );
  if (!eventType.ok) return eventType;

  /** @type {string|undefined} */
  let correlationId;
  if ("correlationId" in input && input.correlationId !== undefined) {
    const corr = requireNonEmptyString(
      input.correlationId,
      "correlationId",
      PROVIDER_ADAPTER_OBSERVATION_ERROR.REFERENCE_INVALID,
      "correlationId"
    );
    if (!corr.ok) return corr;
    correlationId = corr.value;
  }

  /** @type {string|undefined} */
  let resultStatus;
  if ("resultStatus" in input && input.resultStatus !== undefined) {
    const status = requireNonEmptyString(
      input.resultStatus,
      "resultStatus",
      PROVIDER_ADAPTER_OBSERVATION_ERROR.REFERENCE_INVALID,
      "resultStatus"
    );
    if (!status.ok) return status;
    resultStatus = status.value;
  }

  let attributes = Object.freeze({});
  if ("attributes" in input && input.attributes !== undefined) {
    if (!isPlainObject(input.attributes)) {
      return fail(
        contractError(
          PROVIDER_ADAPTER_OBSERVATION_ERROR.INVALID,
          "attributes must be a plain object",
          "attributes"
        )
      );
    }
    const redacted = createRedactedDiagnostics(input.attributes);
    if (!redacted.ok) return redacted;
    attributes = redacted.value;
  }

  return ok(
    deepFreeze({
      observationId: observationId.value,
      contractVersion: contractVersion.value,
      adapterId: adapterId.value,
      requestId: requestId.value,
      observedAt: observedAt.value,
      eventType: eventType.value,
      ...(correlationId ? { correlationId } : {}),
      ...(resultStatus ? { resultStatus } : {}),
      attributes,
    })
  );
}
