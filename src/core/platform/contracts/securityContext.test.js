import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSecurityContext,
  isSecurityContext,
  SECURITY_CONTEXT_ERROR,
} from "./securityContext.js";
import { createActorReference } from "./actorReference.js";

const validActor = Object.freeze({
  actorType: "USER",
  actorId: "actor-1",
});

test("valid actor is required", () => {
  const result = createSecurityContext({ actor: validActor });
  assert.equal(result.ok, true);
  assert.equal(result.value.actor.actorType, "USER");
  assert.equal(result.value.actor.actorId, "actor-1");
});

test("invalid actor is rejected", () => {
  const missing = createSecurityContext({});
  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, SECURITY_CONTEXT_ERROR.ACTOR_INVALID);

  const invalid = createSecurityContext({
    actor: { actorType: "", actorId: "x" },
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, SECURITY_CONTEXT_ERROR.ACTOR_INVALID);
});

test("minimal context contains only actor", () => {
  const result = createSecurityContext({ actor: validActor });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.value), ["actor"]);
  assert.equal("tenantId" in result.value, false);
  assert.equal("sessionId" in result.value, false);
  assert.equal("requestId" in result.value, false);
  assert.equal("correlationId" in result.value, false);
  assert.equal("role" in result.value, false);
  assert.equal("permission" in result.value, false);
});

test("context accepts full optional IDs", () => {
  const result = createSecurityContext({
    actor: validActor,
    tenantId: "tenant_01",
    sessionId: "session_01",
    requestId: "request_01",
    correlationId: "corr_01",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.tenantId, "tenant_01");
  assert.equal(result.value.sessionId, "session_01");
  assert.equal(result.value.requestId, "request_01");
  assert.equal(result.value.correlationId, "corr_01");
});

test("optional IDs are trimmed", () => {
  const result = createSecurityContext({
    actor: validActor,
    tenantId: "  tenant_trim  ",
    sessionId: "  session_trim  ",
    requestId: "  request_trim  ",
    correlationId: "  corr_trim  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.tenantId, "tenant_trim");
  assert.equal(result.value.sessionId, "session_trim");
  assert.equal(result.value.requestId, "request_trim");
  assert.equal(result.value.correlationId, "corr_trim");
});

test("invalid tenantId is rejected", () => {
  const result = createSecurityContext({
    actor: validActor,
    tenantId: "   ",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, SECURITY_CONTEXT_ERROR.IDENTIFIER_INVALID);
  assert.equal(result.error.field, "tenantId");
});

test("invalid sessionId is rejected", () => {
  const result = createSecurityContext({
    actor: validActor,
    sessionId: "",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, SECURITY_CONTEXT_ERROR.IDENTIFIER_INVALID);
  assert.equal(result.error.field, "sessionId");
});

test("invalid requestId is rejected", () => {
  const result = createSecurityContext({
    actor: validActor,
    requestId: 99,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, SECURITY_CONTEXT_ERROR.IDENTIFIER_INVALID);
  assert.equal(result.error.field, "requestId");
});

test("invalid correlationId is rejected", () => {
  const result = createSecurityContext({
    actor: validActor,
    correlationId: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, SECURITY_CONTEXT_ERROR.IDENTIFIER_INVALID);
  assert.equal(result.error.field, "correlationId");
});

test("omitted optional fields are not auto-created", () => {
  const result = createSecurityContext({ actor: validActor });
  assert.equal(result.ok, true);
  assert.equal(result.value.tenantId, undefined);
  assert.equal(result.value.sessionId, undefined);
  assert.equal(result.value.requestId, undefined);
  assert.equal(result.value.correlationId, undefined);
  assert.equal(JSON.stringify(result.value), '{"actor":{"actorType":"USER","actorId":"actor-1"}}');
});

test("no role or permission is synthesized", () => {
  const result = createSecurityContext({ actor: validActor });
  assert.equal(result.ok, true);
  assert.equal("role" in result.value, false);
  assert.equal("roles" in result.value, false);
  assert.equal("permission" in result.value, false);
  assert.equal("permissions" in result.value, false);
  assert.equal("authorized" in result.value, false);
});

test("output is immutable", () => {
  const result = createSecurityContext({
    actor: validActor,
    tenantId: "tenant_locked",
  });
  assert.equal(result.ok, true);
  assert.throws(() => {
    result.value.tenantId = "changed";
  }, TypeError);
  assert.throws(() => {
    result.value.actor = createActorReference({
      actorType: "SYSTEM",
      actorId: "sys-1",
    }).value;
  }, TypeError);
  assert.equal(result.value.tenantId, "tenant_locked");
});

test("isSecurityContext true/false is correct", () => {
  const valid = createSecurityContext({ actor: validActor }).value;
  assert.equal(isSecurityContext(valid), true);
  assert.equal(isSecurityContext({ actor: { actorType: "", actorId: "x" } }), false);
  assert.equal(isSecurityContext(null), false);
  assert.equal(isSecurityContext({}), false);
});

test("securityContext does not generate optional identifiers", () => {
  const sourcePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "securityContext.js"
  );
  const source = fs.readFileSync(sourcePath, "utf8");
  assert.equal(source.includes("Date.now"), false);
  assert.equal(source.includes("randomUUID"), false);
  assert.equal(source.includes("DEFAULT_TENANT_ID"), false);
  assert.equal(source.includes("localStorage"), false);
  assert.equal(source.includes("process.env"), false);
  assert.equal(/function\s+generate/i.test(source), false);

  const result = createSecurityContext({ actor: validActor });
  assert.equal(result.ok, true);
  assert.equal("tenantId" in result.value, false);
  assert.equal("sessionId" in result.value, false);
  assert.equal("requestId" in result.value, false);
  assert.equal("correlationId" in result.value, false);
});
