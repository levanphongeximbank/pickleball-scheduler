/**
 * Event/Audit adoption adapter certification tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  projectEventTraceContext,
  projectCommonEventEnvelope,
  projectAuditEventEnvelope,
  projectEventErrorDescriptor,
  EVENT_TRACE_CONTEXT_ADAPTER_ERROR,
  COMMON_EVENT_ENVELOPE_ADAPTER_ERROR,
  AUDIT_EVENT_ENVELOPE_ADAPTER_ERROR,
  EVENT_ERROR_DESCRIPTOR_ADAPTER_ERROR,
} from "./index.js";
import {
  isTraceContext,
  isCommonEventEnvelope,
  isPlatformErrorDescriptor,
  isActorReference,
  isSubjectReference,
  createActorReference,
  createSubjectReference,
  createTraceContext,
  projectIdentityActor,
  projectTenantScope,
} from "../../index.js";

const ADAPTER_DIR = path.dirname(fileURLToPath(import.meta.url));

const FIXED_OCCURRED_AT = "2026-07-24T00:00:00.000Z";
const FIXED_EVENT_ID = "evt-fixed-001";

function readAdapterSources() {
  const files = fs
    .readdirSync(ADAPTER_DIR)
    .filter((name) => name.endsWith(".js") && !name.endsWith(".test.js"));
  return files.map((name) => ({
    name,
    source: fs.readFileSync(path.join(ADAPTER_DIR, name), "utf8"),
  }));
}

function minimalEnvelopeInput(overrides = {}) {
  return {
    eventId: FIXED_EVENT_ID,
    eventType: "identity.login",
    occurredAt: FIXED_OCCURRED_AT,
    sourceModule: "identity",
    payloadVersion: "1.0.0",
    actor: { actorType: "USER", actorId: "user-1" },
    payload: { action: "login" },
    ...overrides,
  };
}

test("1. valid trace context projection", () => {
  const result = projectEventTraceContext({
    correlationId: "corr-1",
    causationId: "cause-1",
  });
  assert.equal(result.ok, true);
  assert.equal(isTraceContext(result.value), true);
  assert.equal(result.value.correlationId, "corr-1");
  assert.equal(result.value.causationId, "cause-1");
  assert.equal(Object.isFrozen(result.value), true);
});

test("2. trace context with correlationId only", () => {
  const result = projectEventTraceContext({ correlationId: "corr-only" });
  assert.equal(result.ok, true);
  assert.equal(result.value.correlationId, "corr-only");
  assert.equal("causationId" in result.value, false);
});

test("3. trace context with causationId only", () => {
  const result = projectEventTraceContext({ causationId: "cause-only" });
  assert.equal(result.ok, true);
  assert.equal(result.value.causationId, "cause-only");
  assert.equal("correlationId" in result.value, false);
});

test("4. no trace identifier generation", () => {
  const empty = projectEventTraceContext({});
  assert.equal(empty.ok, true);
  assert.equal("correlationId" in empty.value, false);
  assert.equal("causationId" in empty.value, false);

  const before = Date.now();
  const result = projectEventTraceContext({});
  const after = Date.now();
  const serialized = JSON.stringify(result.value);
  assert.equal(serialized.includes(String(before)), false);
  assert.equal(serialized.includes(String(after)), false);
  assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(serialized), false);

  assert.equal(
    projectEventTraceContext(null).error.code,
    EVENT_TRACE_CONTEXT_ADAPTER_ERROR.INVALID
  );
});

test("5. valid minimal common event envelope", () => {
  const result = projectCommonEventEnvelope(minimalEnvelopeInput());
  assert.equal(result.ok, true);
  assert.equal(isCommonEventEnvelope(result.value), true);
  assert.equal(result.value.eventId, FIXED_EVENT_ID);
  assert.equal(result.value.eventType, "identity.login");
  assert.equal(result.value.occurredAt, FIXED_OCCURRED_AT);
  assert.equal(result.value.sourceModule, "identity");
  assert.equal(result.value.payloadVersion, "1.0.0");
  assert.equal("tenantId" in result.value, false);
  assert.equal("subject" in result.value, false);
  assert.equal("trace" in result.value, false);
});

test("6. valid full common event envelope", () => {
  const actor = createActorReference({
    actorType: "USER",
    actorId: "user-full",
  }).value;
  const subject = createSubjectReference({
    subjectType: "MATCH",
    subjectId: "match-9",
  }).value;
  const trace = createTraceContext({
    correlationId: "corr-full",
    causationId: "cause-full",
  }).value;
  const payload = { detail: "full" };

  const result = projectCommonEventEnvelope({
    eventId: "evt-full",
    eventType: "competition.match.completed",
    occurredAt: FIXED_OCCURRED_AT,
    sourceModule: "competition-core",
    payloadVersion: "2.1.0",
    actor,
    subject,
    trace,
    tenantId: "tenant-full",
    payload,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.actor, actor);
  assert.deepEqual(result.value.subject, subject);
  assert.deepEqual(result.value.trace, trace);
  assert.equal(result.value.payload, payload);
  assert.equal(result.value.tenantId, "tenant-full");
});

test("7. explicit eventId required", () => {
  const input = minimalEnvelopeInput();
  delete input.eventId;
  assert.equal(
    projectCommonEventEnvelope(input).error.code,
    COMMON_EVENT_ENVELOPE_ADAPTER_ERROR.EVENT_ID_REQUIRED
  );
});

test("8. explicit occurredAt required", () => {
  const input = minimalEnvelopeInput();
  delete input.occurredAt;
  assert.equal(
    projectCommonEventEnvelope(input).error.code,
    COMMON_EVENT_ENVELOPE_ADAPTER_ERROR.OCCURRED_AT_REQUIRED
  );
});

test("9. actor reference preserved", () => {
  const actor = createActorReference({
    actorType: "SYSTEM",
    actorId: "sys-1",
  }).value;
  const result = projectCommonEventEnvelope(minimalEnvelopeInput({ actor }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.actor, actor);
  assert.equal(isActorReference(result.value.actor), true);
});

test("10. subject reference preserved", () => {
  const subject = createSubjectReference({
    subjectType: "PLAYER",
    subjectId: "player-1",
  }).value;
  const result = projectCommonEventEnvelope(minimalEnvelopeInput({ subject }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.subject, subject);
  assert.equal(isSubjectReference(result.value.subject), true);
});

test("11. trace reference preserved", () => {
  const trace = createTraceContext({ correlationId: "corr-preserve" }).value;
  const result = projectCommonEventEnvelope(minimalEnvelopeInput({ trace }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.trace, trace);
});

test("12. payload reference preserved", () => {
  const payload = { nested: { value: 42 } };
  const result = projectCommonEventEnvelope(minimalEnvelopeInput({ payload }));
  assert.equal(result.ok, true);
  assert.equal(result.value.payload, payload);
  assert.equal(result.value.payload.nested.value, 42);
});

test("13. tenant ID not inferred", () => {
  const result = projectCommonEventEnvelope(
    minimalEnvelopeInput({
      venueId: "venue-should-not-become-tenant",
      clubId: "club-should-not-become-tenant",
    })
  );
  assert.equal(result.ok, true);
  assert.equal("tenantId" in result.value, false);
});

test("14. event type not renamed", () => {
  const result = projectCommonEventEnvelope(
    minimalEnvelopeInput({ eventType: "Custom.Module.Event_Type" })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.eventType, "Custom.Module.Event_Type");
});

test("15. source module not rewritten", () => {
  const result = projectCommonEventEnvelope(
    minimalEnvelopeInput({ sourceModule: "finance.billing" })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.sourceModule, "finance.billing");
});

test("16. payload version not compared", () => {
  const result = projectCommonEventEnvelope(
    minimalEnvelopeInput({ payloadVersion: "99.0.0-legacy" })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.payloadVersion, "99.0.0-legacy");
});

test("17. audit projection returns canonical Common Event Envelope", () => {
  const result = projectAuditEventEnvelope(minimalEnvelopeInput());
  assert.equal(result.ok, true);
  assert.equal(isCommonEventEnvelope(result.value), true);
  assert.equal(result.value.eventId, FIXED_EVENT_ID);
});

test("18. audit persistence metadata is not invented", () => {
  const result = projectAuditEventEnvelope(
    minimalEnvelopeInput({
      sequence: 12,
      streamKey: "stream-a",
      recordedAt: FIXED_OCCURRED_AT,
      integrityMetadata: { fingerprint: "abc" },
      redactionMetadata: { redacted: true, paths: ["secret"] },
    })
  );
  assert.equal(result.ok, true);
  assert.equal("sequence" in result.value, false);
  assert.equal("streamKey" in result.value, false);
  assert.equal("recordedAt" in result.value, false);
  assert.equal("integrityMetadata" in result.value, false);
  assert.equal("redactionMetadata" in result.value, false);

  assert.equal(
    projectAuditEventEnvelope({ payload: {} }).error.code,
    AUDIT_EVENT_ENVELOPE_ADAPTER_ERROR.EVENT_ID_REQUIRED
  );
});

test("19. valid Platform Error Descriptor projection", () => {
  const result = projectEventErrorDescriptor({
    code: "EVENT_VALIDATION_FAILED",
    message: "Invalid event payload",
    category: "validation",
    field: "eventType",
    retryable: false,
  });
  assert.equal(result.ok, true);
  assert.equal(isPlatformErrorDescriptor(result.value), true);
  assert.equal(result.value.code, "EVENT_VALIDATION_FAILED");
  assert.equal(result.value.retryable, false);
});

test("20. strict retryable boolean", () => {
  assert.equal(
    projectEventErrorDescriptor({
      code: "X",
      message: "y",
      retryable: "true",
    }).error.code,
    EVENT_ERROR_DESCRIPTOR_ADAPTER_ERROR.RETRYABLE_INVALID
  );
  assert.equal(
    projectEventErrorDescriptor({
      code: "X",
      message: "y",
      retryable: 1,
    }).error.code,
    EVENT_ERROR_DESCRIPTOR_ADAPTER_ERROR.RETRYABLE_INVALID
  );

  const okTrue = projectEventErrorDescriptor({
    code: "X",
    message: "y",
    retryable: true,
  });
  assert.equal(okTrue.ok, true);
  assert.equal(okTrue.value.retryable, true);
});

test("21. no Error stack projection", () => {
  const err = new Error("boom");
  assert.equal(
    projectEventErrorDescriptor(err).error.code,
    EVENT_ERROR_DESCRIPTOR_ADAPTER_ERROR.INVALID
  );

  const result = projectEventErrorDescriptor({
    code: "PLAIN",
    message: "ok",
    stack: "Error: should not project\n at fake.js:1",
  });
  assert.equal(result.ok, true);
  assert.equal("stack" in result.value, false);
});

test("22-27. no Date.now, randomUUID, database, publish, persistence, env", () => {
  for (const { name, source } of readAdapterSources()) {
    assert.equal(/Date\.now\s*\(/.test(source), false, name);
    assert.equal(/randomUUID\s*\(/.test(source), false, name);
    assert.equal(/Math\.random\s*\(/.test(source), false, name);
    assert.equal(/createClient\s*\(/.test(source), false, name);
    assert.equal(/supabase/i.test(source), false, name);
    assert.equal(/localStorage\./.test(source), false, name);
    assert.equal(/sessionStorage\./.test(source), false, name);
    assert.equal(/process\.env/.test(source), false, name);
    assert.equal(/import\.meta\.env/.test(source), false, name);
    assert.equal(/\bpublishEvent\s*\(/.test(source), false, name);
    assert.equal(/\bwriteAuditLog\s*\(/.test(source), false, name);
    assert.equal(/\boutbox\b/i.test(source), false, name);
    assert.equal(/AsyncLocalStorage/.test(source), false, name);
  }
});

test("28. input objects are not mutated", () => {
  const input = minimalEnvelopeInput({
    subject: { subjectType: "CLUB", subjectId: "club-1" },
    trace: { correlationId: "corr-m" },
    extra: { nested: true },
  });
  const snapshot = JSON.stringify(input);
  const result = projectCommonEventEnvelope(input);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(input.extra.nested, true);

  const auditInput = {
    ...minimalEnvelopeInput(),
    sequence: 99,
  };
  const auditSnapshot = JSON.stringify(auditInput);
  assert.equal(projectAuditEventEnvelope(auditInput).ok, true);
  assert.equal(JSON.stringify(auditInput), auditSnapshot);
});

test("29. canonical output immutability is preserved", () => {
  const envelope = projectCommonEventEnvelope(minimalEnvelopeInput()).value;
  const audit = projectAuditEventEnvelope(minimalEnvelopeInput()).value;
  const trace = projectEventTraceContext({ correlationId: "c" }).value;
  const error = projectEventErrorDescriptor({
    code: "E",
    message: "m",
  }).value;

  for (const value of [envelope, audit, trace, error]) {
    assert.equal(Object.isFrozen(value), true);
  }
});

test("30. public adapter exports exist via barrel", () => {
  assert.equal(typeof projectEventTraceContext, "function");
  assert.equal(typeof projectCommonEventEnvelope, "function");
  assert.equal(typeof projectAuditEventEnvelope, "function");
  assert.equal(typeof projectEventErrorDescriptor, "function");
});

test("32. Identity/Tenant adapters remain available", () => {
  const actor = projectIdentityActor({
    actorType: "USER",
    id: "compat-user",
  });
  assert.equal(actor.ok, true);
  const scope = projectTenantScope({ scopeType: "TENANT", tenantId: "t-1" });
  assert.equal(scope.ok, true);
});

test("34. no Business Module import", () => {
  for (const { name, source } of readAdapterSources()) {
    assert.equal(/src\/features\//.test(source), false, name);
    assert.equal(/src\/auth\//.test(source), false, name);
    assert.equal(
      /from\s+["'][^"']*(?:finance|crm|competition-core|player-rating)/.test(
        source
      ),
      false,
      name
    );
  }
});

test("actor may be projected via Identity adapter shape", () => {
  const result = projectCommonEventEnvelope(
    minimalEnvelopeInput({
      actor: { actorType: "USER", id: "auth-shaped-id" },
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.actor.actorId, "auth-shaped-id");
});
