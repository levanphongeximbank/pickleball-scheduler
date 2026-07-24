/**
 * Platform Core capability discovery certification tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  listPlatformCapabilities,
  findPlatformCapability,
  hasPlatformCapability,
} from "./capabilityDiscovery.js";
import { PLATFORM_CAPABILITY_MANIFEST } from "./capabilities.js";

const DISCOVERY_SOURCE = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "capabilityDiscovery.js"),
  "utf8"
);

const AUTHORITATIVE_MANIFEST_COUNT = 37;

test("16. listPlatformCapabilities returns immutable data", () => {
  const listed = listPlatformCapabilities();
  assert.equal(listed, PLATFORM_CAPABILITY_MANIFEST);
  assert.equal(Object.isFrozen(listed), true);
  assert.throws(() => {
    /** @type {any} */ (listed).push({ capabilityCode: "X" });
  }, TypeError);
});

test("17. canonical descriptors remain immutable", () => {
  const listed = listPlatformCapabilities();
  for (const item of listed) {
    assert.equal(Object.isFrozen(item), true);
  }
  assert.throws(() => {
    /** @type {any} */ (listed[0]).capabilityCode = "MUTATED";
  }, TypeError);
});

test("18. findPlatformCapability finds a known exact code", () => {
  const found = findPlatformCapability("RESULT");
  assert.notEqual(found, null);
  assert.equal(found.capabilityCode, "RESULT");
  assert.equal(found, PLATFORM_CAPABILITY_MANIFEST.find((item) => item.capabilityCode === "RESULT"));
});

test("19. findPlatformCapability trims surrounding whitespace", () => {
  const found = findPlatformCapability("  RESULT  ");
  assert.notEqual(found, null);
  assert.equal(found.capabilityCode, "RESULT");
});

test("20. unknown capability returns null", () => {
  assert.equal(findPlatformCapability("DOES_NOT_EXIST"), null);
  assert.equal(findPlatformCapability(""), null);
  assert.equal(findPlatformCapability("   "), null);
  assert.equal(findPlatformCapability(null), null);
  assert.equal(findPlatformCapability(42), null);
});

test("21. hasPlatformCapability true for known code", () => {
  assert.equal(hasPlatformCapability("RESULT"), true);
  assert.equal(hasPlatformCapability("CAPABILITY_DISCOVERY"), true);
  assert.equal(hasPlatformCapability("INTEGRATION_PORT_DESCRIPTOR_ADAPTER"), true);
  assert.equal(hasPlatformCapability("PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER"), true);
});

test("22. hasPlatformCapability false for unknown code", () => {
  assert.equal(hasPlatformCapability("UNKNOWN_CAPABILITY"), false);
  assert.equal(hasPlatformCapability(""), false);
  assert.equal(hasPlatformCapability(undefined), false);
});

test("23. no fuzzy or case-insensitive matching", () => {
  assert.equal(findPlatformCapability("result"), null);
  assert.equal(findPlatformCapability("Result"), null);
  assert.equal(findPlatformCapability("RESUL"), null);
  assert.equal(hasPlatformCapability("result"), false);
});

test("24-30. discovery has no filesystem / module / network / env / storage / mutable registry", () => {
  assert.equal(/readdirSync|readdir\s*\(|fs\.promises/.test(DISCOVERY_SOURCE), false);
  assert.equal(/(?:^|\n)\s*import\s*\(|(?:^|\n)\s*require\s*\(/.test(DISCOVERY_SOURCE), false);
  assert.equal(/fetch\s*\(|createClient|axios|WebSocket/.test(DISCOVERY_SOURCE), false);
  assert.equal(/process\.env|localStorage|indexedDB/.test(DISCOVERY_SOURCE), false);
  assert.equal(/supabase|createClient|postgres|sqlite/i.test(DISCOVERY_SOURCE), false);
  assert.equal(/new\s+Map\s*\(|new\s+Set\s*\(/.test(DISCOVERY_SOURCE), false);
  assert.equal(
    /registerCapability|unregisterCapability|enableCapability|disableCapability|reloadCapabilities/.test(
      DISCOVERY_SOURCE
    ),
    false
  );
});

test("35. capability manifest count matches authoritative state", () => {
  assert.equal(PLATFORM_CAPABILITY_MANIFEST.length, AUTHORITATIVE_MANIFEST_COUNT);
  assert.equal(listPlatformCapabilities().length, AUTHORITATIVE_MANIFEST_COUNT);
});

test("discovery does not mutate the manifest", () => {
  const before = [...PLATFORM_CAPABILITY_MANIFEST];
  listPlatformCapabilities();
  findPlatformCapability("RESULT");
  hasPlatformCapability("RESULT");
  assert.equal(PLATFORM_CAPABILITY_MANIFEST.length, before.length);
  assert.deepEqual(
    PLATFORM_CAPABILITY_MANIFEST.map((item) => item.capabilityCode),
    before.map((item) => item.capabilityCode)
  );
});
