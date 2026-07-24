/**
 * Integration/Capability adoption adapter certification tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  projectIntegrationPortDescriptor,
  projectPlatformCapabilityDescriptor,
  INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR,
  PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER_ERROR,
} from "./index.js";
import {
  isIntegrationPortDescriptor,
  isPlatformCapabilityDescriptor,
  projectIdentityActor,
  projectTenantScope,
  projectEventTraceContext,
  projectOperationIdentity,
  projectCompatibilityDecision,
  PLATFORM_CAPABILITY_MANIFEST,
  listPlatformCapabilities,
  findPlatformCapability,
  hasPlatformCapability,
} from "../../index.js";

const ADAPTER_DIR = path.dirname(fileURLToPath(import.meta.url));

function readAdapterSources() {
  const files = fs
    .readdirSync(ADAPTER_DIR)
    .filter((name) => name.endsWith(".js") && !name.endsWith(".test.js"));
  return files.map((name) => ({
    name,
    source: fs.readFileSync(path.join(ADAPTER_DIR, name), "utf8"),
  }));
}

test("1. valid minimal Integration Port Descriptor projection", () => {
  const result = projectIntegrationPortDescriptor({
    portName: "billing.port",
    ownerModule: "finance",
    direction: "INBOUND",
  });
  assert.equal(result.ok, true);
  assert.equal(isIntegrationPortDescriptor(result.value), true);
  assert.equal(result.value.portName, "billing.port");
  assert.equal(result.value.ownerModule, "finance");
  assert.equal(result.value.direction, "INBOUND");
  assert.equal("version" in result.value, false);
});

test("2. valid versioned Integration Port Descriptor projection", () => {
  const result = projectIntegrationPortDescriptor({
    portName: "billing.port",
    ownerModule: "finance",
    direction: "OUTBOUND",
    version: "1.2.0",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.version, "1.2.0");
});

test("3. required portName", () => {
  assert.equal(
    projectIntegrationPortDescriptor({
      ownerModule: "finance",
      direction: "INBOUND",
    }).error.code,
    INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR.PORT_NAME_REQUIRED
  );
});

test("4. required ownerModule", () => {
  assert.equal(
    projectIntegrationPortDescriptor({
      portName: "billing.port",
      direction: "INBOUND",
    }).error.code,
    INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR.OWNER_MODULE_REQUIRED
  );
});

test("5. required direction", () => {
  assert.equal(
    projectIntegrationPortDescriptor({
      portName: "billing.port",
      ownerModule: "finance",
    }).error.code,
    INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR.DIRECTION_REQUIRED
  );
});

test("6. no direction inference", () => {
  const result = projectIntegrationPortDescriptor({
    portName: "billing.port",
    ownerModule: "finance",
    direction: undefined,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR.DIRECTION_REQUIRED
  );
});

test("7. no version default", () => {
  const result = projectIntegrationPortDescriptor({
    portName: "billing.port",
    ownerModule: "finance",
    direction: "INBOUND",
  });
  assert.equal(result.ok, true);
  assert.equal("version" in result.value, false);
  assert.equal(result.value.version, undefined);
});

test("8. no port implementation creation", () => {
  const sources = readAdapterSources();
  for (const { name, source } of sources) {
    assert.equal(/createClient\s*\(/.test(source), false, name);
    assert.equal(/new\s+\w*Port\b/.test(source), false, name);
    assert.equal(/implementPort/.test(source), false, name);
    assert.equal(/registerPort/.test(source), false, name);
  }
});

test("9. no service/client construction", () => {
  const sources = readAdapterSources();
  for (const { name, source } of sources) {
    assert.equal(/axios|fetch\s*\(|http\.request|SupabaseClient/.test(source), false, name);
    assert.equal(/dependencyInjection|createContainer|inject\s*\(/.test(source), false, name);
  }
});

test("10. valid minimal Platform Capability Descriptor projection", () => {
  const result = projectPlatformCapabilityDescriptor({
    capabilityCode: "CUSTOM_CAP",
    ownerModule: "platform-core",
  });
  assert.equal(result.ok, true);
  assert.equal(isPlatformCapabilityDescriptor(result.value), true);
  assert.equal(result.value.capabilityCode, "CUSTOM_CAP");
  assert.equal(result.value.ownerModule, "platform-core");
  assert.equal("version" in result.value, false);
  assert.equal("status" in result.value, false);
});

test("11. valid full Platform Capability Descriptor projection", () => {
  const result = projectPlatformCapabilityDescriptor({
    capabilityCode: "CUSTOM_CAP_FULL",
    ownerModule: "platform-core",
    version: "2.0.0",
    status: "ADAPTER_AVAILABLE",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.version, "2.0.0");
  assert.equal(result.value.status, "ADAPTER_AVAILABLE");
});

test("12. no status inference", () => {
  const result = projectPlatformCapabilityDescriptor({
    capabilityCode: "NO_STATUS",
    ownerModule: "platform-core",
  });
  assert.equal(result.ok, true);
  assert.equal("status" in result.value, false);
});

test("13. no production-readiness inference", () => {
  const result = projectPlatformCapabilityDescriptor({
    capabilityCode: "NO_PROD",
    ownerModule: "platform-core",
    status: "ADAPTER_AVAILABLE",
  });
  assert.equal(result.ok, true);
  assert.notEqual(result.value.status, "PRODUCTION_READY");
  assert.notEqual(result.value.status, "RUNTIME_ADOPTED");
});

test("14. no capability execution", () => {
  const sources = readAdapterSources();
  for (const { name, source } of sources) {
    assert.equal(/executeCapability|invokeCapability|runCapability/.test(source), false, name);
  }
  const projected = projectPlatformCapabilityDescriptor({
    capabilityCode: "RESULT",
    ownerModule: "platform-core",
  });
  assert.equal(projected.ok, true);
  assert.equal(typeof projected.value, "object");
  assert.equal("execute" in projected.value, false);
});

test("15. no registry mutation", () => {
  const before = PLATFORM_CAPABILITY_MANIFEST.length;
  const beforeCodes = PLATFORM_CAPABILITY_MANIFEST.map((item) => item.capabilityCode);
  projectPlatformCapabilityDescriptor({
    capabilityCode: "SHOULD_NOT_REGISTER",
    ownerModule: "platform-core",
  });
  assert.equal(PLATFORM_CAPABILITY_MANIFEST.length, before);
  assert.deepEqual(
    PLATFORM_CAPABILITY_MANIFEST.map((item) => item.capabilityCode),
    beforeCodes
  );
  assert.equal(hasPlatformCapability("SHOULD_NOT_REGISTER"), false);
});

test("31. input objects are not mutated", () => {
  const portInput = {
    portName: "  port.a  ",
    ownerModule: "  mod.a  ",
    direction: "  INBOUND  ",
    version: "  1.0.0  ",
  };
  const portSnapshot = structuredClone(portInput);
  const portResult = projectIntegrationPortDescriptor(portInput);
  assert.equal(portResult.ok, true);
  assert.deepEqual(portInput, portSnapshot);

  const capInput = {
    capabilityCode: "  CODE  ",
    ownerModule: "  platform-core  ",
    version: "  1.0.0  ",
    status: "  ADAPTER_AVAILABLE  ",
  };
  const capSnapshot = structuredClone(capInput);
  const capResult = projectPlatformCapabilityDescriptor(capInput);
  assert.equal(capResult.ok, true);
  assert.deepEqual(capInput, capSnapshot);
});

test("32. public adapter exports exist", () => {
  assert.equal(typeof projectIntegrationPortDescriptor, "function");
  assert.equal(typeof projectPlatformCapabilityDescriptor, "function");
});

test("33. public discovery exports exist", () => {
  assert.equal(typeof listPlatformCapabilities, "function");
  assert.equal(typeof findPlatformCapability, "function");
  assert.equal(typeof hasPlatformCapability, "function");
});

test("36. Identity/Tenant adapters remain available", () => {
  const actor = projectIdentityActor({
    actorType: "USER",
    actorId: "ic-actor",
  });
  assert.equal(actor.ok, true);
  const scope = projectTenantScope({ scopeType: "TENANT", tenantId: "t-ic" });
  assert.equal(scope.ok, true);
});

test("37. Event/Audit adapters remain available", () => {
  const trace = projectEventTraceContext({ correlationId: "corr-ic" });
  assert.equal(trace.ok, true);
});

test("38. Operation/Compatibility adapters remain available", () => {
  const identity = projectOperationIdentity({ operationId: "op-ic" });
  assert.equal(identity.ok, true);
  const decision = projectCompatibilityDecision({
    compatible: true,
    decisionCode: "OK",
  });
  assert.equal(decision.ok, true);
});

test("40. legacy Platform Core scaffold remains compatible via public surface", async () => {
  const surface = await import("../../index.js");
  assert.equal(typeof surface.createTenantRecord, "function");
  assert.equal(typeof surface.getCorePlatformSeed, "function");
});

test("41. no Business Module import", () => {
  const sources = readAdapterSources();
  for (const { name, source } of sources) {
    assert.equal(/src\/features\//.test(source), false, name);
    assert.equal(/src\/auth\//.test(source), false, name);
    assert.equal(/supabase/i.test(source), false, name);
  }
});

test("boundary: no filesystem scan / module loading / network / env / storage / mutable registry", () => {
  const sources = readAdapterSources();
  for (const { name, source } of sources) {
    assert.equal(/readdirSync|readdir\s*\(|fs\.promises/.test(source), false, name);
    assert.equal(/(?:^|\n)\s*import\s*\(|(?:^|\n)\s*require\s*\(/.test(source), false, name);
    assert.equal(/fetch\s*\(|createClient|axios/.test(source), false, name);
    assert.equal(/process\.env|localStorage/.test(source), false, name);
    assert.equal(/new\s+Map\s*\(|new\s+Set\s*\(/.test(source), false, name);
    assert.equal(/registerCapability|unregisterCapability/.test(source), false, name);
    assert.equal(/Date\.now\s*\(|randomUUID\s*\(/.test(source), false, name);
  }
});

test("invalid version fails through Contract Version adapter", () => {
  assert.equal(
    projectIntegrationPortDescriptor({
      portName: "p",
      ownerModule: "m",
      direction: "INBOUND",
      version: "   ",
    }).error.code,
    INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR.VERSION_INVALID
  );
  assert.equal(
    projectPlatformCapabilityDescriptor({
      capabilityCode: "C",
      ownerModule: "platform-core",
      version: "",
    }).error.code,
    PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER_ERROR.VERSION_INVALID
  );
});

test("non-object inputs are rejected", () => {
  assert.equal(
    projectIntegrationPortDescriptor(null).error.code,
    INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR.INVALID
  );
  assert.equal(
    projectPlatformCapabilityDescriptor("x").error.code,
    PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER_ERROR.INVALID
  );
});
