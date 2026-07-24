/**
 * Audit Event Envelope Adapter — projects an already-resolved audit event
 * input into the canonical Common Event Envelope.
 *
 * Does not introduce a competing audit contract, persist, redact, allocate
 * sequences, look up actors, authorize, rename eventType, or invent
 * persistence metadata.
 */

import { fail } from "../../contracts/result.js";
import { projectCommonEventEnvelope } from "./commonEventEnvelopeAdapter.js";

export const AUDIT_EVENT_ENVELOPE_ADAPTER_ERROR = Object.freeze({
  INVALID: "AUDIT_EVENT_ENVELOPE_ADAPTER_INVALID",
  EVENT_ID_REQUIRED: "AUDIT_EVENT_ENVELOPE_ADAPTER_EVENT_ID_REQUIRED",
  EVENT_TYPE_REQUIRED: "AUDIT_EVENT_ENVELOPE_ADAPTER_EVENT_TYPE_REQUIRED",
  OCCURRED_AT_REQUIRED: "AUDIT_EVENT_ENVELOPE_ADAPTER_OCCURRED_AT_REQUIRED",
  SOURCE_MODULE_REQUIRED: "AUDIT_EVENT_ENVELOPE_ADAPTER_SOURCE_MODULE_REQUIRED",
  PAYLOAD_VERSION_REQUIRED:
    "AUDIT_EVENT_ENVELOPE_ADAPTER_PAYLOAD_VERSION_REQUIRED",
  ACTOR_REQUIRED: "AUDIT_EVENT_ENVELOPE_ADAPTER_ACTOR_REQUIRED",
  PAYLOAD_REQUIRED: "AUDIT_EVENT_ENVELOPE_ADAPTER_PAYLOAD_REQUIRED",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function adapterError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * Project an already-resolved audit event into CommonEventEnvelope.
 * Only canonical envelope fields are projected; persistence metadata
 * (sequence, streamKey, recordedAt, fingerprints, etc.) stays module-owned.
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectAuditEventEnvelope(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      adapterError(
        AUDIT_EVENT_ENVELOPE_ADAPTER_ERROR.INVALID,
        "Audit event envelope input must be a plain object"
      )
    );
  }

  if (!("eventId" in input) || input.eventId === undefined) {
    return fail(
      adapterError(
        AUDIT_EVENT_ENVELOPE_ADAPTER_ERROR.EVENT_ID_REQUIRED,
        "Audit event envelope projection requires an explicit eventId",
        "eventId"
      )
    );
  }

  if (!("eventType" in input) || input.eventType === undefined) {
    return fail(
      adapterError(
        AUDIT_EVENT_ENVELOPE_ADAPTER_ERROR.EVENT_TYPE_REQUIRED,
        "Audit event envelope projection requires an explicit eventType",
        "eventType"
      )
    );
  }

  if (!("occurredAt" in input) || input.occurredAt === undefined) {
    return fail(
      adapterError(
        AUDIT_EVENT_ENVELOPE_ADAPTER_ERROR.OCCURRED_AT_REQUIRED,
        "Audit event envelope projection requires an explicit occurredAt",
        "occurredAt"
      )
    );
  }

  if (!("sourceModule" in input) || input.sourceModule === undefined) {
    return fail(
      adapterError(
        AUDIT_EVENT_ENVELOPE_ADAPTER_ERROR.SOURCE_MODULE_REQUIRED,
        "Audit event envelope projection requires an explicit sourceModule",
        "sourceModule"
      )
    );
  }

  if (!("payloadVersion" in input) || input.payloadVersion === undefined) {
    return fail(
      adapterError(
        AUDIT_EVENT_ENVELOPE_ADAPTER_ERROR.PAYLOAD_VERSION_REQUIRED,
        "Audit event envelope projection requires an explicit payloadVersion",
        "payloadVersion"
      )
    );
  }

  if (!("actor" in input) || input.actor === undefined) {
    return fail(
      adapterError(
        AUDIT_EVENT_ENVELOPE_ADAPTER_ERROR.ACTOR_REQUIRED,
        "Audit event envelope projection requires an explicit actor",
        "actor"
      )
    );
  }

  if (!("payload" in input)) {
    return fail(
      adapterError(
        AUDIT_EVENT_ENVELOPE_ADAPTER_ERROR.PAYLOAD_REQUIRED,
        "Audit event envelope projection requires an explicit payload",
        "payload"
      )
    );
  }

  /** @type {Record<string, *>} */
  const envelopeInput = {
    eventId: input.eventId,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    sourceModule: input.sourceModule,
    payloadVersion: input.payloadVersion,
    actor: input.actor,
    payload: input.payload,
  };

  if ("tenantId" in input && input.tenantId !== undefined) {
    envelopeInput.tenantId = input.tenantId;
  }
  if ("subject" in input && input.subject !== undefined) {
    envelopeInput.subject = input.subject;
  }
  if ("trace" in input && input.trace !== undefined) {
    envelopeInput.trace = input.trace;
  }

  return projectCommonEventEnvelope(envelopeInput);
}
