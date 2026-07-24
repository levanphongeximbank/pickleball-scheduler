/**
 * Common Event Envelope Adapter — projects already-resolved event values
 * into Platform Core CommonEventEnvelope.
 *
 * Does not generate eventId/occurredAt, publish events, persist, retry,
 * transform payloads, or query Identity/Tenant runtimes.
 */

import { fail, ok } from "../../contracts/result.js";
import { createCommonEventEnvelope } from "../../contracts/commonEventEnvelope.js";
import { isActorReference } from "../../contracts/actorReference.js";
import { isSubjectReference } from "../../contracts/subjectReference.js";
import { isTraceContext } from "../../contracts/traceContext.js";
import { createSubjectReference } from "../../contracts/subjectReference.js";
import { projectIdentityActor } from "../identityTenant/identityActorAdapter.js";
import { projectEventTraceContext } from "./eventTraceContextAdapter.js";

export const COMMON_EVENT_ENVELOPE_ADAPTER_ERROR = Object.freeze({
  INVALID: "COMMON_EVENT_ENVELOPE_ADAPTER_INVALID",
  EVENT_ID_REQUIRED: "COMMON_EVENT_ENVELOPE_ADAPTER_EVENT_ID_REQUIRED",
  EVENT_TYPE_REQUIRED: "COMMON_EVENT_ENVELOPE_ADAPTER_EVENT_TYPE_REQUIRED",
  OCCURRED_AT_REQUIRED: "COMMON_EVENT_ENVELOPE_ADAPTER_OCCURRED_AT_REQUIRED",
  SOURCE_MODULE_REQUIRED:
    "COMMON_EVENT_ENVELOPE_ADAPTER_SOURCE_MODULE_REQUIRED",
  PAYLOAD_VERSION_REQUIRED:
    "COMMON_EVENT_ENVELOPE_ADAPTER_PAYLOAD_VERSION_REQUIRED",
  ACTOR_REQUIRED: "COMMON_EVENT_ENVELOPE_ADAPTER_ACTOR_REQUIRED",
  PAYLOAD_REQUIRED: "COMMON_EVENT_ENVELOPE_ADAPTER_PAYLOAD_REQUIRED",
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
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
function resolveActor(input) {
  if (!("actor" in input) || input.actor === undefined) {
    return fail(
      adapterError(
        COMMON_EVENT_ENVELOPE_ADAPTER_ERROR.ACTOR_REQUIRED,
        "Common event envelope projection requires an explicit actor",
        "actor"
      )
    );
  }

  if (isActorReference(input.actor)) {
    return ok(input.actor);
  }

  return projectIdentityActor(input.actor);
}

/**
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
function resolveOptionalSubject(input) {
  if (!("subject" in input) || input.subject === undefined) {
    return ok(undefined);
  }

  if (isSubjectReference(input.subject)) {
    return ok(input.subject);
  }

  return createSubjectReference(input.subject);
}

/**
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
function resolveOptionalTrace(input) {
  if (!("trace" in input) || input.trace === undefined) {
    return ok(undefined);
  }

  if (isTraceContext(input.trace)) {
    return ok(input.trace);
  }

  return projectEventTraceContext(input.trace);
}

/**
 * Project already-resolved event values into CommonEventEnvelope.
 * eventId and occurredAt must be caller-supplied.
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectCommonEventEnvelope(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      adapterError(
        COMMON_EVENT_ENVELOPE_ADAPTER_ERROR.INVALID,
        "Common event envelope input must be a plain object"
      )
    );
  }

  if (!("eventId" in input) || input.eventId === undefined) {
    return fail(
      adapterError(
        COMMON_EVENT_ENVELOPE_ADAPTER_ERROR.EVENT_ID_REQUIRED,
        "Common event envelope projection requires an explicit eventId",
        "eventId"
      )
    );
  }

  if (!("eventType" in input) || input.eventType === undefined) {
    return fail(
      adapterError(
        COMMON_EVENT_ENVELOPE_ADAPTER_ERROR.EVENT_TYPE_REQUIRED,
        "Common event envelope projection requires an explicit eventType",
        "eventType"
      )
    );
  }

  if (!("occurredAt" in input) || input.occurredAt === undefined) {
    return fail(
      adapterError(
        COMMON_EVENT_ENVELOPE_ADAPTER_ERROR.OCCURRED_AT_REQUIRED,
        "Common event envelope projection requires an explicit occurredAt",
        "occurredAt"
      )
    );
  }

  if (!("sourceModule" in input) || input.sourceModule === undefined) {
    return fail(
      adapterError(
        COMMON_EVENT_ENVELOPE_ADAPTER_ERROR.SOURCE_MODULE_REQUIRED,
        "Common event envelope projection requires an explicit sourceModule",
        "sourceModule"
      )
    );
  }

  if (!("payloadVersion" in input) || input.payloadVersion === undefined) {
    return fail(
      adapterError(
        COMMON_EVENT_ENVELOPE_ADAPTER_ERROR.PAYLOAD_VERSION_REQUIRED,
        "Common event envelope projection requires an explicit payloadVersion",
        "payloadVersion"
      )
    );
  }

  if (!("payload" in input)) {
    return fail(
      adapterError(
        COMMON_EVENT_ENVELOPE_ADAPTER_ERROR.PAYLOAD_REQUIRED,
        "Common event envelope projection requires an explicit payload",
        "payload"
      )
    );
  }

  const actorResult = resolveActor(input);
  if (!actorResult.ok) return actorResult;

  const subjectResult = resolveOptionalSubject(input);
  if (!subjectResult.ok) return subjectResult;

  const traceResult = resolveOptionalTrace(input);
  if (!traceResult.ok) return traceResult;

  /** @type {Record<string, *>} */
  const payload = {
    eventId: input.eventId,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    sourceModule: input.sourceModule,
    payloadVersion: input.payloadVersion,
    actor: actorResult.value,
    payload: input.payload,
  };

  if ("tenantId" in input && input.tenantId !== undefined) {
    payload.tenantId = input.tenantId;
  }
  if (subjectResult.value !== undefined) {
    payload.subject = subjectResult.value;
  }
  if (traceResult.value !== undefined) {
    payload.trace = traceResult.value;
  }

  return createCommonEventEnvelope(payload);
}
