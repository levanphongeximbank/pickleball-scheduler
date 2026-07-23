import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createPlatformCapabilityDescriptor,
  isPlatformCapabilityDescriptor,
  PLATFORM_CAPABILITY_DESCRIPTOR_ERROR,
} from "./platformCapabilityDescriptor.js";

test("valid minimal platform capability descriptor", () => {
  const result = createPlatformCapabilityDescriptor({
    capabilityCode: "AUTHORIZATION_DECISION",
    ownerModule: "platform-core",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.capabilityCode, "AUTHORIZATION_DECISION");
  assert.equal(result.value.ownerModule, "platform-core");
  assert.equal("version" in result.value, false);
  assert.equal("status" in result.value, false);
});

test("valid full platform capability descriptor", () => {
  const result = createPlatformCapabilityDescriptor({
    capabilityCode: "  ROLE_CODE  ",
    ownerModule: "  platform-core  ",
    version: "  1.0  ",
    status: "  available  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.capabilityCode, "ROLE_CODE");
  assert.equal(result.value.ownerModule, "platform-core");
  assert.equal(result.value.version, "1.0");
  assert.equal(result.value.status, "available");
});

test("empty capabilityCode is rejected", () => {
  const result = createPlatformCapabilityDescriptor({
    capabilityCode: "  ",
    ownerModule: "platform-core",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    PLATFORM_CAPABILITY_DESCRIPTOR_ERROR.CAPABILITY_CODE_INVALID
  );
});

test("non-string ownerModule is rejected", () => {
  const result = createPlatformCapabilityDescriptor({
    capabilityCode: "X",
    ownerModule: 9,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    PLATFORM_CAPABILITY_DESCRIPTOR_ERROR.OWNER_MODULE_INVALID
  );
});

test("invalid version is rejected", () => {
  const result = createPlatformCapabilityDescriptor({
    capabilityCode: "X",
    ownerModule: "platform-core",
    version: "",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    PLATFORM_CAPABILITY_DESCRIPTOR_ERROR.VERSION_INVALID
  );
});

test("empty status is rejected when provided", () => {
  const result = createPlatformCapabilityDescriptor({
    capabilityCode: "X",
    ownerModule: "platform-core",
    status: "   ",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    PLATFORM_CAPABILITY_DESCRIPTOR_ERROR.STATUS_INVALID
  );
});

test("optional fields absent are not auto-created", () => {
  const result = createPlatformCapabilityDescriptor({
    capabilityCode: "X",
    ownerModule: "platform-core",
  });
  assert.equal(result.ok, true);
  assert.equal("version" in result.value, false);
  assert.equal("status" in result.value, false);
});

test("output is frozen", () => {
  const result = createPlatformCapabilityDescriptor({
    capabilityCode: "X",
    ownerModule: "platform-core",
  });
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(result.value), true);
  assert.throws(() => {
    result.value.capabilityCode = "Y";
  }, TypeError);
});

test("does not maintain registry or load modules", () => {
  const source = fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "platformCapabilityDescriptor.js"
    ),
    "utf8"
  );
  assert.equal(/globalThis|Map\(|autoDiscover|featureFlag/.test(source), false);
  assert.equal(/from ["'].*features\//.test(source), false);
  assert.equal(/supabase/.test(source), false);
  assert.equal(source.includes("Date.now"), false);
  assert.equal(source.includes("randomUUID"), false);
});

test("isPlatformCapabilityDescriptor true/false is correct", () => {
  const valid = createPlatformCapabilityDescriptor({
    capabilityCode: "X",
    ownerModule: "platform-core",
  });
  assert.equal(valid.ok, true);
  assert.equal(isPlatformCapabilityDescriptor(valid.value), true);
  assert.equal(isPlatformCapabilityDescriptor({ capabilityCode: "X" }), false);
  assert.equal(isPlatformCapabilityDescriptor(null), false);
});
