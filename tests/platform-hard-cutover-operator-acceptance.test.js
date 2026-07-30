import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOperatorAcceptanceEvidence,
  maskOperatorIdentifier,
  OPERATOR_ACCEPTANCE_PROJECT_REF,
  OPERATOR_ACCEPTANCE_STEPS,
  resolveOperatorAcceptanceAccess,
  resolveOperatorAcceptanceTarget,
} from "../src/features/platform-hard-cutover/operatorAcceptanceShared.js";

test("resolveOperatorAcceptanceTarget accepts only staging ref", () => {
  const target = resolveOperatorAcceptanceTarget({
    VITE_APP_ENV: "staging",
    VITE_SUPABASE_URL: `https://${OPERATOR_ACCEPTANCE_PROJECT_REF}.supabase.co`,
  });
  assert.equal(target.isStagingEnv, true);
  assert.equal(target.isExpectedStagingRef, true);
  assert.equal(target.isProductionRef, false);
});

test("resolveOperatorAcceptanceAccess fails closed on production mismatch", () => {
  const access = resolveOperatorAcceptanceAccess({
    env: {
      VITE_APP_ENV: "production",
      VITE_SUPABASE_URL: "https://expuvcohlcjzvrrauvud.supabase.co",
    },
    authUser: { id: "user-1", role: "SUPER_ADMIN" },
    sessionUserId: "user-1",
    currentTenantId: "tenant-1",
    isSuperAdmin: true,
  });
  assert.equal(access.ok, false);
});

test("resolveOperatorAcceptanceAccess passes for staging super admin", () => {
  const access = resolveOperatorAcceptanceAccess({
    env: {
      VITE_APP_ENV: "staging",
      VITE_SUPABASE_URL: `https://${OPERATOR_ACCEPTANCE_PROJECT_REF}.supabase.co`,
    },
    authUser: { id: "abcd1234efgh5678", role: "SUPER_ADMIN" },
    sessionUserId: "abcd1234efgh5678",
    currentTenantId: "tenant-1",
    isSuperAdmin: true,
  });
  assert.equal(access.ok, true);
  assert.equal(access.maskedActorId, "abcd***5678");
});

test("maskOperatorIdentifier redacts short and long ids", () => {
  assert.equal(maskOperatorIdentifier("12345678"), "12***78");
  assert.equal(maskOperatorIdentifier("123456789"), "1234***6789");
});

test("buildOperatorAcceptanceEvidence excludes credentials", () => {
  const evidence = buildOperatorAcceptanceEvidence({
    access: {
      target: { projectRef: OPERATOR_ACCEPTANCE_PROJECT_REF, appEnv: "staging" },
      tenantId: "tenant-1",
      maskedActorId: "abcd***5678",
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
    },
    startedAt: "2026-07-30T00:00:00.000Z",
    finishedAt: "2026-07-30T00:01:00.000Z",
    steps: [
      {
        id: "A-OWN",
        status: "PASS",
        objectId: "abcd***5678",
        code: null,
        message: null,
        details: { safe: true, access_token: "should-not-be-relayed" },
        observedAt: "2026-07-30T00:00:30.000Z",
      },
    ],
  });
  assert.equal(evidence.secretsPrinted, false);
  assert.equal(evidence.target.projectRef, OPERATOR_ACCEPTANCE_PROJECT_REF);
  assert.equal(evidence.steps[0].id, "A-OWN");
});

test("operator acceptance steps preserve required order", () => {
  assert.deepEqual(OPERATOR_ACCEPTANCE_STEPS.slice(0, 5), [
    "A-OWN",
    "A-CLUB",
    "A-COURT",
    "A-PLAYER",
    "A-RATE",
  ]);
  assert.deepEqual(OPERATOR_ACCEPTANCE_STEPS.slice(-6), [
    "A-G1",
    "A-G2",
    "A-G3",
    "A-G4",
    "A-G5",
    "A-G6",
  ]);
});
