import test from "node:test";
import assert from "node:assert/strict";

import { resolveCommunicationRuntimeMode } from "../src/features/communication/runtime/resolveCommunicationRuntimeMode.js";
import { COMMUNICATION_RUNTIME_MODE } from "../src/features/communication/runtime/constants.js";
import {
  HARD_CUTOVER_FLAG,
  getRuntimeAuthorityEntry,
} from "../src/features/platform-hard-cutover/runtimeAuthorityMatrix.js";

test("messaging HC: matrix registers messaging domain", () => {
  const row = getRuntimeAuthorityEntry("messaging");
  assert.ok(row);
  assert.equal(row.failClosedError, "MESSAGING_DEMO_AUTHORITY_FORBIDDEN");
  assert.ok(row.forbiddenFallback.some((x) => /DEMO/i.test(x)));
});

test("messaging HC: never DEMO under hard cutover — UNAVAILABLE when deps missing", () => {
  const r = resolveCommunicationRuntimeMode({
    env: {
      [HARD_CUTOVER_FLAG]: "true",
      MODE: "development",
      DEV: true,
      NODE_ENV: "development",
    },
    productionDependenciesCertified: false,
    activationSnapshot: {
      STAGING_MIGRATION_READY: false,
      PRODUCTION_READY: false,
    },
  });
  assert.equal(r.mode, COMMUNICATION_RUNTIME_MODE.UNAVAILABLE);
  assert.equal(r.demoAllowed, false);
  assert.equal(r.reason, "MESSAGING_DEMO_AUTHORITY_FORBIDDEN");
});

test("messaging HC: PRODUCTION when deps + activation ready", () => {
  const r = resolveCommunicationRuntimeMode({
    env: { [HARD_CUTOVER_FLAG]: "true", MODE: "development", DEV: true },
    productionDependenciesCertified: true,
    activationSnapshot: {
      STAGING_MIGRATION_READY: true,
      PRODUCTION_READY: false,
    },
  });
  assert.equal(r.mode, COMMUNICATION_RUNTIME_MODE.PRODUCTION);
  assert.equal(r.demoAllowed, false);
});

test("messaging HC: force DEMO rejected under hard cutover", () => {
  const r = resolveCommunicationRuntimeMode({
    env: { [HARD_CUTOVER_FLAG]: "true", NODE_ENV: "test", VITEST: "true" },
    allowForceMode: true,
    forceMode: COMMUNICATION_RUNTIME_MODE.DEMO,
    hardCutover: true,
  });
  assert.equal(r.mode, COMMUNICATION_RUNTIME_MODE.UNAVAILABLE);
  assert.equal(r.demoAllowed, false);
});

test("messaging without HC: default DEMO still allowed on dev/test surface", () => {
  const r = resolveCommunicationRuntimeMode({
    env: {
      [HARD_CUTOVER_FLAG]: "false",
      NODE_ENV: "test",
      VITEST: "true",
    },
    activationSnapshot: {
      STAGING_MIGRATION_READY: false,
      PRODUCTION_READY: false,
    },
  });
  assert.equal(r.mode, COMMUNICATION_RUNTIME_MODE.DEMO);
  assert.equal(r.demoAllowed, true);
});
