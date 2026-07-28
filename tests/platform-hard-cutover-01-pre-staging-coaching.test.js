import test from "node:test";
import assert from "node:assert/strict";

import {
  COACHING_RUNTIME_MODE,
  createDefaultCoachingRuntime,
  resolveDefaultCoachingRuntimeMode,
  resetDefaultCoachingRuntime,
} from "../src/features/coaching/runtime/index.js";
import {
  HARD_CUTOVER_FLAG,
  getRuntimeAuthorityEntry,
} from "../src/features/platform-hard-cutover/runtimeAuthorityMatrix.js";
import { COACHING_RUNTIME_ERROR_CODES } from "../src/features/coaching/runtime/errors.js";

test("coaching HC: matrix registers coaching domain fail-closed", () => {
  const row = getRuntimeAuthorityEntry("coaching");
  assert.ok(row);
  assert.equal(row.failClosedError, "COACHING_LOCALSTORAGE_AUTHORITY_FORBIDDEN");
  assert.ok(row.forbiddenFallback.some((x) => /localStorage/i.test(x)));
});

test("coaching HC: default mode is UNAVAILABLE when hard cutover ON", () => {
  resetDefaultCoachingRuntime();
  const mode = resolveDefaultCoachingRuntimeMode({
    env: { [HARD_CUTOVER_FLAG]: "true", VITE_APP_ENV: "development" },
  });
  assert.equal(mode, COACHING_RUNTIME_MODE.UNAVAILABLE);

  const runtime = createDefaultCoachingRuntime({
    env: { [HARD_CUTOVER_FLAG]: "true", VITE_APP_ENV: "development" },
  });
  assert.equal(runtime.mode, COACHING_RUNTIME_MODE.UNAVAILABLE);
  assert.equal(runtime.isLegacy, false);
});

test("coaching HC: explicit LEGACY override remapped to UNAVAILABLE", () => {
  const mode = resolveDefaultCoachingRuntimeMode({
    mode: COACHING_RUNTIME_MODE.LEGACY,
    env: { [HARD_CUTOVER_FLAG]: "true" },
  });
  assert.equal(mode, COACHING_RUNTIME_MODE.UNAVAILABLE);
});

test("coaching HC: unavailable runtime fails closed on collection ops", async () => {
  const runtime = createDefaultCoachingRuntime({
    env: { [HARD_CUTOVER_FLAG]: "true" },
  });
  const listed = await runtime.listCollection("coaches", "club-1");
  assert.equal(listed.ok, false);
  assert.equal(listed.code, COACHING_RUNTIME_ERROR_CODES.UNSUPPORTED_MODE);
});

test("coaching HC: without hard cutover remains LEGACY (no flag flip)", () => {
  resetDefaultCoachingRuntime();
  const mode = resolveDefaultCoachingRuntimeMode({
    env: { [HARD_CUTOVER_FLAG]: "false", VITE_APP_ENV: "development" },
  });
  assert.equal(mode, COACHING_RUNTIME_MODE.LEGACY);
});
