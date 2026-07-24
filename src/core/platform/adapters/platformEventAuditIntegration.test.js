/**
 * Cross-boundary Event/Audit ↔ Platform Core integration certification.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as publicSurface from "../index.js";
import * as adapters from "./index.js";
import { PLATFORM_CAPABILITY_MANIFEST } from "../capabilities.js";

const PLATFORM_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const ADAPTERS_DIR = path.dirname(fileURLToPath(import.meta.url));

const EVENT_AUDIT_EXPORT_NAMES = Object.freeze([
  "projectEventTraceContext",
  "EVENT_TRACE_CONTEXT_ADAPTER_ERROR",
  "projectCommonEventEnvelope",
  "COMMON_EVENT_ENVELOPE_ADAPTER_ERROR",
  "projectAuditEventEnvelope",
  "AUDIT_EVENT_ENVELOPE_ADAPTER_ERROR",
  "projectEventErrorDescriptor",
  "EVENT_ERROR_DESCRIPTOR_ADAPTER_ERROR",
]);

const IDENTITY_TENANT_EXPORT_NAMES = Object.freeze([
  "projectIdentityActor",
  "IDENTITY_ACTOR_ADAPTER_ERROR",
  "projectSecurityContext",
  "SECURITY_CONTEXT_ADAPTER_ERROR",
  "projectTenantScope",
  "TENANT_SCOPE_ADAPTER_ERROR",
  "projectPermissionCode",
  "PERMISSION_CODE_ADAPTER_ERROR",
  "projectAuthorizationRequest",
  "AUTHORIZATION_REQUEST_ADAPTER_ERROR",
  "projectAuthorizationDecision",
  "AUTHORIZATION_DECISION_ADAPTER_ERROR",
]);

const EVENT_AUDIT_CAPABILITY_CODES = Object.freeze([
  "EVENT_TRACE_CONTEXT_ADAPTER",
  "COMMON_EVENT_ENVELOPE_ADAPTER",
  "AUDIT_EVENT_ENVELOPE_ADAPTER",
  "EVENT_ERROR_DESCRIPTOR_ADAPTER",
]);

const IDENTITY_TENANT_CAPABILITY_CODES = Object.freeze([
  "IDENTITY_ACTOR_ADAPTER",
  "SECURITY_CONTEXT_ADAPTER",
  "TENANT_SCOPE_ADAPTER",
  "PERMISSION_CODE_ADAPTER",
  "AUTHORIZATION_REQUEST_ADAPTER",
  "AUTHORIZATION_DECISION_ADAPTER",
]);

test("30. public Event/Audit adapter exports exist on Platform Core surface", () => {
  for (const name of EVENT_AUDIT_EXPORT_NAMES) {
    assert.equal(name in publicSurface, true, `missing public export ${name}`);
    assert.equal(publicSurface[name], adapters[name]);
  }
});

test("31. capability manifest remains unique and immutable with Event/Audit adapters", () => {
  const codes = PLATFORM_CAPABILITY_MANIFEST.map((item) => item.capabilityCode);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(Object.isFrozen(PLATFORM_CAPABILITY_MANIFEST), true);

  for (const code of EVENT_AUDIT_CAPABILITY_CODES) {
    assert.equal(codes.includes(code), true, `missing ${code}`);
  }
  for (const code of IDENTITY_TENANT_CAPABILITY_CODES) {
    assert.equal(codes.includes(code), true, `missing ${code}`);
  }

  const byCode = new Map(
    PLATFORM_CAPABILITY_MANIFEST.map((item) => [item.capabilityCode, item])
  );
  for (const code of EVENT_AUDIT_CAPABILITY_CODES) {
    assert.equal(byCode.get(code).status, "ADAPTER_AVAILABLE");
    assert.equal(byCode.get(code).ownerModule, "platform-core");
    assert.notEqual(byCode.get(code).status, "PRODUCTION_READY");
    assert.notEqual(byCode.get(code).status, "RUNTIME_ADOPTED");
  }
});

test("32. existing Identity/Tenant adapters remain available", () => {
  for (const name of IDENTITY_TENANT_EXPORT_NAMES) {
    assert.equal(name in publicSurface, true, `missing ${name}`);
    assert.equal(typeof publicSurface[name] !== "undefined", true);
  }

  const actor = publicSurface.projectIdentityActor({
    actorType: "USER",
    actorId: "still-available",
  });
  assert.equal(actor.ok, true);
});

test("33. legacy Platform Core scaffold remains compatible", () => {
  for (const name of [
    "createTenantRecord",
    "createUserRecord",
    "assertTenantAccess",
    "canPerformAction",
    "getPermissionMatrix",
    "getRlsPolicyMatrix",
    "createAuditEvent",
    "createNotification",
    "createSubscription",
    "createSetting",
    "getCorePlatformSeed",
  ]) {
    assert.equal(typeof publicSurface[name], "function", name);
  }

  const seed = publicSurface.getCorePlatformSeed();
  assert.ok(Array.isArray(seed.roles));
  assert.ok(Array.isArray(seed.permissions));
});

test("cross-boundary flow: trace → common envelope → audit envelope → error", () => {
  const actor = publicSurface.projectIdentityActor({
    actorType: "USER",
    id: "event-integration-user",
  });
  assert.equal(actor.ok, true);

  const trace = publicSurface.projectEventTraceContext({
    correlationId: "corr-integration",
    causationId: "cause-integration",
  });
  assert.equal(trace.ok, true);

  const payload = { action: "login", outcome: "ok" };
  const common = publicSurface.projectCommonEventEnvelope({
    eventId: "evt-integration-1",
    eventType: "identity.login",
    occurredAt: "2026-07-24T12:00:00.000Z",
    sourceModule: "identity",
    payloadVersion: "1.0.0",
    actor: actor.value,
    tenantId: "tenant-integration",
    subject: {
      subjectType: "USER",
      subjectId: "event-integration-user",
    },
    trace: trace.value,
    payload,
  });
  assert.equal(common.ok, true);
  assert.equal(publicSurface.isCommonEventEnvelope(common.value), true);
  assert.deepEqual(common.value.actor, actor.value);
  assert.deepEqual(common.value.trace, trace.value);
  assert.equal(common.value.payload, payload);

  const audit = publicSurface.projectAuditEventEnvelope({
    eventId: "evt-audit-integration-1",
    eventType: "identity.login",
    occurredAt: "2026-07-24T12:00:00.000Z",
    sourceModule: "identity",
    payloadVersion: "1.0.0",
    actor: actor.value,
    payload,
    sequence: 7,
    streamKey: "identity:login",
    recordedAt: "2026-07-24T12:00:01.000Z",
  });
  assert.equal(audit.ok, true);
  assert.equal(publicSurface.isCommonEventEnvelope(audit.value), true);
  assert.equal("sequence" in audit.value, false);
  assert.equal("streamKey" in audit.value, false);
  assert.equal("recordedAt" in audit.value, false);

  const error = publicSurface.projectEventErrorDescriptor({
    code: "EVENT_REJECTED",
    message: "Rejected by validator",
    retryable: false,
  });
  assert.equal(error.ok, true);
  assert.equal(publicSurface.isPlatformErrorDescriptor(error.value), true);
});

test("adapters do not introduce circular dependency with contracts", () => {
  const contractsIndex = fs.readFileSync(
    path.join(PLATFORM_DIR, "contracts", "index.js"),
    "utf8"
  );
  assert.equal(
    /from\s+["'][^"']*adapters[^"']*["']/.test(contractsIndex),
    false
  );

  const capabilitiesSource = fs.readFileSync(
    path.join(PLATFORM_DIR, "capabilities.js"),
    "utf8"
  );
  assert.equal(
    /from\s+["'][^"']*adapters[^"']*["']/.test(capabilitiesSource),
    false
  );

  const adapterIndex = fs.readFileSync(
    path.join(ADAPTERS_DIR, "index.js"),
    "utf8"
  );
  assert.equal(
    /from\s+["']\.\.\/index\.js["']/.test(adapterIndex),
    false,
    "adapters barrel must not import public platform index"
  );
});

test("Event/Audit adapter tree has no Date.now / randomUUID / publish / persistence", () => {
  function walk(dir) {
    /** @type {string[]} */
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...walk(full));
      } else if (entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")) {
        out.push(full);
      }
    }
    return out;
  }

  const eventAuditDir = path.join(ADAPTERS_DIR, "eventAudit");
  for (const filePath of walk(eventAuditDir)) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.equal(/Date\.now\s*\(/.test(source), false, filePath);
    assert.equal(/randomUUID\s*\(/.test(source), false, filePath);
    assert.equal(/Math\.random\s*\(/.test(source), false, filePath);
    assert.equal(/\bpublishEvent\s*\(/.test(source), false, filePath);
    assert.equal(/\bwriteAuditLog\s*\(/.test(source), false, filePath);
    assert.equal(/localStorage\./.test(source), false, filePath);
    assert.equal(/process\.env/.test(source), false, filePath);
    assert.equal(/src\/features\//.test(source), false, filePath);
  }
});
