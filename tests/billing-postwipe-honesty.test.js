import test from "node:test";
import assert from "node:assert/strict";

import {
  BILLING_LEGACY_DEMO_BANNER,
  BILLING_MISSING_SCOPE_USER_MESSAGE,
  BILLING_RUNTIME_MODE,
  BILLING_UNAVAILABLE_USER_MESSAGE,
} from "../src/features/billing/runtime/constants.js";
import { resolveBillingRuntime } from "../src/features/billing/runtime/resolveBillingRuntime.js";
import { HARD_CUTOVER_FLAG } from "../src/features/platform-hard-cutover/runtimeAuthorityMatrix.js";

test("Billing HC ON — returns typed unavailable and blocks legacy authority", () => {
  const runtime = resolveBillingRuntime({
    env: { [HARD_CUTOVER_FLAG]: "true" },
    tenantId: "venue-a",
    storeMode: "local",
  });

  assert.equal(runtime.mode, BILLING_RUNTIME_MODE.UNAVAILABLE);
  assert.equal(runtime.allowsWrites, false);
  assert.equal(runtime.legacyBlocked, true);
  assert.match(runtime.message, /Billing chưa khả dụng/i);
});

test("Billing HC ON — no tenant still resolves to unavailable, not demo fallback", () => {
  const runtime = resolveBillingRuntime({
    env: { [HARD_CUTOVER_FLAG]: "true" },
    tenantId: null,
    storeMode: "local",
  });

  assert.equal(runtime.mode, BILLING_RUNTIME_MODE.UNAVAILABLE);
  assert.equal(runtime.tenantId, null);
  assert.equal(runtime.message, BILLING_UNAVAILABLE_USER_MESSAGE);
});

test("Billing HC OFF — missing tenant returns explicit missing-scope state", () => {
  const runtime = resolveBillingRuntime({
    env: { [HARD_CUTOVER_FLAG]: "false" },
    tenantId: null,
    storeMode: "local",
  });

  assert.equal(runtime.mode, BILLING_RUNTIME_MODE.MISSING_SCOPE);
  assert.equal(runtime.allowsWrites, false);
  assert.equal(runtime.message, BILLING_MISSING_SCOPE_USER_MESSAGE);
});

test("Billing HC OFF — local store remains legacy-local and clearly labeled", () => {
  const runtime = resolveBillingRuntime({
    env: { [HARD_CUTOVER_FLAG]: "false" },
    tenantId: "venue-local",
    storeMode: "local",
  });

  assert.equal(runtime.mode, BILLING_RUNTIME_MODE.LEGACY_LOCAL);
  assert.equal(runtime.allowsDemoMutations, true);
  assert.equal(runtime.message, BILLING_LEGACY_DEMO_BANNER);
});

test("Billing HC OFF — supabase store resolves durable mode without demo copy", () => {
  const runtime = resolveBillingRuntime({
    env: { [HARD_CUTOVER_FLAG]: "false" },
    tenantId: "venue-prod",
    storeMode: "supabase",
  });

  assert.equal(runtime.mode, BILLING_RUNTIME_MODE.DURABLE);
  assert.equal(runtime.allowsDemoMutations, false);
  assert.equal(runtime.message, null);
});
