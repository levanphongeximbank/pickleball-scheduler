import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCommonEventEnvelope,
  isCommonEventEnvelope,
  COMMON_EVENT_ERROR,
} from "./commonEventEnvelope.js";
import { createActorReference } from "./actorReference.js";
import { createSubjectReference } from "./subjectReference.js";
import { createTraceContext } from "./traceContext.js";

const validActor = Object.freeze({
  actorType: "USER",
  actorId: "actor-1",
});

const validSubject = Object.freeze({
  subjectType: "MATCH",
  subjectId: "match-1",
});

const validTrace = Object.freeze({
  correlationId: "corr-1",
  causationId: "cause-1",
});

/**
 * @param {Record<string, *>} [overrides]
 */
function minimalInput(overrides = {}) {
  return {
    eventId: "evt-001",
    eventType: "platform.example.created",
    occurredAt: "2026-07-24T03:00:00.000Z",
    sourceModule: "platform-core",
    payloadVersion: "1",
    actor: validActor,
    payload: { ok: true },
    ...overrides,
  };
}

test("minimal valid envelope is accepted", () => {
  const result = createCommonEventEnvelope(minimalInput());
  assert.equal(result.ok, true);
  assert.equal(result.value.eventId, "evt-001");
  assert.equal(result.value.eventType, "platform.example.created");
  assert.equal(result.value.occurredAt, "2026-07-24T03:00:00.000Z");
  assert.equal(result.value.sourceModule, "platform-core");
  assert.equal(result.value.payloadVersion, "1");
  assert.equal(result.value.actor.actorId, "actor-1");
  assert.deepEqual(result.value.payload, { ok: true });
  assert.deepEqual(Object.keys(result.value), [
    "eventId",
    "eventType",
    "occurredAt",
    "sourceModule",
    "payloadVersion",
    "actor",
    "payload",
  ]);
});

test("full valid envelope with tenantId, subject, and trace", () => {
  const result = createCommonEventEnvelope(
    minimalInput({
      tenantId: "tenant_01",
      subject: validSubject,
      trace: validTrace,
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.tenantId, "tenant_01");
  assert.equal(result.value.subject.subjectId, "match-1");
  assert.equal(result.value.trace.correlationId, "corr-1");
  assert.equal(result.value.trace.causationId, "cause-1");
});

test("eventId is trimmed", () => {
  const result = createCommonEventEnvelope(
    minimalInput({ eventId: "  evt-trim  " })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.eventId, "evt-trim");
});

test("eventType is trimmed", () => {
  const result = createCommonEventEnvelope(
    minimalInput({ eventType: "  platform.trimmed  " })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.eventType, "platform.trimmed");
});

test("occurredAt UTC Z is accepted", () => {
  const result = createCommonEventEnvelope(
    minimalInput({ occurredAt: "2026-01-15T12:30:00.000Z" })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.occurredAt, "2026-01-15T12:30:00.000Z");
});

test("explicit-offset occurredAt is normalized to UTC Z", () => {
  const result = createCommonEventEnvelope(
    minimalInput({ occurredAt: "2026-01-15T19:30:00.000+07:00" })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.occurredAt, "2026-01-15T12:30:00.000Z");
});

test("sourceModule is trimmed", () => {
  const result = createCommonEventEnvelope(
    minimalInput({ sourceModule: "  billing-core  " })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.sourceModule, "billing-core");
});

test("payloadVersion is trimmed", () => {
  const result = createCommonEventEnvelope(
    minimalInput({ payloadVersion: "  2.0  " })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.payloadVersion, "2.0");
});

test("valid Actor Reference is required", () => {
  const result = createCommonEventEnvelope(minimalInput());
  assert.equal(result.ok, true);
  assert.equal(result.value.actor.actorType, "USER");
  assert.equal(Object.isFrozen(result.value.actor), true);
});

test("valid Subject Reference is optional", () => {
  const withSubject = createCommonEventEnvelope(
    minimalInput({ subject: validSubject })
  );
  assert.equal(withSubject.ok, true);
  assert.equal(withSubject.value.subject.subjectType, "MATCH");

  const withoutSubject = createCommonEventEnvelope(minimalInput());
  assert.equal(withoutSubject.ok, true);
  assert.equal("subject" in withoutSubject.value, false);
});

test("valid Trace Context is optional", () => {
  const withTrace = createCommonEventEnvelope(
    minimalInput({ trace: validTrace })
  );
  assert.equal(withTrace.ok, true);
  assert.equal(withTrace.value.trace.correlationId, "corr-1");

  const withoutTrace = createCommonEventEnvelope(minimalInput());
  assert.equal(withoutTrace.ok, true);
  assert.equal("trace" in withoutTrace.value, false);
});

test("invalid eventId is rejected", () => {
  const empty = createCommonEventEnvelope(minimalInput({ eventId: "" }));
  assert.equal(empty.ok, false);
  assert.equal(empty.error.code, COMMON_EVENT_ERROR.ID_INVALID);

  const nonString = createCommonEventEnvelope(minimalInput({ eventId: 99 }));
  assert.equal(nonString.ok, false);
  assert.equal(nonString.error.code, COMMON_EVENT_ERROR.ID_INVALID);
});

test("empty eventType is rejected", () => {
  const result = createCommonEventEnvelope(minimalInput({ eventType: "  " }));
  assert.equal(result.ok, false);
  assert.equal(result.error.code, COMMON_EVENT_ERROR.TYPE_INVALID);
  assert.equal(result.error.field, "eventType");
});

test("invalid occurredAt is rejected", () => {
  const result = createCommonEventEnvelope(
    minimalInput({ occurredAt: "not-an-instant" })
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, COMMON_EVENT_ERROR.OCCURRED_AT_INVALID);
});

test("local timestamp without offset is rejected", () => {
  const result = createCommonEventEnvelope(
    minimalInput({ occurredAt: "2026-01-15T12:30:00.000" })
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, COMMON_EVENT_ERROR.OCCURRED_AT_INVALID);
});

test("empty sourceModule is rejected", () => {
  const result = createCommonEventEnvelope(
    minimalInput({ sourceModule: "" })
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, COMMON_EVENT_ERROR.SOURCE_MODULE_INVALID);
});

test("empty payloadVersion is rejected", () => {
  const result = createCommonEventEnvelope(
    minimalInput({ payloadVersion: "\t" })
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, COMMON_EVENT_ERROR.PAYLOAD_VERSION_INVALID);
});

test("invalid actor is rejected", () => {
  const { actor: _omit, ...withoutActor } = minimalInput();
  const missingActor = createCommonEventEnvelope(withoutActor);
  assert.equal(missingActor.ok, false);
  assert.equal(missingActor.error.code, COMMON_EVENT_ERROR.ACTOR_INVALID);

  const invalid = createCommonEventEnvelope(
    minimalInput({ actor: { actorType: "", actorId: "x" } })
  );
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, COMMON_EVENT_ERROR.ACTOR_INVALID);
});

test("invalid tenantId is rejected", () => {
  const result = createCommonEventEnvelope(
    minimalInput({ tenantId: "   " })
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, COMMON_EVENT_ERROR.TENANT_ID_INVALID);
});

test("invalid subject is rejected", () => {
  const result = createCommonEventEnvelope(
    minimalInput({ subject: { subjectType: "", subjectId: "x" } })
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, COMMON_EVENT_ERROR.SUBJECT_INVALID);
});

test("invalid trace is rejected", () => {
  const result = createCommonEventEnvelope(
    minimalInput({ trace: { correlationId: "" } })
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, COMMON_EVENT_ERROR.TRACE_INVALID);
});

test("missing payload property is rejected", () => {
  const { payload: _omit, ...withoutPayload } = minimalInput();
  const result = createCommonEventEnvelope(withoutPayload);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, COMMON_EVENT_ERROR.PAYLOAD_MISSING);
  assert.equal(result.error.field, "payload");
});

test("payload null is accepted and preserved", () => {
  const result = createCommonEventEnvelope(minimalInput({ payload: null }));
  assert.equal(result.ok, true);
  assert.equal(result.value.payload, null);
});

test("payload primitive is accepted and preserved", () => {
  const stringPayload = createCommonEventEnvelope(
    minimalInput({ payload: "text" })
  );
  assert.equal(stringPayload.ok, true);
  assert.equal(stringPayload.value.payload, "text");

  const numberPayload = createCommonEventEnvelope(
    minimalInput({ payload: 42 })
  );
  assert.equal(numberPayload.ok, true);
  assert.equal(numberPayload.value.payload, 42);

  const boolPayload = createCommonEventEnvelope(
    minimalInput({ payload: false })
  );
  assert.equal(boolPayload.ok, true);
  assert.equal(boolPayload.value.payload, false);
});

test("payload array is accepted and preserved by reference", () => {
  const payload = [1, 2, 3];
  const result = createCommonEventEnvelope(minimalInput({ payload }));
  assert.equal(result.ok, true);
  assert.equal(result.value.payload, payload);
  assert.deepEqual(result.value.payload, [1, 2, 3]);
});

test("payload object keeps reference and is not mutated by contract", () => {
  const payload = { nested: { value: 1 } };
  const result = createCommonEventEnvelope(minimalInput({ payload }));
  assert.equal(result.ok, true);
  assert.equal(result.value.payload, payload);
  assert.equal(Object.isFrozen(result.value.payload), false);

  payload.nested.value = 2;
  assert.equal(result.value.payload.nested.value, 2);

  result.value.payload.extra = "added";
  assert.equal(payload.extra, "added");
});

test("omitted optional fields are not auto-created", () => {
  const result = createCommonEventEnvelope(minimalInput());
  assert.equal(result.ok, true);
  assert.equal("tenantId" in result.value, false);
  assert.equal("subject" in result.value, false);
  assert.equal("trace" in result.value, false);
  assert.equal("role" in result.value, false);
  assert.equal("permission" in result.value, false);
  assert.equal("sessionId" in result.value, false);
  assert.equal("requestId" in result.value, false);
});

test("event envelope top-level is frozen", () => {
  const result = createCommonEventEnvelope(
    minimalInput({ tenantId: "tenant_locked" })
  );
  assert.equal(result.ok, true);
  assert.throws(() => {
    result.value.eventId = "changed";
  }, TypeError);
  assert.throws(() => {
    result.value.tenantId = "other";
  }, TypeError);
  assert.equal(result.value.tenantId, "tenant_locked");
});

test("isCommonEventEnvelope true/false is correct", () => {
  const valid = createCommonEventEnvelope(minimalInput()).value;
  assert.equal(isCommonEventEnvelope(valid), true);
  assert.equal(
    isCommonEventEnvelope(minimalInput({ eventType: "" })),
    false
  );
  assert.equal(isCommonEventEnvelope(null), false);
  assert.equal(isCommonEventEnvelope({}), false);
});

test("eventId is not auto-generated", () => {
  const { eventId: _omit, ...withoutId } = minimalInput();
  const result = createCommonEventEnvelope(withoutId);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, COMMON_EVENT_ERROR.ID_INVALID);
});

test("occurredAt is not auto-defaulted", () => {
  const { occurredAt: _omit, ...withoutOccurredAt } = minimalInput();
  const result = createCommonEventEnvelope(withoutOccurredAt);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, COMMON_EVENT_ERROR.OCCURRED_AT_INVALID);
});

test("no business event enum or module-specific dependency", () => {
  const sourcePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "commonEventEnvelope.js"
  );
  const source = fs.readFileSync(sourcePath, "utf8");
  assert.equal(source.includes("Date.now"), false);
  assert.equal(source.includes("randomUUID"), false);
  assert.equal(source.includes("src/features"), false);
  assert.equal(source.includes("src/auth"), false);
  assert.equal(source.includes("supabase"), false);
  assert.equal(source.includes("DEFAULT_TENANT_ID"), false);
  assert.equal(source.includes("COMPETITION_EVENT"), false);
  assert.equal(source.includes("FINANCE_EVENT"), false);
  assert.equal(source.includes("publishEvent"), false);
  assert.equal(source.includes("localStorage"), false);
  assert.equal(/function\s+generate/i.test(source), false);
  assert.equal(/EVENT_TYPES\s*=/.test(source), false);
  assert.equal(/enum\s+/.test(source), false);

  const frozenActor = createActorReference(validActor).value;
  const frozenSubject = createSubjectReference(validSubject).value;
  const frozenTrace = createTraceContext(validTrace).value;
  const result = createCommonEventEnvelope(
    minimalInput({
      actor: frozenActor,
      subject: frozenSubject,
      trace: frozenTrace,
    })
  );
  assert.equal(result.ok, true);
});
