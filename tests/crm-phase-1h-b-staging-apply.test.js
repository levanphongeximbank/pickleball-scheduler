/**
 * CRM Phase 1H-B — controlled Staging apply gates (offline / fail-closed).
 * Run: node --test tests/crm-phase-1h-b-staging-apply.test.js
 *
 * Does NOT connect to Staging or Production. Does NOT apply SQL.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as crm from "../src/features/crm/index.js";
import {
  CRM_PHASE_1H_B_VERDICTS,
  evaluateCrmPhase1hBApprovalGates,
  evaluateCrmPhase1hBStagingIdentityGate,
  evaluateCrmPhase1hBBackupGate,
  evaluateCrmPhase1hBCredentialsGate,
  evaluateCrmPhase1hBQaIdentitiesGate,
  evaluateCrmPhase1hBPreWriteGates,
  classifyCrmPhase1hBMigrationPlan,
} from "../src/features/crm/staging/phase1hBGates.js";
import {
  loadCrmStagingMigrationManifest,
  verifyCrmStagingMigrationManifest,
  CRM_PRODUCTION_PROJECT_REF_BLOCKLIST,
  CRM_STAGING_PROJECT_REF_ALLOWLIST,
} from "../src/features/crm/staging/migrationManifest.js";
import { getCrmDefaultRuntimePersistenceMode } from "../src/features/crm/persistence/runtimeCompositionGuard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const phase1hbDir = path.join(root, "docs", "crm", "phase-1h-b");

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function runNode(script, args = []) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env },
  });
}

test("Phase 1H-B facade exports gate helpers", () => {
  assert.equal(typeof crm.evaluateCrmPhase1hBPreWriteGates, "function");
  assert.equal(typeof crm.classifyCrmPhase1hBMigrationPlan, "function");
  assert.ok(crm.CRM_PHASE_1H_B_VERDICTS.BLOCKED_APPROVAL_REQUIRED);
  assert.deepEqual(crm.CRM_PRODUCTION_PROJECT_REF_BLOCKLIST, [
    "expuvcohlcjzvrrauvud",
  ]);
  assert.deepEqual(crm.CRM_STAGING_PROJECT_REF_ALLOWLIST, [
    "qyewbxjsiiyufanzcjcq",
  ]);
});

test("Phase 1H-B approval gates fail closed without Owner tokens or decision", () => {
  const r = evaluateCrmPhase1hBApprovalGates({
    env: {},
    flags: { deferRoleMatrix: true },
    ownerDecision: null,
  });
  assert.equal(r.ok, false);
  assert.ok(r.requiredMissing.includes("permission_seed_apply"));
  assert.ok(r.requiredMissing.includes("phase_1g_persistence_apply"));
  assert.ok(r.requiredMissing.includes("staging_owner_apply_umbrella"));
  assert.equal(r.roleMatrix.deferred, true);
});

test("Phase 1H-B limited Owner decision approves seed+1G and defers role matrix", () => {
  const decision = {
    phase: "1H-B",
    environmentTarget: "staging",
    phase1gPersistenceApplyApproved: true,
    permissionSeedApplyApproved: true,
    roleMatrixApplyApproved: false,
    deferRoleMatrix: true,
    limitedStagingApplyUmbrellaApproved: true,
    backupRestoreApproved: false,
    productionApplyApproved: false,
    durableRuntimeApproved: false,
  };
  const r = evaluateCrmPhase1hBApprovalGates({
    env: {},
    flags: {},
    ownerDecision: decision,
  });
  assert.equal(r.ok, true);
  assert.equal(r.roleMatrix.deferred, true);
  assert.equal(r.backupStatus.approvedByOwnerDecision, false);
});

test("Phase 1H-B approval gates pass only when CLI tokens match env", () => {
  const env = {
    CRM_IDENTITY_PERMISSION_SEED_APPROVAL: "seed-token",
    CRM_PHASE_1G_PERSISTENCE_APPLY_APPROVAL: "1g-token",
    CRM_STAGING_BACKUP_EVIDENCE: "backup-token",
    CRM_STAGING_OWNER_APPROVAL: "owner-token",
    CRM_IDENTITY_ROLE_MATRIX_APPROVAL: "matrix-token",
  };
  const bad = evaluateCrmPhase1hBApprovalGates({
    env,
    flags: {
      deferRoleMatrix: false,
      permissionSeedApproval: "wrong",
      phase1gApplyApproval: "1g-token",
      backupEvidence: "backup-token",
      ownerApproval: "owner-token",
      roleMatrixApproval: "matrix-token",
    },
  });
  assert.equal(bad.ok, false);

  const good = evaluateCrmPhase1hBApprovalGates({
    env,
    flags: {
      deferRoleMatrix: false,
      permissionSeedApproval: "seed-token",
      phase1gApplyApproval: "1g-token",
      ownerApproval: "owner-token",
      roleMatrixApproval: "matrix-token",
    },
  });
  assert.equal(good.ok, true);
});

test("Phase 1H-B Staging identity rejects Production and unset URL", () => {
  const unset = evaluateCrmPhase1hBStagingIdentityGate({
    env: {},
    environmentFlag: "staging",
  });
  assert.equal(unset.ok, false);

  const prod = evaluateCrmPhase1hBStagingIdentityGate({
    env: {
      VITE_APP_ENV: "staging",
      VITE_SUPABASE_URL: `https://${CRM_PRODUCTION_PROJECT_REF_BLOCKLIST[0]}.supabase.co`,
    },
    environmentFlag: "staging",
  });
  assert.equal(prod.ok, false);
  assert.ok(
    prod.errors.some((e) => /Production project reference/i.test(e))
  );

  const staging = evaluateCrmPhase1hBStagingIdentityGate({
    env: {
      VITE_APP_ENV: "staging",
      VITE_SUPABASE_URL: `https://${CRM_STAGING_PROJECT_REF_ALLOWLIST[0]}.supabase.co`,
    },
    environmentFlag: "staging",
  });
  assert.equal(staging.ok, true);
  assert.equal(staging.urlIdentity.projectRefHint, CRM_STAGING_PROJECT_REF_ALLOWLIST[0]);
});

test("Phase 1H-B backup gate requires token match + evidence path", () => {
  const missing = evaluateCrmPhase1hBBackupGate({
    env: {},
    flags: {},
  });
  assert.equal(missing.ok, false);

  const ok = evaluateCrmPhase1hBBackupGate({
    env: {
      CRM_STAGING_BACKUP_EVIDENCE: "backup-token",
      CRM_STAGING_BACKUP_EVIDENCE_PATH:
        "docs/crm/phase-1h-b/03_STAGING_IDENTITY_AND_BACKUP_EVIDENCE.md",
    },
    flags: { backupEvidence: "backup-token" },
  });
  assert.equal(ok.ok, true);
});

test("Phase 1H-B pre-write without decision returns BLOCKED_APPROVAL_REQUIRED", () => {
  const gates = evaluateCrmPhase1hBPreWriteGates({
    env: {},
    flags: { environment: "staging", deferRoleMatrix: true },
    repoRoot: root,
    requireQaIdentities: true,
    loadOwnerDecision: false,
    ownerDecision: null,
  });
  assert.equal(gates.canWrite, false);
  assert.equal(
    gates.verdict,
    CRM_PHASE_1H_B_VERDICTS.BLOCKED_APPROVAL_REQUIRED
  );
});

test("Phase 1H-B with approved recovery decision blocks on credentials next", () => {
  const gates = evaluateCrmPhase1hBPreWriteGates({
    env: {},
    flags: { environment: "staging" },
    repoRoot: root,
    requireQaIdentities: true,
    loadOwnerDecision: true,
  });
  assert.equal(gates.canWrite, false);
  assert.equal(gates.ownerDecisionLoaded, true);
  assert.equal(gates.approvals.ok, true);
  assert.equal(gates.identity.ok, true);
  assert.equal(gates.backup.ok, true);
  assert.equal(gates.approvals.roleMatrix.deferred, true);
  assert.deepEqual(gates.migrationPlan.deferred, [
    "docs/crm/phase-1h/20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql",
  ]);
  assert.equal(
    gates.verdict,
    CRM_PHASE_1H_B_VERDICTS.BLOCKED_CREDENTIALS_REQUIRED
  );
  assert.equal(gates.sqlApplied, false);
  assert.equal(gates.productionConnected, false);
  assert.equal(gates.deploy, false);
  assert.equal(gates.secretsPrinted, false);
});

test("Phase 1H-B migration plan defers role matrix when not approved", () => {
  const manifest = loadCrmStagingMigrationManifest(root);
  const plan = classifyCrmPhase1hBMigrationPlan(manifest, {
    deferRoleMatrix: true,
    roleMatrixApproved: false,
  });
  assert.equal(plan.deferred.length, 1);
  assert.match(plan.deferred[0].path, /ROLE_PERMISSION_ASSIGNMENT/);
  assert.equal(plan.apply.length, manifest.migrations.length - 1);
  assert.equal(plan.apply[0].order, 1);
  assert.equal(plan.apply[plan.apply.length - 1].order, 7);
});

test("Phase 1H-B manifest still verifies SHA sequence", () => {
  const verify = verifyCrmStagingMigrationManifest({ repoRoot: root });
  assert.equal(verify.ok, true);
  assert.equal(verify.checked, 8);
});

test("Phase 1H-B durable runtime remains memory default", () => {
  assert.equal(getCrmDefaultRuntimePersistenceMode(), "memory");
  const creds = evaluateCrmPhase1hBCredentialsGate({ env: {} });
  assert.equal(creds.ok, false);
  const qa = evaluateCrmPhase1hBQaIdentitiesGate({ env: {} });
  assert.equal(qa.ok, false);
});

test("Phase 1H-B offline preflight exits 0", () => {
  const out = runNode("scripts/crm/phase-1h-staging-preflight.mjs", [
    "--offline",
    "--environment=staging",
  ]);
  const report = JSON.parse(out);
  assert.equal(report.phase, "1H-B");
  assert.equal(report.ok, true);
  assert.equal(report.sqlApplied, false);
  assert.equal(report.stagingConnected, false);
  assert.equal(report.productionConnected, false);
  assert.equal(report.environmentVariableValues, "NOT_PRINTED");
});

test("Phase 1H-B live-gates preflight blocks without approvals", () => {
  let failed = false;
  let report;
  try {
    runNode("scripts/crm/phase-1h-staging-preflight.mjs", [
      "--live-gates",
      "--environment=staging",
    ]);
  } catch (err) {
    failed = true;
    report = JSON.parse(String(err.stdout || ""));
  }
  assert.equal(failed, true);
  assert.equal(report.ok, false);
  assert.equal(report.liveGates.canWrite, false);
  assert.ok(
    [
      CRM_PHASE_1H_B_VERDICTS.BLOCKED_APPROVAL_REQUIRED,
      CRM_PHASE_1H_B_VERDICTS.BLOCKED_STAGING_IDENTITY_UNVERIFIED,
      CRM_PHASE_1H_B_VERDICTS.BLOCKED_BACKUP_REQUIRED,
      CRM_PHASE_1H_B_VERDICTS.BLOCKED_CREDENTIALS_REQUIRED,
      CRM_PHASE_1H_B_VERDICTS.BLOCKED_QA_IDENTITIES_REQUIRED,
    ].includes(report.liveGates.verdict)
  );
});

test("Phase 1H-B apply dry-run does not apply SQL", () => {
  const out = runNode("scripts/crm/phase-1h-staging-apply.mjs", ["--dry-run"]);
  const report = JSON.parse(out);
  assert.equal(report.mode, "dry-run");
  assert.equal(report.sqlApplied, false);
  assert.equal(report.stagingConnected, false);
  assert.equal(report.productionConnected, false);
  assert.equal(report.deploy, false);
  assert.ok(report.migrationsWouldApply.length >= 7);
});

test("Phase 1H-B apply --apply-staging refuses without Owner gates", () => {
  let failed = false;
  let report;
  try {
    runNode("scripts/crm/phase-1h-staging-apply.mjs", [
      "--apply-staging",
      "--environment=staging",
      "--defer-role-matrix",
    ]);
  } catch (err) {
    failed = true;
    report = JSON.parse(String(err.stdout || ""));
  }
  assert.equal(failed, true);
  assert.equal(report.mode, "apply-refused");
  assert.equal(report.sqlApplied, false);
  assert.ok(
    [
      CRM_PHASE_1H_B_VERDICTS.BLOCKED_APPROVAL_REQUIRED,
      CRM_PHASE_1H_B_VERDICTS.BLOCKED_STAGING_IDENTITY_UNVERIFIED,
      CRM_PHASE_1H_B_VERDICTS.BLOCKED_BACKUP_REQUIRED,
      CRM_PHASE_1H_B_VERDICTS.BLOCKED_CREDENTIALS_REQUIRED,
      CRM_PHASE_1H_B_VERDICTS.BLOCKED_QA_IDENTITIES_REQUIRED,
    ].includes(report.verdict)
  );
});

test("Phase 1H-B evidence docs exist and contain no secret-looking JWTs", () => {
  const required = [
    "01_PHASE_1H_B_EXECUTION_PLAN.md",
    "02_PRE_APPLY_SAFETY_BASELINE.md",
    "03_STAGING_IDENTITY_AND_BACKUP_EVIDENCE.md",
    "04_MIGRATION_APPLY_REPORT.md",
    "05_POST_APPLY_SCHEMA_AND_RLS_QA.md",
    "06_PERMISSION_AND_ROLE_MATRIX_QA.md",
    "07_PENDING_EVENT_RPC_QA.md",
    "08_CROSS_TENANT_AUTHORIZATION_QA.md",
    "09_RUNTIME_SAFETY_CONFIRMATION.md",
    "10_PHASE_1H_B_FINAL_CERTIFICATION.md",
  ];
  for (const name of required) {
    assert.ok(
      existsSync(path.join(phase1hbDir, name)),
      `missing evidence: ${name}`
    );
  }
  const jwtLike = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;
  const serviceRoleLike = /service_role|eyJhbGci/i;
  for (const file of walkFiles(phase1hbDir)) {
    const text = readFileSync(file, "utf8");
    assert.equal(jwtLike.test(text), false, `JWT-like token in ${file}`);
    assert.equal(serviceRoleLike.test(text), false, `service_role leak in ${file}`);
  }
});
