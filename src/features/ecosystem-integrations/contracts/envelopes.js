/**
 * Provider-neutral inbound / outbound integration envelopes.
 * Opaque payload boundary — no vendor models.
 */

import {
  createIdempotencyKey,
  fail,
  ok,
  createPlatformScope,
} from "../../../core/platform/index.js";
import { ENVELOPE_VERSION } from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  normalizeOpaquePayload,
  requireIsoInstant,
  requireNonEmptyString,
} from "./shared.js";

export const INTEGRATION_ENVELOPE_ERROR = Object.freeze({
  INVALID: "INTEGRATION_ENVELOPE_INVALID",
  VERSION_INVALID: "INTEGRATION_ENVELOPE_VERSION_INVALID",
  MESSAGE_ID_INVALID: "INTEGRATION_ENVELOPE_MESSAGE_ID_INVALID",
  TIMESTAMP_INVALID: "INTEGRATION_ENVELOPE_TIMESTAMP_INVALID",
  CORRELATION_INVALID: "INTEGRATION_ENVELOPE_CORRELATION_INVALID",
  CAUSATION_INVALID: "INTEGRATION_ENVELOPE_CAUSATION_INVALID",
  TENANT_INVALID: "INTEGRATION_ENVELOPE_TENANT_INVALID",
  CONNECTOR_INVALID: "INTEGRATION_ENVELOPE_CONNECTOR_INVALID",
  PROVIDER_INVALID: "INTEGRATION_ENVELOPE_PROVIDER_INVALID",
  PAYLOAD_TYPE_INVALID: "INTEGRATION_ENVELOPE_PAYLOAD_TYPE_INVALID",
  PAYLOAD_VERSION_INVALID: "INTEGRATION_ENVELOPE_PAYLOAD_VERSION_INVALID",
  PAYLOAD_INVALID: "INTEGRATION_ENVELOPE_PAYLOAD_INVALID",
  DELIVERY_INVALID: "INTEGRATION_ENVELOPE_DELIVERY_INVALID",
});

/**
 * @param {*} input
 * @param {"INBOUND"|"OUTBOUND"} direction
 */
function createEnvelope(input, direction) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        INTEGRATION_ENVELOPE_ERROR.INVALID,
        `${direction} envelope input must be a plain object`
      )
    );
  }

  const envelopeVersion = requireNonEmptyString(
    input.envelopeVersion ?? ENVELOPE_VERSION,
    "envelopeVersion",
    INTEGRATION_ENVELOPE_ERROR.VERSION_INVALID,
    "envelopeVersion"
  );
  if (!envelopeVersion.ok) return envelopeVersion;

  const messageId = requireNonEmptyString(
    input.messageId ?? input.eventId,
    "messageId",
    INTEGRATION_ENVELOPE_ERROR.MESSAGE_ID_INVALID,
    "messageId"
  );
  if (!messageId.ok) return messageId;

  const timestampField =
    direction === "INBOUND"
      ? input.receivedAt ?? input.occurredAt
      : input.requestedAt ?? input.occurredAt;
  const timestampLabel = direction === "INBOUND" ? "receivedAt" : "requestedAt";
  const timestamp = requireIsoInstant(
    timestampField,
    timestampLabel,
    INTEGRATION_ENVELOPE_ERROR.TIMESTAMP_INVALID
  );
  if (!timestamp.ok) return timestamp;

  let occurredAt;
  if ("occurredAt" in input && input.occurredAt !== undefined) {
    const occurred = requireIsoInstant(
      input.occurredAt,
      "occurredAt",
      INTEGRATION_ENVELOPE_ERROR.TIMESTAMP_INVALID
    );
    if (!occurred.ok) return occurred;
    occurredAt = occurred.value;
  }

  const correlationId = requireNonEmptyString(
    input.correlationId,
    "correlationId",
    INTEGRATION_ENVELOPE_ERROR.CORRELATION_INVALID,
    "correlationId"
  );
  if (!correlationId.ok) return correlationId;

  let causationId;
  if ("causationId" in input && input.causationId !== undefined) {
    const causation = requireNonEmptyString(
      input.causationId,
      "causationId",
      INTEGRATION_ENVELOPE_ERROR.CAUSATION_INVALID,
      "causationId"
    );
    if (!causation.ok) return causation;
    causationId = causation.value;
  }

  let tenantContext;
  if ("tenantContext" in input && input.tenantContext !== undefined) {
    if (typeof input.tenantContext === "string") {
      const scope = createPlatformScope({
        scopeType: "tenant",
        tenantId: input.tenantContext,
      });
      if (!scope.ok) {
        return fail(
          contractError(
            INTEGRATION_ENVELOPE_ERROR.TENANT_INVALID,
            "tenantContext string must be a valid Platform scope tenantId",
            "tenantContext"
          )
        );
      }
      tenantContext = deepFreeze({
        scopeType: scope.value.scopeType,
        tenantId: scope.value.tenantId,
      });
    } else if (isPlainObject(input.tenantContext)) {
      const scopeInput = {
        scopeType: input.tenantContext.scopeType ?? "tenant",
        ...(input.tenantContext.scopeId !== undefined
          ? { scopeId: input.tenantContext.scopeId }
          : {}),
        ...(input.tenantContext.tenantId !== undefined
          ? { tenantId: input.tenantContext.tenantId }
          : {}),
      };
      const scope = createPlatformScope(scopeInput);
      if (!scope.ok) {
        return fail(
          contractError(
            INTEGRATION_ENVELOPE_ERROR.TENANT_INVALID,
            "tenantContext must project to a valid PlatformScope",
            "tenantContext"
          )
        );
      }
      tenantContext = deepFreeze({
        scopeType: scope.value.scopeType,
        ...(scope.value.scopeId ? { scopeId: scope.value.scopeId } : {}),
        ...(scope.value.tenantId ? { tenantId: scope.value.tenantId } : {}),
      });
    } else {
      return fail(
        contractError(
          INTEGRATION_ENVELOPE_ERROR.TENANT_INVALID,
          "tenantContext must be a string tenantId or PlatformScope-compatible object",
          "tenantContext"
        )
      );
    }
  }

  const connectorId = requireNonEmptyString(
    input.connectorId,
    "connectorId",
    INTEGRATION_ENVELOPE_ERROR.CONNECTOR_INVALID,
    "connectorId"
  );
  if (!connectorId.ok) return connectorId;

  const providerKey = requireNonEmptyString(
    input.providerKey,
    "providerKey",
    INTEGRATION_ENVELOPE_ERROR.PROVIDER_INVALID,
    "providerKey"
  );
  if (!providerKey.ok) return providerKey;

  const payloadType = requireNonEmptyString(
    input.payloadType,
    "payloadType",
    INTEGRATION_ENVELOPE_ERROR.PAYLOAD_TYPE_INVALID,
    "payloadType"
  );
  if (!payloadType.ok) return payloadType;

  const payloadVersion = requireNonEmptyString(
    input.payloadVersion ?? "1",
    "payloadVersion",
    INTEGRATION_ENVELOPE_ERROR.PAYLOAD_VERSION_INVALID,
    "payloadVersion"
  );
  if (!payloadVersion.ok) return payloadVersion;

  const payload = normalizeOpaquePayload(
    input.payload,
    "payload",
    INTEGRATION_ENVELOPE_ERROR.PAYLOAD_INVALID
  );
  if (!payload.ok) return payload;

  let delivery = Object.freeze({});
  if ("delivery" in input && input.delivery !== undefined) {
    if (!isPlainObject(input.delivery)) {
      return fail(
        contractError(
          INTEGRATION_ENVELOPE_ERROR.DELIVERY_INVALID,
          "delivery must be a plain object",
          "delivery"
        )
      );
    }
    /** @type {Record<string, *>} */
    const d = {};
    if (input.delivery.attempt != null) {
      const attempt = Number(input.delivery.attempt);
      if (!Number.isInteger(attempt) || attempt < 1) {
        return fail(
          contractError(
            INTEGRATION_ENVELOPE_ERROR.DELIVERY_INVALID,
            "delivery.attempt must be a positive integer",
            "delivery"
          )
        );
      }
      d.attempt = attempt;
    }
    if (input.delivery.idempotencyKey != null) {
      const keyResult = createIdempotencyKey(input.delivery.idempotencyKey);
      if (!keyResult.ok) {
        return fail(
          contractError(
            INTEGRATION_ENVELOPE_ERROR.DELIVERY_INVALID,
            "delivery.idempotencyKey must be a valid Platform IdempotencyKey",
            "delivery"
          )
        );
      }
      d.idempotencyKey = keyResult.value;
    }
    delivery = deepFreeze(d);
  }

  /** @type {Record<string, *>} */
  const envelope = {
    envelopeVersion: envelopeVersion.value,
    direction,
    messageId: messageId.value,
    correlationId: correlationId.value,
    connectorId: connectorId.value,
    providerKey: providerKey.value,
    payloadType: payloadType.value,
    payloadVersion: payloadVersion.value,
    payload: payload.value,
    delivery,
  };

  if (direction === "INBOUND") {
    envelope.receivedAt = timestamp.value;
  } else {
    envelope.requestedAt = timestamp.value;
  }
  if (occurredAt !== undefined) {
    envelope.occurredAt = occurredAt;
  }
  if (causationId !== undefined) {
    envelope.causationId = causationId;
  }
  if (tenantContext !== undefined) {
    envelope.tenantContext = tenantContext;
  }

  return ok(deepFreeze(envelope));
}

/**
 * @param {*} input
 */
export function createInboundIntegrationEnvelope(input) {
  return createEnvelope(input, "INBOUND");
}

/**
 * @param {*} input
 */
export function createOutboundIntegrationEnvelope(input) {
  return createEnvelope(input, "OUTBOUND");
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isInboundIntegrationEnvelope(value) {
  return (
    isPlainObject(value) &&
    value.direction === "INBOUND" &&
    createInboundIntegrationEnvelope(value).ok === true
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isOutboundIntegrationEnvelope(value) {
  return (
    isPlainObject(value) &&
    value.direction === "OUTBOUND" &&
    createOutboundIntegrationEnvelope(value).ok === true
  );
}
