import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateMessagingAcceptanceMode,
  MESSAGING_ACCEPTANCE_CODE,
} from "../src/features/platform-hard-cutover/operatorAcceptanceMessaging.js";

test("A-MSG accepts PRODUCTION (uppercase)", () => {
  const result = evaluateMessagingAcceptanceMode({
    mode: "PRODUCTION",
    reason: "HARD_CUTOVER_PRODUCTION_READY",
    demoAllowed: false,
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, MESSAGING_ACCEPTANCE_CODE.OK);
  assert.equal(result.normalizedMode, "PRODUCTION");
});

test("A-MSG accepts production (lowercase)", () => {
  const result = evaluateMessagingAcceptanceMode({
    mode: "production",
    demoAllowed: false,
  });
  assert.equal(result.ok, true);
  assert.equal(result.normalizedMode, "PRODUCTION");
});

test("A-MSG accepts UNAVAILABLE (uppercase)", () => {
  const result = evaluateMessagingAcceptanceMode({
    mode: "UNAVAILABLE",
    reason: "MESSAGING_DEMO_AUTHORITY_FORBIDDEN",
    demoAllowed: false,
  });
  assert.equal(result.ok, true);
  assert.equal(result.normalizedMode, "UNAVAILABLE");
});

test("A-MSG accepts unavailable (lowercase)", () => {
  const result = evaluateMessagingAcceptanceMode({ mode: "unavailable" });
  assert.equal(result.ok, true);
  assert.equal(result.normalizedMode, "UNAVAILABLE");
});

test("A-MSG rejects DEMO / MOCK / LEGACY", () => {
  for (const mode of ["DEMO", "demo", "MOCK", "mock", "LEGACY", "legacy"]) {
    const result = evaluateMessagingAcceptanceMode({ mode, demoAllowed: true });
    assert.equal(result.ok, false, mode);
    assert.equal(result.code, MESSAGING_ACCEPTANCE_CODE.MODE_FORBIDDEN, mode);
  }
});

test("A-MSG rejects missing mode without silent PASS", () => {
  const result = evaluateMessagingAcceptanceMode(null);
  assert.equal(result.ok, false);
  assert.equal(result.code, MESSAGING_ACCEPTANCE_CODE.MODE_MISSING);
});
