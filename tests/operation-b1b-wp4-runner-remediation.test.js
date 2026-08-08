/**
 * OPERATION B1B — WP4 runner remediation tests (local/mock only).
 * No Staging/Production access. No real PostgreSQL.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_PRODUCTION_PROJECT_REF,
  EXPECTED_B1B_COUNT,
  RETIRED_OWNER_PRODUCTION_GO,
  RETIRED_OPERATION_B1_BATCH_IDS,
  FRESH_AUTHORIZATION_BINDING,
  REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  OPERATION_B1B_LIVE_ADAPTER_CAPABILITIES,
  evaluateAuthorization,
  mutationAllowed,
  createFreshAuthorizationBinding,
  presentLiveAuthority,
  resetAuthorityConsumptionForTests,
  sha256Hex,
  validateAllowlistDocument,
  quarantineOneIdentityB1B,
  runBatchQuarantineB1B,
  hardDeleteUnavailable,
  createOperationB1BLiveAdapters,
  assertNarrowAdapterSurface,
  OPERATION_ID,
} from "../scripts/operations/production-qa-identity-operation-b1b/lib/index.js";
import { runB1BExecute } from "../scripts/operations/production-qa-identity-operation-b1b/execute.mjs";
import {
  evaluateAuthorization as evaluateB1Authorization,
  mutationAllowed as b1MutationAllowed,
  REQUIRED_OWNER_PRODUCTION_GO,
  RETIRED_OWNER_PRODUCTION_GO as B1_RETIRED_GO,
  FORWARD_LIVE_EXECUTION_RETIRED,
} from "../scripts/operations/production-qa-identity-operation-b1/lib/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FRESH_BATCH = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2";
const TEST_GO = "APPROVE_OPERATION_B1B_UNIT_TEST_BINDING_NOT_PRODUCTION";

function uuid(n = 1) {
  const hex = String(n).padStart(12, "0");
  return `33333333-4444-4555-8666-${hex}`;
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
      captured_at: "2026-08-08T00:00:00.000Z",
      production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
      ...overrides,
    });
  }
  return identities;
}

function writeAllowlistAndSnapshot(identities, batchId) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "op-b1b-wp4-"));
  const allowlist = {
    operation: OPERATION_ID,
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    target_count: 8,
    captured_at_utc: "2026-08-08T00:00:00.000Z",
    identities,
  };
  const alBody = `${JSON.stringify(allowlist, null, 2)}\n`;
  const alPath = path.join(dir, "allowlist.json");
  fs.writeFileSync(alPath, alBody, "utf8");
  const snapshot = {
    operation: "OPERATION_B1B_ORIGINAL_STATE_SNAPSHOT",
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    batch_id: batchId,
    captured_at_utc: "2026-08-08T00:00:00.000Z",
    target_count: 8,
    identities: identities.map((r) => ({
      label: r.label,
      auth_user_id: r.auth_user_id,
      profile_id: r.profile_id,
      email: r.expected_email,
      original_profile_status: r.profile_status,
      original_auth_banned: r.auth_banned === true,
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

function makeBinding(files, batchId = FRESH_BATCH) {
  const created = createFreshAuthorizationBinding({
    ownerProductionGo: TEST_GO,
    explicitExecuteConfirmation: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
    expectedBatchId: batchId,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
    productionProjectRef: EXPECTED_PRODUCTION_PROJECT_REF,
  });
  assert.equal(created.ok, true);
  return created.binding;
}

function liveInput(files, binding, overrides = {}) {
  return {
    DRY_RUN: "false",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1B_BATCH_ID: FRESH_BATCH,
    ALLOWLIST_PATH: files.alPath,
    ALLOWLIST_SHA256: files.alSha,
    RECOVERY_SNAPSHOT_PATH: files.snPath,
    SNAPSHOT_SHA256: files.snSha,
    OWNER_PRODUCTION_GO: TEST_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
    freshAuthorizationBinding: binding,
    ...overrides,
  };
}

function baseAdapters(row, state) {
  const calls = [];
  const adapters = {
    emailOverrides: { [row.auth_user_id]: row.expected_email },
    fetchAuthUser: async () => ({
      id: row.auth_user_id,
      email: row.expected_email,
      banned_until: state.banned
        ? new Date(Date.now() + 86400000).toISOString()
        : null,
    }),
    fetchProfile: async () => ({
      id: row.profile_id,
      email: row.expected_email,
      status: state.profileStatus,
    }),
    fetchReferenceCounts: async () => zeroRefs(),
    fetchAuthBanState: async () => state.banned === true,
    qaQuarantinePrepare: async (args) => {
      calls.push("qa_quarantine_prepare");
      state.authority = {
        id: "q-" + row.profile_id,
        profile_id: args.profileId,
        auth_user_id: args.authUserId,
        batch_id: args.batchId,
        allowlist_sha256: args.allowlistSha256,
        snapshot_sha256: args.snapshotSha256,
        lifecycle_state: "pending",
        auth_ban_state: "pending",
        lifecycle_version: 1,
        original_auth_banned: args.originalAuthBanned,
        original_profile_status: args.originalProfileStatus,
      };
      return { ok: true, data: state.authority };
    },
    qaQuarantineActivateAfterAuthBan: async (args) => {
      calls.push("qa_quarantine_activate_after_auth_ban");
      if (!args.authBanReadbackConfirmed) {
        return { ok: false, reason: "auth_ban_readback_not_confirmed" };
      }
      if (args.expectedLifecycleVersion !== state.authority.lifecycle_version) {
        return { ok: false, reason: "lifecycle_version_mismatch" };
      }
      state.authority = {
        ...state.authority,
        lifecycle_state: "active",
        auth_ban_state: "applied",
        lifecycle_version: state.authority.lifecycle_version + 1,
      };
      return { ok: true, data: state.authority };
    },
    qaQuarantineActivatePreexistingBan: async (args) => {
      calls.push("qa_quarantine_activate_preexisting_ban");
      if (args.expectedLifecycleVersion !== state.authority.lifecycle_version) {
        return { ok: false, reason: "lifecycle_version_mismatch" };
      }
      state.authority = {
        ...state.authority,
        lifecycle_state: "active",
        auth_ban_state: "not_required_preexisting",
        lifecycle_version: state.authority.lifecycle_version + 1,
      };
      return { ok: true, data: state.authority };
    },
    qaQuarantineRecordCompensatedFailure: async () => {
      calls.push("qa_quarantine_record_compensated_failure");
      state.authority = {
        ...state.authority,
        lifecycle_state: "failed",
        auth_ban_state: "reverted",
        lifecycle_version: (state.authority?.lifecycle_version || 1) + 1,
      };
      return { ok: true, data: state.authority };
    },
    qaQuarantineRelease: async () => {
      calls.push("qa_quarantine_release");
      state.authority = {
        ...state.authority,
        lifecycle_state: "released",
        lifecycle_version: (state.authority?.lifecycle_version || 1) + 1,
      };
      return { ok: true, data: state.authority };
    },
    qaQuarantineGetState: async () => {
      calls.push("qa_quarantine_get_state");
      return { ok: true, data: state.authority };
    },
    banAuthUser: async () => {
      calls.push("banAuthUser");
      state.banned = true;
      return { ok: true };
    },
    unbanAuthUser: async () => {
      calls.push("unbanAuthUser");
      state.banned = false;
      return { ok: true };
    },
    _calls: calls,
  };
  return adapters;
}

function authorizedAuth(files, binding) {
  resetAuthorityConsumptionForTests();
  const auth = evaluateAuthorization(liveInput(files, binding));
  assert.equal(mutationAllowed(auth), true);
  presentLiveAuthority(auth);
  return auth;
}

test("WP4 constants: no Production GO; retired artifacts rejected", () => {
  assert.equal(FRESH_AUTHORIZATION_BINDING, null);
  assert.equal(RETIRED_OWNER_PRODUCTION_GO, "APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY");
  assert.ok(
    RETIRED_OPERATION_B1_BATCH_IDS.includes(
      "b37186cf-e620-4f27-aba3-d7e8750ae7df"
    )
  );
  assert.ok(
    RETIRED_OPERATION_B1_BATCH_IDS.includes(
      "9c9d5fc7-648e-44c6-a959-e62157f7c970"
    )
  );
  assert.equal(EXPECTED_B1B_COUNT, 8);
  assert.equal(hardDeleteUnavailable().available, false);
});

test("A) default dry-run = zero mutations", async () => {
  resetAuthorityConsumptionForTests();
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const report = await runB1BExecute(
    {
      ...liveInput(files, binding),
      DRY_RUN: "true",
    },
    { repoRoots: [root] }
  );
  assert.equal(report.ok, true);
  assert.equal(report.dryRun, true);
  assert.equal(report.mutationCalls, 0);
  assert.equal(report.newProductionGoIssued, false);
});

test("A) wrong/missing project ref = zero", () => {
  resetAuthorityConsumptionForTests();
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const wrong = evaluateAuthorization(
    liveInput(files, binding, { PRODUCTION_PROJECT_REF: "wrongprojectrefxxxx" })
  );
  assert.equal(mutationAllowed(wrong), false);
  assert.ok(wrong.reasons.includes("wrong_or_missing_production_project_ref"));

  const missing = evaluateAuthorization(
    liveInput(files, binding, { PRODUCTION_PROJECT_REF: "" })
  );
  assert.equal(mutationAllowed(missing), false);
  assert.ok(missing.reasons.includes("missing_production_project_ref"));
});

test("A) malformed / retired batches / retired GO / missing binding = zero", () => {
  resetAuthorityConsumptionForTests();
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);

  const malformed = evaluateAuthorization(
    liveInput(files, binding, { OPERATION_B1B_BATCH_ID: "not-a-uuid" })
  );
  assert.equal(mutationAllowed(malformed), false);
  assert.ok(malformed.reasons.includes("malformed_or_missing_batch_id"));

  for (const retired of RETIRED_OPERATION_B1_BATCH_IDS) {
    const r = evaluateAuthorization(
      liveInput(files, binding, { OPERATION_B1B_BATCH_ID: retired })
    );
    assert.equal(mutationAllowed(r), false, retired);
    assert.ok(r.reasons.includes("retired_batch_id_not_reusable"), retired);
  }

  const retiredGo = evaluateAuthorization(
    liveInput(files, binding, {
      OWNER_PRODUCTION_GO: RETIRED_OWNER_PRODUCTION_GO,
    })
  );
  assert.equal(mutationAllowed(retiredGo), false);
  assert.ok(
    retiredGo.reasons.includes("retired_owner_production_go_not_reusable")
  );

  const noBinding = evaluateAuthorization(
    liveInput(files, null, { freshAuthorizationBinding: null })
  );
  assert.equal(mutationAllowed(noBinding), false);
  assert.ok(noBinding.reasons.includes("missing_fresh_authorization_binding"));
});

test("A) allowlist/snapshot SHA mismatch = zero", () => {
  resetAuthorityConsumptionForTests();
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);

  const alMismatch = evaluateAuthorization(
    liveInput(files, binding, { ALLOWLIST_SHA256: "a".repeat(64) })
  );
  assert.equal(mutationAllowed(alMismatch), false);
  assert.ok(alMismatch.reasons.includes("allowlist_sha256_binding_mismatch"));

  const snMismatch = evaluateAuthorization(
    liveInput(files, binding, { SNAPSHOT_SHA256: "b".repeat(64) })
  );
  assert.equal(mutationAllowed(snMismatch), false);
  assert.ok(snMismatch.reasons.includes("snapshot_sha256_binding_mismatch"));
});

test("A) target count != 8 / B2 / forbidden email = zero", () => {
  const seven = makeEight().slice(0, 7);
  const badCount = validateAllowlistDocument({
    operation: OPERATION_ID,
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    target_count: 7,
    identities: seven,
  });
  assert.equal(badCount.ok, false);

  const withB2 = makeEight();
  withB2[0].label = "QA-01";
  const b2 = validateAllowlistDocument({
    operation: OPERATION_ID,
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    target_count: 8,
    identities: withB2,
  });
  assert.equal(b2.ok, false);
  assert.ok(b2.errors.some((e) => e.startsWith("b2_excluded_label_present")));

  const forbidden = makeEight();
  forbidden[0].expected_email = "phase1b-smith@gmail.com";
  const forb = validateAllowlistDocument({
    operation: OPERATION_ID,
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    target_count: 8,
    identities: forbidden,
  });
  assert.equal(forb.ok, false);
  assert.ok(forb.errors.includes("forbidden_real_user_email"));
});

test("B) originally unbanned order: prepare→ban→auth_readback→activate_after→authority_readback", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = authorizedAuth(files, binding);
  const row = makeEight()[0];
  const state = { banned: false, profileStatus: "active", authority: null };
  const adapters = baseAdapters(row, state);
  const callLog = [];

  const result = await quarantineOneIdentityB1B({
    allowlistRow: row,
    adapters,
    authResult: auth,
    dryRun: false,
    batchId: FRESH_BATCH,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
    callLog,
  });

  assert.equal(result.ok, true);
  assert.equal(result.profileStatusPreserved, true);
  assert.equal(state.profileStatus, "active");
  assert.ok(!adapters._calls.includes("updateProfileStatus"));

  const names = callLog.map((c) => c.name).filter((n) =>
    [
      "qa_quarantine_prepare",
      "banAuthUser",
      "auth_readback",
      "qa_quarantine_activate_after_auth_ban",
      "authority_readback",
    ].includes(n)
  );
  const idx = (n) => names.indexOf(n);
  assert.ok(idx("qa_quarantine_prepare") >= 0);
  assert.ok(idx("banAuthUser") > idx("qa_quarantine_prepare"));
  assert.ok(idx("auth_readback") > idx("banAuthUser"));
  assert.ok(
    idx("qa_quarantine_activate_after_auth_ban") > idx("auth_readback")
  );
  assert.ok(
    idx("authority_readback") > idx("qa_quarantine_activate_after_auth_ban")
  );
});

test("C) preexisting ban: prepare→auth_readback→activate_preexisting; ban/unban = 0", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = authorizedAuth(files, binding);
  const row = { ...makeEight()[0], auth_banned: true };
  const state = { banned: true, profileStatus: "active", authority: null };
  const adapters = baseAdapters(row, state);
  const callLog = [];

  const result = await quarantineOneIdentityB1B({
    allowlistRow: row,
    adapters,
    authResult: auth,
    dryRun: false,
    batchId: FRESH_BATCH,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
    callLog,
  });

  assert.equal(result.ok, true);
  assert.equal(adapters._calls.filter((c) => c === "banAuthUser").length, 0);
  assert.equal(adapters._calls.filter((c) => c === "unbanAuthUser").length, 0);
  assert.equal(state.authority.auth_ban_state, "not_required_preexisting");

  const names = callLog.map((c) => c.name);
  assert.ok(names.includes("qa_quarantine_prepare"));
  assert.ok(names.includes("auth_readback"));
  assert.ok(names.includes("qa_quarantine_activate_preexisting_ban"));
  assert.ok(names.includes("authority_readback"));
  assert.ok(!names.includes("banAuthUser"));
});

test("D) prepare failure: Auth=0 activation=0 batch stops", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = authorizedAuth(files, binding);
  const identities = makeEight();
  let prepareCalls = 0;
  let banCalls = 0;
  let activateCalls = 0;

  const adapters = {
    emailOverrides: Object.fromEntries(
      identities.map((r) => [r.auth_user_id, r.expected_email])
    ),
    fetchAuthUser: async (id) => ({
      id,
      email: identities.find((r) => r.auth_user_id === id).expected_email,
    }),
    fetchProfile: async (id) => ({
      id,
      email: identities.find((r) => r.profile_id === id).expected_email,
      status: "active",
    }),
    fetchReferenceCounts: async () => zeroRefs(),
    fetchAuthBanState: async () => false,
    qaQuarantineGetState: async () => ({ ok: true, data: null }),
    qaQuarantinePrepare: async () => {
      prepareCalls += 1;
      return { ok: false, reason: "prepare_rejected" };
    },
    banAuthUser: async () => {
      banCalls += 1;
      return { ok: true };
    },
    qaQuarantineActivateAfterAuthBan: async () => {
      activateCalls += 1;
      return { ok: true };
    },
  };

  const batch = await runBatchQuarantineB1B({
    identities,
    adapters,
    authResult: auth,
    batchId: FRESH_BATCH,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
  });
  assert.equal(batch.ok, false);
  assert.equal(prepareCalls, 1);
  assert.equal(banCalls, 0);
  assert.equal(activateCalls, 0);
  assert.ok(batch.results.length < EXPECTED_B1B_COUNT);
});

test("E) Auth ban failure: prepare occurred; activation=0; fail record; unban=0", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = authorizedAuth(files, binding);
  const row = makeEight()[0];
  const state = { banned: false, profileStatus: "active", authority: null };
  const adapters = baseAdapters(row, state);
  adapters.banAuthUser = async () => {
    adapters._calls.push("banAuthUser");
    return { ok: false, reason: "ban_failed" };
  };

  const result = await quarantineOneIdentityB1B({
    allowlistRow: row,
    adapters,
    authResult: auth,
    dryRun: false,
    batchId: FRESH_BATCH,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
  });

  assert.equal(result.ok, false);
  assert.ok(adapters._calls.includes("qa_quarantine_prepare"));
  assert.ok(adapters._calls.includes("banAuthUser"));
  assert.ok(
    adapters._calls.includes("qa_quarantine_record_compensated_failure")
  );
  assert.equal(
    adapters._calls.filter((c) => c === "qa_quarantine_activate_after_auth_ban")
      .length,
    0
  );
  assert.equal(adapters._calls.filter((c) => c === "unbanAuthUser").length, 0);
  assert.notEqual(state.authority?.lifecycle_state, "active");
  assert.equal(state.profileStatus, "active");
});

test("F) activation failure after new Auth ban: unban + readback + compensated; no retry", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = authorizedAuth(files, binding);
  const row = makeEight()[0];
  const state = { banned: false, profileStatus: "active", authority: null };
  const adapters = baseAdapters(row, state);
  adapters.qaQuarantineActivateAfterAuthBan = async () => {
    adapters._calls.push("qa_quarantine_activate_after_auth_ban");
    return { ok: false, reason: "activate_failed" };
  };

  const result = await quarantineOneIdentityB1B({
    allowlistRow: row,
    adapters,
    authResult: auth,
    dryRun: false,
    batchId: FRESH_BATCH,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
  });

  assert.equal(result.ok, false);
  assert.ok(adapters._calls.includes("banAuthUser"));
  assert.ok(adapters._calls.includes("unbanAuthUser"));
  assert.ok(adapters._calls.includes("qa_quarantine_record_compensated_failure"));
  assert.equal(state.banned, false);
  assert.notEqual(state.authority?.lifecycle_state, "active");
  assert.equal(state.profileStatus, "active");

  // Same GO/batch cannot silently retry
  const retryAuth = evaluateAuthorization(liveInput(files, binding));
  assert.equal(mutationAllowed(retryAuth), false);
  assert.ok(retryAuth.reasons.includes("authority_already_consumed"));
});

test("G) post-activation readback failure: release/compensate; preexisting never unbanned", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth2 = authorizedAuth(files, binding);
  const row = { ...makeEight()[1], auth_banned: true };
  const state = { banned: true, profileStatus: "active", authority: null };
  const adapters = baseAdapters(row, state);
  adapters.qaQuarantineActivatePreexistingBan = async () => {
    adapters._calls.push("qa_quarantine_activate_preexisting_ban");
    state.authority = {
      ...state.authority,
      lifecycle_state: "active",
      auth_ban_state: "not_required_preexisting",
      lifecycle_version: state.authority.lifecycle_version + 1,
      id: state.authority.id,
    };
    // Activate "succeeds" but subsequent authority readback will fail verification
    return { ok: true, data: state.authority };
  };
  let reads = 0;
  adapters.qaQuarantineGetState = async () => {
    adapters._calls.push("qa_quarantine_get_state");
    reads += 1;
    if (reads >= 2 && state.authority?.lifecycle_state === "active") {
      return {
        ok: true,
        data: {
          ...state.authority,
          lifecycle_state: "pending",
          auth_ban_state: "pending",
        },
      };
    }
    return { ok: true, data: state.authority };
  };

  const result = await quarantineOneIdentityB1B({
    allowlistRow: row,
    adapters,
    authResult: auth2,
    dryRun: false,
    batchId: FRESH_BATCH,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
  });
  assert.equal(result.ok, false);
  assert.equal(adapters._calls.filter((c) => c === "unbanAuthUser").length, 0);
  assert.equal(state.banned, true);
  assert.equal(state.profileStatus, "active");
});

test("H) impossible split: Auth banned without authority → stop all", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = authorizedAuth(files, binding);
  const identities = makeEight();

  const row0 = identities[0];
  const state0 = { banned: false, profileStatus: "active", authority: null };
  const a0 = baseAdapters(row0, state0);
  a0.banAuthUser = async () => {
    a0._calls.push("banAuthUser");
    state0.banned = true;
    return { ok: true };
  };
  a0.qaQuarantineActivateAfterAuthBan = async () => {
    a0._calls.push("qa_quarantine_activate_after_auth_ban");
    return { ok: false, reason: "activate_failed" };
  };
  a0.unbanAuthUser = async () => {
    a0._calls.push("unbanAuthUser");
    // Fail unban → leaves Auth banned without authority
    return { ok: false, reason: "unban_failed" };
  };

  const first = await quarantineOneIdentityB1B({
    allowlistRow: row0,
    adapters: a0,
    authResult: auth,
    dryRun: false,
    batchId: FRESH_BATCH,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
  });
  assert.equal(first.ok, false);
  assert.equal(first.critical, true);
  assert.match(first.abortReason || "", /CRITICAL_COMPENSATION_INCOMPLETE/);

  const identities2 = makeEight();
  const states = new Map(
    identities2.map((r) => [
      r.profile_id,
      { banned: false, profileStatus: "active", authority: null },
    ])
  );
  let prepared = 0;
  const batchAd = {
    emailOverrides: Object.fromEntries(
      identities2.map((r) => [r.auth_user_id, r.expected_email])
    ),
    fetchAuthUser: async (id) => ({
      id,
      email: identities2.find((r) => r.auth_user_id === id).expected_email,
    }),
    fetchProfile: async (id) => ({
      id,
      email: identities2.find((r) => r.profile_id === id).expected_email,
      status: "active",
    }),
    fetchReferenceCounts: async () => zeroRefs(),
    fetchAuthBanState: async (id) => states.get(id).banned === true,
    qaQuarantineGetState: async ({ profileId }) => ({
      ok: true,
      data: states.get(profileId).authority,
    }),
    qaQuarantinePrepare: async (args) => {
      prepared += 1;
      const st = states.get(args.profileId);
      st.authority = {
        id: "q-" + args.profileId,
        profile_id: args.profileId,
        batch_id: args.batchId,
        allowlist_sha256: args.allowlistSha256,
        lifecycle_state: "pending",
        auth_ban_state: "pending",
        lifecycle_version: 1,
        original_auth_banned: false,
        original_profile_status: "active",
      };
      return { ok: true, data: st.authority };
    },
    banAuthUser: async ({ userId }) => {
      states.get(userId).banned = true;
      return { ok: true };
    },
    unbanAuthUser: async () => {
      // Leave banned to create split if activation fails and unban "fails"
      return { ok: false, reason: "unban_failed" };
    },
    qaQuarantineActivateAfterAuthBan: async () => ({
      ok: false,
      reason: "activate_failed",
    }),
    qaQuarantineRecordCompensatedFailure: async () => ({ ok: true, data: {} }),
  };

  resetAuthorityConsumptionForTests();
  const auth3 = authorizedAuth(files, binding);
  const batch = await runBatchQuarantineB1B({
    identities: identities2,
    adapters: batchAd,
    authResult: auth3,
    batchId: FRESH_BATCH,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
  });
  assert.equal(batch.ok, false);
  assert.equal(batch.results[0].critical, true);
  // Stop after first unresolved — remaining not all processed as success
  assert.ok(prepared <= 2);
  assert.ok(
    batch.results.length < EXPECTED_B1B_COUNT ||
      batch.results.some(
        (r) => r.abortReason?.includes("batch_stopped") || r.critical
      )
  );
});

test("I) no B1B writer updates profiles.status", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = authorizedAuth(files, binding);
  const row = makeEight()[0];
  const state = { banned: false, profileStatus: "active", authority: null };
  const adapters = baseAdapters(row, state);
  assert.equal(typeof adapters.updateProfileStatus, "undefined");

  const result = await quarantineOneIdentityB1B({
    allowlistRow: row,
    adapters,
    authResult: auth,
    dryRun: false,
    batchId: FRESH_BATCH,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
  });
  assert.equal(result.ok, true);
  assert.equal(state.profileStatus, "active");
  assert.equal(result.profileStatusPreserved, true);

  // Reject adapter surface that includes updateProfileStatus
  const bad = await quarantineOneIdentityB1B({
    allowlistRow: row,
    adapters: {
      ...adapters,
      updateProfileStatus: async () => ({ ok: true }),
    },
    authResult: auth,
    dryRun: false,
    batchId: FRESH_BATCH,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
  });
  assert.equal(bad.ok, false);
  assert.match(bad.abortReason || "", /profile_status_writer_forbidden/);
});

test("J) OLD B1 retirement: GO and batches cannot authorize forward", () => {
  assert.equal(FORWARD_LIVE_EXECUTION_RETIRED, true);
  assert.equal(B1_RETIRED_GO, "APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY");
  assert.equal(REQUIRED_OWNER_PRODUCTION_GO, B1_RETIRED_GO);

  const forward = evaluateB1Authorization({
    DRY_RUN: "false",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: FRESH_BATCH,
    ALLOWLIST_PATH: "C:\\tmp\\a.json",
    ALLOWLIST_SHA256: "c".repeat(64),
    OWNER_PRODUCTION_GO: REQUIRED_OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION:
      "I_UNDERSTAND_THIS_MUTATES_PRODUCTION_QA_ONLY",
  });
  assert.equal(b1MutationAllowed(forward), false);
  assert.ok(forward.reasons.includes("forward_live_execution_retired"));
  assert.ok(
    forward.reasons.includes("retired_owner_production_go_not_reusable")
  );
  assert.equal(forward.oldOwnerGoReusable, false);
  assert.equal(forward.oldBatchReusable, false);

  for (const batch of [
    "b37186cf-e620-4f27-aba3-d7e8750ae7df",
    "9c9d5fc7-648e-44c6-a959-e62157f7c970",
  ]) {
    const r = evaluateB1Authorization({
      DRY_RUN: "false",
      PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
      OPERATION_B1_BATCH_ID: batch,
      ALLOWLIST_PATH: "C:\\tmp\\a.json",
      ALLOWLIST_SHA256: "c".repeat(64),
      OWNER_PRODUCTION_GO: REQUIRED_OWNER_PRODUCTION_GO,
      EXPLICIT_EXECUTE_CONFIRMATION:
        "I_UNDERSTAND_THIS_MUTATES_PRODUCTION_QA_ONLY",
    });
    assert.equal(b1MutationAllowed(r), false);
    assert.ok(r.reasons.includes("retired_batch_id_not_reusable"));
  }
});

test("K) exact eight accepted under valid mocked conditions; hard delete unavailable", () => {
  const doc = {
    operation: OPERATION_ID,
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    target_count: 8,
    identities: makeEight(),
  };
  const v = validateAllowlistDocument(doc);
  assert.equal(v.ok, true);
  assert.equal(hardDeleteUnavailable().available, false);
});

test("L) security surface: narrow adapters; no raw admin; no profile status writer", () => {
  assert.ok(
    !OPERATION_B1B_LIVE_ADAPTER_CAPABILITIES.includes("updateProfileStatus")
  );
  assert.ok(!OPERATION_B1B_LIVE_ADAPTER_CAPABILITIES.includes("deleteUser"));
  assert.ok(!OPERATION_B1B_LIVE_ADAPTER_CAPABILITIES.includes("createUser"));

  const adapters = createOperationB1BLiveAdapters({
    admin: {
      auth: { admin: { getUserById: async () => ({ data: null }), updateUserById: async () => ({ data: null }) } },
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: null, error: null }),
        };
      },
      rpc: async () => ({ data: { ok: true }, error: null }),
    },
  });
  const surface = assertNarrowAdapterSurface(adapters);
  assert.equal(surface.ok, true);
  assert.equal(surface.hasUpdateProfileStatus, false);
  assert.equal(surface.hasHardDelete, false);
  assert.equal(adapters.admin, undefined);
  assert.equal(adapters.client, undefined);
  assert.equal(adapters.deleteUser, undefined);
  assert.equal(adapters.updateProfileStatus, undefined);
});

test("one-time authority: presentLiveAuthority consumes GO/batch", () => {
  resetAuthorityConsumptionForTests();
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = evaluateAuthorization(liveInput(files, binding));
  assert.equal(mutationAllowed(auth), true);
  const first = presentLiveAuthority(auth);
  assert.equal(first.ok, true);
  const second = presentLiveAuthority(auth);
  assert.equal(second.ok, false);
  const again = evaluateAuthorization(liveInput(files, binding));
  assert.equal(mutationAllowed(again), false);
  assert.ok(again.reasons.includes("authority_already_consumed"));
});

test("createFreshAuthorizationBinding rejects retired GO/batch", () => {
  const badGo = createFreshAuthorizationBinding({
    ownerProductionGo: RETIRED_OWNER_PRODUCTION_GO,
    expectedBatchId: FRESH_BATCH,
    allowlistSha256: "a".repeat(64),
    snapshotSha256: "b".repeat(64),
  });
  assert.equal(badGo.ok, false);
  assert.ok(badGo.reasons.includes("retired_owner_production_go_not_reusable"));

  const badBatch = createFreshAuthorizationBinding({
    ownerProductionGo: TEST_GO,
    expectedBatchId: "b37186cf-e620-4f27-aba3-d7e8750ae7df",
    allowlistSha256: "a".repeat(64),
    snapshotSha256: "b".repeat(64),
  });
  assert.equal(badBatch.ok, false);
  assert.ok(badBatch.reasons.includes("retired_batch_id_not_reusable"));
});
