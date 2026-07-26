/**
 * Canonical integration observation contract (ECO-05).
 * Provider-neutral, audit-safe — no secrets, raw bodies, or network evidence.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  IDEMPOTENCY_OUTCOME_VALUES,
  INTEGRATION_ERROR_CODE_VALUES,
  INTEGRATION_OBSERVATION_VERSION,
  OBSERVATION_SOURCE_KIND_VALUES,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireBoolean,
  requireEnumMember,
  requireIsoInstant,
  requireNonEmptyString,
} from "./shared.js";
import { createRedactedDiagnostics } from "./redactedDiagnostics.js";

export const INTEGRATION_OBSERVATION_ERROR = Object.freeze({
  INVALID: "INTEGRATION_OBSERVATION_INVALID",
  REFERENCE_INVALID: "INTEGRATION_OBSERVATION_REFERENCE_INVALID",
  TIMESTAMP_INVALID: "INTEGRATION_OBSERVATION_TIMESTAMP_INVALID",
  VERSION_INVALID: "INTEGRATION_OBSERVATION_VERSION_INVALID",
  SOURCE_INVALID: "INTEGRATION_OBSERVATION_SOURCE_INVALID",
  METADATA_INVALID: "INTEGRATION_OBSERVATION_METADATA_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createIntegrationObservation(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        INTEGRATION_OBSERVATION_ERROR.INVALID,
        "IntegrationObservation input must be a plain object"
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? INTEGRATION_OBSERVATION_VERSION,
    "contractVersion",
    INTEGRATION_OBSERVATION_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const observationId = requireNonEmptyString(
    input.observationId,
    "observationId",
    INTEGRATION_OBSERVATION_ERROR.REFERENCE_INVALID,
    "observationId"
  );
  if (!observationId.ok) return observationId;

  const sourceKind = requireEnumMember(
    input.sourceKind,
    OBSERVATION_SOURCE_KIND_VALUES,
    "sourceKind",
    INTEGRATION_OBSERVATION_ERROR.SOURCE_INVALID,
    "sourceKind"
  );
  if (!sourceKind.ok) return sourceKind;

  const subjectId = requireNonEmptyString(
    input.subjectId,
    "subjectId",
    INTEGRATION_OBSERVATION_ERROR.REFERENCE_INVALID,
    "subjectId"
  );
  if (!subjectId.ok) return subjectId;

  const eventType = requireNonEmptyString(
    input.eventType ?? "integration.observation",
    "eventType",
    INTEGRATION_OBSERVATION_ERROR.REFERENCE_INVALID,
    "eventType"
  );
  if (!eventType.ok) return eventType;

  const observedAt = requireIsoInstant(
    input.observedAt ?? new Date().toISOString(),
    "observedAt",
    INTEGRATION_OBSERVATION_ERROR.TIMESTAMP_INVALID
  );
  if (!observedAt.ok) return observedAt;

  /** @type {string|undefined} */
  let outcome;
  if ("outcome" in input && input.outcome !== undefined) {
    const o = requireNonEmptyString(
      input.outcome,
      "outcome",
      INTEGRATION_OBSERVATION_ERROR.REFERENCE_INVALID,
      "outcome"
    );
    if (!o.ok) return o;
    outcome = o.value;
  }

  /** @type {string|undefined} */
  let correlationId;
  if ("correlationId" in input && input.correlationId !== undefined) {
    const corr = requireNonEmptyString(
      input.correlationId,
      "correlationId",
      INTEGRATION_OBSERVATION_ERROR.REFERENCE_INVALID,
      "correlationId"
    );
    if (!corr.ok) return corr;
    correlationId = corr.value;
  }

  /** @type {string|undefined} */
  let connectorId;
  if ("connectorId" in input && input.connectorId !== undefined) {
    const id = requireNonEmptyString(
      input.connectorId,
      "connectorId",
      INTEGRATION_OBSERVATION_ERROR.REFERENCE_INVALID,
      "connectorId"
    );
    if (!id.ok) return id;
    connectorId = id.value;
  }

  /** @type {string|undefined} */
  let adapterId;
  if ("adapterId" in input && input.adapterId !== undefined) {
    const id = requireNonEmptyString(
      input.adapterId,
      "adapterId",
      INTEGRATION_OBSERVATION_ERROR.REFERENCE_INVALID,
      "adapterId"
    );
    if (!id.ok) return id;
    adapterId = id.value;
  }

  /** @type {string|undefined} */
  let ingressId;
  if ("ingressId" in input && input.ingressId !== undefined) {
    const id = requireNonEmptyString(
      input.ingressId,
      "ingressId",
      INTEGRATION_OBSERVATION_ERROR.REFERENCE_INVALID,
      "ingressId"
    );
    if (!id.ok) return id;
    ingressId = id.value;
  }

  /** @type {string|undefined} */
  let routeId;
  if ("routeId" in input && input.routeId !== undefined) {
    const id = requireNonEmptyString(
      input.routeId,
      "routeId",
      INTEGRATION_OBSERVATION_ERROR.REFERENCE_INVALID,
      "routeId"
    );
    if (!id.ok) return id;
    routeId = id.value;
  }

  /** @type {string|undefined} */
  let errorCode;
  if ("errorCode" in input && input.errorCode !== undefined) {
    const code = requireEnumMember(
      input.errorCode,
      INTEGRATION_ERROR_CODE_VALUES,
      "errorCode",
      INTEGRATION_OBSERVATION_ERROR.METADATA_INVALID,
      "errorCode"
    );
    if (!code.ok) return code;
    errorCode = code.value;
  }

  /** @type {boolean|undefined} */
  let retryable;
  if ("retryable" in input && input.retryable !== undefined) {
    const flag = requireBoolean(
      input.retryable,
      "retryable",
      INTEGRATION_OBSERVATION_ERROR.METADATA_INVALID
    );
    if (!flag.ok) return flag;
    retryable = flag.value;
  }

  /** @type {string|undefined} */
  let idempotencyOutcome;
  if ("idempotencyOutcome" in input && input.idempotencyOutcome !== undefined) {
    const outcomeEnum = requireEnumMember(
      input.idempotencyOutcome,
      IDEMPOTENCY_OUTCOME_VALUES,
      "idempotencyOutcome",
      INTEGRATION_OBSERVATION_ERROR.METADATA_INVALID,
      "idempotencyOutcome"
    );
    if (!outcomeEnum.ok) return outcomeEnum;
    idempotencyOutcome = outcomeEnum.value;
  }

  let deliveryEvidence = Object.freeze({});
  if ("deliveryEvidence" in input && input.deliveryEvidence !== undefined) {
    if (!isPlainObject(input.deliveryEvidence)) {
      return fail(
        contractError(
          INTEGRATION_OBSERVATION_ERROR.METADATA_INVALID,
          "deliveryEvidence must be a plain object",
          "deliveryEvidence"
        )
      );
    }
    const redacted = createRedactedDiagnostics(input.deliveryEvidence);
    if (!redacted.ok) return redacted;
    deliveryEvidence = redacted.value;
  }

  let attributes = Object.freeze({});
  if ("attributes" in input && input.attributes !== undefined) {
    if (!isPlainObject(input.attributes)) {
      return fail(
        contractError(
          INTEGRATION_OBSERVATION_ERROR.INVALID,
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
      sourceKind: sourceKind.value,
      subjectId: subjectId.value,
      eventType: eventType.value,
      observedAt: observedAt.value,
      ...(outcome ? { outcome } : {}),
      ...(correlationId ? { correlationId } : {}),
      ...(connectorId ? { connectorId } : {}),
      ...(adapterId ? { adapterId } : {}),
      ...(ingressId ? { ingressId } : {}),
      ...(routeId ? { routeId } : {}),
      ...(errorCode ? { errorCode } : {}),
      ...(retryable !== undefined ? { retryable } : {}),
      ...(idempotencyOutcome ? { idempotencyOutcome } : {}),
      deliveryEvidence,
      attributes,
    })
  );
}

/**
 * Normalize a provider-adapter observation into the canonical contract.
 * @param {*} adapterObservation
 * @param {*} [overrides]
 */
export function projectCanonicalFromProviderAdapterObservation(
  adapterObservation,
  overrides = {}
) {
  if (!isPlainObject(adapterObservation)) {
    return fail(
      contractError(
        INTEGRATION_OBSERVATION_ERROR.INVALID,
        "adapterObservation must be a plain object"
      )
    );
  }
  if (!isPlainObject(overrides)) {
    return fail(
      contractError(
        INTEGRATION_OBSERVATION_ERROR.INVALID,
        "overrides must be a plain object"
      )
    );
  }

  return createIntegrationObservation({
    observationId: adapterObservation.observationId,
    sourceKind: "PROVIDER_ADAPTER",
    subjectId: adapterObservation.adapterId,
    adapterId: adapterObservation.adapterId,
    eventType: adapterObservation.eventType ?? "adapter.invocation",
    observedAt: adapterObservation.observedAt,
    outcome: adapterObservation.resultStatus,
    correlationId: adapterObservation.correlationId,
    attributes:
      adapterObservation.attributes?.diagnostics ??
      adapterObservation.attributes ??
      {},
    ...overrides,
  });
}

/**
 * Normalize a webhook ingress observation into the canonical contract.
 * @param {*} webhookObservation
 * @param {*} [overrides]
 */
export function projectCanonicalFromWebhookIngressObservation(
  webhookObservation,
  overrides = {}
) {
  if (!isPlainObject(webhookObservation)) {
    return fail(
      contractError(
        INTEGRATION_OBSERVATION_ERROR.INVALID,
        "webhookObservation must be a plain object"
      )
    );
  }
  if (!isPlainObject(overrides)) {
    return fail(
      contractError(
        INTEGRATION_OBSERVATION_ERROR.INVALID,
        "overrides must be a plain object"
      )
    );
  }

  return createIntegrationObservation({
    observationId: webhookObservation.observationId,
    sourceKind: "WEBHOOK_INGRESS",
    subjectId: webhookObservation.ingressId,
    ingressId: webhookObservation.ingressId,
    routeId: webhookObservation.routeId,
    eventType: webhookObservation.eventType ?? "webhook.ingress",
    observedAt: webhookObservation.observedAt,
    outcome: webhookObservation.outcome,
    correlationId: webhookObservation.correlationId,
    attributes:
      webhookObservation.attributes?.diagnostics ??
      webhookObservation.attributes ??
      {},
    ...overrides,
  });
}
