import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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

test("resolveOperatorAcceptanceAccess passes for staging venue owner", () => {
  const access = resolveOperatorAcceptanceAccess({
    env: {
      VITE_APP_ENV: "staging",
      VITE_SUPABASE_URL: `https://${OPERATOR_ACCEPTANCE_PROJECT_REF}.supabase.co`,
    },
    authUser: { id: "13e0a111bcdeaf9c", role: "VENUE_OWNER", venueId: "venue-staging-a" },
    sessionUserId: "13e0a111bcdeaf9c",
    currentTenantId: "venue-staging-a",
    isSuperAdmin: false,
  });
  assert.equal(access.ok, true);
  assert.equal(access.role, "VENUE_OWNER");
  assert.equal(access.tenantId, "venue-staging-a");
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
  assert.equal(OPERATOR_ACCEPTANCE_STEPS.length, 17);
  assert.deepEqual(OPERATOR_ACCEPTANCE_STEPS.slice(0, 7), [
    "A-OWN",
    "A-CLUB",
    "A-COURT",
    "A-PLAYER",
    "A-RATE",
    "A-COMP",
    "A-SEC",
  ]);
  assert.deepEqual(OPERATOR_ACCEPTANCE_STEPS.slice(-6), [
    "A-G1",
    "A-G2",
    "A-G3",
    "A-G4",
    "A-G5",
    "A-G6",
  ]);
  assert.equal(OPERATOR_ACCEPTANCE_STEPS.includes("A-PAIR"), false);
});

test("A-PLAYER evidence export never contains full sessionUserId", () => {
  const runner = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/features/platform-hard-cutover/operatorAcceptanceRunner.js"
    ),
    "utf8"
  );
  assert.match(
    runner,
    /okStep\(\s*"A-PLAYER"[\s\S]*?objectId:\s*maskOperatorIdentifier\(/
  );

  const sessionUserId = "13e0968b-53c5-4ba6-8ae0-dce12b1faf9c";
  const evidence = buildOperatorAcceptanceEvidence({
    access: {
      target: { projectRef: OPERATOR_ACCEPTANCE_PROJECT_REF, appEnv: "staging" },
      tenantId: "venue-staging-a",
      maskedActorId: maskOperatorIdentifier(sessionUserId),
      role: "TENANT_OWNER",
      isSuperAdmin: false,
    },
    startedAt: "2026-07-30T17:09:59.352Z",
    finishedAt: "2026-07-30T17:10:03.152Z",
    steps: [
      {
        id: "A-PLAYER",
        status: "PASS",
        objectId: maskOperatorIdentifier(
          sessionUserId /* athlete_id || profile_id || sessionUserId */
        ),
        code: null,
        message: null,
        details: {
          source: "platform_resolve_athlete_profile RPC",
          authUsersCreated: "notObserved",
        },
        observedAt: "2026-07-30T17:10:00.405Z",
      },
    ],
  });
  const serialized = JSON.stringify(evidence);
  assert.equal(serialized.includes(sessionUserId), false);
  assert.equal(evidence.steps[0].objectId, "13e0***af9c");
  assert.equal(evidence.actor.maskedUserId, "13e0***af9c");
});
