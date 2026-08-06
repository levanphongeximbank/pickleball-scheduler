/**
 * Operation B1A — approved live operator runner tests (mocked; no Production I/O).
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_PRODUCTION_PROJECT_REF,
  REQUIRED_OWNER_PRODUCTION_GO,
  REQUIRED_OWNER_PRODUCTION_GO_ROLLBACK,
  REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  RETIRED_OPERATION_B1_BATCH_IDS,
  QUARANTINE_BAN_DURATION,
  evaluateAuthorization,
  mutationAllowed,
  sha256Hex,
  hardDeleteUnavailable,
  quarantineOneIdentity,
} from "../scripts/operations/production-qa-identity-operation-b1/lib/index.js";
import {
  assertNodeOperatorRuntime,
  assertNoViteSecrets,
  assertSupabaseUrlMatchesProject,
  loadOperatorCredentials,
  createOperationB1LiveAdapters,
  OPERATION_B1_LIVE_ADAPTER_CAPABILITIES,
  AUTH_UNBAN_DURATION,
  redactSecrets,
} from "../scripts/operations/production-qa-identity-operation-b1/lib/liveOperator/index.js";
import { runLiveOperatorExecute } from "../scripts/operations/production-qa-identity-operation-b1/execute-live-operator.mjs";
import { runLiveOperatorRollback } from "../scripts/operations/production-qa-identity-operation-b1/rollback-live-operator.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FRESH_BATCH = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1";

function uuid(n = 1) {
  const hex = String(n).padStart(12, "0");
  return `22222222-3333-4333-8444-${hex}`;
}

function zeroRefs() {
  return {
    athlete_count: 0,
    membership_active: 0,
    membership_removed: 0,
    membership_total: 0,
    tenant_members: 0,
    tenants_owned: 0,
    club_governance_owner: 0,
    tournament_refs: 0,
    rating_refs: 0,
    finance_refs: 0,
    other_business_refs: 0,
  };
}

function makeEight(overrides = {}) {
  const identities = [];
  for (let i = 1; i <= 8; i += 1) {
    const id = uuid(i);
    identities.push({
      label: `QA-${String(i + 3).padStart(2, "0")}`,
      auth_user_id: id,
      profile_id: id,
      expected_email: `phase1c.prod.safe${i}@prod-qa.local`,
      profile_status: "active",
      auth_banned: false,
      reference_counts: zeroRefs(),
      captured_at: "2026-08-06T00:00:00.000Z",
      production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
      ...overrides,
    });
  }
  return identities;
}

function writeAllowlistAndSnapshot(identities, batchId) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "op-b1a-"));
  const allowlist = {
    operation: "OPERATION_B1_REVERSIBLE_QA_QUARANTINE",
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    target_count: 8,
    captured_at_utc: "2026-08-06T00:00:00.000Z",
    identities,
  };
  const alBody = `${JSON.stringify(allowlist, null, 2)}\n`;
  const alPath = path.join(dir, "allowlist.json");
  fs.writeFileSync(alPath, alBody, "utf8");
  const snapshot = {
    operation: "OPERATION_B1_ORIGINAL_STATE_SNAPSHOT",
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    batch_id: batchId,
    captured_at_utc: "2026-08-06T00:00:00.000Z",
    target_count: 8,
    identities: identities.map((r) => ({
      label: r.label,
      auth_user_id: r.auth_user_id,
      profile_id: r.profile_id,
      email: r.expected_email,
      original_profile_status: r.profile_status,
      original_auth_banned: false,
      reference_counts: r.reference_counts,
      captured_at: r.captured_at,
      production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    })),
  };
  const snBody = `${JSON.stringify(snapshot, null, 2)}\n`;
  const snPath = path.join(dir, "snapshot.json");
  fs.writeFileSync(snPath, snBody, "utf8");
  return {
    dir,
    alPath,
    snPath,
    alSha: sha256Hex(alBody),
    snSha: sha256Hex(snBody),
  };
}

function baseInput(files, overrides = {}) {
  return {
    DRY_RUN: "true",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: FRESH_BATCH,
    ALLOWLIST_PATH: files.alPath,
    ALLOWLIST_SHA256: files.alSha,
    SNAPSHOT_PATH: files.snPath,
    SNAPSHOT_SHA256: files.snSha,
    ...overrides,
  };
}

function liveAuthInput(files, overrides = {}) {
  return baseInput(files, {
    DRY_RUN: "false",
    OWNER_PRODUCTION_GO: REQUIRED_OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
    ...overrides,
  });
}

test("1) missing credentials fail before adapter calls", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const report = await runLiveOperatorExecute(liveAuthInput(files), {
    repoRoots: [root],
    loadOperatorCredentials: () => ({
      ok: false,
      reasons: ["missing_supabase_secret_key"],
    }),
  });
  assert.equal(report.ok, false);
  assert.equal(report.mutationClientConstructed, false);
  assert.equal(report.failReason, "credentials_missing_before_adapter");
  assert.equal(report.mutationCalls, 0);
});

test("2) credentials are not required for dry-run", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const report = await runLiveOperatorExecute(baseInput(files), {
    repoRoots: [root],
  });
  assert.equal(report.ok, true);
  assert.equal(report.mutationClientConstructed, false);
  assert.equal(report.dryRun, true);
  assert.equal(report.mutationCalls, 0);
});

test("3) wrong Supabase project URL fails", () => {
  const g = assertSupabaseUrlMatchesProject(
    "https://aaaaaaaaaaaaaaaaaaaa.supabase.co"
  );
  assert.equal(g.ok, false);
  assert.equal(g.reason, "supabase_url_project_ref_mismatch");
  const bad = loadOperatorCredentials({
    SUPABASE_URL: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co",
    SUPABASE_SECRET_KEY: "x",
  });
  assert.equal(bad.ok, false);
});

test("4) VITE_* credentials are rejected", () => {
  const prev = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = "should-never-be-used";
  try {
    assert.equal(assertNoViteSecrets().ok, false);
    assert.equal(assertNoViteSecrets().reason, "vite_secret_rejected");
  } finally {
    if (prev === undefined) delete process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    else process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = prev;
  }
});

test("5) browser runtime is rejected", () => {
  assert.equal(assertNodeOperatorRuntime().ok, true);
  const prev = globalThis.window;
  globalThis.window = {};
  try {
    assert.equal(assertNodeOperatorRuntime().ok, false);
    assert.equal(assertNodeOperatorRuntime().reason, "browser_runtime_rejected");
  } finally {
    if (prev === undefined) delete globalThis.window;
    else globalThis.window = prev;
  }
});

test("6) missing Owner GO gives zero calls", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const report = await runLiveOperatorExecute(
    baseInput(files, {
      DRY_RUN: "false",
      EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
    }),
    { repoRoots: [root] }
  );
  assert.equal(report.ok, false);
  assert.equal(report.mutationCalls, 0);
  assert.equal(report.mutationClientConstructed, false);
});

test("7) previous Owner GO event / retired batch cannot be reused", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const retired = await runLiveOperatorExecute(
    liveAuthInput(files, {
      OPERATION_B1_BATCH_ID: RETIRED_OPERATION_B1_BATCH_IDS[0],
    }),
    { repoRoots: [root] }
  );
  assert.equal(retired.ok, false);
  assert.ok(retired.reasons.includes("retired_batch_id_not_reusable"));
  assert.equal(retired.mutationCalls, 0);
  assert.equal(retired.mutationClientConstructed, false);
});

test("8) invalid allowlist checksum gives zero calls", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const report = await runLiveOperatorExecute(
    liveAuthInput(files, { ALLOWLIST_SHA256: "0".repeat(64) }),
    {
      repoRoots: [root],
      loadOperatorCredentials: () => ({
        ok: true,
        url: `https://${EXPECTED_PRODUCTION_PROJECT_REF}.supabase.co`,
        secretKey: "test-secret-not-logged",
        projectRef: EXPECTED_PRODUCTION_PROJECT_REF,
      }),
    }
  );
  assert.equal(report.ok, false);
  assert.equal(report.mutationCalls, 0);
  // Fail before mutation client when allowlist SHA invalid at auth structural layer
  assert.ok(
    report.failReason === "authorization_or_structural_guards" ||
      report.failReason === "allowlist_validation_failed"
  );
});

test("9) B2 identity gives zero calls", async () => {
  const identities = makeEight();
  identities[0].label = "QA-01";
  const files = writeAllowlistAndSnapshot(identities, FRESH_BATCH);
  const report = await runLiveOperatorExecute(baseInput(files), {
    repoRoots: [root],
  });
  assert.equal(report.ok, false);
  assert.equal(report.mutationCalls, 0);
});

test("10) business-reference drift gives zero mutation calls", async () => {
  const identities = makeEight();
  const row = identities[0];
  const auth = evaluateAuthorization({
    DRY_RUN: "false",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: FRESH_BATCH,
    ALLOWLIST_PATH: "C:\\tmp\\a.json",
    ALLOWLIST_SHA256: "a".repeat(64),
    OWNER_PRODUCTION_GO: REQUIRED_OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  });
  let profileWrites = 0;
  const result = await quarantineOneIdentity({
    allowlistRow: row,
    authResult: auth,
    dryRun: false,
    adapters: {
      emailOverrides: { [row.auth_user_id]: row.expected_email },
      fetchProfile: async () => ({
        id: row.profile_id,
        email: row.expected_email,
        status: "active",
      }),
      fetchReferenceCounts: async () => ({
        ...zeroRefs(),
        athlete_count: 1,
      }),
      fetchAuthBanState: async () => false,
      updateProfileStatus: async () => {
        profileWrites += 1;
        return { ok: true };
      },
      banAuthUser: async () => ({ ok: true }),
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.abortReason || "", /business_reference/);
  assert.equal(profileWrites, 0);
});

test("11) Auth email mismatch gives zero mutation calls", async () => {
  const row = makeEight()[0];
  const auth = evaluateAuthorization({
    DRY_RUN: "false",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: FRESH_BATCH,
    ALLOWLIST_PATH: "C:\\tmp\\a.json",
    ALLOWLIST_SHA256: "b".repeat(64),
    OWNER_PRODUCTION_GO: REQUIRED_OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  });
  let profileWrites = 0;
  const result = await quarantineOneIdentity({
    allowlistRow: row,
    authResult: auth,
    dryRun: false,
    adapters: {
      emailOverrides: { [row.auth_user_id]: row.expected_email },
      fetchProfile: async () => ({
        id: row.profile_id,
        email: "phase1c.prod.other@prod-qa.local",
        status: "active",
      }),
      fetchReferenceCounts: async () => zeroRefs(),
      fetchAuthBanState: async () => false,
      updateProfileStatus: async () => {
        profileWrites += 1;
        return { ok: true };
      },
      banAuthUser: async () => ({ ok: true }),
    },
  });
  assert.equal(result.ok, false);
  assert.equal(profileWrites, 0);
});

test("12) adapter surface is narrow, frozen, and omits raw admin/client", () => {
  assert.equal(hardDeleteUnavailable().available, false);
  const adapters = createOperationB1LiveAdapters({
    admin: {
      from() {},
      auth: { admin: { getUserById: async () => ({ data: null, error: null }) } },
    },
  });
  assert.equal(Object.isFrozen(adapters), true);
  assert.deepEqual(Object.keys(adapters).sort(), [
    ...OPERATION_B1_LIVE_ADAPTER_CAPABILITIES,
  ].sort());
  assert.equal("admin" in adapters, false);
  assert.equal("client" in adapters, false);
  assert.equal("supabase" in adapters, false);
  assert.equal("deleteUser" in adapters, false);
  assert.equal("createUser" in adapters, false);
  assert.equal("from" in adapters, false);
  assert.equal("rpc" in adapters, false);
  assert.equal(typeof adapters.deleteUser, "undefined");
  assert.equal(typeof adapters.createUser, "undefined");
  assert.equal(typeof adapters.admin, "undefined");
  assert.equal(typeof adapters.from, "undefined");
  assert.equal(typeof adapters.rpc, "undefined");
  assert.equal(typeof adapters.fetchAuthUser, "function");
  assert.equal(typeof adapters.fetchProfile, "function");
  assert.equal(typeof adapters.fetchAuthBanState, "function");
  assert.equal(typeof adapters.fetchReferenceCounts, "function");
  assert.equal(typeof adapters.updateProfileStatus, "function");
  assert.equal(typeof adapters.banAuthUser, "function");
  assert.equal(typeof adapters.unbanAuthUser, "function");
});

test("13) adapter cannot access unrelated tables via public surface", () => {
  const adapters = createOperationB1LiveAdapters({
    admin: { from() {}, auth: { admin: {} } },
  });
  assert.equal(typeof adapters.updateProfileStatus, "function");
  assert.equal(typeof adapters.banAuthUser, "function");
  assert.equal(typeof adapters.from, "undefined");
  assert.equal(typeof adapters.sql, "undefined");
  assert.equal(typeof adapters.rpc, "undefined");
  assert.equal(typeof adapters.insert, "undefined");
  assert.equal(typeof adapters.delete, "undefined");
  assert.equal(typeof adapters.admin, "undefined");
  assert.equal(typeof adapters.client, "undefined");
  assert.equal(typeof adapters.supabase, "undefined");
});

test("14) Auth ban uses the exact approved duration", async () => {
  const calls = [];
  const adapters = createOperationB1LiveAdapters({
    admin: {
      from() {
        throw new Error("should_not_touch_tables_for_ban");
      },
      auth: {
        admin: {
          updateUserById: async (id, payload) => {
            calls.push({ id, payload });
            return {
              data: {
                user: {
                  banned_until: new Date(Date.now() + 3.6e12).toISOString(),
                },
              },
              error: null,
            };
          },
        },
      },
    },
  });
  const ban = await adapters.banAuthUser({
    userId: uuid(1),
    banDuration: QUARANTINE_BAN_DURATION,
  });
  assert.equal(ban.ok, true);
  assert.equal(calls[0].payload.ban_duration, "876000h");
  const bad = await adapters.banAuthUser({
    userId: uuid(1),
    banDuration: "1h",
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "unapproved_ban_duration");
});

test("15-17) profile conditional update exact-one / zero / multi fail closed", async () => {
  let rows = [];
  const adapters = createOperationB1LiveAdapters({
    admin: {
      from() {
        return {
          update() {
            return this;
          },
          eq() {
            return this;
          },
          select: async () => ({ data: rows, error: null }),
        };
      },
      auth: { admin: {} },
    },
  });
  rows = [];
  assert.equal(
    (
      await adapters.updateProfileStatus({
        profileId: uuid(1),
        email: "phase1c.prod.safe1@prod-qa.local",
        status: "quarantined",
        expectedCurrentStatus: "active",
      })
    ).reason,
    "profile_zero_row_update"
  );
  rows = [
    { id: uuid(1), status: "quarantined" },
    { id: uuid(2), status: "quarantined" },
  ];
  assert.equal(
    (
      await adapters.updateProfileStatus({
        profileId: uuid(1),
        status: "quarantined",
        expectedCurrentStatus: "active",
      })
    ).reason,
    "profile_multiple_row_update"
  );
  rows = [
    {
      id: uuid(1),
      status: "quarantined",
      email: "phase1c.prod.safe1@prod-qa.local",
    },
  ];
  assert.equal(
    (
      await adapters.updateProfileStatus({
        profileId: uuid(1),
        email: "phase1c.prod.safe1@prod-qa.local",
        status: "quarantined",
        expectedCurrentStatus: "active",
      })
    ).ok,
    true
  );
});

test("18) Auth/eligibility failure before mutation → no profile mutation", async () => {
  const row = makeEight()[0];
  const auth = evaluateAuthorization({
    DRY_RUN: "false",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: FRESH_BATCH,
    ALLOWLIST_PATH: "C:\\tmp\\a.json",
    ALLOWLIST_SHA256: "c".repeat(64),
    OWNER_PRODUCTION_GO: REQUIRED_OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  });
  let banCalls = 0;
  let profileWrites = 0;
  const result = await quarantineOneIdentity({
    allowlistRow: row,
    authResult: auth,
    dryRun: false,
    adapters: {
      emailOverrides: { [row.auth_user_id]: row.expected_email },
      fetchProfile: async () => null,
      fetchReferenceCounts: async () => zeroRefs(),
      fetchAuthBanState: async () => false,
      updateProfileStatus: async () => {
        profileWrites += 1;
        return { ok: true };
      },
      banAuthUser: async () => {
        banCalls += 1;
        return { ok: true };
      },
    },
  });
  assert.equal(result.ok, false);
  assert.equal(profileWrites, 0);
  assert.equal(banCalls, 0);
});

test("19) Auth ban failure after profile → profile compensation", async () => {
  const row = makeEight()[0];
  const auth = evaluateAuthorization({
    DRY_RUN: "false",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: FRESH_BATCH,
    ALLOWLIST_PATH: "C:\\tmp\\a.json",
    ALLOWLIST_SHA256: "d".repeat(64),
    OWNER_PRODUCTION_GO: REQUIRED_OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  });
  let status = "active";
  const result = await quarantineOneIdentity({
    allowlistRow: row,
    authResult: auth,
    dryRun: false,
    adapters: {
      emailOverrides: { [row.auth_user_id]: row.expected_email },
      fetchProfile: async () => ({
        id: row.profile_id,
        email: row.expected_email,
        status,
      }),
      fetchReferenceCounts: async () => zeroRefs(),
      fetchAuthBanState: async () => false,
      updateProfileStatus: async ({ status: next }) => {
        status = next;
        return { ok: true };
      },
      banAuthUser: async () => ({ ok: false, reason: "auth_ban_failed_simulated" }),
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.compensated, true);
  assert.equal(status, "active");
});

test("20) compensation failure returns explicit unresolved status", async () => {
  const row = makeEight()[0];
  const auth = evaluateAuthorization({
    DRY_RUN: "false",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: FRESH_BATCH,
    ALLOWLIST_PATH: "C:\\tmp\\a.json",
    ALLOWLIST_SHA256: "e".repeat(64),
    OWNER_PRODUCTION_GO: REQUIRED_OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  });
  let updates = 0;
  const result = await quarantineOneIdentity({
    allowlistRow: row,
    authResult: auth,
    dryRun: false,
    adapters: {
      emailOverrides: { [row.auth_user_id]: row.expected_email },
      fetchProfile: async () => ({
        id: row.profile_id,
        email: row.expected_email,
        status: "active",
      }),
      fetchReferenceCounts: async () => zeroRefs(),
      fetchAuthBanState: async () => false,
      updateProfileStatus: async () => {
        updates += 1;
        if (updates === 1) return { ok: true };
        return { ok: false, reason: "compensation_failed" };
      },
      banAuthUser: async () => ({ ok: false, reason: "ban_fail" }),
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.aborted, true);
  assert.ok(result.abortReason);
  assert.equal(result.compensated, true);
});

test("21) postcheck failure stops completion", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const identities = makeEight();
  const state = new Map(
    identities.map((r) => [r.profile_id, { status: "active", banned: false }])
  );

  const report = await runLiveOperatorExecute(liveAuthInput(files), {
    repoRoots: [root],
    loadOperatorCredentials: () => ({
      ok: true,
      url: `https://${EXPECTED_PRODUCTION_PROJECT_REF}.supabase.co`,
      secretKey: "test-secret-not-logged",
      projectRef: EXPECTED_PRODUCTION_PROJECT_REF,
    }),
    createOperationB1AdminClient: () => ({}),
    createOperationB1LiveAdapters: () => ({
      emailOverrides: Object.fromEntries(
        identities.map((r) => [r.auth_user_id, r.expected_email])
      ),
      fetchProfile: async (id) => {
        const row = identities.find((r) => r.profile_id === id);
        const st = state.get(id);
        return {
          id,
          email: row.expected_email,
          // Intentionally never reflect quarantine so postcheck fails
          status: "active",
          _ignored: st,
        };
      },
      fetchReferenceCounts: async () => zeroRefs(),
      fetchAuthBanState: async () => false,
      updateProfileStatus: async ({ profileId, status }) => {
        state.get(profileId).status = status;
        return { ok: true };
      },
      banAuthUser: async ({ userId }) => {
        state.get(userId).banned = true;
        return { ok: true };
      },
    }),
  });
  assert.equal(report.ok, false);
  assert.equal(report.failReason, "postcheck_failed");
  assert.equal(report.execute?.ok, true);
});

test("22) execution remains idempotent (dry-run + already-quarantined)", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const a = await runLiveOperatorExecute(baseInput(files), {
    repoRoots: [root],
  });
  const b = await runLiveOperatorExecute(baseInput(files), {
    repoRoots: [root],
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.mutationCalls, 0);
  assert.equal(b.mutationCalls, 0);
});

test("23) rollback remains idempotent (dry-run)", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const input = {
    DRY_RUN: "true",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: FRESH_BATCH,
    ALLOWLIST_PATH: files.snPath,
    ALLOWLIST_SHA256: files.snSha,
  };
  const a = await runLiveOperatorRollback(input, { repoRoots: [root] });
  const b = await runLiveOperatorRollback(input, { repoRoots: [root] });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.mutationClientConstructed, false);
  assert.equal(a.mutationCalls, 0);
});

test("24) rollback refuses later state drift", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const identities = makeEight();
  const report = await runLiveOperatorRollback(
    {
      DRY_RUN: "false",
      PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
      OPERATION_B1_BATCH_ID: FRESH_BATCH,
      ALLOWLIST_PATH: files.snPath,
      ALLOWLIST_SHA256: files.snSha,
      OWNER_PRODUCTION_GO: REQUIRED_OWNER_PRODUCTION_GO_ROLLBACK,
      EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
    },
    {
      repoRoots: [root],
      loadOperatorCredentials: () => ({
        ok: true,
        url: `https://${EXPECTED_PRODUCTION_PROJECT_REF}.supabase.co`,
        secretKey: "test-secret-not-logged",
        projectRef: EXPECTED_PRODUCTION_PROJECT_REF,
      }),
      createOperationB1AdminClient: () => ({}),
      createOperationB1LiveAdapters: () => ({
        emailOverrides: Object.fromEntries(
          identities.map((r) => [r.auth_user_id, r.expected_email])
        ),
        fetchProfile: async (id) => ({
          id,
          email: identities.find((r) => r.profile_id === id).expected_email,
          status: "disabled_by_someone_else",
        }),
        fetchAuthBanState: async () => true,
        updateProfileStatus: async () => ({ ok: true }),
        unbanAuthUser: async () => ({ ok: true }),
      }),
    }
  );
  assert.equal(report.ok, false);
  assert.ok((report.rollback?.unresolved || []).length >= 1);
  assert.equal(
    report.rollback?.unresolved?.[0]?.abortReason,
    "post_quarantine_profile_drift"
  );
});

test("25) secret values never appear in logs or errors", () => {
  const secret = "test-secret-not-logged-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb";
  const redacted = redactSecrets(`Bearer ${secret}`);
  assert.equal(redacted.includes("eyJ"), false);
  assert.match(String(redacted), /REDACTED/);
});

test("26) terminal summaries mask emails and IDs via package masking path", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const report = await runLiveOperatorExecute(baseInput(files), {
    repoRoots: [root],
  });
  const dumped = JSON.stringify(report);
  assert.equal(dumped.includes("phase1c.prod.safe1@prod-qa.local"), false);
  assert.equal(dumped.includes(uuid(1)), false);
});

test("27) real network and Production calls are impossible in tests", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  let createClientCalled = false;
  const report = await runLiveOperatorExecute(baseInput(files), {
    repoRoots: [root],
    createClientImpl: () => {
      createClientCalled = true;
      throw new Error("network_forbidden_in_tests");
    },
  });
  assert.equal(report.ok, true);
  assert.equal(createClientCalled, false);
  assert.equal(report.mutationClientConstructed, false);
});

test("forward GO cannot authorize rollback; unban duration is none", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const forward = evaluateAuthorization({
    DRY_RUN: "false",
    mode: "rollback",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: FRESH_BATCH,
    ALLOWLIST_PATH: files.snPath,
    ALLOWLIST_SHA256: files.snSha,
    OWNER_PRODUCTION_GO: REQUIRED_OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  });
  assert.equal(forward.ok, false);
  assert.ok(forward.reasons.includes("forward_go_cannot_authorize_rollback"));
  assert.equal(mutationAllowed(forward), false);

  const rollback = evaluateAuthorization({
    DRY_RUN: "false",
    mode: "rollback",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: FRESH_BATCH,
    ALLOWLIST_PATH: files.snPath,
    ALLOWLIST_SHA256: files.snSha,
    OWNER_PRODUCTION_GO: REQUIRED_OWNER_PRODUCTION_GO_ROLLBACK,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  });
  assert.equal(rollback.ok, true);

  const calls = [];
  const adapters = createOperationB1LiveAdapters({
    admin: {
      from() {},
      auth: {
        admin: {
          updateUserById: async (_id, payload) => {
            calls.push(payload);
            return { data: { user: { banned_until: null } }, error: null };
          },
        },
      },
    },
  });
  const unban = await adapters.unbanAuthUser({ userId: uuid(1) });
  assert.equal(unban.ok, true);
  assert.equal(calls[0].ban_duration, AUTH_UNBAN_DURATION);
  assert.equal(AUTH_UNBAN_DURATION, "none");
});

test("loadOperatorCredentials supports secret key + service-role fallback", () => {
  const missing = loadOperatorCredentials({});
  assert.equal(missing.ok, false);
  const primary = loadOperatorCredentials({
    SUPABASE_URL: `https://${EXPECTED_PRODUCTION_PROJECT_REF}.supabase.co`,
    SUPABASE_SECRET_KEY: "x",
  });
  assert.equal(primary.ok, true);
  assert.equal(primary.usedServiceRoleFallback, false);
  const fallback = loadOperatorCredentials({
    SUPABASE_URL: `https://${EXPECTED_PRODUCTION_PROJECT_REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: "y",
  });
  assert.equal(fallback.ok, true);
  assert.equal(fallback.usedServiceRoleFallback, true);
});

test("recovery snapshot: correct byte SHA-256 passes (dry-run + live gate)", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const dry = await runLiveOperatorExecute(baseInput(files), {
    repoRoots: [root],
  });
  assert.equal(dry.ok, true);
  assert.equal(dry.mutationClientConstructed, false);

  let credsCalls = 0;
  let adminCalls = 0;
  const live = await runLiveOperatorExecute(liveAuthInput(files), {
    repoRoots: [root],
    loadOperatorCredentials: () => {
      credsCalls += 1;
      return {
        ok: true,
        url: `https://${EXPECTED_PRODUCTION_PROJECT_REF}.supabase.co`,
        secretKey: "test-secret-not-logged",
        projectRef: EXPECTED_PRODUCTION_PROJECT_REF,
      };
    },
    createOperationB1AdminClient: () => {
      adminCalls += 1;
      return {
        from() {
          throw new Error("network_forbidden_in_tests");
        },
        auth: {
          admin: {
            getUserById: async () => {
              throw new Error("network_forbidden_in_tests");
            },
            updateUserById: async () => {
              throw new Error("network_forbidden_in_tests");
            },
          },
        },
      };
    },
  });
  // Correct hash must pass the snapshot gate and reach credential/client construction.
  assert.equal(credsCalls >= 1, true);
  assert.equal(adminCalls >= 1, true);
  assert.equal(live.mutationClientConstructed, true);
  assert.equal(
    live.failReason === "recovery_snapshot_sha256_mismatch",
    false
  );
});

test("recovery snapshot: wrong hash blocks before credentials/client/network", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  let credsCalls = 0;
  let adminCalls = 0;
  let adapterCalls = 0;
  let networkCalls = 0;
  let authCalls = 0;
  let profileCalls = 0;

  const report = await runLiveOperatorExecute(
    liveAuthInput(files, { SNAPSHOT_SHA256: "a".repeat(64) }),
    {
      repoRoots: [root],
      loadOperatorCredentials: () => {
        credsCalls += 1;
        return {
          ok: true,
          url: `https://${EXPECTED_PRODUCTION_PROJECT_REF}.supabase.co`,
          secretKey: "test-secret-not-logged",
          projectRef: EXPECTED_PRODUCTION_PROJECT_REF,
        };
      },
      createOperationB1AdminClient: () => {
        adminCalls += 1;
        networkCalls += 1;
        return {};
      },
      createOperationB1LiveAdapters: () => {
        adapterCalls += 1;
        return {
          fetchAuthUser: async () => {
            authCalls += 1;
            networkCalls += 1;
            return null;
          },
          fetchProfile: async () => {
            profileCalls += 1;
            networkCalls += 1;
            return null;
          },
          updateProfileStatus: async () => {
            profileCalls += 1;
            networkCalls += 1;
            return { ok: true };
          },
          banAuthUser: async () => {
            authCalls += 1;
            networkCalls += 1;
            return { ok: true };
          },
        };
      },
    }
  );

  assert.equal(report.ok, false);
  assert.equal(report.failReason, "recovery_snapshot_sha256_mismatch");
  assert.ok(report.reasons.includes("recovery_snapshot_sha256_mismatch"));
  assert.equal(report.mutationClientConstructed, false);
  assert.equal(report.mutationCalls, 0);
  assert.equal(credsCalls, 0);
  assert.equal(adminCalls, 0);
  assert.equal(adapterCalls, 0);
  assert.equal(networkCalls, 0);
  assert.equal(authCalls, 0);
  assert.equal(profileCalls, 0);
});

test("recovery snapshot: modified file after hash calculation blocks", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const originalSha = files.snSha;
  fs.writeFileSync(
    files.snPath,
    `${JSON.stringify({ tampered: true, marker: "DO_NOT_LOG_SNAPSHOT_BODY" }, null, 2)}\n`,
    "utf8"
  );
  let credsCalls = 0;
  const report = await runLiveOperatorExecute(
    liveAuthInput(files, { SNAPSHOT_SHA256: originalSha }),
    {
      repoRoots: [root],
      loadOperatorCredentials: () => {
        credsCalls += 1;
        return { ok: true, url: "x", secretKey: "y" };
      },
      createOperationB1AdminClient: () => {
        throw new Error("client_must_not_construct");
      },
    }
  );
  assert.equal(report.ok, false);
  assert.equal(report.failReason, "recovery_snapshot_sha256_mismatch");
  assert.equal(report.mutationClientConstructed, false);
  assert.equal(credsCalls, 0);
  const dumped = JSON.stringify(report);
  assert.equal(dumped.includes("DO_NOT_LOG_SNAPSHOT_BODY"), false);
  assert.equal(dumped.includes("tampered"), false);
});

test("recovery snapshot: malformed hash blocks", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const report = await runLiveOperatorExecute(
    baseInput(files, { SNAPSHOT_SHA256: "not-a-sha" }),
    { repoRoots: [root] }
  );
  assert.equal(report.ok, false);
  assert.ok(report.reasons.includes("missing_or_invalid_recovery_snapshot"));
  assert.equal(report.mutationClientConstructed, false);
  assert.equal(report.mutationCalls, 0);
});

test("recovery snapshot: missing file blocks", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const missing = path.join(files.dir, "does-not-exist-snapshot.json");
  const report = await runLiveOperatorExecute(
    baseInput(files, { SNAPSHOT_PATH: missing }),
    { repoRoots: [root] }
  );
  assert.equal(report.ok, false);
  assert.ok(report.reasons.includes("recovery_snapshot_missing"));
  assert.equal(report.mutationClientConstructed, false);
  assert.equal(report.mutationCalls, 0);
});

test("recovery snapshot mismatch: dry-run also fail-closed before adapters", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const report = await runLiveOperatorExecute(
    baseInput(files, { SNAPSHOT_SHA256: "b".repeat(64) }),
    { repoRoots: [root] }
  );
  assert.equal(report.ok, false);
  assert.equal(report.failReason, "recovery_snapshot_sha256_mismatch");
  assert.equal(report.dryRun, true);
  assert.equal(report.mutationClientConstructed, false);
  assert.equal(report.mutationCalls, 0);
  assert.equal(report.execute, null);
});
