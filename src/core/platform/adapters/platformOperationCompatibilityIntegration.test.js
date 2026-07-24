/**
 * Cross-boundary Operation/Compatibility ↔ Platform Core integration certification.
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

const OPERATION_COMPATIBILITY_EXPORT_NAMES = Object.freeze([
  "projectIdempotencyKey",
  "IDEMPOTENCY_KEY_ADAPTER_ERROR",
  "projectOperationIdentity",
  "OPERATION_IDENTITY_ADAPTER_ERROR",
  "projectContractVersion",
  "CONTRACT_VERSION_ADAPTER_ERROR",
  "projectCompatibilityDecision",
  "COMPATIBILITY_DECISION_ADAPTER_ERROR",
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

const OPERATION_COMPATIBILITY_CAPABILITY_CODES = Object.freeze([
  "IDEMPOTENCY_KEY_ADAPTER",
  "OPERATION_IDENTITY_ADAPTER",
  "CONTRACT_VERSION_ADAPTER",
  "COMPATIBILITY_DECISION_ADAPTER",
]);

const IDENTITY_TENANT_CAPABILITY_CODES = Object.freeze([
  "IDENTITY_ACTOR_ADAPTER",
  "SECURITY_CONTEXT_ADAPTER",
  "TENANT_SCOPE_ADAPTER",
  "PERMISSION_CODE_ADAPTER",
  "AUTHORIZATION_REQUEST_ADAPTER",
  "AUTHORIZATION_DECISION_ADAPTER",
]);

const EVENT_AUDIT_CAPABILITY_CODES = Object.freeze([
  "EVENT_TRACE_CONTEXT_ADAPTER",
  "COMMON_EVENT_ENVELOPE_ADAPTER",
  "AUDIT_EVENT_ENVELOPE_ADAPTER",
  "EVENT_ERROR_DESCRIPTOR_ADAPTER",
]);

test("33. public Operation/Compatibility adapter exports exist on Platform Core surface", () => {
  for (const name of OPERATION_COMPATIBILITY_EXPORT_NAMES) {
    assert.equal(name in publicSurface, true, `missing public export ${name}`);
    assert.equal(publicSurface[name], adapters[name]);
  }
});

test("34. capability manifest remains unique and immutable with Operation/Compatibility adapters", () => {
  const codes = PLATFORM_CAPABILITY_MANIFEST.map((item) => item.capabilityCode);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(Object.isFrozen(PLATFORM_CAPABILITY_MANIFEST), true);

  for (const code of OPERATION_COMPATIBILITY_CAPABILITY_CODES) {
    assert.equal(codes.includes(code), true, `missing ${code}`);
  }
  for (const code of IDENTITY_TENANT_CAPABILITY_CODES) {
    assert.equal(codes.includes(code), true, `missing ${code}`);
  }
  for (const code of EVENT_AUDIT_CAPABILITY_CODES) {
    assert.equal(codes.includes(code), true, `missing ${code}`);
  }

  const byCode = new Map(
    PLATFORM_CAPABILITY_MANIFEST.map((item) => [item.capabilityCode, item])
  );
  for (const code of OPERATION_COMPATIBILITY_CAPABILITY_CODES) {
    assert.equal(byCode.get(code).status, "ADAPTER_AVAILABLE");
    assert.equal(byCode.get(code).ownerModule, "platform-core");
    assert.notEqual(byCode.get(code).status, "PRODUCTION_READY");
    assert.notEqual(byCode.get(code).status, "RUNTIME_ADOPTED");
  }
});

test("35. Identity/Tenant adapters remain available", () => {
  for (const name of IDENTITY_TENANT_EXPORT_NAMES) {
    assert.equal(name in publicSurface, true, `missing ${name}`);
  }

  const actor = publicSurface.projectIdentityActor({
    actorType: "USER",
    actorId: "still-available-op",
  });
  assert.equal(actor.ok, true);
});

test("36. Event/Audit adapters remain available", () => {
  for (const name of EVENT_AUDIT_EXPORT_NAMES) {
    assert.equal(name in publicSurface, true, `missing ${name}`);
  }

  const trace = publicSurface.projectEventTraceContext({
    correlationId: "corr-still",
  });
  assert.equal(trace.ok, true);
});

test("37. legacy Platform Core scaffold remains compatible", () => {
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

test("cross-boundary flow: key → identity → version → compatibility decision", () => {
  const key = publicSurface.projectIdempotencyKey("integration-idem-1");
  assert.equal(key.ok, true);
  assert.equal(publicSurface.isIdempotencyKey(key.value), true);

  const identity = publicSurface.projectOperationIdentity({
    operationId: "op-integration-1",
    idempotencyKey: key.value,
    correlationId: "corr-integration-1",
  });
  assert.equal(identity.ok, true);
  assert.equal(publicSurface.isOperationIdentity(identity.value), true);
  assert.equal(identity.value.idempotencyKey, key.value);

  const current = publicSurface.projectContractVersion("1.0.0");
  const required = publicSurface.projectContractVersion("1.0.0");
  assert.equal(current.ok, true);
  assert.equal(required.ok, true);

  const decision = publicSurface.projectCompatibilityDecision({
    compatible: true,
    decisionCode: "SAME_OPAQUE_VERSION",
    currentVersion: current.value,
    requiredVersion: required.value,
    reason: "caller-resolved match",
  });
  assert.equal(decision.ok, true);
  assert.equal(publicSurface.isCompatibilityDecision(decision.value), true);
  assert.equal(decision.value.compatible, true);
  assert.equal(decision.value.currentVersion, "1.0.0");
  assert.equal(decision.value.requiredVersion, "1.0.0");
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

test("Operation/Compatibility adapter tree has no Date.now / randomUUID / persistence / migration", () => {
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

  const opCompatDir = path.join(ADAPTERS_DIR, "operationCompatibility");
  for (const filePath of walk(opCompatDir)) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.equal(/Date\.now\s*\(/.test(source), false, filePath);
    assert.equal(/randomUUID\s*\(/.test(source), false, filePath);
    assert.equal(/Math\.random\s*\(/.test(source), false, filePath);
    assert.equal(/\brunMigration\s*\(/.test(source), false, filePath);
    assert.equal(/localStorage\./.test(source), false, filePath);
    assert.equal(/process\.env/.test(source), false, filePath);
    assert.equal(/src\/features\//.test(source), false, filePath);
    assert.equal(/req\.headers/.test(source), false, filePath);
  }
});
