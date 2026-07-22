#!/usr/bin/env node
/**
 * CRM Phase 1H-B — Controlled Staging apply (fail-closed).
 *
 * DEFAULT: dry-run (no SQL apply).
 *
 * Required for live apply (all must pass):
 *   --apply-staging
 *   --environment=staging
 *   --owner-approval=<token matching CRM_STAGING_OWNER_APPROVAL>
 *   --backup-evidence=<token matching CRM_STAGING_BACKUP_EVIDENCE>
 *   --permission-seed-approval=<token matching CRM_IDENTITY_PERMISSION_SEED_APPROVAL>
 *   --phase-1g-apply-approval=<token matching CRM_PHASE_1G_PERSISTENCE_APPLY_APPROVAL>
 *   --role-matrix-approval=<token>  OR  --defer-role-matrix
 *
 * Never continues to Production. Never deploys. Never logs credentials.
 * Never executes automatic rollback. Stop on first migration error.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

import { loadProjectEnv } from "../load-env.mjs";
import {
  CRM_PRODUCTION_PROJECT_REF_BLOCKLIST,
  CRM_STAGING_PROJECT_REF_ALLOWLIST,
  verifyCrmStagingMigrationManifest,
  loadCrmStagingMigrationManifest,
  sha256File,
  getCrmPhase1hRepoRoot,
} from "../../src/features/crm/staging/migrationManifest.js";
import {
  CRM_PHASE_1H_B_VERDICTS,
  evaluateCrmPhase1hBPreWriteGates,
  classifyCrmPhase1hBMigrationPlan,
} from "../../src/features/crm/staging/phase1hBGates.js";

const root = getCrmPhase1hRepoRoot();
const STAGING_REF = CRM_STAGING_PROJECT_REF_ALLOWLIST[0];
const EVIDENCE_DIR = path.join(root, "docs/crm/phase-1h-b");

function parseArgs(argv) {
  const args = {
    applyStaging: false,
    ownerApproval: null,
    backupEvidence: null,
    permissionSeedApproval: null,
    roleMatrixApproval: null,
    phase1gApplyApproval: null,
    environment: null,
    deferRoleMatrix: false,
    dryRun: true,
  };
  for (const raw of argv) {
    if (raw === "--apply-staging") {
      args.applyStaging = true;
      args.dryRun = false;
    } else if (raw === "--dry-run") {
      args.dryRun = true;
      args.applyStaging = false;
    } else if (raw === "--defer-role-matrix") {
      args.deferRoleMatrix = true;
    } else if (raw.startsWith("--owner-approval=")) {
      args.ownerApproval = raw.slice("--owner-approval=".length);
    } else if (raw.startsWith("--backup-evidence=")) {
      args.backupEvidence = raw.slice("--backup-evidence=".length);
    } else if (raw.startsWith("--permission-seed-approval=")) {
      args.permissionSeedApproval = raw.slice(
        "--permission-seed-approval=".length
      );
    } else if (raw.startsWith("--role-matrix-approval=")) {
      args.roleMatrixApproval = raw.slice("--role-matrix-approval=".length);
    } else if (raw.startsWith("--phase-1g-apply-approval=")) {
      args.phase1gApplyApproval = raw.slice("--phase-1g-apply-approval=".length);
    } else if (raw.startsWith("--environment=")) {
      args.environment = String(raw.slice("--environment=".length)).toLowerCase();
    }
  }
  return args;
}

/**
 * Apply one SQL file via Supabase Management API (Staging project only).
 * Never logs token or full connection strings.
 */
async function executeStagingSql(accessToken, sql, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      body?.message || body?.error || `HTTP ${res.status}` || res.statusText;
    throw new Error(`${label}: ${msg}`);
  }
  return { ok: true, label };
}

function writeEvidenceJson(filename, payload) {
  if (!existsSync(EVIDENCE_DIR)) {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
  const target = path.join(EVIDENCE_DIR, filename);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

async function main() {
  // Load local env files if present — values never printed.
  try {
    loadProjectEnv();
  } catch {
    // Fail closed later via gates if credentials missing.
  }

  const args = parseArgs(process.argv.slice(2));
  const manifest = loadCrmStagingMigrationManifest(root);
  const verify = verifyCrmStagingMigrationManifest({ repoRoot: root, manifest });

  // Production URL hard block (without printing URL)
  for (const ref of CRM_PRODUCTION_PROJECT_REF_BLOCKLIST) {
    const url =
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.STAGING_SUPABASE_URL ||
      "";
    if (url.includes(ref)) {
      const blocked = {
        phase: "1H-B",
        script: "phase-1h-staging-apply",
        mode: "blocked",
        verdict: CRM_PHASE_1H_B_VERDICTS.BLOCKED_STAGING_IDENTITY_UNVERIFIED,
        ok: false,
        sqlApplied: false,
        productionConnected: false,
        stagingConnected: false,
        deploy: false,
        credentialsLogged: false,
        errors: ["Production project reference blocklisted in Supabase URL."],
      };
      console.log(JSON.stringify(blocked, null, 2));
      process.exit(1);
    }
  }

  const gateFlags = {
    ownerApproval: args.ownerApproval,
    backupEvidence: args.backupEvidence,
    permissionSeedApproval: args.permissionSeedApproval,
    roleMatrixApproval: args.roleMatrixApproval,
    phase1gApplyApproval: args.phase1gApplyApproval,
    deferRoleMatrix: args.deferRoleMatrix,
    environment: args.environment || "staging",
  };

  // Dry-run: report plan only — never connect / never write.
  if (!args.applyStaging || args.dryRun) {
    const plan = classifyCrmPhase1hBMigrationPlan(manifest, {
      deferRoleMatrix: args.deferRoleMatrix,
      roleMatrixApproved: Boolean(args.roleMatrixApproval),
    });
    const report = {
      phase: "1H-B",
      script: "phase-1h-staging-apply",
      mode: "dry-run",
      ok: verify.ok,
      sqlApplied: false,
      stagingConnected: false,
      productionConnected: false,
      deploy: false,
      automaticRollback: false,
      credentialsLogged: false,
      stopOnFirstError: true,
      manifestOk: verify.ok,
      manifestErrors: verify.errors || [],
      migrationsWouldApply: plan.apply.map((m) => ({
        order: m.order,
        path: m.path,
        sha256: m.sha256,
      })),
      migrationsDeferred: plan.deferred.map((m) => ({
        order: m.order,
        path: m.path,
        reason: "role_matrix_not_approved_or_deferred",
      })),
      evidence:
        "Dry-run only. Live apply requires --apply-staging plus all Owner approval / backup / Staging identity / credential gates.",
    };
    console.log(JSON.stringify(report, null, 2));
    process.exit(verify.ok ? 0 : 1);
  }

  // Live apply path — evaluate gates before any write.
  const gates = evaluateCrmPhase1hBPreWriteGates({
    env: process.env,
    flags: gateFlags,
    repoRoot: root,
    requireQaIdentities: false, // QA identities required for post-apply QA, not for SQL apply itself
  });

  if (!gates.canWrite) {
    const refused = {
      phase: "1H-B",
      script: "phase-1h-staging-apply",
      mode: "apply-refused",
      ok: false,
      verdict: gates.verdict,
      sqlApplied: false,
      stagingConnected: false,
      productionConnected: false,
      deploy: false,
      automaticRollback: false,
      credentialsLogged: false,
      gates: {
        approvalsOk: gates.approvals.ok,
        requiredMissingApprovals: gates.approvals.requiredMissing,
        identityOk: gates.identity.ok,
        identityErrors: gates.identity.errors,
        backupOk: gates.backup.ok,
        backupErrors: gates.backup.errors,
        credentialsOk: gates.credentials.ok,
        credentialsErrors: gates.credentials.errors,
        runtimeOk: gates.runtime.ok,
        runtimeErrors: gates.runtime.errors,
        manifestOk: gates.manifestVerify.ok,
        manifestErrors: gates.manifestVerify.errors,
        roleMatrixDeferred: gates.approvals.roleMatrix.deferred,
      },
      migrationPlan: gates.migrationPlan,
    };
    writeEvidenceJson("APPLY_GATE_REFUSAL.json", refused);
    console.log(JSON.stringify(refused, null, 2));
    process.exit(1);
  }

  // Re-verify checksums immediately before write.
  const reverify = verifyCrmStagingMigrationManifest({
    repoRoot: root,
    manifest,
  });
  if (!reverify.ok) {
    const failed = {
      phase: "1H-B",
      mode: "apply-refused",
      verdict: CRM_PHASE_1H_B_VERDICTS.APPLY_FAILED,
      ok: false,
      sqlApplied: false,
      errors: reverify.errors,
    };
    console.log(JSON.stringify(failed, null, 2));
    process.exit(1);
  }

  const plan = classifyCrmPhase1hBMigrationPlan(manifest, {
    deferRoleMatrix: args.deferRoleMatrix || !gates.approvals.roleMatrix.approved,
    roleMatrixApproved: gates.approvals.roleMatrix.approved,
  });

  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const applied = [];
  const deferred = plan.deferred.map((m) => ({
    order: m.order,
    path: m.path,
    reason: "role_matrix_approval_deferred",
  }));

  try {
    for (const entry of plan.apply) {
      const abs = path.join(root, entry.path);
      const actualSha = sha256File(abs);
      if (actualSha.toLowerCase() !== String(entry.sha256).toLowerCase()) {
        throw new Error(
          `SHA-256 mismatch immediately before apply for ${entry.path}`
        );
      }
      const sql = readFileSync(abs, "utf8");
      await executeStagingSql(accessToken, sql, `migration-order-${entry.order}`);
      applied.push({
        order: entry.order,
        path: entry.path,
        sha256: actualSha,
        status: "applied",
      });
    }

    const success = {
      phase: "1H-B",
      script: "phase-1h-staging-apply",
      mode: "applied",
      ok: true,
      verdict: null,
      sqlApplied: true,
      stagingConnected: true,
      stagingProjectRef: STAGING_REF,
      productionConnected: false,
      deploy: false,
      automaticRollback: false,
      credentialsLogged: false,
      stopOnFirstError: true,
      migrationsApplied: applied,
      migrationsDeferred: deferred,
      finishedAt: new Date().toISOString(),
    };
    writeEvidenceJson("APPLY_RESULT.json", success);
    console.log(JSON.stringify(success, null, 2));
    process.exit(0);
  } catch (err) {
    const failed = {
      phase: "1H-B",
      script: "phase-1h-staging-apply",
      mode: "apply-failed",
      ok: false,
      verdict: CRM_PHASE_1H_B_VERDICTS.APPLY_FAILED,
      sqlApplied: applied.length > 0,
      stagingConnected: true,
      productionConnected: false,
      deploy: false,
      automaticRollback: false,
      credentialsLogged: false,
      migrationsApplied: applied,
      migrationsDeferred: deferred,
      stoppedOn: applied.length + 1,
      error: err?.message || String(err),
      finishedAt: new Date().toISOString(),
    };
    writeEvidenceJson("APPLY_RESULT.json", failed);
    console.log(JSON.stringify(failed, null, 2));
    process.exit(1);
  }
}

main();
