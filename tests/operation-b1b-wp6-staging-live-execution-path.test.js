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
} from "../scripts/operations/production-qa-identity-operation-b1b/stagingLiveExecute.mjs";import {
  WP6_CLAIM_FORWARD,
  WP6_CLAIM_ROLLBACK,
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

test("SQL artifacts exist (forward + rollback) without Staging apply", () => {
  const forward = readWp6ClaimSql(WP6_CLAIM_FORWARD);
  const rollback = readWp6ClaimSql(WP6_CLAIM_ROLLBACK);
  assert.ok(forward.includes("operation_b1b_one_time_authority_claims"));
  assert.ok(forward.includes("operation_b1b_claim_one_time_live_authority"));
  assert.ok(forward.includes("REJECTED_ALREADY_CLAIMED"));
  assert.ok(forward.includes("owner_go_fingerprint"));
  assert.ok(!/OWNER_STAGING_GO|service_role_key|eyJ/.test(forward));
  assert.ok(rollback.includes("DROP TABLE IF EXISTS public.operation_b1b_one_time_authority_claims"));
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
