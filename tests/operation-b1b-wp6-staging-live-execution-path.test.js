/**
 * OPERATION B1B — WP6 Staging live execution path + durable authority claim.
 *
 * Local/mock + local disposable Postgres only.
 * STAGING_ACCESS=0 / AUTH_MUTATIONS=0 / PRODUCTION_ACCESS=0
 */
import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import {
  EXPECTED_PRODUCTION_PROJECT_REF,
  EXPECTED_STAGING_PROJECT_REF,
  OPERATION_TARGET_MODE,
  OPERATION_ID,
  REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
  CERTIFIED_STAGING_TARGET_LABELS,
  createFreshAuthorizationBinding,
  createOperationB1BLiveAdapters,
  createPgOperationB1BDurableAuthorityClaimer,
  fingerprintOwnerGo,
  hashExactEightUuidSet,
  assertNoSecretsInClaimEvidence,
  validateDurableAuthorityBind,
  evaluateAuthorization,
  mutationAllowed,
  presentLiveAuthority,
  resetAuthorityConsumptionForTests,
  quarantineOneIdentityB1B,
  sha256Hex,
  OPERATION_B1B_LIVE_ADAPTER_CAPABILITIES,
} from "../scripts/operations/production-qa-identity-operation-b1b/lib/index.js";
import { runB1BExecute } from "../scripts/operations/production-qa-identity-operation-b1b/execute.mjs";
import {
  buildStagingLiveExecuteInput,
  resolveStagingLiveCredentials,
  createStagingLiveExecutionDeps,
} from "../scripts/operations/production-qa-identity-operation-b1b/stagingLiveExecute.mjs";
import {
  WP6_CLAIM_FORWARD,
  WP6_CLAIM_ROLLBACK,
  applyWp6ClaimForward,
  applyWp6ClaimRollback,
  asServiceRole,
  bootstrapWp6ClaimDatabase,
  readWp6ClaimSql,
  resolveWp6LocalDatabase,
  resetSessionGuc,
} from "./helpers/operation-b1b-wp6-execution-path.js";
import { asRole } from "./helpers/operation-b1b-wp5-postgres.js";
import { readPgDurableAuthorityClaim } from "../scripts/operations/production-qa-identity-operation-b1b/lib/durableAuthorityClaim.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_BATCH = "c13c323a-4fec-4327-90ba-56128fb126f5";
const STAGING_BATCH_2 = "c13c323a-4fec-4327-90ba-56128fb126f6";
const STAGING_GO = "APPROVE_OPERATION_B1B_STAGING_REHEARSAL_UNIT_TEST_NOT_LIVE";
const EXEC_VERSION = "496bf24d0be59e7fc09db353ff68f1a0d351e2ae";

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

function uuid(n = 1) {
  const hex = String(n).padStart(12, "0");
  return `33333333-4444-4555-8666-${hex}`;
}

function makeStagingEight() {
  const identities = [];
  for (let i = 1; i <= 8; i += 1) {
    const id = uuid(100 + i);
    identities.push({
      label: CERTIFIED_STAGING_TARGET_LABELS[i - 1],
      auth_user_id: id,
      profile_id: id,
      expected_email: `phase1c.stg.safe${i}@staging-qa.local`,
      profile_status: "active",
      auth_banned: false,
      reference_counts: zeroRefs(),
      captured_at: "2026-08-09T00:00:00.000Z",
      staging_project_ref: EXPECTED_STAGING_PROJECT_REF,
    });
  }
  return identities;
}

function writeAllowlistAndSnapshot(identities, batchId) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "op-b1b-wp6-exec-"));
  const alPath = path.join(dir, "allowlist.json");
  const snPath = path.join(dir, "snapshot.json");
  const allowlist = {
    operation: OPERATION_ID,
    operation_target_mode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
    staging_project_ref: EXPECTED_STAGING_PROJECT_REF,
    target_count: 8,
    captured_at_utc: "2026-08-09T00:00:00.000Z",
    batch_id: batchId,
    identities,
  };
  const snapshot = {
    operation: "OPERATION_B1B_STAGING_ORIGINAL_STATE_SNAPSHOT",
    operation_target_mode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
    staging_project_ref: EXPECTED_STAGING_PROJECT_REF,
    batch_id: batchId,
    captured_at_utc: "2026-08-09T00:00:00.000Z",
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
      staging_project_ref: EXPECTED_STAGING_PROJECT_REF,
    })),
  };
  const alBody = `${JSON.stringify(allowlist, null, 2)}\n`;
  const snBody = `${JSON.stringify(snapshot, null, 2)}\n`;
  fs.writeFileSync(alPath, alBody, "utf8");
  fs.writeFileSync(snPath, snBody, "utf8");
  return {
    dir,
    alPath,
    snPath,
    alSha: sha256Hex(alBody),
    snSha: sha256Hex(snBody),
    exactEight: hashExactEightUuidSet(identities),
  };
}

function makeStagingBinding(files, overrides = {}) {
  const created = createFreshAuthorizationBinding({
    operationTargetMode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
    ownerStagingGo: STAGING_GO,
    expectedBatchId: STAGING_BATCH,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
    stagingProjectRef: EXPECTED_STAGING_PROJECT_REF,
    explicitExecuteConfirmation: REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
    ...overrides,
  });
  assert.equal(created.ok, true, created.reasons?.join(","));
  return created.binding;
}

function stagingLiveInput(files, binding, overrides = {}) {
  return {
    DRY_RUN: "false",
    OPERATION_TARGET_MODE: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
    STAGING_PROJECT_REF: EXPECTED_STAGING_PROJECT_REF,
    TARGET_PROJECT_REF: EXPECTED_STAGING_PROJECT_REF,
    OPERATION_B1B_BATCH_ID: STAGING_BATCH,
    ALLOWLIST_PATH: files.alPath,
    ALLOWLIST_SHA256: files.alSha,
    RECOVERY_SNAPSHOT_PATH: files.snPath,
    SNAPSHOT_SHA256: files.snSha,
    OWNER_STAGING_GO: STAGING_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
    freshAuthorizationBinding: binding,
    executionVersion: EXEC_VERSION,
    ...overrides,
  };
}

function baseAdapters(row, state) {
  const calls = [];
  const rpcArgLog = [];
  const qid = uuid(9001);
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
          environment: "staging",
        },
      };
    },
    qaQuarantinePrepare: async (args) => {
      calls.push("qa_quarantine_prepare");
      state.authority = {
        id: qid,
        quarantine_id: qid,
        profile_id: args.profileId,
        auth_user_id: args.authUserId,
        batch_id: args.batchId,
        lifecycle_state: "pending",
        auth_ban_state: "pending",
        lifecycle_version: 1,
        original_auth_banned: args.originalAuthBanned === true,
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
      rpcArgLog.push({
        name: "qa_quarantine_activate_after_auth_ban",
        args: {
          p_quarantine_id: args.quarantineId,
          p_expected_lifecycle_version: args.expectedLifecycleVersion,
          p_auth_ban_readback_confirmed: args.authBanReadbackConfirmed === true,
        },
      });
      state.authority = {
        ...state.authority,
        lifecycle_state: "active",
        auth_ban_state: "applied",
        lifecycle_version: (state.authority?.lifecycle_version || 1) + 1,
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
    qaQuarantineActivatePreexistingBan: async () => ({
      ok: true,
      data: { ok: true },
    }),
    qaQuarantineRecordCompensatedFailure: async (args) => {
      calls.push("qa_quarantine_record_compensated_failure");
      rpcArgLog.push({
        name: "qa_quarantine_record_compensated_failure",
        args: {
          p_quarantine_id: args.quarantineId,
          p_expected_lifecycle_version: args.expectedLifecycleVersion,
          p_target_auth_ban_state: args.targetAuthBanState,
          p_failure_classification: args.failureClassification,
        },
      });
      state.authority = {
        ...state.authority,
        lifecycle_state: "failed",
        auth_ban_state: args.targetAuthBanState || "reverted",
        lifecycle_version: (state.authority?.lifecycle_version || 1) + 1,
      };
      return { ok: true, data: { ok: true, ...state.authority } };
    },
    qaQuarantineRelease: async () => ({ ok: true, data: { ok: true } }),
    qaQuarantineGetState: async () => ({
      ok: true,
      data: { ok: true, ...(state.authority || {}) },
    }),
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
  };
  adapters._calls = calls;
  adapters._rpcArgLog = rpcArgLog;
  return adapters;
}

function makeBind(files, overrides = {}) {
  return {
    operationId: OPERATION_ID,
    operationTargetMode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
    batchId: STAGING_BATCH,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
    exactEightUuidSetHash: files.exactEight,
    executionVersion: EXEC_VERSION,
    ownerStagingGo: STAGING_GO,
    ownerProductionGo: "",
    stagingProjectRef: EXPECTED_STAGING_PROJECT_REF,
    productionProjectRef: "",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Structural / harness tests (no DB)
// ---------------------------------------------------------------------------

test("A) Staging hard-bind PASS", () => {
  const built = buildStagingLiveExecuteInput({
    OPERATION_TARGET_MODE: "staging_rehearsal",
    STAGING_PROJECT_REF: EXPECTED_STAGING_PROJECT_REF,
    DRY_RUN: "false",
    OWNER_STAGING_GO: STAGING_GO,
    OPERATION_B1B_BATCH_ID: STAGING_BATCH,
    ALLOWLIST_SHA256: "a".repeat(64),
    SNAPSHOT_SHA256: "b".repeat(64),
    ALLOWLIST_PATH: "C:\\outside\\allowlist.json",
    RECOVERY_SNAPSHOT_PATH: "C:\\outside\\snapshot.json",
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
  });
  assert.equal(built.ok, true, built.reasons?.join(","));
  assert.equal(
    built.input.OPERATION_TARGET_MODE,
    OPERATION_TARGET_MODE.STAGING_REHEARSAL
  );
  assert.equal(built.input.STAGING_PROJECT_REF, EXPECTED_STAGING_PROJECT_REF);
});

test("B) Production ref rejected by staging harness", () => {
  const built = buildStagingLiveExecuteInput({
    OPERATION_TARGET_MODE: "staging_rehearsal",
    STAGING_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    DRY_RUN: "false",
    OWNER_STAGING_GO: STAGING_GO,
    OPERATION_B1B_BATCH_ID: STAGING_BATCH,
    ALLOWLIST_SHA256: "a".repeat(64),
    SNAPSHOT_SHA256: "b".repeat(64),
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
  });
  assert.equal(built.ok, false);
  assert.ok(
    built.reasons.includes("production_project_ref_rejected_in_staging_mode")
  );
});

test("C) Production execute confirmation rejected", () => {
  const built = buildStagingLiveExecuteInput({
    OPERATION_TARGET_MODE: "staging_rehearsal",
    STAGING_PROJECT_REF: EXPECTED_STAGING_PROJECT_REF,
    DRY_RUN: "false",
    OWNER_STAGING_GO: STAGING_GO,
    OPERATION_B1B_BATCH_ID: STAGING_BATCH,
    ALLOWLIST_SHA256: "a".repeat(64),
    SNAPSHOT_SHA256: "b".repeat(64),
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  });
  assert.equal(built.ok, false);
  assert.ok(
    built.reasons.includes(
      "production_execute_confirmation_rejected_in_staging_mode"
    )
  );
});

test("D) Missing live credentials fail closed", () => {
  const creds = resolveStagingLiveCredentials({
    OPERATION_B1B_STAGING_SUPABASE_URL: "",
    OPERATION_B1B_STAGING_SERVICE_ROLE_KEY: "",
    SUPABASE_URL: `https://${EXPECTED_PRODUCTION_PROJECT_REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: "prod-secret-should-not-fallback",
  });
  assert.equal(creds.ok, false);
  assert.ok(creds.reasons.includes("missing_staging_supabase_url"));
  assert.ok(creds.reasons.includes("missing_staging_service_role_key"));
});

test("D2) Production URL rejected even if labeled staging", () => {
  const creds = resolveStagingLiveCredentials({
    OPERATION_B1B_STAGING_SUPABASE_URL: `https://${EXPECTED_PRODUCTION_PROJECT_REF}.supabase.co`,
    OPERATION_B1B_STAGING_SERVICE_ROLE_KEY: "x".repeat(40),
  });
  assert.equal(creds.ok, false);
  assert.ok(
    creds.reasons.includes("production_project_ref_rejected_in_staging_mode")
  );
});

test("E) dry-run cannot consume durable authority (harness + execute)", async () => {
  resetAuthorityConsumptionForTests();
  const files = writeAllowlistAndSnapshot(makeStagingEight(), STAGING_BATCH);
  const binding = makeStagingBinding(files);
  let claimCalls = 0;
  const claimer = async () => {
    claimCalls += 1;
    return { ok: true };
  };
  const report = await runB1BExecute(
    stagingLiveInput(files, binding, { DRY_RUN: "true" }),
    {
      repoRoots: [root],
      adapters: baseAdapters(makeStagingEight()[0], {
        banned: false,
        profileStatus: "active",
      }),
      claimOneTimeLiveAuthority: claimer,
    }
  );
  assert.equal(report.dryRun, true);
  assert.equal(report.durableAuthorityClaimed, false);
  assert.equal(report.authorityConsumed, false);
  assert.equal(claimCalls, 0);

  const harness = buildStagingLiveExecuteInput(
    stagingLiveInput(files, binding, { DRY_RUN: "true" })
  );
  assert.equal(harness.ok, false);
  assert.ok(harness.reasons.includes("staging_live_harness_requires_dry_run_false"));
});

test("F) exact live package reaches claim barrier via staging wiring", async () => {
  resetAuthorityConsumptionForTests();
  const files = writeAllowlistAndSnapshot(makeStagingEight(), STAGING_BATCH);
  const binding = makeStagingBinding(files);
  let claimBind = null;
  const claimer = async (bind) => {
    claimBind = bind;
    return { ok: true };
  };
  const row = makeStagingEight()[0];
  const report = await runB1BExecute(stagingLiveInput(files, binding), {
    repoRoots: [root],
    adapters: baseAdapters(row, { banned: false, profileStatus: "active" }),
    claimOneTimeLiveAuthority: claimer,
    executionVersion: EXEC_VERSION,
  });
  assert.equal(report.durableAuthorityClaimed, true);
  assert.equal(report.authorityConsumed, true);
  assert.ok(claimBind);
  assert.equal(claimBind.operationTargetMode, "staging_rehearsal");
  assert.equal(claimBind.stagingProjectRef, EXPECTED_STAGING_PROJECT_REF);
  assert.equal(claimBind.exactEightUuidSetHash, files.exactEight);
  assert.equal(claimBind.executionVersion, EXEC_VERSION);
  assert.equal(claimBind.allowlistSha256, files.alSha);
  assert.equal(claimBind.snapshotSha256, files.snSha);
});

test("F2) invalid package does NOT consume durable authority", async () => {
  resetAuthorityConsumptionForTests();
  const files = writeAllowlistAndSnapshot(makeStagingEight(), STAGING_BATCH);
  const binding = makeStagingBinding(files);
  let claimCalls = 0;
  const report = await runB1BExecute(
    stagingLiveInput(files, binding, {
      ALLOWLIST_SHA256: "c".repeat(64),
    }),
    {
      repoRoots: [root],
      adapters: baseAdapters(makeStagingEight()[0], {
        banned: false,
        profileStatus: "active",
      }),
      claimOneTimeLiveAuthority: async () => {
        claimCalls += 1;
        return { ok: true };
      },
    }
  );
  assert.equal(report.ok, false);
  assert.equal(claimCalls, 0);
  assert.equal(report.authorityConsumed, false);
  assert.equal(report.durableAuthorityClaimed, false);
});

test("ENV_FALLBACK_PRESENT=false — no Production env fallback", () => {
  const creds = resolveStagingLiveCredentials({
    SUPABASE_URL: `https://${EXPECTED_STAGING_PROJECT_REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: "should-not-be-used",
  });
  assert.equal(creds.ok, false);
  assert.ok(creds.reasons.includes("missing_staging_supabase_url"));
});

test("SQL artifacts encode rollback evidence-preservation + TOCTOU lock contract", () => {
  const forward = readWp6ClaimSql(WP6_CLAIM_FORWARD);
  const rollback = readWp6ClaimSql(WP6_CLAIM_ROLLBACK);
  assert.ok(forward.includes("operation_b1b_one_time_authority_claims"));
  assert.ok(forward.includes("operation_b1b_claim_one_time_live_authority"));
  assert.ok(forward.includes("REJECTED_ALREADY_CLAIMED"));
  assert.ok(forward.includes("owner_go_fingerprint"));
  assert.ok(!/OWNER_STAGING_GO|service_role_key|eyJ/.test(forward));
  assert.ok(
    rollback.includes(
      "OPERATION_B1B_AUTHORITY_CLAIM_ROLLBACK_REFUSED_NONEMPTY_STORE"
    )
  );
  assert.match(rollback, /\bBEGIN\s*;/);
  assert.match(rollback, /\bCOMMIT\s*;/);
  assert.ok(
    rollback.includes(
      "LOCK TABLE public.operation_b1b_one_time_authority_claims IN ACCESS EXCLUSIVE MODE"
    )
  );
  const beginIdx = rollback.search(/\bBEGIN\s*;/);
  const lockIdx = rollback.indexOf(
    "LOCK TABLE public.operation_b1b_one_time_authority_claims IN ACCESS EXCLUSIVE MODE"
  );
  const guardIdx = rollback.indexOf(
    "OPERATION_B1B_AUTHORITY_CLAIM_ROLLBACK_REFUSED_NONEMPTY_STORE"
  );
  const dropTableIdx = rollback.indexOf(
    "DROP TABLE IF EXISTS public.operation_b1b_one_time_authority_claims"
  );
  const dropFnIdx = rollback.indexOf(
    "DROP FUNCTION IF EXISTS public.operation_b1b_claim_one_time_live_authority"
  );
  const commitIdx = rollback.search(/\bCOMMIT\s*;/);
  assert.ok(beginIdx >= 0 && lockIdx > beginIdx, "BEGIN before LOCK");
  assert.ok(guardIdx > lockIdx, "LOCK must precede nonempty guard");
  assert.ok(dropTableIdx > guardIdx, "guard must precede DROP TABLE");
  assert.ok(dropFnIdx > guardIdx, "guard must precede DROP FUNCTION");
  assert.ok(commitIdx > dropTableIdx, "COMMIT after teardown");
  // Lock and guard must be separate top-level DO blocks (fresh statement snapshot).
  const lockDoIdx = rollback.indexOf("DO $lock$");
  const guardDoIdx = rollback.indexOf("DO $guard$");
  assert.ok(lockDoIdx >= 0 && guardDoIdx > lockDoIdx, "separate lock/guard DO blocks");
  assert.ok(
    rollback.includes(
      "to_regclass('public.operation_b1b_one_time_authority_claims')"
    )
  );
  assert.ok(!/TRUNCATE|DELETE FROM\s+public\.operation_b1b_one_time_authority_claims/i.test(rollback));
});

test("fingerprintOwnerGo never equals plaintext GO", () => {
  const fp = fingerprintOwnerGo(STAGING_GO);
  assert.equal(fp.length, 64);
  assert.notEqual(fp, STAGING_GO.toLowerCase());
  assert.ok(!fp.includes("approve"));
});

test("validateDurableAuthorityBind rejects production ref in staging", () => {
  const files = writeAllowlistAndSnapshot(makeStagingEight(), STAGING_BATCH);
  const bad = validateDurableAuthorityBind(
    makeBind(files, { stagingProjectRef: EXPECTED_PRODUCTION_PROJECT_REF })
  );
  assert.equal(bad.ok, false);
  assert.ok(
    bad.reasons.includes("production_project_ref_rejected_in_staging_mode")
  );
});

test("N-unit) Boundary-3 compensation preserved through new adapter surface", async () => {
  const files = writeAllowlistAndSnapshot(makeStagingEight(), STAGING_BATCH);
  const binding = makeStagingBinding(files);
  const auth = evaluateAuthorization(stagingLiveInput(files, binding));
  assert.equal(mutationAllowed(auth), true);
  auth.exactEightUuidSetHash = files.exactEight;
  auth.executionVersion = EXEC_VERSION;

  const row = makeStagingEight()[0];
  const state = { banned: false, profileStatus: "active", authority: null };
  const adapters = baseAdapters(row, state);
  adapters.qaQuarantineActivateAfterAuthBan = async () => {
    adapters._calls.push("qa_quarantine_activate_after_auth_ban");
    return { ok: false, reason: "activate_failed" };
  };

  // Prove narrow live adapter factory still freezes approved surface.
  const fakeAdmin = {
    auth: { admin: { getUserById: async () => ({ data: null, error: null }) } },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    rpc: async () => ({ data: { ok: true }, error: null }),
  };
  const live = createOperationB1BLiveAdapters({ admin: fakeAdmin });
  assert.deepEqual(
    Object.keys(live).sort(),
    [...OPERATION_B1B_LIVE_ADAPTER_CAPABILITIES].sort()
  );

  const result = await quarantineOneIdentityB1B({
    allowlistRow: row,
    adapters,
    authResult: auth,
    dryRun: false,
    batchId: STAGING_BATCH,
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
  assert.equal(failArgs.args.p_failure_classification, "activation_failed_compensated");
  assert.equal(failArgs.args.p_target_auth_ban_state, "reverted");
  assert.equal(state.banned, false);
  assert.notEqual(state.authority?.lifecycle_state, "active");
});

// ---------------------------------------------------------------------------
// Real local Postgres durable claim tests
// ---------------------------------------------------------------------------

let pgCtx = null;

test("WP6 durable claim: provision local disposable Postgres", async (t) => {
  const resolved = await resolveWp6LocalDatabase();
  if (!resolved.ok) {
    t.skip(`local postgres unavailable: ${resolved.reason}`);
    return;
  }
  const client = new pg.Client({ connectionString: resolved.databaseUrl });
  await client.connect();
  await bootstrapWp6ClaimDatabase(client);
  pgCtx = { client, cleanup: resolved.cleanup, databaseUrl: resolved.databaseUrl };
});

async function requirePg(t) {
  if (!pgCtx?.client) {
    t.skip("local postgres not provisioned");
    return null;
  }
  return pgCtx.client;
}

async function durablePackageInventory(client) {
  const tables = await client.query(`
    select relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and relname = 'operation_b1b_one_time_authority_claims'
    order by 1
  `);
  const funcs = await client.query(`
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'operation_b1b_authority_claim_is_service_role',
        'operation_b1b_claim_one_time_live_authority',
        'operation_b1b_get_one_time_live_authority_claim'
      )
    order by 1
  `);
  return {
    tables: tables.rows.map((r) => r.relname),
    funcs: funcs.rows.map((r) => r.proname),
  };
}

test("R0) empty-store rollback PASS; absent-store rollback idempotent; reapply 30", async (t) => {
  const client = await requirePg(t);
  if (!client) return;
  await resetSessionGuc(client);

  const beforeCount = Number(
    (
      await client.query(
        `select count(*)::int as c from public.operation_b1b_one_time_authority_claims`
      )
    ).rows[0].c
  );
  assert.equal(beforeCount, 0);

  await applyWp6ClaimRollback(client);
  let inv = await durablePackageInventory(client);
  assert.deepEqual(inv.tables, []);
  assert.deepEqual(inv.funcs, []);

  // Absent store — second rollback remains safe/idempotent.
  await applyWp6ClaimRollback(client);
  inv = await durablePackageInventory(client);
  assert.deepEqual(inv.tables, []);
  assert.deepEqual(inv.funcs, []);

  await applyWp6ClaimForward(client);
  inv = await durablePackageInventory(client);
  assert.ok(inv.tables.includes("operation_b1b_one_time_authority_claims"));
  assert.equal(inv.funcs.length, 3);
});

async function waitForLockWait(observer, waiterPid, { timeoutMs = 8000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { rows } = await observer.query(
      `select count(*)::int as c
         from pg_locks
        where pid = $1::int
          and NOT granted`,
      [waiterPid]
    );
    if (Number(rows[0].c) > 0) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

async function resetDurablePackageEmpty(client) {
  await resetSessionGuc(client);
  await client.query(
    `DROP TABLE IF EXISTS public.operation_b1b_one_time_authority_claims CASCADE`
  );
  await applyWp6ClaimForward(client);
}

test("T1) claim-first concurrency: claim commits → SQL70 refuses → evidence kept", async (t) => {
  const client = await requirePg(t);
  if (!client) return;
  await resetDurablePackageEmpty(client);

  const claimer = new pg.Client({ connectionString: pgCtx.databaseUrl });
  const rollbacker = new pg.Client({ connectionString: pgCtx.databaseUrl });
  const observer = new pg.Client({ connectionString: pgCtx.databaseUrl });
  await claimer.connect();
  await rollbacker.connect();
  await observer.connect();
  await claimer.query("SET lock_timeout = '8s'");
  await rollbacker.query("SET lock_timeout = '8s'");

  const batch = crypto.randomUUID();
  const files = writeAllowlistAndSnapshot(makeStagingEight(), batch);
  try {
    await claimer.query("BEGIN");
    await asServiceRole(claimer);
    const pending = await claimer.query(
      `SELECT public.operation_b1b_claim_one_time_live_authority(
         $1::text, $2::text, $3::text, $4::uuid,
         $5::text, $6::text, $7::text, $8::text, $9::text
       ) AS result`,
      [
        OPERATION_ID,
        OPERATION_TARGET_MODE.STAGING_REHEARSAL,
        EXPECTED_STAGING_PROJECT_REF,
        batch,
        files.alSha,
        files.snSha,
        files.exactEight,
        EXEC_VERSION,
        fingerprintOwnerGo(STAGING_GO),
      ]
    );
    assert.equal(pending.rows[0].result.ok, true);

    const rollbackPid = (
      await rollbacker.query(`select pg_backend_pid() as pid`)
    ).rows[0].pid;
    const rollbackPromise = applyWp6ClaimRollback(rollbacker).then(
      () => ({ ok: true, deadlock: false }),
      (err) => ({
        ok: false,
        err: String(err?.message || err),
        deadlock: /deadlock/i.test(String(err?.message || err)),
      })
    );

    const waiting = await waitForLockWait(observer, rollbackPid);
    assert.equal(waiting, true, "SQL70 must wait on ACCESS EXCLUSIVE behind open claim txn");

    await claimer.query("COMMIT");
    const rb = await rollbackPromise;
    assert.equal(rb.deadlock, false, "DEADLOCK_FOUND must be NO");
    assert.equal(rb.ok, false);
    assert.match(
      rb.err || "",
      /OPERATION_B1B_AUTHORITY_CLAIM_ROLLBACK_REFUSED_NONEMPTY_STORE/
    );

    const { rows } = await observer.query(
      `select count(*)::int as c
         from public.operation_b1b_one_time_authority_claims
        where batch_id = $1::uuid`,
      [batch]
    );
    assert.equal(Number(rows[0].c), 1);
    const readback = await readPgDurableAuthorityClaim(
      observer,
      {
        operationTargetMode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
        projectRef: EXPECTED_STAGING_PROJECT_REF,
        batchId: batch,
      },
      { asServiceRole: async () => asServiceRole(observer) }
    );
    assert.equal(readback.ok, true);
    assert.equal(readback.found, true);
    assert.equal(readback.consumed, true);
  } finally {
    try {
      await claimer.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    await claimer.end().catch(() => {});
    await rollbacker.end().catch(() => {});
    await observer.end().catch(() => {});
  }
});

test("T2) rollback-first concurrency: lock held → claim blocked → empty teardown wins", async (t) => {
  const client = await requirePg(t);
  if (!client) return;
  await resetDurablePackageEmpty(client);

  const locker = new pg.Client({ connectionString: pgCtx.databaseUrl });
  const claimer = new pg.Client({ connectionString: pgCtx.databaseUrl });
  const observer = new pg.Client({ connectionString: pgCtx.databaseUrl });
  await locker.connect();
  await claimer.connect();
  await observer.connect();
  await claimer.query("SET lock_timeout = '8s'");

  const batch = crypto.randomUUID();
  const files = writeAllowlistAndSnapshot(makeStagingEight(), batch);
  try {
    await locker.query("BEGIN");
    await locker.query(
      `LOCK TABLE public.operation_b1b_one_time_authority_claims IN ACCESS EXCLUSIVE MODE`
    );

    const claimPid = (await claimer.query(`select pg_backend_pid() as pid`)).rows[0]
      .pid;
    const claimPromise = (async () => {
      try {
        await asServiceRole(claimer);
        const { rows } = await claimer.query(
          `SELECT public.operation_b1b_claim_one_time_live_authority(
             $1::text, $2::text, $3::text, $4::uuid,
             $5::text, $6::text, $7::text, $8::text, $9::text
           ) AS result`,
          [
            OPERATION_ID,
            OPERATION_TARGET_MODE.STAGING_REHEARSAL,
            EXPECTED_STAGING_PROJECT_REF,
            batch,
            files.alSha,
            files.snSha,
            files.exactEight,
            EXEC_VERSION,
            fingerprintOwnerGo(STAGING_GO),
          ]
        );
        return {
          ok: rows[0]?.result?.ok === true,
          result: rows[0]?.result,
          err: null,
          deadlock: false,
        };
      } catch (err) {
        const msg = String(err?.message || err);
        return {
          ok: false,
          result: null,
          err: msg,
          deadlock: /deadlock/i.test(msg),
        };
      }
    })();

    const waiting = await waitForLockWait(observer, claimPid);
    assert.equal(waiting, true, "claim INSERT must wait behind ACCESS EXCLUSIVE");

    // Empty-store teardown under the same lock (SQL70 equivalent after lock+guard).
    const cnt = await locker.query(
      `select count(*)::bigint as c from public.operation_b1b_one_time_authority_claims`
    );
    assert.equal(Number(cnt.rows[0].c), 0);
    await locker.query(`
      DROP FUNCTION IF EXISTS public.operation_b1b_get_one_time_live_authority_claim(text, text, text, uuid);
      DROP FUNCTION IF EXISTS public.operation_b1b_claim_one_time_live_authority(text, text, text, uuid, text, text, text, text, text);
      DROP FUNCTION IF EXISTS public.operation_b1b_authority_claim_is_service_role();
      DROP TABLE IF EXISTS public.operation_b1b_one_time_authority_claims;
    `);
    await locker.query("COMMIT");

    const claimRes = await claimPromise;
    assert.equal(claimRes.deadlock, false, "DEADLOCK_FOUND must be NO");
    assert.equal(claimRes.ok, false, "claim must not commit while teardown owned the lock");
    assert.ok(
      claimRes.err &&
        (/does not exist|could not open relation|lock timeout|canceling statement|OID/i.test(
          claimRes.err
        ) ||
          claimRes.result?.ok === false),
      claimRes.err || JSON.stringify(claimRes.result)
    );

    const inv = await durablePackageInventory(observer);
    assert.deepEqual(inv.tables, []);
    // Must not observe a committed claim row after teardown.
    assert.equal(inv.tables.includes("operation_b1b_one_time_authority_claims"), false);
  } finally {
    try {
      await locker.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    await locker.end().catch(() => {});
    await claimer.end().catch(() => {});
    await observer.end().catch(() => {});
  }
  await resetDurablePackageEmpty(client);
});

test("T3) hammer claim vs canonical SQL70: never erase committed claim", async (t) => {
  const client = await requirePg(t);
  if (!client) return;
  const ITERATIONS = 24;
  let lost = 0;
  let deadlock = false;
  const outcomes = { claimWins: 0, rollbackWins: 0 };

  for (let i = 0; i < ITERATIONS; i += 1) {
    await resetDurablePackageEmpty(client);
    const c1 = new pg.Client({ connectionString: pgCtx.databaseUrl });
    const c2 = new pg.Client({ connectionString: pgCtx.databaseUrl });
    await c1.connect();
    await c2.connect();
    await c1.query("SET lock_timeout = '8s'");
    await c2.query("SET lock_timeout = '8s'");
    const batch = crypto.randomUUID();
    const files = writeAllowlistAndSnapshot(makeStagingEight(), batch);
    try {
      const claimPromise = (async () => {
        try {
          await asServiceRole(c1);
          const { rows } = await c1.query(
            `SELECT public.operation_b1b_claim_one_time_live_authority(
               $1::text, $2::text, $3::text, $4::uuid,
               $5::text, $6::text, $7::text, $8::text, $9::text
             ) AS result`,
            [
              OPERATION_ID,
              OPERATION_TARGET_MODE.STAGING_REHEARSAL,
              EXPECTED_STAGING_PROJECT_REF,
              batch,
              files.alSha,
              files.snSha,
              files.exactEight,
              EXEC_VERSION,
              fingerprintOwnerGo(STAGING_GO),
            ]
          );
          return { ok: rows[0]?.result?.ok === true, err: null, deadlock: false };
        } catch (err) {
          const msg = String(err?.message || err);
          return { ok: false, err: msg, deadlock: /deadlock/i.test(msg) };
        }
      })();
      const rollbackPromise = applyWp6ClaimRollback(c2).then(
        () => ({ ok: true, err: null, deadlock: false }),
        (err) => {
          const msg = String(err?.message || err);
          return { ok: false, err: msg, deadlock: /deadlock/i.test(msg) };
        }
      );
      const [claimRes, rbRes] = await Promise.all([claimPromise, rollbackPromise]);
      deadlock = deadlock || claimRes.deadlock || rbRes.deadlock;

      const inv = await durablePackageInventory(client);
      let rowCount = 0;
      if (inv.tables.includes("operation_b1b_one_time_authority_claims")) {
        rowCount = Number(
          (
            await client.query(
              `select count(*)::int as c
                 from public.operation_b1b_one_time_authority_claims
                where batch_id = $1::uuid`,
              [batch]
            )
          ).rows[0].c
        );
      }

      if (claimRes.ok === true) {
        outcomes.claimWins += 1;
        // Committed claim must remain; rollback must have refused or not removed it.
        if (rowCount !== 1) {
          lost += 1;
          break;
        }
        assert.match(
          rbRes.err || "",
          /OPERATION_B1B_AUTHORITY_CLAIM_ROLLBACK_REFUSED_NONEMPTY_STORE/
        );
      } else {
        outcomes.rollbackWins += 1;
        // Rollback-empty win: package gone and no committed claim row.
        assert.equal(claimRes.ok, false);
        assert.equal(rowCount, 0);
      }
    } finally {
      await c1.end().catch(() => {});
      await c2.end().catch(() => {});
    }
  }

  assert.equal(deadlock, false, "DEADLOCK_FOUND must be NO");
  assert.equal(lost, 0, `COMMITTED_CLAIM_EVIDENCE_LOST must be 0 (lost=${lost})`);
  assert.ok(
    outcomes.claimWins + outcomes.rollbackWins === ITERATIONS,
    JSON.stringify(outcomes)
  );
  await resetDurablePackageEmpty(client);
});

test("G) first durable claim succeeds", async (t) => {
  const client = await requirePg(t);
  if (!client) return;
  const files = writeAllowlistAndSnapshot(makeStagingEight(), STAGING_BATCH);
  await asServiceRole(client);
  const claimer = createPgOperationB1BDurableAuthorityClaimer({
    client,
    asServiceRole: async () => asServiceRole(client),
  });
  const first = await claimer(makeBind(files));
  assert.equal(first.ok, true, first.reason);
  assert.equal(first.consumed, true);
  assert.equal(first.reason, "CLAIMED");

  const readback = await readPgDurableAuthorityClaim(
    client,
    {
      operationTargetMode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
      projectRef: EXPECTED_STAGING_PROJECT_REF,
      batchId: STAGING_BATCH,
    },
    { asServiceRole: async () => asServiceRole(client) }
  );
  assert.equal(readback.ok, true);
  assert.equal(readback.found, true);
  assert.equal(readback.status, "consumed");
  assert.equal(readback.owner_go_fingerprint, fingerprintOwnerGo(STAGING_GO));
  assert.equal(readback.allowlist_sha256, files.alSha);
  const secretScan = assertNoSecretsInClaimEvidence(readback);
  assert.equal(secretScan.ok, true, secretScan.reason);
});

test("H) second identical claim fails REJECTED_ALREADY_CLAIMED", async (t) => {
  const client = await requirePg(t);
  if (!client) return;
  const files = writeAllowlistAndSnapshot(makeStagingEight(), STAGING_BATCH);
  const claimer = createPgOperationB1BDurableAuthorityClaimer({
    client,
    asServiceRole: async () => asServiceRole(client),
  });
  const second = await claimer(makeBind(files));
  assert.equal(second.ok, false);
  assert.equal(second.consumed, true);
  assert.equal(second.reason, "authority_already_consumed");
});

test("I) concurrent duplicate claims → exactly one winner", async (t) => {
  const client = await requirePg(t);
  if (!client) return;
  const files = writeAllowlistAndSnapshot(makeStagingEight(), STAGING_BATCH_2);
  const clients = [];
  try {
    for (let i = 0; i < 8; i += 1) {
      const c = new pg.Client({ connectionString: pgCtx.databaseUrl });
      await c.connect();
      clients.push(c);
    }
    const results = await Promise.all(
      clients.map((c) =>
        createPgOperationB1BDurableAuthorityClaimer({
          client: c,
          asServiceRole: async () => asServiceRole(c),
        })(makeBind(files, { batchId: STAGING_BATCH_2 }))
      )
    );
    const winners = results.filter((r) => r.ok === true);
    const losers = results.filter((r) => r.ok === false);
    assert.equal(winners.length, 1, JSON.stringify(results));
    assert.equal(losers.length, 7);
    assert.ok(losers.every((r) => r.reason === "authority_already_consumed"));
  } finally {
    for (const c of clients) {
      await c.end().catch(() => {});
    }
  }
});

test("J) changed allowlist SHA cannot reuse already consumed batch", async (t) => {
  const client = await requirePg(t);
  if (!client) return;
  const files = writeAllowlistAndSnapshot(makeStagingEight(), STAGING_BATCH);
  const claimer = createPgOperationB1BDurableAuthorityClaimer({
    client,
    asServiceRole: async () => asServiceRole(client),
  });
  const changed = await claimer(
    makeBind(files, { allowlistSha256: "d".repeat(64) })
  );
  assert.equal(changed.ok, false);
  assert.equal(changed.consumed, true);
  assert.equal(changed.reason, "authority_already_consumed");
});

test("K) changed snapshot SHA cannot reuse already consumed batch", async (t) => {
  const client = await requirePg(t);
  if (!client) return;
  const files = writeAllowlistAndSnapshot(makeStagingEight(), STAGING_BATCH);
  const claimer = createPgOperationB1BDurableAuthorityClaimer({
    client,
    asServiceRole: async () => asServiceRole(client),
  });
  const changed = await claimer(
    makeBind(files, { snapshotSha256: "e".repeat(64) })
  );
  assert.equal(changed.ok, false);
  assert.equal(changed.consumed, true);
  assert.equal(changed.reason, "authority_already_consumed");
});

test("K2) changed UUID-set hash cannot reuse already consumed batch", async (t) => {
  const client = await requirePg(t);
  if (!client) return;
  const files = writeAllowlistAndSnapshot(makeStagingEight(), STAGING_BATCH);
  const claimer = createPgOperationB1BDurableAuthorityClaimer({
    client,
    asServiceRole: async () => asServiceRole(client),
  });
  const changed = await claimer(
    makeBind(files, { exactEightUuidSetHash: "f".repeat(64) })
  );
  assert.equal(changed.ok, false);
  assert.equal(changed.consumed, true);
  assert.equal(changed.reason, "authority_already_consumed");
});

test("L) batch burned after claim even if later execution fails", async (t) => {
  const client = await requirePg(t);
  if (!client) return;
  resetAuthorityConsumptionForTests();
  const batch = "c13c323a-4fec-4327-90ba-56128fb126f7";
  const files = writeAllowlistAndSnapshot(makeStagingEight(), batch);
  const binding = makeStagingBinding(files, { expectedBatchId: batch });
  const claimer = createPgOperationB1BDurableAuthorityClaimer({
    client,
    asServiceRole: async () => asServiceRole(client),
  });
  const row = makeStagingEight()[0];
  const state = { banned: false, profileStatus: "active", authority: null };
  const adapters = baseAdapters(row, state);
  adapters.qaQuarantineActivateAfterAuthBan = async () => ({
    ok: false,
    reason: "activate_failed",
  });

  const report = await runB1BExecute(
    stagingLiveInput(files, binding, { OPERATION_B1B_BATCH_ID: batch }),
    {
      repoRoots: [root],
      adapters,
      claimOneTimeLiveAuthority: claimer,
      executionVersion: EXEC_VERSION,
    }
  );
  assert.equal(report.durableAuthorityClaimed, true);
  assert.equal(report.authorityConsumed, true);
  assert.equal(report.ok, false);

  const reuse = await claimer(
    makeBind(files, { batchId: batch })
  );
  assert.equal(reuse.ok, false);
  assert.equal(reuse.reason, "authority_already_consumed");
});

test("M) no raw Owner GO/secret persisted in claim ledger", async (t) => {
  const client = await requirePg(t);
  if (!client) return;
  await resetSessionGuc(client);
  const { rows } = await client.query(
    `SELECT * FROM public.operation_b1b_one_time_authority_claims`
  );
  for (const row of rows) {
    const scan = assertNoSecretsInClaimEvidence(row);
    assert.equal(scan.ok, true, scan.reason);
    assert.equal(row.owner_go_fingerprint.length, 64);
    assert.notEqual(row.owner_go_fingerprint, STAGING_GO);
    assert.ok(!JSON.stringify(row).includes(STAGING_GO));
  }
});

test("R1) nonempty-store rollback FAIL CLOSED; claim evidence preserved", async (t) => {
  const client = await requirePg(t);
  if (!client) return;
  await resetSessionGuc(client);

  const beforeInv = await durablePackageInventory(client);
  assert.ok(
    beforeInv.tables.includes("operation_b1b_one_time_authority_claims")
  );
  assert.equal(beforeInv.funcs.length, 3);

  const beforeRows = await client.query(
    `SELECT id, batch_id, status, owner_go_fingerprint, allowlist_sha256,
            snapshot_sha256, exact_eight_uuid_set_hash, claimed_at
       FROM public.operation_b1b_one_time_authority_claims
      ORDER BY claimed_at, id`
  );
  assert.ok(beforeRows.rows.length >= 1);

  let refused = false;
  let refuseMessage = "";
  try {
    await applyWp6ClaimRollback(client);
  } catch (err) {
    refused = true;
    refuseMessage = String(err?.message || err);
  }
  assert.equal(refused, true, "canonical 70 must refuse nonempty store");
  assert.match(
    refuseMessage,
    /OPERATION_B1B_AUTHORITY_CLAIM_ROLLBACK_REFUSED_NONEMPTY_STORE/
  );

  const afterInv = await durablePackageInventory(client);
  assert.deepEqual(afterInv.tables, beforeInv.tables);
  assert.deepEqual(afterInv.funcs, beforeInv.funcs);

  const afterRows = await client.query(
    `SELECT id, batch_id, status, owner_go_fingerprint, allowlist_sha256,
            snapshot_sha256, exact_eight_uuid_set_hash, claimed_at
       FROM public.operation_b1b_one_time_authority_claims
      ORDER BY claimed_at, id`
  );
  assert.deepEqual(afterRows.rows, beforeRows.rows);

  const readback = await readPgDurableAuthorityClaim(
    client,
    {
      operationTargetMode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
      projectRef: EXPECTED_STAGING_PROJECT_REF,
      batchId: STAGING_BATCH,
    },
    { asServiceRole: async () => asServiceRole(client) }
  );
  assert.equal(readback.ok, true);
  assert.equal(readback.found, true);
  assert.equal(readback.consumed, true);
  assert.equal(readback.status, "consumed");
  assert.equal(readback.batch_id, STAGING_BATCH);
});

test("N) Boundary-3 through harness dependency wiring + durable claim", async (t) => {
  const client = await requirePg(t);
  if (!client) return;
  resetAuthorityConsumptionForTests();
  const batch = "c13c323a-4fec-4327-90ba-56128fb126f8";
  const files = writeAllowlistAndSnapshot(makeStagingEight(), batch);
  const binding = makeStagingBinding(files, { expectedBatchId: batch });
  const claimer = createPgOperationB1BDurableAuthorityClaimer({
    client,
    asServiceRole: async () => asServiceRole(client),
  });
  const row = makeStagingEight()[0];
  const state = { banned: false, profileStatus: "active", authority: null };
  const adapters = baseAdapters(row, state);
  adapters.qaQuarantineActivateAfterAuthBan = async () => {
    adapters._calls.push("qa_quarantine_activate_after_auth_ban");
    return { ok: false, reason: "activate_failed" };
  };

  // Simulate staging harness wiring (adapters + durable claimer injected).
  const wired = await createStagingLiveExecutionDeps({
    credentials: {
      ok: true,
      url: `https://${EXPECTED_STAGING_PROJECT_REF}.supabase.co`,
      secretKey: "test-staging-service-role-key-not-real",
      projectRef: EXPECTED_STAGING_PROJECT_REF,
    },
    createClientImpl: () => ({
      auth: { admin: {} },
      from: () => ({}),
      rpc: async () => ({ data: null, error: null }),
    }),
    adaptersOverride: adapters,
    claimOneTimeLiveAuthorityOverride: claimer,
    repoRoots: [root],
    executionVersion: EXEC_VERSION,
  });
  assert.equal(wired.ok, true);

  const report = await runB1BExecute(
    stagingLiveInput(files, binding, { OPERATION_B1B_BATCH_ID: batch }),
    wired.deps
  );
  assert.equal(report.durableAuthorityClaimed, true);
  assert.equal(report.authorityConsumed, true);
  // Batch of 8 with single-row adapters → overall execute may fail eligibility,
  // but Boundary-3 path for the matched identity is exercised via quarantineOneIdentity
  // when adapters are hit. Force single-identity path:
  resetAuthorityConsumptionForTests();
  const auth = evaluateAuthorization(
    stagingLiveInput(files, binding, { OPERATION_B1B_BATCH_ID: batch })
  );
  auth.exactEightUuidSetHash = files.exactEight;
  const presented = await presentLiveAuthority(auth, async () => ({
    ok: true,
  }));
  assert.equal(presented.ok, true);

  const b3 = await quarantineOneIdentityB1B({
    allowlistRow: row,
    adapters,
    authResult: auth,
    dryRun: false,
    batchId: batch,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
  });
  assert.equal(b3.ok, false);
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
});

test("anon/authenticated cannot execute claim RPC", async (t) => {
  const client = await requirePg(t);
  if (!client) return;
  for (const role of ["anon", "authenticated"]) {
    await asRole(client, { role });
    let denied = false;
    try {
      await client.query(
        `SELECT public.operation_b1b_claim_one_time_live_authority(
           $1::text, $2::text, $3::text, $4::uuid,
           $5::text, $6::text, $7::text, $8::text, $9::text
         ) AS result`,
        [
          OPERATION_ID,
          OPERATION_TARGET_MODE.STAGING_REHEARSAL,
          EXPECTED_STAGING_PROJECT_REF,
          crypto.randomUUID(),
          "a".repeat(64),
          "b".repeat(64),
          "c".repeat(64),
          EXEC_VERSION,
          fingerprintOwnerGo(STAGING_GO),
        ]
      );
    } catch (err) {
      denied = true;
      assert.match(String(err.message || err), /permission denied|must be owner/i);
    }
    assert.equal(denied, true, `expected execute deny for ${role}`);
  }
  await resetSessionGuc(client);
});

test("cleanup local disposable Postgres", async () => {
  if (pgCtx?.client) {
    await pgCtx.client.end().catch(() => {});
  }
  if (pgCtx?.cleanup) {
    await pgCtx.cleanup();
  }
  pgCtx = null;
});
