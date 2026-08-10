/**
 * OPERATION B1B — WP4 runner remediation tests (local/mock only).
 * No Staging/Production access. No real PostgreSQL.
 *
 * Includes strict RPC argument contract locks against WP2 SQL.
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
  OPERATION_B1B_RPC_ARG_KEYS,
  FAILURE_CLASSIFICATION_MATRIX,
  CERTIFIED_B1_TARGET_LABELS,
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
const WP2_SQL = path.join(
  root,
  "docs/v5/operations/production-qa-identity-operation-b1b-remediation/sql/20_QA_IDENTITY_QUARANTINE_AUTHORITY_FORWARD.sql"
);
const FRESH_BATCH = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2";
const TEST_GO = "APPROVE_OPERATION_B1B_UNIT_TEST_BINDING_NOT_PRODUCTION";

function uuid(n = 1) {
  const hex = String(n).padStart(12, "0");
  return `33333333-4444-4555-8666-${hex}`;
}

function quarantineUuid(n = 1) {
  const hex = String(n).padStart(12, "0");
  return `aaaaaaaa-bbbb-4ccc-8ddd-${hex}`;
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

/** Test-only durable claimer — WP4 has no default Production implementation. */
function testDurableClaimer() {
  const claimed = new Set();
  return async (bind) => {
    const key = `${bind.ownerProductionGo}::${bind.batchId}::${bind.allowlistSha256}::${bind.snapshotSha256}`;
    if (claimed.has(key)) {
      return { ok: false, consumed: true, reason: "authority_already_consumed" };
    }
    claimed.add(key);
    return { ok: true };
  };
}

function assertExactKeys(actual, expected, label) {
  const a = Object.keys(actual || {}).sort();
  const e = [...expected].sort();
  assert.deepEqual(a, e, label);
}

function baseAdapters(row, state) {
  const calls = [];
  const rpcArgLog = [];
  const qid = state.quarantineId || quarantineUuid(1);

  function pushRpc(name, args) {
    rpcArgLog.push({ name, keys: Object.keys(args || {}).sort(), args });
  }

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
    validateQaPrepareContract: async (args) => {
      calls.push("operation_b1b_validate_qa_prepare_contract");
      pushRpc("operation_b1b_validate_qa_prepare_contract", {
        p_bindings: args.bindings,
      });
      assertExactKeys(
        { p_bindings: 1 },
        OPERATION_B1B_RPC_ARG_KEYS.operation_b1b_validate_qa_prepare_contract,
        "validateQaPrepareContract arg keys"
      );
      if (state.prepareContractOk === false) {
        return {
          ok: false,
          reason: state.prepareContractReason || "prepare_contract_incompatible",
          code: state.prepareContractReason || "prepare_contract_incompatible",
        };
      }
      return {
        ok: true,
        data: {
          ok: true,
          code: "prepare_contract_compatible",
          checked: Array.isArray(args?.bindings) ? args.bindings.length : 0,
          environment: "production",
        },
      };
    },
    qaQuarantinePrepare: async (args) => {
      calls.push("qa_quarantine_prepare");
      pushRpc("qa_quarantine_prepare", {
        p_profile_id: args.profileId,
        p_auth_user_id: args.authUserId,
        p_batch_id: args.batchId,
        p_allowlist_sha256: args.allowlistSha256,
        p_snapshot_sha256: args.snapshotSha256,
        p_reason: args.reason,
        p_original_profile_status: args.originalProfileStatus,
        p_original_auth_banned: args.originalAuthBanned,
        p_expected_email: args.expectedEmail,
        p_allowlist_label: args.allowlistLabel,
        p_metadata: args.metadata ?? {},
      });
      assertExactKeys(
        {
          p_profile_id: 1,
          p_auth_user_id: 1,
          p_batch_id: 1,
          p_allowlist_sha256: 1,
          p_snapshot_sha256: 1,
          p_reason: 1,
          p_original_profile_status: 1,
          p_original_auth_banned: 1,
          p_expected_email: 1,
          p_allowlist_label: 1,
          p_metadata: 1,
        },
        OPERATION_B1B_RPC_ARG_KEYS.qa_quarantine_prepare,
        "prepare mock keys"
      );
      state.authority = {
        id: qid,
        quarantine_id: qid,
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
      return {
        ok: true,
        data: {
          ok: true,
          code: "prepared",
          quarantine_id: qid,
          lifecycle_state: "pending",
          auth_ban_state: "pending",
          lifecycle_version: 1,
          ...state.authority,
        },
      };
    },
    qaQuarantineActivateAfterAuthBan: async (args) => {
      calls.push("qa_quarantine_activate_after_auth_ban");
      pushRpc("qa_quarantine_activate_after_auth_ban", {
        p_quarantine_id: args.quarantineId,
        p_expected_lifecycle_version: args.expectedLifecycleVersion,
        p_auth_ban_readback_confirmed: args.authBanReadbackConfirmed === true,
      });
      assertExactKeys(
        {
          p_quarantine_id: 1,
          p_expected_lifecycle_version: 1,
          p_auth_ban_readback_confirmed: 1,
        },
        OPERATION_B1B_RPC_ARG_KEYS.qa_quarantine_activate_after_auth_ban,
        "activate_after keys"
      );
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
      return {
        ok: true,
        data: {
          ok: true,
          code: "activated_after_auth_ban",
          quarantine_id: args.quarantineId,
          ...state.authority,
        },
      };
    },
    qaQuarantineActivatePreexistingBan: async (args) => {
      calls.push("qa_quarantine_activate_preexisting_ban");
      pushRpc("qa_quarantine_activate_preexisting_ban", {
        p_quarantine_id: args.quarantineId,
        p_expected_lifecycle_version: args.expectedLifecycleVersion,
      });
      assertExactKeys(
        {
          p_quarantine_id: 1,
          p_expected_lifecycle_version: 1,
        },
        OPERATION_B1B_RPC_ARG_KEYS.qa_quarantine_activate_preexisting_ban,
        "activate_preexisting keys"
      );
      if (args.expectedLifecycleVersion !== state.authority.lifecycle_version) {
        return { ok: false, reason: "lifecycle_version_mismatch" };
      }
      state.authority = {
        ...state.authority,
        lifecycle_state: "active",
        auth_ban_state: "not_required_preexisting",
        lifecycle_version: state.authority.lifecycle_version + 1,
      };
      return {
        ok: true,
        data: {
          ok: true,
          code: "activated_preexisting_ban",
          quarantine_id: args.quarantineId,
          ...state.authority,
        },
      };
    },
    qaQuarantineRecordCompensatedFailure: async (args) => {
      calls.push("qa_quarantine_record_compensated_failure");
      pushRpc("qa_quarantine_record_compensated_failure", {
        p_quarantine_id: args.quarantineId,
        p_expected_lifecycle_version: args.expectedLifecycleVersion,
        p_target_auth_ban_state: args.targetAuthBanState,
        p_failure_classification: args.failureClassification,
      });
      assertExactKeys(
        {
          p_quarantine_id: 1,
          p_expected_lifecycle_version: 1,
          p_target_auth_ban_state: 1,
          p_failure_classification: 1,
        },
        OPERATION_B1B_RPC_ARG_KEYS.qa_quarantine_record_compensated_failure,
        "compensated_failure keys"
      );
      const expected =
        FAILURE_CLASSIFICATION_MATRIX[args.failureClassification];
      if (!expected || expected !== args.targetAuthBanState) {
        return { ok: false, reason: "invalid_compensation_pair", code: "invalid_compensation_pair" };
      }
      if (
        args.failureClassification === "activation_failed_preexisting" &&
        state.authority?.original_auth_banned !== true
      ) {
        return {
          ok: false,
          reason: "preexisting_classification_requires_original_banned",
        };
      }
      state.authority = {
        ...state.authority,
        lifecycle_state: "failed",
        auth_ban_state: args.targetAuthBanState,
        failure_classification: args.failureClassification,
        lifecycle_version: (state.authority?.lifecycle_version || 1) + 1,
      };
      return { ok: true, data: state.authority };
    },
    qaQuarantineRelease: async (args) => {
      calls.push("qa_quarantine_release");
      pushRpc("qa_quarantine_release", {
        p_quarantine_id: args.quarantineId,
        p_expected_lifecycle_version: args.expectedLifecycleVersion,
        p_release_reason: args.releaseReason,
      });
      assertExactKeys(
        {
          p_quarantine_id: 1,
          p_expected_lifecycle_version: 1,
          p_release_reason: 1,
        },
        OPERATION_B1B_RPC_ARG_KEYS.qa_quarantine_release,
        "release keys"
      );
      state.authority = {
        ...state.authority,
        lifecycle_state: "released",
        lifecycle_version: (state.authority?.lifecycle_version || 1) + 1,
      };
      return { ok: true, data: state.authority };
    },
    qaQuarantineGetState: async (args) => {
      calls.push("qa_quarantine_get_state");
      const rpcArgs = { p_quarantine_id: args.quarantineId };
      pushRpc("qa_quarantine_get_state", rpcArgs);
      assert.deepEqual(
        Object.keys(rpcArgs),
        ["p_quarantine_id"],
        "get_state must only send p_quarantine_id"
      );
      assert.equal(
        Object.prototype.hasOwnProperty.call(args, "profileId") &&
          args.profileId != null &&
          Object.keys(rpcArgs).includes("p_profile_id"),
        false
      );
      assert.ok(args.quarantineId, "get_state requires quarantineId");
      assert.equal(
        Object.keys(rpcArgs).includes("p_profile_id"),
        false,
        "get_state must never send p_profile_id"
      );
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
    _rpcArgLog: rpcArgLog,
  };
  return adapters;
}

async function authorizedAuth(files, binding) {
  resetAuthorityConsumptionForTests();
  const auth = evaluateAuthorization(liveInput(files, binding));
  assert.equal(mutationAllowed(auth), true);
  const presented = await presentLiveAuthority(auth, testDurableClaimer());
  assert.equal(presented.ok, true);
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
  assert.deepEqual(OPERATION_B1B_RPC_ARG_KEYS.qa_quarantine_get_state, [
    "p_quarantine_id",
  ]);
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

test("A) target count != 8 / B2 / forbidden email / uncertified labels = zero", () => {
  const short = makeEight().slice(0, 7);
  const shortDoc = {
    operation: OPERATION_ID,
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    target_count: 7,
    identities: short,
  };
  assert.equal(validateAllowlistDocument(shortDoc).ok, false);

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

  const lowerB2 = makeEight();
  lowerB2[0].label = "qa-01";
  const b2lower = validateAllowlistDocument({
    operation: OPERATION_ID,
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    target_count: 8,
    identities: lowerB2,
  });
  assert.equal(b2lower.ok, false);
  assert.ok(
    b2lower.errors.some((e) => e.startsWith("b2_excluded_label_present"))
  );

  const arbitrary = makeEight();
  arbitrary[0].label = "FOO-99";
  const arb = validateAllowlistDocument({
    operation: OPERATION_ID,
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    target_count: 8,
    identities: arbitrary,
  });
  assert.equal(arb.ok, false);
  assert.ok(arb.errors.some((e) => e.startsWith("unknown_or_uncertified_label")));

  const lowerOk = makeEight();
  lowerOk[0].label = "qa-04";
  const normalized = validateAllowlistDocument({
    operation: OPERATION_ID,
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    target_count: 8,
    identities: lowerOk,
  });
  assert.equal(normalized.ok, true);
  assert.equal(normalized.identities[0].label, "QA-04");

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

  assert.equal(CERTIFIED_B1_TARGET_LABELS.length, 8);
});

test("B) originally unbanned order: prepare→ban→auth_readback→activate_after→get_state(id)", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = await authorizedAuth(files, binding);
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

  const names = callLog.map((c) => c.name);
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

  const getStateCalls = adapters._rpcArgLog.filter(
    (c) => c.name === "qa_quarantine_get_state"
  );
  assert.ok(getStateCalls.length >= 1);
  for (const c of getStateCalls) {
    assert.deepEqual(c.keys, ["p_quarantine_id"]);
  }
});

test("C) preexisting ban: prepare→auth_readback→activate_preexisting; ban/unban = 0", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = await authorizedAuth(files, binding);
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
  const auth = await authorizedAuth(files, binding);
  const identities = makeEight();
  let prepareCalls = 0;
  let banCalls = 0;
  let activateCalls = 0;
  let getStateCalls = 0;

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
    qaQuarantineGetState: async () => {
      getStateCalls += 1;
      return { ok: true, data: null };
    },
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
  assert.equal(getStateCalls, 0, "no get_state before quarantine_id");
  assert.ok(batch.results.length < EXPECTED_B1B_COUNT);
});

test("E) Auth ban failure: prepare → record(failed, auth_ban_failed); unban=0", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = await authorizedAuth(files, binding);
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
  const failArgs = adapters._rpcArgLog.find(
    (c) => c.name === "qa_quarantine_record_compensated_failure"
  );
  assert.equal(failArgs.args.p_failure_classification, "auth_ban_failed");
  assert.equal(failArgs.args.p_target_auth_ban_state, "failed");
  assert.equal(
    adapters._calls.filter((c) => c === "qa_quarantine_activate_after_auth_ban")
      .length,
    0
  );
  assert.equal(adapters._calls.filter((c) => c === "unbanAuthUser").length, 0);
  assert.notEqual(state.authority?.lifecycle_state, "active");
});

test("F) activation failure after new Auth ban: unban + record(reverted, activation_failed_compensated)", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = await authorizedAuth(files, binding);
  const row = makeEight()[0];
  const state = { banned: false, profileStatus: "active", authority: null };
  const adapters = baseAdapters(row, state);
  adapters.qaQuarantineActivateAfterAuthBan = async (args) => {
    adapters._calls.push("qa_quarantine_activate_after_auth_ban");
    adapters._rpcArgLog.push({
      name: "qa_quarantine_activate_after_auth_ban",
      keys: Object.keys({
        p_quarantine_id: args.quarantineId,
        p_expected_lifecycle_version: args.expectedLifecycleVersion,
        p_auth_ban_readback_confirmed: true,
      }).sort(),
      args: {
        p_quarantine_id: args.quarantineId,
        p_expected_lifecycle_version: args.expectedLifecycleVersion,
        p_auth_ban_readback_confirmed: true,
      },
    });
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
  const failArgs = adapters._rpcArgLog.find(
    (c) => c.name === "qa_quarantine_record_compensated_failure"
  );
  assert.equal(
    failArgs.args.p_failure_classification,
    "activation_failed_compensated"
  );
  assert.equal(failArgs.args.p_target_auth_ban_state, "reverted");
  assert.equal(state.banned, false);
  assert.notEqual(state.authority?.lifecycle_state, "active");
  assert.equal(state.profileStatus, "active");
});

test("F2) compensation incomplete path records compensation_incomplete→failed", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = await authorizedAuth(files, binding);
  const row = makeEight()[0];
  const state = { banned: false, profileStatus: "active", authority: null };
  const adapters = baseAdapters(row, state);
  adapters.qaQuarantineActivateAfterAuthBan = async () => {
    adapters._calls.push("qa_quarantine_activate_after_auth_ban");
    return { ok: false, reason: "activate_failed" };
  };
  adapters.unbanAuthUser = async () => {
    adapters._calls.push("unbanAuthUser");
    return { ok: false, reason: "unban_failed" };
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
  assert.equal(result.critical, true);
  assert.match(result.abortReason || "", /CRITICAL_COMPENSATION_INCOMPLETE/);
  const failArgs = adapters._rpcArgLog.find(
    (c) =>
      c.name === "qa_quarantine_record_compensated_failure" &&
      c.args.p_failure_classification === "compensation_incomplete"
  );
  assert.ok(failArgs);
  assert.equal(failArgs.args.p_target_auth_ban_state, "failed");
});

test("G) preexisting activation failure: activation_failed_preexisting→failed; no unban", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = await authorizedAuth(files, binding);
  const row = { ...makeEight()[1], auth_banned: true };
  const state = { banned: true, profileStatus: "active", authority: null };
  const adapters = baseAdapters(row, state);
  adapters.qaQuarantineActivatePreexistingBan = async () => {
    adapters._calls.push("qa_quarantine_activate_preexisting_ban");
    return { ok: false, reason: "activate_preexisting_failed" };
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
  assert.equal(adapters._calls.filter((c) => c === "unbanAuthUser").length, 0);
  assert.equal(state.banned, true);
  const failArgs = adapters._rpcArgLog.find(
    (c) => c.name === "qa_quarantine_record_compensated_failure"
  );
  assert.equal(
    failArgs.args.p_failure_classification,
    "activation_failed_preexisting"
  );
  assert.equal(failArgs.args.p_target_auth_ban_state, "failed");
  assert.notEqual(state.authority?.lifecycle_state, "active");
});

test("H) impossible split / critical compensation stops batch", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const identities2 = makeEight();
  const states = new Map(
    identities2.map((r, i) => [
      r.profile_id,
      {
        banned: false,
        profileStatus: "active",
        authority: null,
        quarantineId: quarantineUuid(i + 1),
      },
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
    qaQuarantineGetState: async ({ quarantineId }) => {
      assert.ok(quarantineId);
      const st = [...states.values()].find((s) => s.quarantineId === quarantineId);
      return { ok: true, data: st?.authority || null };
    },
    qaQuarantinePrepare: async (args) => {
      prepared += 1;
      const st = states.get(args.profileId);
      st.authority = {
        id: st.quarantineId,
        quarantine_id: st.quarantineId,
        profile_id: args.profileId,
        batch_id: args.batchId,
        allowlist_sha256: args.allowlistSha256,
        lifecycle_state: "pending",
        auth_ban_state: "pending",
        lifecycle_version: 1,
        original_auth_banned: false,
        original_profile_status: "active",
      };
      return {
        ok: true,
        data: {
          ok: true,
          code: "prepared",
          quarantine_id: st.quarantineId,
          ...st.authority,
        },
      };
    },
    banAuthUser: async ({ userId }) => {
      states.get(userId).banned = true;
      return { ok: true };
    },
    unbanAuthUser: async () => ({ ok: false, reason: "unban_failed" }),
    qaQuarantineActivateAfterAuthBan: async () => ({
      ok: false,
      reason: "activate_failed",
    }),
    qaQuarantineRecordCompensatedFailure: async (args) => {
      assert.ok(
        FAILURE_CLASSIFICATION_MATRIX[args.failureClassification] ===
          args.targetAuthBanState
      );
      return { ok: true, data: {} };
    },
  };

  resetAuthorityConsumptionForTests();
  const auth3 = await authorizedAuth(files, binding);
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
  assert.ok(prepared <= 2);
});

test("I) no B1B writer updates profiles.status", async () => {
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = await authorizedAuth(files, binding);
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

test("K) exact eight accepted; certified labels exactly once", () => {
  const doc = {
    operation: OPERATION_ID,
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    target_count: 8,
    identities: makeEight(),
  };
  const v = validateAllowlistDocument(doc);
  assert.equal(v.ok, true);
  assert.equal(hardDeleteUnavailable().available, false);
  const labels = v.identities.map((r) => r.label).sort();
  assert.deepEqual(labels, [...CERTIFIED_B1_TARGET_LABELS].sort());
});

test("L) security surface: narrow adapters; get_state exact keys; no p_profile_id", async () => {
  assert.ok(
    !OPERATION_B1B_LIVE_ADAPTER_CAPABILITIES.includes("updateProfileStatus")
  );

  const rpcCalls = [];
  const adapters = createOperationB1BLiveAdapters({
    admin: {
      auth: {
        admin: {
          getUserById: async () => ({ data: null }),
          updateUserById: async () => ({ data: null }),
        },
      },
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
      rpc: async (name, args) => {
        rpcCalls.push({ name, keys: Object.keys(args || {}).sort(), args });
        return { data: { ok: true, code: "state" }, error: null };
      },
    },
  });
  const surface = assertNarrowAdapterSurface(adapters);
  assert.equal(surface.ok, true);
  assert.equal(adapters.admin, undefined);

  const qid = quarantineUuid(9);
  const ok = await adapters.qaQuarantineGetState({ quarantineId: qid });
  assert.equal(ok.ok, true);
  assert.deepEqual(rpcCalls[0].keys, ["p_quarantine_id"]);
  assert.equal(rpcCalls[0].args.p_quarantine_id, qid);
  assert.equal(
    Object.prototype.hasOwnProperty.call(rpcCalls[0].args, "p_profile_id"),
    false
  );

  const badNull = await adapters.qaQuarantineGetState({ quarantineId: null });
  assert.equal(badNull.ok, false);
  assert.equal(badNull.reason, "invalid_or_missing_quarantine_id");

  const badProfile = await adapters.qaQuarantineGetState({
    quarantineId: qid,
    profileId: uuid(1),
  });
  assert.equal(badProfile.ok, true);
  assert.deepEqual(rpcCalls.at(-1).keys, ["p_quarantine_id"]);
});

test("M) live execute requires durable claimOneTimeLiveAuthority dependency", async () => {
  resetAuthorityConsumptionForTests();
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const row = makeEight()[0];
  const state = { banned: false, profileStatus: "active", authority: null };
  const adapters = baseAdapters(row, state);

  const missing = await runB1BExecute(liveInput(files, binding), {
    repoRoots: [root],
    adapters,
  });
  assert.equal(missing.ok, false);
  assert.equal(
    missing.failReason,
    "durable_one_time_authority_dependency_required"
  );
  assert.equal(missing.mutationCalls, 0);

  resetAuthorityConsumptionForTests();
  const ok = await runB1BExecute(liveInput(files, binding), {
    repoRoots: [root],
    adapters: baseAdapters(row, {
      banned: false,
      profileStatus: "active",
      authority: null,
    }),
    claimOneTimeLiveAuthority: testDurableClaimer(),
  });
  // Single-identity adapters against 8 identities will fail eligibility for others,
  // but durable claim must have succeeded first (authorityConsumed).
  assert.equal(ok.authorityConsumed, true);
  assert.equal(ok.durableAuthorityClaimed, true);
});

test("one-time authority: durable dependency required; process-local is defense-in-depth", async () => {
  resetAuthorityConsumptionForTests();
  const files = writeAllowlistAndSnapshot(makeEight(), FRESH_BATCH);
  const binding = makeBinding(files);
  const auth = evaluateAuthorization(liveInput(files, binding));
  assert.equal(mutationAllowed(auth), true);

  const missing = await presentLiveAuthority(auth);
  assert.equal(missing.ok, false);
  assert.equal(
    missing.reason,
    "durable_one_time_authority_dependency_required"
  );

  const claimer = testDurableClaimer();
  const first = await presentLiveAuthority(auth, claimer);
  assert.equal(first.ok, true);
  assert.equal(first.durable, true);
  const second = await presentLiveAuthority(auth, claimer);
  assert.equal(second.ok, false);
});

test("N) RPC arg keys locked to WP2 SQL signatures", () => {
  const sql = fs.readFileSync(WP2_SQL, "utf8");
  const expected = {
    operation_b1b_validate_qa_prepare_contract: "p_bindings jsonb",
    qa_quarantine_prepare:
      "p_profile_id uuid, p_auth_user_id uuid, p_batch_id uuid, p_allowlist_sha256 text, p_snapshot_sha256 text, p_reason text, p_original_profile_status text, p_original_auth_banned boolean, p_expected_email text, p_allowlist_label text, p_metadata jsonb",
    qa_quarantine_activate_after_auth_ban:
      "p_quarantine_id uuid, p_expected_lifecycle_version integer, p_auth_ban_readback_confirmed boolean",
    qa_quarantine_activate_preexisting_ban:
      "p_quarantine_id uuid, p_expected_lifecycle_version integer",
    qa_quarantine_record_compensated_failure:
      "p_quarantine_id uuid, p_expected_lifecycle_version integer, p_target_auth_ban_state text, p_failure_classification text",
    qa_quarantine_release:
      "p_quarantine_id uuid, p_expected_lifecycle_version integer, p_release_reason text",
    qa_quarantine_get_state: "p_quarantine_id uuid",
  };

  for (const [name, sig] of Object.entries(expected)) {
    assert.ok(
      sql.includes(`WHEN '${name}' THEN`) ||
        new RegExp(
          `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`,
          "i"
        ).test(sql),
      `sql mentions ${name}`
    );
    const keys = OPERATION_B1B_RPC_ARG_KEYS[name];
    for (const key of keys) {
      assert.ok(sig.includes(key), `${name} SQL sig includes ${key}`);
    }
    assert.equal(
      keys.includes("p_profile_id") && name === "qa_quarantine_get_state",
      false
    );
  }

  assert.deepEqual(OPERATION_B1B_RPC_ARG_KEYS.qa_quarantine_get_state, [
    "p_quarantine_id",
  ]);
  assert.ok(sql.includes("activation_failed_preexisting"));
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
