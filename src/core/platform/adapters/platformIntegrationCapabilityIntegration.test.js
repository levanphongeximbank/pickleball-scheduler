/**
 * Cross-boundary Integration/Capability ↔ Platform Core integration certification.
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

const INTEGRATION_CAPABILITY_EXPORT_NAMES = Object.freeze([
  "projectIntegrationPortDescriptor",
  "INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR",
  "projectPlatformCapabilityDescriptor",
  "PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER_ERROR",
]);

const DISCOVERY_EXPORT_NAMES = Object.freeze([
  "listPlatformCapabilities",
  "findPlatformCapability",
  "hasPlatformCapability",
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

const INTEGRATION_CAPABILITY_CODES = Object.freeze([
  "INTEGRATION_PORT_DESCRIPTOR_ADAPTER",
  "PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER",
  "CAPABILITY_DISCOVERY",
]);

const AUTHORITATIVE_MANIFEST_COUNT = 37;

test("32. public Integration/Capability adapter exports exist on Platform Core surface", () => {
  for (const name of INTEGRATION_CAPABILITY_EXPORT_NAMES) {
    assert.equal(name in publicSurface, true, `missing public export ${name}`);
    assert.equal(publicSurface[name], adapters[name]);
  }
});

test("33. public discovery exports exist on Platform Core surface", () => {
  for (const name of DISCOVERY_EXPORT_NAMES) {
    assert.equal(name in publicSurface, true, `missing public export ${name}`);
    assert.equal(typeof publicSurface[name], "function");
  }
});

test("34. capability manifest remains unique and immutable with final adapters", () => {
  const codes = PLATFORM_CAPABILITY_MANIFEST.map((item) => item.capabilityCode);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(Object.isFrozen(PLATFORM_CAPABILITY_MANIFEST), true);
  assert.equal(PLATFORM_CAPABILITY_MANIFEST.length, AUTHORITATIVE_MANIFEST_COUNT);

  for (const code of INTEGRATION_CAPABILITY_CODES) {
    assert.equal(codes.includes(code), true, `missing ${code}`);
  }

  const byCode = new Map(
    PLATFORM_CAPABILITY_MANIFEST.map((item) => [item.capabilityCode, item])
  );
  assert.equal(byCode.get("INTEGRATION_PORT_DESCRIPTOR_ADAPTER").status, "ADAPTER_AVAILABLE");
  assert.equal(byCode.get("PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER").status, "ADAPTER_AVAILABLE");
  assert.equal(byCode.get("CAPABILITY_DISCOVERY").status, "DISCOVERY_AVAILABLE");

  for (const code of INTEGRATION_CAPABILITY_CODES) {
    assert.equal(byCode.get(code).ownerModule, "platform-core");
    assert.notEqual(byCode.get(code).status, "PRODUCTION_READY");
    assert.notEqual(byCode.get(code).status, "RUNTIME_ADOPTED");
  }
});

test("36. Identity/Tenant adapters remain available", () => {
  for (const name of IDENTITY_TENANT_EXPORT_NAMES) {
    assert.equal(name in publicSurface, true, `missing ${name}`);
  }
  const actor = publicSurface.projectIdentityActor({
    actorType: "USER",
    actorId: "still-available-ic",
  });
  assert.equal(actor.ok, true);
});

test("37. Event/Audit adapters remain available", () => {
  for (const name of EVENT_AUDIT_EXPORT_NAMES) {
    assert.equal(name in publicSurface, true, `missing ${name}`);
  }
  const trace = publicSurface.projectEventTraceContext({
    correlationId: "corr-still-ic",
  });
  assert.equal(trace.ok, true);
});

test("38. Operation/Compatibility adapters remain available", () => {
  for (const name of OPERATION_COMPATIBILITY_EXPORT_NAMES) {
    assert.equal(name in publicSurface, true, `missing ${name}`);
  }
  const identity = publicSurface.projectOperationIdentity({
    operationId: "op-still-ic",
  });
  assert.equal(identity.ok, true);
});

test("39. all Phase 1 contract exports remain available", () => {
  for (const name of [
    "ok",
    "fail",
    "createIntegrationPortDescriptor",
    "createPlatformCapabilityDescriptor",
    "createOperationIdentity",
    "createCompatibilityDecision",
  ]) {
    assert.equal(typeof publicSurface[name], "function", name);
  }
});

test("40. legacy Platform Core scaffold remains compatible", () => {
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
});

test("cross-boundary flow: port descriptor → capability descriptor → discovery", () => {
  const port = publicSurface.projectIntegrationPortDescriptor({
    portName: "integration.example",
    ownerModule: "platform-core",
    direction: "BIDIRECTIONAL",
    version: "1.0.0",
  });
  assert.equal(port.ok, true);
  assert.equal(publicSurface.isIntegrationPortDescriptor(port.value), true);

  const capability = publicSurface.projectPlatformCapabilityDescriptor({
    capabilityCode: "EXAMPLE_CALLER_CAPABILITY",
    ownerModule: "platform-core",
    version: "1.0.0",
    status: "ADAPTER_AVAILABLE",
  });
  assert.equal(capability.ok, true);
  assert.equal(publicSurface.isPlatformCapabilityDescriptor(capability.value), true);

  const listed = publicSurface.listPlatformCapabilities();
  assert.equal(listed, PLATFORM_CAPABILITY_MANIFEST);
  assert.equal(
    publicSurface.findPlatformCapability("CAPABILITY_DISCOVERY")?.capabilityCode,
    "CAPABILITY_DISCOVERY"
  );
  assert.equal(publicSurface.hasPlatformCapability("INTEGRATION_PORT_DESCRIPTOR_ADAPTER"), true);
  assert.equal(publicSurface.hasPlatformCapability("EXAMPLE_CALLER_CAPABILITY"), false);
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

  const discoverySource = fs.readFileSync(
    path.join(PLATFORM_DIR, "capabilityDiscovery.js"),
    "utf8"
  );
  assert.equal(
    /from\s+["']\.\/index\.js["']/.test(discoverySource),
    false,
    "discovery must not import public platform index"
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

test("Integration/Capability adapter tree has no Date.now / randomUUID / persistence / Business Modules", () => {
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

  const integrationDir = path.join(ADAPTERS_DIR, "integrationCapability");
  for (const filePath of walk(integrationDir)) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.equal(/Date\.now\s*\(/.test(source), false, filePath);
    assert.equal(/randomUUID\s*\(/.test(source), false, filePath);
    assert.equal(/Math\.random\s*\(/.test(source), false, filePath);
    assert.equal(/localStorage\./.test(source), false, filePath);
    assert.equal(/process\.env/.test(source), false, filePath);
    assert.equal(/src\/features\//.test(source), false, filePath);
    assert.equal(/supabase/i.test(source), false, filePath);
  }
});
