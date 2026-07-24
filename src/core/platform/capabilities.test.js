/**
 * Platform Core capability manifest certification (Phase 2A + adapters).
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PLATFORM_CAPABILITY_MANIFEST,
} from "./capabilities.js";
import {
  createPlatformCapabilityDescriptor,
  isPlatformCapabilityDescriptor,
} from "./contracts/platformCapabilityDescriptor.js";

const PLATFORM_DIR = path.dirname(fileURLToPath(import.meta.url));

const ADAPTER_CAPABILITY_CODES = Object.freeze([
  "IDENTITY_ACTOR_ADAPTER",
  "SECURITY_CONTEXT_ADAPTER",
  "TENANT_SCOPE_ADAPTER",
  "PERMISSION_CODE_ADAPTER",
  "AUTHORIZATION_REQUEST_ADAPTER",
  "AUTHORIZATION_DECISION_ADAPTER",
]);

const EVENT_AUDIT_ADAPTER_CAPABILITY_CODES = Object.freeze([
  "EVENT_TRACE_CONTEXT_ADAPTER",
  "COMMON_EVENT_ENVELOPE_ADAPTER",
  "AUDIT_EVENT_ENVELOPE_ADAPTER",
  "EVENT_ERROR_DESCRIPTOR_ADAPTER",
]);

const OPERATION_COMPATIBILITY_ADAPTER_CAPABILITY_CODES = Object.freeze([
  "IDEMPOTENCY_KEY_ADAPTER",
  "OPERATION_IDENTITY_ADAPTER",
  "CONTRACT_VERSION_ADAPTER",
  "COMPATIBILITY_DECISION_ADAPTER",
]);

const INTEGRATION_CAPABILITY_ADAPTER_CAPABILITY_CODES = Object.freeze([
  "INTEGRATION_PORT_DESCRIPTOR_ADAPTER",
  "PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER",
]);

const CAPABILITY_DISCOVERY_CODES = Object.freeze([
  "CAPABILITY_DISCOVERY",
]);

const AUTHORITATIVE_MANIFEST_COUNT = 37;

test("capability manifest is a non-empty frozen list", () => {
  assert.equal(Array.isArray(PLATFORM_CAPABILITY_MANIFEST), true);
  assert.ok(PLATFORM_CAPABILITY_MANIFEST.length >= 1);
  assert.equal(Object.isFrozen(PLATFORM_CAPABILITY_MANIFEST), true);
});

test("every capability item is a valid immutable descriptor", () => {
  for (const item of PLATFORM_CAPABILITY_MANIFEST) {
    assert.equal(isPlatformCapabilityDescriptor(item), true);
    assert.equal(Object.isFrozen(item), true);
    assert.equal(typeof item.capabilityCode, "string");
    assert.equal(item.ownerModule, "platform-core");
    assert.equal(item.version, "1.0.0");
    assert.ok(
      item.status === "CONTRACT_AVAILABLE" ||
        item.status === "ADAPTER_AVAILABLE" ||
        item.status === "DISCOVERY_AVAILABLE",
      `${item.capabilityCode} status must be CONTRACT_AVAILABLE, ADAPTER_AVAILABLE, or DISCOVERY_AVAILABLE`
    );
    assert.notEqual(item.status, "PRODUCTION_READY");
    assert.notEqual(item.status, "RUNTIME_ADOPTED");
  }
});

test("capability codes are unique", () => {
  const codes = PLATFORM_CAPABILITY_MANIFEST.map((item) => item.capabilityCode);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(PLATFORM_CAPABILITY_MANIFEST.length, AUTHORITATIVE_MANIFEST_COUNT);
});

test("identity/tenant adapter capabilities are present with ADAPTER_AVAILABLE", () => {
  const byCode = new Map(
    PLATFORM_CAPABILITY_MANIFEST.map((item) => [item.capabilityCode, item])
  );
  for (const code of ADAPTER_CAPABILITY_CODES) {
    assert.equal(byCode.has(code), true, `missing capability ${code}`);
    assert.equal(byCode.get(code).status, "ADAPTER_AVAILABLE");
    assert.equal(byCode.get(code).ownerModule, "platform-core");
  }
});

test("event/audit adapter capabilities are present with ADAPTER_AVAILABLE", () => {
  const byCode = new Map(
    PLATFORM_CAPABILITY_MANIFEST.map((item) => [item.capabilityCode, item])
  );
  for (const code of EVENT_AUDIT_ADAPTER_CAPABILITY_CODES) {
    assert.equal(byCode.has(code), true, `missing capability ${code}`);
    assert.equal(byCode.get(code).status, "ADAPTER_AVAILABLE");
    assert.equal(byCode.get(code).ownerModule, "platform-core");
    assert.notEqual(byCode.get(code).status, "PRODUCTION_READY");
    assert.notEqual(byCode.get(code).status, "RUNTIME_ADOPTED");
  }
});

test("operation/compatibility adapter capabilities are present with ADAPTER_AVAILABLE", () => {
  const byCode = new Map(
    PLATFORM_CAPABILITY_MANIFEST.map((item) => [item.capabilityCode, item])
  );
  for (const code of OPERATION_COMPATIBILITY_ADAPTER_CAPABILITY_CODES) {
    assert.equal(byCode.has(code), true, `missing capability ${code}`);
    assert.equal(byCode.get(code).status, "ADAPTER_AVAILABLE");
    assert.equal(byCode.get(code).ownerModule, "platform-core");
    assert.notEqual(byCode.get(code).status, "PRODUCTION_READY");
    assert.notEqual(byCode.get(code).status, "RUNTIME_ADOPTED");
  }
});

test("integration/capability adapter capabilities are present with ADAPTER_AVAILABLE", () => {
  const byCode = new Map(
    PLATFORM_CAPABILITY_MANIFEST.map((item) => [item.capabilityCode, item])
  );
  for (const code of INTEGRATION_CAPABILITY_ADAPTER_CAPABILITY_CODES) {
    assert.equal(byCode.has(code), true, `missing capability ${code}`);
    assert.equal(byCode.get(code).status, "ADAPTER_AVAILABLE");
    assert.equal(byCode.get(code).ownerModule, "platform-core");
    assert.notEqual(byCode.get(code).status, "PRODUCTION_READY");
    assert.notEqual(byCode.get(code).status, "RUNTIME_ADOPTED");
  }
});

test("capability discovery is present with DISCOVERY_AVAILABLE", () => {
  const byCode = new Map(
    PLATFORM_CAPABILITY_MANIFEST.map((item) => [item.capabilityCode, item])
  );
  for (const code of CAPABILITY_DISCOVERY_CODES) {
    assert.equal(byCode.has(code), true, `missing capability ${code}`);
    assert.equal(byCode.get(code).status, "DISCOVERY_AVAILABLE");
    assert.equal(byCode.get(code).ownerModule, "platform-core");
    assert.notEqual(byCode.get(code).status, "PRODUCTION_READY");
    assert.notEqual(byCode.get(code).status, "RUNTIME_ADOPTED");
  }
});

test("manifest mutation is rejected", () => {
  assert.throws(() => {
    /** @type {any} */ (PLATFORM_CAPABILITY_MANIFEST).push({
      capabilityCode: "X",
      ownerModule: "platform-core",
    });
  }, TypeError);

  assert.throws(() => {
    /** @type {any} */ (PLATFORM_CAPABILITY_MANIFEST[0]).capabilityCode = "MUTATED";
  }, TypeError);
});

test("development constructor rejects duplicate capability codes", () => {
  const source = fs.readFileSync(
    path.join(PLATFORM_DIR, "capabilities.js"),
    "utf8"
  );
  assert.match(source, /Duplicate Platform Core capabilityCode/);

  function createImmutableCapabilityManifest(entries) {
    const seen = new Set();
    const items = [];
    for (const entry of entries) {
      const capabilityCode = entry.capabilityCode;
      if (seen.has(capabilityCode)) {
        throw new Error(
          `Duplicate Platform Core capabilityCode: ${capabilityCode}`
        );
      }
      seen.add(capabilityCode);
      const result = createPlatformCapabilityDescriptor({
        capabilityCode,
        ownerModule: "platform-core",
        version: "1.0.0",
        status: entry.status,
      });
      if (!result.ok) {
        throw new Error(result.error.code);
      }
      items.push(result.value);
    }
    return Object.freeze(items);
  }

  assert.throws(
    () =>
      createImmutableCapabilityManifest([
        { capabilityCode: "RESULT", status: "CONTRACT_AVAILABLE" },
        { capabilityCode: "RESULT", status: "CONTRACT_AVAILABLE" },
      ]),
    /Duplicate Platform Core capabilityCode: RESULT/
  );
});

test("capabilities module has no Business Module or runtime side effects", () => {
  const source = fs.readFileSync(
    path.join(PLATFORM_DIR, "capabilities.js"),
    "utf8"
  );
  assert.equal(/src\/features\//.test(source), false);
  assert.equal(/src\/auth\//.test(source), false);
  assert.equal(/supabase/i.test(source), false);
  assert.equal(/localStorage/.test(source), false);
  assert.equal(/process\.env/.test(source), false);
  assert.equal(/fetch\s*\(/.test(source), false);
  assert.equal(/createClient/.test(source), false);
});
