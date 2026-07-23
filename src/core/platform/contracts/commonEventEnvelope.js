/**
 * Common Event Envelope contract (Platform Core Phase 1D).
 *
 * Schema and validation only. Does not publish, persist, retry, deliver,
 * audit, authorize, or validate business payload schemas.
 */

import { fail, ok } from "./result.js";
import { normalizeOpaqueId } from "./opaqueId.js";
import { parseIsoStrict } from "./isoClock.js";
import {
  createActorReference,
  isActorReference,
} from "./actorReference.js";
import {
  createSubjectReference,
  isSubjectReference,
} from "./subjectReference.js";
import { createTraceContext, isTraceContext } from "./traceContext.js";

/**
 * @typedef {{
 *   eventId: string,
 *   eventType: string,
 *   occurredAt: string,
 *   sourceModule: string,
 *   payloadVersion: string,
 *   actor: import("./actorReference.js").ActorReference,
 *   payload: *,
 *   tenantId?: string,
 *   subject?: import("./subjectReference.js").SubjectReference,
 *   trace?: import("./traceContext.js").TraceContext,
 * }} CommonEventEnvelope
 */

export const COMMON_EVENT_ERROR = Object.freeze({
  INVALID: "COMMON_EVENT_INVALID",
  ID_INVALID: "COMMON_EVENT_ID_INVALID",
  TYPE_INVALID: "COMMON_EVENT_TYPE_INVALID",
  OCCURRED_AT_INVALID: "COMMON_EVENT_OCCURRED_AT_INVALID",
  SOURCE_MODULE_INVALID: "COMMON_EVENT_SOURCE_MODULE_INVALID",
  PAYLOAD_VERSION_INVALID: "COMMON_EVENT_PAYLOAD_VERSION_INVALID",
  ACTOR_INVALID: "COMMON_EVENT_ACTOR_INVALID",
  TENANT_ID_INVALID: "COMMON_EVENT_TENANT_ID_INVALID",
  SUBJECT_INVALID: "COMMON_EVENT_SUBJECT_INVALID",
  TRACE_INVALID: "COMMON_EVENT_TRACE_INVALID",
  PAYLOAD_MISSING: "COMMON_EVENT_PAYLOAD_MISSING",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function commonEventError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * @param {*} value
 * @param {string} field
 * @param {string} errorCode
 * @returns {import("./result.js").Result}
 */
function normalizeRequiredTrimmedString(value, field, errorCode) {
  if (typeof value !== "string") {
    return fail(
      commonEventError(
        errorCode,
        `CommonEventEnvelope ${field} must be a string`,
        field
      )
    );
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return fail(
      commonEventError(
        errorCode,
        `CommonEventEnvelope ${field} must be a non-empty string`,
        field
      )
    );
  }

  return ok(trimmed);
}

/**
 * @param {*} input
 * @returns {import("./result.js").Result}
 */
export function createCommonEventEnvelope(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      commonEventError(
        COMMON_EVENT_ERROR.INVALID,
        "CommonEventEnvelope input must be a plain object"
      )
    );
  }

  const eventIdResult = normalizeOpaqueId(input.eventId);
  if (!eventIdResult.ok) {
    return fail(
      commonEventError(
        COMMON_EVENT_ERROR.ID_INVALID,
        "CommonEventEnvelope eventId must be a non-empty opaque identifier",
        "eventId"
      )
    );
  }

  const eventTypeResult = normalizeRequiredTrimmedString(
    input.eventType,
    "eventType",
    COMMON_EVENT_ERROR.TYPE_INVALID
  );
  if (!eventTypeResult.ok) return eventTypeResult;

  if (!("occurredAt" in input) || input.occurredAt === undefined) {
    return fail(
      commonEventError(
        COMMON_EVENT_ERROR.OCCURRED_AT_INVALID,
        "CommonEventEnvelope occurredAt is required",
        "occurredAt"
      )
    );
  }

  const occurredAtResult = parseIsoStrict(input.occurredAt);
  if (!occurredAtResult.ok) {
    return fail(
      commonEventError(
        COMMON_EVENT_ERROR.OCCURRED_AT_INVALID,
        "CommonEventEnvelope occurredAt must be a strict ISO instant",
        "occurredAt"
      )
    );
  }

  const sourceModuleResult = normalizeRequiredTrimmedString(
    input.sourceModule,
    "sourceModule",
    COMMON_EVENT_ERROR.SOURCE_MODULE_INVALID
  );
  if (!sourceModuleResult.ok) return sourceModuleResult;

  const payloadVersionResult = normalizeRequiredTrimmedString(
    input.payloadVersion,
    "payloadVersion",
    COMMON_EVENT_ERROR.PAYLOAD_VERSION_INVALID
  );
  if (!payloadVersionResult.ok) return payloadVersionResult;

  if (!("actor" in input) || input.actor === undefined) {
    return fail(
      commonEventError(
        COMMON_EVENT_ERROR.ACTOR_INVALID,
        "CommonEventEnvelope actor is required",
        "actor"
      )
    );
  }

  const actorResult = createActorReference(input.actor);
  if (!actorResult.ok) {
    return fail(
      commonEventError(
        COMMON_EVENT_ERROR.ACTOR_INVALID,
        "CommonEventEnvelope actor must be a valid ActorReference",
        "actor"
      )
    );
  }

  if (!("payload" in input)) {
    return fail(
      commonEventError(
        COMMON_EVENT_ERROR.PAYLOAD_MISSING,
        "CommonEventEnvelope payload property is required",
        "payload"
      )
    );
  }

  /** @type {CommonEventEnvelope} */
  const envelope = {
    eventId: eventIdResult.value,
    eventType: eventTypeResult.value,
    occurredAt: occurredAtResult.value,
    sourceModule: sourceModuleResult.value,
    payloadVersion: payloadVersionResult.value,
    actor: actorResult.value,
    payload: input.payload,
  };

  if ("tenantId" in input && input.tenantId !== undefined) {
    const tenantIdResult = normalizeOpaqueId(input.tenantId);
    if (!tenantIdResult.ok) {
      return fail(
        commonEventError(
          COMMON_EVENT_ERROR.TENANT_ID_INVALID,
          "CommonEventEnvelope tenantId must be a non-empty opaque identifier",
          "tenantId"
        )
      );
    }
    envelope.tenantId = tenantIdResult.value;
  }

  if ("subject" in input && input.subject !== undefined) {
    const subjectResult = createSubjectReference(input.subject);
    if (!subjectResult.ok) {
      return fail(
        commonEventError(
          COMMON_EVENT_ERROR.SUBJECT_INVALID,
          "CommonEventEnvelope subject must be a valid SubjectReference",
          "subject"
        )
      );
    }
    envelope.subject = subjectResult.value;
  }

  if ("trace" in input && input.trace !== undefined) {
    const traceResult = createTraceContext(input.trace);
    if (!traceResult.ok) {
      return fail(
        commonEventError(
          COMMON_EVENT_ERROR.TRACE_INVALID,
          "CommonEventEnvelope trace must be a valid TraceContext",
          "trace"
        )
      );
    }
    envelope.trace = traceResult.value;
  }

  return ok(Object.freeze(envelope));
}

/**
 * @param {*} value
 * @returns {value is CommonEventEnvelope}
 */
export function isCommonEventEnvelope(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (!isActorReference(value.actor)) {
    return false;
  }
  if ("subject" in value && value.subject !== undefined) {
    if (!isSubjectReference(value.subject)) {
      return false;
    }
  }
  if ("trace" in value && value.trace !== undefined) {
    if (!isTraceContext(value.trace)) {
      return false;
    }
  }
  return createCommonEventEnvelope(value).ok === true;
}
