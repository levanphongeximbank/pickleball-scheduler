/**
 * Canonical webhook ingress request envelope — provider-neutral metadata only.
 * No raw signature, secret, or vendor payload models.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  CONNECTOR_ENVIRONMENT_VALUES,
  ENDPOINT_CLASS_VALUES,
  WEBHOOK_INGRESS_ENVELOPE_VERSION,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireEnumMember,
  requireIsoInstant,
  requireNonEmptyString,
} from "./shared.js";

export const WEBHOOK_INGRESS_ENVELOPE_ERROR = Object.freeze({
  INVALID: "WEBHOOK_INGRESS_ENVELOPE_INVALID",
  VERSION_INVALID: "WEBHOOK_INGRESS_ENVELOPE_VERSION_INVALID",
  REFERENCE_INVALID: "WEBHOOK_INGRESS_ENVELOPE_REFERENCE_INVALID",
  TIMESTAMP_INVALID: "WEBHOOK_INGRESS_ENVELOPE_TIMESTAMP_INVALID",
  DIGEST_INVALID: "WEBHOOK_INGRESS_ENVELOPE_DIGEST_INVALID",
  ENVIRONMENT_INVALID: "WEBHOOK_INGRESS_ENVELOPE_ENVIRONMENT_INVALID",
  ENDPOINT_INVALID: "WEBHOOK_INGRESS_ENVELOPE_ENDPOINT_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createWebhookIngressEnvelope(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        WEBHOOK_INGRESS_ENVELOPE_ERROR.INVALID,
        "WebhookIngressEnvelope input must be a plain object"
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? WEBHOOK_INGRESS_ENVELOPE_VERSION,
    "contractVersion",
    WEBHOOK_INGRESS_ENVELOPE_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const ingressId = requireNonEmptyString(
    input.ingressId ?? input.requestId,
    "ingressId",
    WEBHOOK_INGRESS_ENVELOPE_ERROR.REFERENCE_INVALID,
    "ingressId"
  );
  if (!ingressId.ok) return ingressId;

  const routeKey = requireNonEmptyString(
    input.routeKey ?? input.pathKey,
    "routeKey",
    WEBHOOK_INGRESS_ENVELOPE_ERROR.REFERENCE_INVALID,
    "routeKey"
  );
  if (!routeKey.ok) return routeKey;

  const connectorId = requireNonEmptyString(
    input.connectorId,
    "connectorId",
    WEBHOOK_INGRESS_ENVELOPE_ERROR.REFERENCE_INVALID,
    "connectorId"
  );
  if (!connectorId.ok) return connectorId;

  const receivedAt = requireIsoInstant(
    input.receivedAt ?? input.now,
    "receivedAt",
    WEBHOOK_INGRESS_ENVELOPE_ERROR.TIMESTAMP_INVALID
  );
  if (!receivedAt.ok) return receivedAt;

  const environment = requireEnumMember(
    input.environment ?? "TEST",
    CONNECTOR_ENVIRONMENT_VALUES,
    "environment",
    WEBHOOK_INGRESS_ENVELOPE_ERROR.ENVIRONMENT_INVALID,
    "environment"
  );
  if (!environment.ok) return environment;

  const endpointClass = requireEnumMember(
    input.endpointClass ?? "MOCK",
    ENDPOINT_CLASS_VALUES,
    "endpointClass",
    WEBHOOK_INGRESS_ENVELOPE_ERROR.ENDPOINT_INVALID,
    "endpointClass"
  );
  if (!endpointClass.ok) return endpointClass;

  const bodyDigest = requireNonEmptyString(
    input.bodyDigest,
    "bodyDigest",
    WEBHOOK_INGRESS_ENVELOPE_ERROR.DIGEST_INVALID,
    "bodyDigest"
  );
  if (!bodyDigest.ok) return bodyDigest;

  /** @type {string|undefined} */
  let providerEventId;
  if ("providerEventId" in input && input.providerEventId !== undefined) {
    const eventId = requireNonEmptyString(
      input.providerEventId,
      "providerEventId",
      WEBHOOK_INGRESS_ENVELOPE_ERROR.REFERENCE_INVALID,
      "providerEventId"
    );
    if (!eventId.ok) return eventId;
    providerEventId = eventId.value;
  } else if ("eventId" in input && input.eventId !== undefined) {
    const eventId = requireNonEmptyString(
      input.eventId,
      "eventId",
      WEBHOOK_INGRESS_ENVELOPE_ERROR.REFERENCE_INVALID,
      "eventId"
    );
    if (!eventId.ok) return eventId;
    providerEventId = eventId.value;
  }

  /** @type {string|undefined} */
  let providerEventType;
  if ("providerEventType" in input && input.providerEventType !== undefined) {
    const eventType = requireNonEmptyString(
      input.providerEventType,
      "providerEventType",
      WEBHOOK_INGRESS_ENVELOPE_ERROR.REFERENCE_INVALID,
      "providerEventType"
    );
    if (!eventType.ok) return eventType;
    providerEventType = eventType.value;
  } else if ("eventType" in input && input.eventType !== undefined) {
    const eventType = requireNonEmptyString(
      input.eventType,
      "eventType",
      WEBHOOK_INGRESS_ENVELOPE_ERROR.REFERENCE_INVALID,
      "eventType"
    );
    if (!eventType.ok) return eventType;
    providerEventType = eventType.value;
  }

  /** @type {string|undefined} */
  let correlationId;
  if ("correlationId" in input && input.correlationId !== undefined) {
    const corr = requireNonEmptyString(
      input.correlationId,
      "correlationId",
      WEBHOOK_INGRESS_ENVELOPE_ERROR.REFERENCE_INVALID,
      "correlationId"
    );
    if (!corr.ok) return corr;
    correlationId = corr.value;
  }

  /** @type {string|undefined} */
  let providerTimestamp;
  if ("providerTimestamp" in input && input.providerTimestamp !== undefined) {
    const ts = requireIsoInstant(
      input.providerTimestamp,
      "providerTimestamp",
      WEBHOOK_INGRESS_ENVELOPE_ERROR.TIMESTAMP_INVALID
    );
    if (!ts.ok) return ts;
    providerTimestamp = ts.value;
  } else if ("timestamp" in input && input.timestamp !== undefined) {
    const ts = requireIsoInstant(
      input.timestamp,
      "timestamp",
      WEBHOOK_INGRESS_ENVELOPE_ERROR.TIMESTAMP_INVALID
    );
    if (!ts.ok) return ts;
    providerTimestamp = ts.value;
  }

  const signaturePresent =
    typeof input.signaturePresent === "boolean"
      ? input.signaturePresent
      : typeof input.signatureHeader === "string" &&
        input.signatureHeader.trim().length > 0;

  // Never retain raw signature / secret / raw body on the canonical envelope.
  return ok(
    deepFreeze({
      contractVersion: contractVersion.value,
      ingressId: ingressId.value,
      routeKey: routeKey.value,
      connectorId: connectorId.value,
      receivedAt: receivedAt.value,
      environment: environment.value,
      endpointClass: endpointClass.value,
      bodyDigest: bodyDigest.value,
      signaturePresent,
      ...(providerEventId ? { providerEventId } : {}),
      ...(providerEventType ? { providerEventType } : {}),
      ...(providerTimestamp ? { providerTimestamp } : {}),
      ...(correlationId ? { correlationId } : {}),
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isWebhookIngressEnvelope(value) {
  return (
    isPlainObject(value) &&
    value.contractVersion === WEBHOOK_INGRESS_ENVELOPE_VERSION &&
    typeof value.ingressId === "string" &&
    typeof value.routeKey === "string" &&
    typeof value.connectorId === "string" &&
    typeof value.bodyDigest === "string"
  );
}
