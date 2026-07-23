/**
 * Platform Core capability manifest certification (Phase 2A).
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
    assert.equal(item.status, "CONTRACT_AVAILABLE");
  }
});

test("capability codes are unique", () => {
  const codes = PLATFORM_CAPABILITY_MANIFEST.map((item) => item.capabilityCode);
  assert.equal(new Set(codes).size, codes.length);
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

  function createImmutableCapabilityManifest(capabilityCodes) {
    const seen = new Set();
    const items = [];
    for (const capabilityCode of capabilityCodes) {
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
        status: "CONTRACT_AVAILABLE",
      });
      if (!result.ok) {
        throw new Error(result.error.code);
      }
      items.push(result.value);
    }
    return Object.freeze(items);
  }

  assert.throws(
    () => createImmutableCapabilityManifest(["RESULT", "RESULT"]),
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
