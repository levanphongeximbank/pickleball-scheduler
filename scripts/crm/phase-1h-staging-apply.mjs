#!/usr/bin/env node
/**
 * CRM Phase 1H-B — Controlled Staging apply (fail-closed).
 *
 * DEFAULT / VERIFY: dry-run / --verify-only (no SQL apply, no mutation connection).
 *
 * Required for live apply (all must pass):
 *   --apply-staging
 *   --environment=staging
 *   --owner-approval=<token matching CRM_STAGING_OWNER_APPROVAL>
 *   --backup-evidence=<token matching CRM_STAGING_BACKUP_EVIDENCE>
 *   --permission-seed-approval=<token matching CRM_IDENTITY_PERMISSION_SEED_APPROVAL>
 *   --phase-1g-apply-approval=<token matching CRM_PHASE_1G_PERSISTENCE_APPLY_APPROVAL>
 *   --role-matrix-approval=<token>  OR  --defer-role-matrix
 *   --one-time-authorization=<absolute-or-repo-relative path to untracked issued auth>
 *
 * Committed Owner decision JSON is NEVER sufficient.
 * Credentials alone are NEVER sufficient.
 * --apply-staging alone is NEVER sufficient.
 * Audit / test / CI contexts fail closed before mutation connections.
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
import {
  computeCrmPhase1hBMigrationPlanFingerprint,
  consumeCrmPhase1hBOneTimeAuthorization,
  detectCrmPhase1hBNonMutationContext,
} from "../../src/features/crm/staging/phase1hBOneTimeAuthorization.js";

const root = getCrmPhase1hRepoRoot();
const STAGING_REF = CRM_STAGING_PROJECT_REF_ALLOWLIST[0];
const PRODUCTION_REF = CRM_PRODUCTION_PROJECT_REF_BLOCKLIST[0];
const EVIDENCE_DIR = path.join(root, "docs/crm/phase-1h-b");

function parseArgs(argv) {
  const args = {
    applyStaging: false,
    verifyOnly: false,
    ownerApproval: null,
    backupEvidence: null,
    permissionSeedApproval: null,
    roleMatrixApproval: null,
    phase1gApplyApproval: null,
    oneTimeAuthorizationPath: null,
    environment: null,
    deferRoleMatrix: false,
    dryRun: true,
    persistEvidence: false,
  };
  for (const raw of argv) {
    if (raw === "--apply-staging") {
      args.applyStaging = true;
      args.dryRun = false;
      args.verifyOnly = false;
    } else if (raw === "--dry-run" || raw === "--verify-only") {
      args.dryRun = true;
      args.verifyOnly = true;
      args.applyStaging = false;
    } else if (raw === "--defer-role-matrix") {
      args.deferRoleMatrix = true;
    } else if (raw === "--persist-evidence") {
      args.persistEvidence = true;
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
    } else if (raw.startsWith("--one-time-authorization=")) {
      args.oneTimeAuthorizationPath = raw.slice(
        "--one-time-authorization=".length
      );
    } else if (raw.startsWith("--environment=")) {
      args.environment = String(raw.slice("--environment=".length)).toLowerCase();
    }
  }
  return args;
}

function resolveAuthPath(rawPath) {
  if (!rawPath) return null;
  return path.isAbsolute(rawPath) ? rawPath : path.join(root, rawPath);
}

function sanitizeEvidencePayload(payload) {
  const text = JSON.stringify(payload);
  const forbidden =
    /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|(postgres(?:ql)?|supabase):\/\/[^\s"']+|(password|access[_-]?token|service[_-]?role|refresh[_-]?token)\s*[:=]/i;
  if (forbidden.test(text)) {
    throw new Error("Refusing to write evidence that appears to contain secrets.");
  }
  return payload;
}

/**
 * Apply one SQL file via Supabase Management API (Staging project only).
 * Never logs token or full connection strings.
 * Exported for tests via dependency injection only — verify path must not call this.
 */
export async function executeStagingSql(accessToken, sql, label, options = {}) {
  const projectRef = options.projectRef || STAGING_REF;
  if (projectRef === PRODUCTION_REF) {
    throw new Error("Production project ref is absolutely blocked.");
  }
  if (projectRef !== STAGING_REF) {
    throw new Error("Non-Staging project ref is blocked.");
  }
  if (!accessToken) {
    throw new Error("Access token missing for Staging apply executor.");
  }
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
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
    // Never include Authorization / token material in thrown message.
    throw new Error(`${label}: ${String(msg).slice(0, 300)}`);
  }
  return { ok: true, label };
}

function writeEvidenceJson(filename, payload) {
  if (!existsSync(EVIDENCE_DIR)) {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
  const target = path.join(EVIDENCE_DIR, filename);
  const safe = sanitizeEvidencePayload(payload);
  writeFileSync(target, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
  return target;
}

/**
 * VERIFY PATH — never connects for mutation, never calls apply executor.
 */
export function buildCrmPhase1hBVerifyReport(options = {}) {
  const repoRoot = options.repoRoot || root;
  const args = options.args || {};
  const manifest =
    options.manifest || loadCrmStagingMigrationManifest(repoRoot);
  const verify =
    options.verify ||
    verifyCrmStagingMigrationManifest({ repoRoot, manifest });
  const plan = classifyCrmPhase1hBMigrationPlan(manifest, {
    deferRoleMatrix: args.deferRoleMatrix,
    roleMatrixApproved: Boolean(args.roleMatrixApproval),
  });
  const fingerprint = computeCrmPhase1hBMigrationPlanFingerprint(plan.apply);

  return {
    phase: "1H-B",
    script: "phase-1h-staging-apply",
    mode: "dry-run",
    path: "verify",
    ok: verify.ok,
    sqlApplied: false,
    stagingConnected: false,
    productionConnected: false,
    deploy: false,
    automaticRollback: false,
    credentialsLogged: false,
    applyExecutorCalled: false,
    stopOnFirstError: true,
    manifestOk: verify.ok,
    manifestErrors: verify.errors || [],
    migrationPlanFingerprint: fingerprint,
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
      "Verify-only / dry-run. Live apply requires --apply-staging plus CLI↔env approvals, live Staging identity, credentials, and explicit one-time authorization. Committed Owner decision is insufficient.",
  };
}

/**
 * APPLY PATH — mutation only after all gates including one-time authorization.
 * Accepts injectable executeSql for offline tests (mock; no real DB).
 */
export async function runCrmPhase1hBApply(options = {}) {
  const repoRoot = options.repoRoot || root;
  const env = options.env || process.env;
  const args = options.args || {};
  const executeSql = options.executeSql || executeStagingSql;
  const consumeAuth =
    options.consumeAuthorization || consumeCrmPhase1hBOneTimeAuthorization;
  const writeEvidence = options.writeEvidence || writeEvidenceJson;

  const context = detectCrmPhase1hBNonMutationContext(env, {
    forceAuditMode: options.forceAuditMode === true,
  });
  if (context.blocked) {
    return {
      phase: "1H-B",
      script: "phase-1h-staging-apply",
      mode: "apply-refused",
      ok: false,
      verdict: CRM_PHASE_1H_B_VERDICTS.BLOCKED_EXECUTION_CONTEXT,
      sqlApplied: false,
      applyExecutorCalled: false,
      stagingConnected: false,
      productionConnected: false,
      errors: [
        `Mutation refused in non-interactive/audit/test/CI context: ${context.reasons.join(",")}`,
      ],
      secretsPrinted: false,
      exitCode: 1,
    };
  }

  for (const ref of CRM_PRODUCTION_PROJECT_REF_BLOCKLIST) {
    const url =
      env.VITE_SUPABASE_URL ||
      env.SUPABASE_URL ||
      env.STAGING_SUPABASE_URL ||
      "";
    if (String(url).includes(ref)) {
      return {
        phase: "1H-B",
        script: "phase-1h-staging-apply",
        mode: "blocked",
        ok: false,
        verdict: CRM_PHASE_1H_B_VERDICTS.BLOCKED_PRODUCTION_PROJECT_REF,
        sqlApplied: false,
        applyExecutorCalled: false,
        productionConnected: false,
        stagingConnected: false,
        deploy: false,
        credentialsLogged: false,
        errors: ["Production project reference blocklisted in Supabase URL."],
        exitCode: 1,
      };
    }
  }

  const authPath = resolveAuthPath(args.oneTimeAuthorizationPath);
  const gateFlags = {
    ownerApproval: args.ownerApproval,
    backupEvidence: args.backupEvidence,
    permissionSeedApproval: args.permissionSeedApproval,
    roleMatrixApproval: args.roleMatrixApproval,
    phase1gApplyApproval: args.phase1gApplyApproval,
    deferRoleMatrix: args.deferRoleMatrix,
    environment: args.environment || "staging",
  };

  const gates = evaluateCrmPhase1hBPreWriteGates({
    env,
    flags: gateFlags,
    repoRoot,
    requireQaIdentities: false,
    requireOneTimeAuthorization: true,
    requireLiveUrlIdentity: true,
    oneTimeAuthorizationPath: authPath,
    now: options.now,
  });

  if (!gates.canWrite) {
    const refused = {
      phase: "1H-B",
      script: "phase-1h-staging-apply",
      mode: "apply-refused",
      ok: false,
      verdict: gates.verdict,
      sqlApplied: false,
      applyExecutorCalled: false,
      stagingConnected: false,
      productionConnected: false,
      deploy: false,
      automaticRollback: false,
      credentialsLogged: false,
      committedDecisionSufficientForApply: false,
      credentialsSufficientForApply: false,
      applyFlagSufficientForApply: false,
      gates: {
        executionContextBlocked: gates.executionContext.blocked,
        executionContextReasons: gates.executionContext.reasons,
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
        oneTimeAuthorizationOk: gates.oneTimeAuthorization.ok,
        oneTimeAuthorizationVerdict: gates.oneTimeAuthorization.verdict,
        oneTimeAuthorizationErrors: gates.oneTimeAuthorization.errors,
        roleMatrixDeferred: gates.approvals.roleMatrix.deferred,
        migrationPlanFingerprint: gates.migrationPlanFingerprint,
      },
      migrationPlan: gates.migrationPlan,
      secretsPrinted: false,
    };
    if (options.persistRefusal !== false) {
      writeEvidence("APPLY_GATE_REFUSAL.json", refused);
    }
    return { ...refused, exitCode: 1 };
  }

  const manifest = loadCrmStagingMigrationManifest(repoRoot);
  const reverify = verifyCrmStagingMigrationManifest({
    repoRoot,
    manifest,
  });
  if (!reverify.ok) {
    return {
      phase: "1H-B",
      mode: "apply-refused",
      verdict: CRM_PHASE_1H_B_VERDICTS.APPLY_FAILED,
      ok: false,
      sqlApplied: false,
      applyExecutorCalled: false,
      errors: reverify.errors,
      secretsPrinted: false,
      exitCode: 1,
    };
  }

  const plan = classifyCrmPhase1hBMigrationPlan(manifest, {
    deferRoleMatrix:
      args.deferRoleMatrix || !gates.approvals.roleMatrix.approved,
    roleMatrixApproved: gates.approvals.roleMatrix.approved,
  });
  const fingerprint = computeCrmPhase1hBMigrationPlanFingerprint(plan.apply);
  if (fingerprint !== gates.migrationPlanFingerprint) {
    return {
      phase: "1H-B",
      mode: "apply-refused",
      verdict: CRM_PHASE_1H_B_VERDICTS.BLOCKED_MIGRATION_FINGERPRINT_MISMATCH,
      ok: false,
      sqlApplied: false,
      applyExecutorCalled: false,
      errors: ["Migration plan fingerprint changed between gate and apply."],
      secretsPrinted: false,
      exitCode: 1,
    };
  }

  const accessToken = String(env.SUPABASE_ACCESS_TOKEN || "").trim();
  const applied = [];
  const deferred = plan.deferred.map((m) => ({
    order: m.order,
    path: m.path,
    reason: "role_matrix_approval_deferred",
  }));
  let applyExecutorCalled = false;

  try {
    for (const entry of plan.apply) {
      const abs = path.join(repoRoot, entry.path);
      const actualSha = sha256File(abs);
      if (actualSha.toLowerCase() !== String(entry.sha256).toLowerCase()) {
        throw new Error(
          `SHA-256 mismatch immediately before apply for ${entry.path}`
        );
      }
      const sql = readFileSync(abs, "utf8");
      applyExecutorCalled = true;
      await executeSql(accessToken, sql, `migration-order-${entry.order}`, {
        projectRef: STAGING_REF,
      });
      applied.push({
        order: entry.order,
        path: entry.path,
        sha256: actualSha,
        status: "applied",
      });
    }

    // Consume authorization after successful apply so replay is impossible.
    if (authPath) {
      consumeAuth(authPath, { consumedAt: new Date().toISOString() });
    }

    const success = {
      phase: "1H-B",
      script: "phase-1h-staging-apply",
      mode: "applied",
      ok: true,
      verdict: null,
      sqlApplied: true,
      applyExecutorCalled,
      stagingConnected: true,
      stagingProjectRef: STAGING_REF,
      productionConnected: false,
      deploy: false,
      automaticRollback: false,
      credentialsLogged: false,
      stopOnFirstError: true,
      migrationPlanFingerprint: fingerprint,
      oneTimeAuthorizationConsumed: true,
      migrationsApplied: applied,
      migrationsDeferred: deferred,
      finishedAt: new Date().toISOString(),
      secretsPrinted: false,
    };
    if (options.persistResult !== false) {
      writeEvidence("APPLY_RESULT.json", success);
    }
    return { ...success, exitCode: 0 };
  } catch (err) {
    const failed = {
      phase: "1H-B",
      script: "phase-1h-staging-apply",
      mode: "apply-failed",
      ok: false,
      verdict: CRM_PHASE_1H_B_VERDICTS.APPLY_FAILED,
      sqlApplied: applied.length > 0,
      applyExecutorCalled,
      stagingConnected: applyExecutorCalled,
      productionConnected: false,
      deploy: false,
      automaticRollback: false,
      credentialsLogged: false,
      migrationsApplied: applied,
      migrationsDeferred: deferred,
      stoppedOn: applied.length + 1,
      error: String(err?.message || err).slice(0, 300),
      finishedAt: new Date().toISOString(),
      secretsPrinted: false,
    };
    if (options.persistResult !== false) {
      writeEvidence("APPLY_RESULT.json", failed);
    }
    return { ...failed, exitCode: 1 };
  }
}

async function main(argv = process.argv.slice(2), runtime = {}) {
  // Load local env files if present — values never printed.
  try {
    loadProjectEnv();
  } catch {
    // Fail closed later via gates if credentials missing.
  }

  const args = parseArgs(argv);

  // Absolute separation: verify path never enters apply path.
  if (!args.applyStaging || args.dryRun || args.verifyOnly) {
    const report = buildCrmPhase1hBVerifyReport({
      repoRoot: root,
      args,
    });
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  }

  // Live apply path — never reached from verify-only mode.
  const result = await runCrmPhase1hBApply({
    args,
    env: runtime.env || process.env,
    executeSql: runtime.executeSql,
    consumeAuthorization: runtime.consumeAuthorization,
    writeEvidence: runtime.writeEvidence,
    forceAuditMode: runtime.forceAuditMode,
    now: runtime.now,
    persistRefusal: args.persistEvidence === true,
    persistResult: args.persistEvidence === true,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.exitCode ?? (result.ok ? 0 : 1));
}

const invokedAsCli =
  process.argv[1] &&
  path.resolve(process.argv[1]).includes("phase-1h-staging-apply.mjs");

if (invokedAsCli) {
  main();
}

export { parseArgs, main, STAGING_REF, PRODUCTION_REF };
