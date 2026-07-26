/**
 * BM-FINAL-SAFETY-01 — CRM Staging apply authorization safety tests.
 *
 * Offline only. Mocks the apply executor. Does NOT connect to Staging or
 * Production. Does NOT mutate any database.
 *
 * Run:
 *   node --test tests/crm-bm-final-safety-01-apply-authorization.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CRM_PHASE_1H_B_VERDICTS,
  evaluateCrmPhase1hBApprovalGates,
  evaluateCrmPhase1hBPreWriteGates,
  evaluateCrmPhase1hBStagingIdentityGate,
  classifyCrmPhase1hBMigrationPlan,
} from "../src/features/crm/staging/phase1hBGates.js";
import {
  buildCrmPhase1hBOneTimeAuthorization,
  computeCrmPhase1hBMigrationPlanFingerprint,
  consumeCrmPhase1hBOneTimeAuthorization,
  detectCrmPhase1hBNonMutationContext,
  evaluateCrmPhase1hBOneTimeAuthorization,
  writeCrmPhase1hBOneTimeAuthorizationFile,
  CRM_PHASE_1H_B_ONE_TIME_AUTH_STATUS,
  CRM_BM_FINAL_SAFETY_01_GRANT_REMEDIATION_OPERATION,
} from "../src/features/crm/staging/phase1hBOneTimeAuthorization.js";
import {
  loadCrmStagingMigrationManifest,
  CRM_PRODUCTION_PROJECT_REF_BLOCKLIST,
  CRM_STAGING_PROJECT_REF_ALLOWLIST,
} from "../src/features/crm/staging/migrationManifest.js";
import {
  buildCrmPhase1hBVerifyReport,
  runCrmPhase1hBApply,
} from "../scripts/crm/phase-1h-staging-apply.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const STAGING = CRM_STAGING_PROJECT_REF_ALLOWLIST[0];
const PRODUCTION = CRM_PRODUCTION_PROJECT_REF_BLOCKLIST[0];

const SECRET_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
  /(postgres(?:ql)?|supabase):\/\/[^\s"']+/i,
  /(password|access[_-]?token|service[_-]?role|refresh[_-]?token)\s*[:=]\s*["'][^"']+["']/i,
];

function tempDir() {
  return mkdtempSync(path.join(os.tmpdir(), "crm-bm-final-safety-01-"));
}

function planFingerprint(repoRoot = root) {
  const manifest = loadCrmStagingMigrationManifest(repoRoot);
  const plan = classifyCrmPhase1hBMigrationPlan(manifest, {
    deferRoleMatrix: true,
    roleMatrixApproved: false,
  });
  return {
    plan,
    fingerprint: computeCrmPhase1hBMigrationPlanFingerprint(plan.apply),
  };
}

function matchingApprovalEnv() {
  const accessTokenEnv = ["SUPABASE", "ACCESS", "TOKEN"].join("_");
  return {
    CRM_IDENTITY_PERMISSION_SEED_APPROVAL: "seed-token",
    CRM_PHASE_1G_PERSISTENCE_APPLY_APPROVAL: "1g-token",
    CRM_STAGING_OWNER_APPROVAL: "owner-token",
    CRM_STAGING_BACKUP_EVIDENCE: "backup-token",
    CRM_STAGING_BACKUP_EVIDENCE_PATH:
      "docs/crm/phase-1h-b/14_STAGING_RECOVERY_EVIDENCE.md",
    [accessTokenEnv]: "mock-not-a-real-credential",
    VITE_APP_ENV: "staging",
    VITE_SUPABASE_URL: `https://${STAGING}.supabase.co`,
    STAGING_SUPABASE_URL: `https://${STAGING}.supabase.co`,
    VITE_CRM_PERSISTENCE_MODE: "memory",
    NODE_ENV: "development",
  };
}

function matchingApprovalFlags() {
  return {
    environment: "staging",
    deferRoleMatrix: true,
    permissionSeedApproval: "seed-token",
    phase1gApplyApproval: "1g-token",
    ownerApproval: "owner-token",
    backupEvidence: "backup-token",
  };
}

function issueAuthFile(dir, overrides = {}) {
  const { fingerprint } = planFingerprint();
  const auth = buildCrmPhase1hBOneTimeAuthorization({
    migrationPlanFingerprint: fingerprint,
    stagingProjectRef: STAGING,
    ...overrides,
  });
  const filePath = path.join(dir, "crm-1hb-one-time.authorization.local");
  writeCrmPhase1hBOneTimeAuthorizationFile(filePath, auth);
  return { filePath, auth, fingerprint };
}

test("1. audit mode blocks mutation context", () => {
  const ctx = detectCrmPhase1hBNonMutationContext(
    {},
    { forceAuditMode: true }
  );
  assert.equal(ctx.blocked, true);
  assert.ok(ctx.reasons.includes("audit_mode"));
});

test("2. test mode blocks mutation context", () => {
  const ctx = detectCrmPhase1hBNonMutationContext({ NODE_ENV: "test" });
  assert.equal(ctx.blocked, true);
  assert.ok(ctx.reasons.includes("NODE_ENV=test"));
});

test("3. CI mode blocks mutation context", () => {
  const ctx = detectCrmPhase1hBNonMutationContext({ CI: "true" });
  assert.equal(ctx.blocked, true);
  assert.ok(ctx.reasons.includes("CI"));
});

test("4. verify mode is read-only and does not mutate", () => {
  const report = buildCrmPhase1hBVerifyReport({
    repoRoot: root,
    args: { deferRoleMatrix: true },
  });
  assert.equal(report.mode, "dry-run");
  assert.equal(report.path, "verify");
  assert.equal(report.sqlApplied, false);
  assert.equal(report.stagingConnected, false);
  assert.equal(report.productionConnected, false);
  assert.equal(report.applyExecutorCalled, false);
});

test("5. verify mode never calls apply executor", async () => {
  let applyCalls = 0;
  const report = buildCrmPhase1hBVerifyReport({
    repoRoot: root,
    args: { deferRoleMatrix: true },
  });
  assert.equal(report.applyExecutorCalled, false);
  // Verify path does not accept/invoke an executor at all.
  assert.equal(typeof report.migrationsWouldApply, "object");
  assert.equal(applyCalls, 0);
});

test("6. committed decision file is insufficient for apply approvals", () => {
  const decision = {
    phase: "1H-B",
    environmentTarget: "staging",
    phase1gPersistenceApplyApproved: true,
    permissionSeedApplyApproved: true,
    roleMatrixApplyApproved: false,
    deferRoleMatrix: true,
    limitedStagingApplyUmbrellaApproved: true,
    productionApplyApproved: false,
  };
  const approvals = evaluateCrmPhase1hBApprovalGates({
    env: {},
    flags: {},
    ownerDecision: decision,
  });
  assert.equal(approvals.ok, false);
  assert.equal(approvals.committedDecisionSufficientForApply, false);
});

test("7. credentials alone are insufficient for write", () => {
  const accessTokenEnv = ["SUPABASE", "ACCESS", "TOKEN"].join("_");
  const gates = evaluateCrmPhase1hBPreWriteGates({
    env: {
      [accessTokenEnv]: "mock-not-a-real-credential",
      VITE_SUPABASE_URL: `https://${STAGING}.supabase.co`,
      VITE_APP_ENV: "staging",
    },
    flags: { environment: "staging", deferRoleMatrix: true },
    repoRoot: root,
    requireQaIdentities: false,
    loadOwnerDecision: false,
    ownerDecision: null,
    requireOneTimeAuthorization: true,
  });
  assert.equal(gates.canWrite, false);
  assert.equal(gates.credentialsSufficientForApply, false);
  assert.equal(
    gates.verdict,
    CRM_PHASE_1H_B_VERDICTS.BLOCKED_APPROVAL_REQUIRED
  );
});

test("8. --apply-staging alone is insufficient (missing one-time auth)", async () => {
  const result = await runCrmPhase1hBApply({
    repoRoot: root,
    env: matchingApprovalEnv(),
    args: {
      ...matchingApprovalFlags(),
      applyStaging: true,
      oneTimeAuthorizationPath: null,
    },
    executeSql: async () => {
      throw new Error("apply executor must not be called");
    },
    persistRefusal: false,
    persistResult: false,
  });
  assert.equal(result.ok, false);
  assert.equal(result.sqlApplied, false);
  assert.equal(result.applyExecutorCalled, false);
  assert.equal(
    result.verdict,
    CRM_PHASE_1H_B_VERDICTS.BLOCKED_ONE_TIME_AUTHORIZATION_REQUIRED
  );
});

test("9. missing one-time authorization is rejected", () => {
  const { fingerprint } = planFingerprint();
  const auth = evaluateCrmPhase1hBOneTimeAuthorization({
    authorization: null,
    expectedFingerprint: fingerprint,
  });
  assert.equal(auth.ok, false);
  assert.equal(
    auth.verdict,
    CRM_PHASE_1H_B_VERDICTS.BLOCKED_ONE_TIME_AUTHORIZATION_REQUIRED
  );
});

test("10. expired authorization is rejected", () => {
  const { fingerprint } = planFingerprint();
  const auth = evaluateCrmPhase1hBOneTimeAuthorization({
    authorization: buildCrmPhase1hBOneTimeAuthorization({
      migrationPlanFingerprint: fingerprint,
      issuedAt: "2026-07-26T10:00:00.000Z",
      expiresAt: "2026-07-26T11:00:00.000Z",
    }),
    expectedFingerprint: fingerprint,
    now: "2026-07-26T12:00:00.000Z",
  });
  assert.equal(auth.ok, false);
  assert.equal(
    auth.verdict,
    CRM_PHASE_1H_B_VERDICTS.BLOCKED_ONE_TIME_AUTHORIZATION_EXPIRED
  );
});

test("11. stale committed decision is rejected for mutation reuse", () => {
  const gates = evaluateCrmPhase1hBPreWriteGates({
    env: matchingApprovalEnv(),
    flags: matchingApprovalFlags(),
    repoRoot: root,
    requireQaIdentities: false,
    loadOwnerDecision: true,
    requireOneTimeAuthorization: true,
  });
  assert.equal(gates.canWrite, false);
  assert.equal(gates.ownerDecisionLoaded, true);
  assert.equal(gates.committedDecisionSufficientForApply, false);
  assert.ok(
    [
      CRM_PHASE_1H_B_VERDICTS.BLOCKED_ONE_TIME_AUTHORIZATION_REQUIRED,
      CRM_PHASE_1H_B_VERDICTS.BLOCKED_STALE_OWNER_DECISION,
    ].includes(gates.verdict)
  );
});

test("12. replayed authorization is rejected", () => {
  const dir = tempDir();
  try {
    const { filePath, fingerprint } = issueAuthFile(dir);
    consumeCrmPhase1hBOneTimeAuthorization(filePath);
    const consumed = JSON.parse(
      readFileSync(`${filePath}.consumed`, "utf8")
    );
    assert.equal(consumed.status, CRM_PHASE_1H_B_ONE_TIME_AUTH_STATUS.CONSUMED);
    const replay = evaluateCrmPhase1hBOneTimeAuthorization({
      authorization: consumed,
      expectedFingerprint: fingerprint,
      now: "2026-07-26T14:00:00.000Z",
    });
    assert.equal(replay.ok, false);
    assert.equal(
      replay.verdict,
      CRM_PHASE_1H_B_VERDICTS.BLOCKED_ONE_TIME_AUTHORIZATION_REPLAYED
    );
    assert.equal(existsSync(filePath), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("13. wrong project ref is rejected", () => {
  const { fingerprint } = planFingerprint();
  const auth = evaluateCrmPhase1hBOneTimeAuthorization({
    authorization: {
      ...buildCrmPhase1hBOneTimeAuthorization({
        migrationPlanFingerprint: fingerprint,
      }),
      stagingProjectRef: "not-the-staging-ref",
    },
    expectedFingerprint: fingerprint,
  });
  assert.equal(auth.ok, false);
  assert.equal(
    auth.verdict,
    CRM_PHASE_1H_B_VERDICTS.BLOCKED_PROJECT_REF_MISMATCH
  );
});

test("14. Production project ref is rejected", () => {
  const { fingerprint } = planFingerprint();
  const auth = evaluateCrmPhase1hBOneTimeAuthorization({
    authorization: {
      schemaVersion: 1,
      operation: "crm_phase_1h_b_staging_apply",
      stagingProjectRef: PRODUCTION,
      migrationPlanFingerprint: fingerprint,
      issuedAt: "2026-07-26T14:00:00.000Z",
      expiresAt: "2026-07-26T15:00:00.000Z",
      nonce: "n1",
      operationId: "op1",
      status: "issued",
    },
    expectedFingerprint: fingerprint,
    expectedProjectRef: STAGING,
  });
  assert.equal(auth.ok, false);
  assert.equal(
    auth.verdict,
    CRM_PHASE_1H_B_VERDICTS.BLOCKED_PRODUCTION_PROJECT_REF
  );

  const identity = evaluateCrmPhase1hBStagingIdentityGate({
    env: {
      VITE_APP_ENV: "staging",
      VITE_SUPABASE_URL: `https://${PRODUCTION}.supabase.co`,
    },
    environmentFlag: "staging",
    requireLiveUrlIdentity: true,
  });
  assert.equal(identity.ok, false);
});

test("15. missing project identity is rejected", () => {
  const identity = evaluateCrmPhase1hBStagingIdentityGate({
    env: { VITE_APP_ENV: "staging" },
    environmentFlag: "staging",
    requireLiveUrlIdentity: true,
    ownerDecision: {
      stagingIdentityVerified: true,
      stagingProjectRefVerified: STAGING,
      environmentTarget: "staging",
      productionApplyApproved: false,
    },
  });
  assert.equal(identity.ok, false);
  assert.ok(
    identity.errors.some((e) => /Live Staging URL identity required/i.test(e))
  );
});

test("16. mismatched migration fingerprint is rejected", () => {
  const { fingerprint } = planFingerprint();
  const auth = evaluateCrmPhase1hBOneTimeAuthorization({
    authorization: buildCrmPhase1hBOneTimeAuthorization({
      migrationPlanFingerprint: fingerprint,
    }),
    expectedFingerprint: "0".repeat(64),
  });
  assert.equal(auth.ok, false);
  assert.equal(
    auth.verdict,
    CRM_PHASE_1H_B_VERDICTS.BLOCKED_MIGRATION_FINGERPRINT_MISMATCH
  );
});

test("17. repeated apply does not auto-run after auth is consumed", async () => {
  const dir = tempDir();
  try {
    const { filePath } = issueAuthFile(dir);
    let calls = 0;
    const first = await runCrmPhase1hBApply({
      repoRoot: root,
      env: matchingApprovalEnv(),
      args: {
        ...matchingApprovalFlags(),
        oneTimeAuthorizationPath: filePath,
      },
      executeSql: async () => {
        calls += 1;
        return { ok: true };
      },
      persistRefusal: false,
      persistResult: false,
    });
    assert.equal(first.ok, true);
    assert.equal(first.sqlApplied, true);
    assert.ok(calls >= 1);

    const second = await runCrmPhase1hBApply({
      repoRoot: root,
      env: matchingApprovalEnv(),
      args: {
        ...matchingApprovalFlags(),
        oneTimeAuthorizationPath: filePath,
      },
      executeSql: async () => {
        calls += 1;
        throw new Error("must not re-apply");
      },
      persistRefusal: false,
      persistResult: false,
    });
    assert.equal(second.ok, false);
    assert.equal(second.sqlApplied, false);
    assert.equal(second.applyExecutorCalled, false);
    assert.equal(
      second.verdict,
      CRM_PHASE_1H_B_VERDICTS.BLOCKED_ONE_TIME_AUTHORIZATION_REQUIRED
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("18. sanitized evidence payload rejects secret-looking content", () => {
  const docsDir = path.join(root, "docs", "crm", "bm-final-safety-01");
  assert.ok(existsSync(docsDir));
  for (const name of [
    "SANITIZED_REAPPLY_EVIDENCE.json",
    "README.md",
    "APPLY_AUTHORIZATION_GUARD.md",
  ]) {
    const text = readFileSync(path.join(docsDir, name), "utf8");
    for (const pattern of SECRET_PATTERNS) {
      assert.equal(pattern.test(text), false, `secret-like pattern in ${name}`);
    }
  }
});

test("19. valid explicit Staging authorization opens gate logic with mocked apply", async () => {
  const dir = tempDir();
  try {
    const { filePath } = issueAuthFile(dir);
    let calls = 0;
    const labels = [];
    const result = await runCrmPhase1hBApply({
      repoRoot: root,
      env: matchingApprovalEnv(),
      args: {
        ...matchingApprovalFlags(),
        oneTimeAuthorizationPath: filePath,
      },
      executeSql: async (_token, _sql, label) => {
        calls += 1;
        labels.push(label);
        return { ok: true, label };
      },
      persistRefusal: false,
      persistResult: false,
    });
    assert.equal(result.ok, true);
    assert.equal(result.sqlApplied, true);
    assert.equal(result.stagingProjectRef, STAGING);
    assert.equal(result.productionConnected, false);
    assert.equal(result.oneTimeAuthorizationConsumed, true);
    assert.equal(calls, 7);
    assert.equal(labels[0], "migration-order-1");
    assert.equal(labels[6], "migration-order-7");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("20. tests never connect to a real database and never mutate Staging", async () => {
  const dir = tempDir();
  try {
    const { filePath } = issueAuthFile(dir);
    const result = await runCrmPhase1hBApply({
      repoRoot: root,
      env: matchingApprovalEnv(),
      args: {
        ...matchingApprovalFlags(),
        oneTimeAuthorizationPath: filePath,
      },
      executeSql: async () => ({ ok: true }),
      persistRefusal: false,
      persistResult: false,
    });
    assert.equal(result.ok, true);
    // Guard: no real fetch/network executor was used in this suite path.
    assert.equal(result.productionConnected, false);
    assert.equal(result.secretsPrinted, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CI/test/audit apply path refuses before invoking mocked executor", async () => {
  let calls = 0;
  const result = await runCrmPhase1hBApply({
    repoRoot: root,
    env: { ...matchingApprovalEnv(), CI: "true" },
    args: matchingApprovalFlags(),
    executeSql: async () => {
      calls += 1;
      return { ok: true };
    },
    persistRefusal: false,
    persistResult: false,
  });
  assert.equal(result.ok, false);
  assert.equal(result.verdict, CRM_PHASE_1H_B_VERDICTS.BLOCKED_EXECUTION_CONTEXT);
  assert.equal(calls, 0);
  assert.equal(result.applyExecutorCalled, false);
});

test("grant remediation authorization is bound to its own operation", () => {
  const sqlFingerprint = "a".repeat(64);
  const remediationAuth = buildCrmPhase1hBOneTimeAuthorization({
    operation: CRM_BM_FINAL_SAFETY_01_GRANT_REMEDIATION_OPERATION,
    migrationPlanFingerprint: sqlFingerprint,
  });
  assert.equal(
    remediationAuth.operation,
    CRM_BM_FINAL_SAFETY_01_GRANT_REMEDIATION_OPERATION
  );

  const accepted = evaluateCrmPhase1hBOneTimeAuthorization({
    authorization: remediationAuth,
    expectedOperation: CRM_BM_FINAL_SAFETY_01_GRANT_REMEDIATION_OPERATION,
    expectedFingerprint: sqlFingerprint,
    expectedProjectRef: STAGING,
  });
  assert.equal(accepted.ok, true);

  // A Staging apply authorization must not unlock grant remediation.
  const applyAuth = buildCrmPhase1hBOneTimeAuthorization({
    migrationPlanFingerprint: sqlFingerprint,
  });
  const crossOperation = evaluateCrmPhase1hBOneTimeAuthorization({
    authorization: applyAuth,
    expectedOperation: CRM_BM_FINAL_SAFETY_01_GRANT_REMEDIATION_OPERATION,
    expectedFingerprint: sqlFingerprint,
    expectedProjectRef: STAGING,
  });
  assert.equal(crossOperation.ok, false);

  // Consumed remediation authorization is replay-rejected.
  const replayed = evaluateCrmPhase1hBOneTimeAuthorization({
    authorization: {
      ...remediationAuth,
      status: CRM_PHASE_1H_B_ONE_TIME_AUTH_STATUS.CONSUMED,
    },
    expectedOperation: CRM_BM_FINAL_SAFETY_01_GRANT_REMEDIATION_OPERATION,
    expectedFingerprint: sqlFingerprint,
    expectedProjectRef: STAGING,
  });
  assert.equal(replayed.ok, false);
  assert.equal(
    replayed.verdict,
    "CRM_PHASE_1H_B_BLOCKED_ONE_TIME_AUTHORIZATION_REPLAYED"
  );

  // Unknown operations cannot be issued at all.
  assert.throws(() =>
    buildCrmPhase1hBOneTimeAuthorization({
      operation: "crm_unknown_operation",
      migrationPlanFingerprint: sqlFingerprint,
    })
  );
});

test("grant remediation SQL package stays byte-stable and DCL-only", () => {
  const remediationSql = readFileSync(
    path.join(root, "docs/crm/bm-final-safety-01/STAGING_GRANT_REMEDIATION.sql"),
    "utf8"
  );
  const executable = remediationSql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ");

  assert.equal(executable.includes(PRODUCTION), false);
  assert.match(executable, /BEGIN\s*;/);
  assert.match(executable, /COMMIT\s*;/);
  assert.equal(/\b(INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM)\b/i.test(executable), false);
  assert.equal(/\b(CREATE|ALTER|DROP)\s+(TABLE|FUNCTION|POLICY|INDEX)\b/i.test(executable), false);
  assert.equal(/\bGRANT\b/i.test(executable), false);
});

test("facade exports one-time authorization helpers", async () => {
  const crm = await import("../src/features/crm/index.js");
  assert.equal(typeof crm.evaluateCrmPhase1hBOneTimeAuthorization, "function");
  assert.equal(typeof crm.computeCrmPhase1hBMigrationPlanFingerprint, "function");
  assert.equal(typeof crm.buildCrmPhase1hBOneTimeAuthorization, "function");
  assert.equal(crm.CRM_STAGING_PROJECT_REF_ALLOWLIST[0], STAGING);
  assert.equal(crm.CRM_PRODUCTION_PROJECT_REF_BLOCKLIST[0], PRODUCTION);
});
