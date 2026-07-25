#!/usr/bin/env node
/**
 * COACHING-03 — Guarded Staging apply (Gate D).
 *
 * DEFAULT: APPLY_MODE=REFUSED (no network write).
 *
 * Live execute requires ALL of:
 *   --execute
 *   --environment=staging
 *   --project-ref=<exact Staging ref>
 *   --expected-commit=<exact HEAD>
 *   clean worktree
 *   --preflight-pass
 *   matching SQL checksums
 *   --owner-go=COACHING_03_OWNER_GO_APPLY_STAGING
 *   Owner approval evidence approved=true / productionAllowed=false
 *   productionAllowed=false
 *
 * Optional: --include-role-grants (requires approval.roleMatrixApproved)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

import {
  COACHING_03_ENVIRONMENT_LABEL,
  COACHING_03_EVIDENCE_DIR,
  COACHING_03_OWNER_GO_TOKEN,
  COACHING_03_ROLE_GRANT_FORWARD_RELATIVE_PATH,
  COACHING_03_STAGING_PROJECT_REF,
  COACHING_03_VERDICTS,
  evaluateCoaching03ApplyGuards,
  getCoaching03RepoRoot,
  loadCoaching03MigrationManifest,
  loadCoaching03OwnerApprovalEvidence,
  loadCoaching03StagingEnv,
  redactSecrets,
  sha256File,
  verifyCoaching03MigrationManifest,
} from "../../src/features/coaching/staging/index.js";
import { resolveStagingEvidenceDir } from "../shared/resolve-staging-evidence-dir.mjs";

function parseArgs(argv) {
  const args = {
    execute: false,
    environment: null,
    projectRef: null,
    expectedCommit: null,
    ownerGo: null,
    preflightPass: false,
    productionAllowed: false,
    includeRoleGrants: false,
  };
  for (const raw of argv) {
    if (raw === "--execute") args.execute = true;
    else if (raw.startsWith("--environment=")) {
      args.environment = String(raw.slice("--environment=".length)).toLowerCase();
    } else if (raw.startsWith("--project-ref=")) {
      args.projectRef = String(raw.slice("--project-ref=".length)).trim();
    } else if (raw.startsWith("--expected-commit=")) {
      args.expectedCommit = String(raw.slice("--expected-commit=".length)).trim();
    } else if (raw.startsWith("--owner-go=")) {
      args.ownerGo = String(raw.slice("--owner-go=".length)).trim();
    } else if (raw === "--preflight-pass") args.preflightPass = true;
    else if (raw === "--production-allowed") args.productionAllowed = true;
    else if (raw === "--include-role-grants") args.includeRoleGrants = true;
  }
  return args;
}

function writeEvidence(repoRoot, filename, payload) {
  const dir = resolveStagingEvidenceDir({
    repoRoot,
    canonicalRelativeDir: COACHING_03_EVIDENCE_DIR,
  });
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

async function executeStagingSql(accessToken, sql, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${COACHING_03_STAGING_PROJECT_REF}/database/query`,
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
    throw new Error(`${label}: ${redactSecrets(String(msg))}`);
  }
  return { ok: true, label };
}

async function main() {
  const repoRoot = getCoaching03RepoRoot();
  loadCoaching03StagingEnv({ repoRoot });
  const args = parseArgs(process.argv.slice(2));
  const manifest = loadCoaching03MigrationManifest(repoRoot);
  const verify = verifyCoaching03MigrationManifest({ repoRoot, manifest });
  const approvalLoaded = loadCoaching03OwnerApprovalEvidence(repoRoot);

  const gates = evaluateCoaching03ApplyGuards({
    execute: args.execute,
    environment: args.environment || COACHING_03_ENVIRONMENT_LABEL,
    projectRef: args.projectRef,
    expectedCommit: args.expectedCommit,
    ownerGoToken: args.ownerGo,
    preflightPass: args.preflightPass,
    productionAllowed: args.productionAllowed,
    includeRoleGrants: args.includeRoleGrants,
    requireApprovalEvidence: args.execute === true,
    repoRoot,
    requireCleanWorktree: true,
    env: process.env,
  });

  console.log(`APPLY_MODE=${gates.applyMode}`);

  if (!args.execute || gates.applyMode === "REFUSED" || !gates.canWrite) {
    const report = {
      phase: "COACHING-03",
      script: "coaching-03-staging-apply",
      APPLY_MODE: "REFUSED",
      ok: verify.ok,
      canWrite: false,
      verdict: gates.verdict,
      actualGitHead: gates.actualGitHead || gates.headSha,
      commitMismatchReasons: gates.commitMismatchReasons || [],
      sqlApplied: false,
      databaseWrites: 0,
      stagingConnected: false,
      productionConnected: false,
      ownerGoRequired: COACHING_03_OWNER_GO_TOKEN,
      ownerGoGranted: false,
      blockers: gates.blockers,
      approvalEvidenceOk: approvalLoaded.ok,
      manifestOk: verify.ok,
      manifestErrors: verify.errors || [],
      migrationsWouldApply: (manifest.migrations || [])
        .filter((m) => m.classification === "forward")
        .map((m) => ({
          order: m.order,
          path: m.path,
          sha256: m.sha256,
          checkpoint: m.checkpoint,
        })),
      transactionModel: manifest.transactionModel,
      secretsPrinted: false,
      finishedAt: new Date().toISOString(),
    };
    writeEvidence(repoRoot, "APPLY_REFUSED.json", report);
    console.log(JSON.stringify(report, null, 2));
    process.exit(args.execute ? 1 : 0);
  }

  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    const blocked = {
      phase: "COACHING-03",
      APPLY_MODE: "REFUSED",
      ok: false,
      verdict: COACHING_03_VERDICTS.APPLY_REFUSED,
      message: "SUPABASE_ACCESS_TOKEN required for live apply.",
      sqlApplied: false,
      databaseWrites: 0,
      secretsPrinted: false,
    };
    writeEvidence(repoRoot, "APPLY_GATE_REFUSAL.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exit(1);
  }

  const forward = [...manifest.migrations]
    .filter((m) => m.classification === "forward")
    .sort((a, b) => Number(a.order) - Number(b.order));

  /** @type {Array<object>} */
  const applied = [];
  const startedAt = new Date().toISOString();
  try {
    for (const entry of forward) {
      const abs = path.join(repoRoot, entry.path);
      const actual = sha256File(abs);
      if (actual !== String(entry.sha256).toLowerCase()) {
        throw new Error(`Checksum drift before apply: ${entry.path}`);
      }
      const sql = readFileSync(abs, "utf8");
      const stepStarted = new Date().toISOString();
      await executeStagingSql(accessToken, sql, entry.path);
      applied.push({
        order: entry.order,
        path: entry.path,
        checkpoint: entry.checkpoint,
        sha256: entry.sha256,
        ok: true,
        startedAt: stepStarted,
        finishedAt: new Date().toISOString(),
      });
    }

    if (args.includeRoleGrants) {
      const roleAbs = path.join(
        repoRoot,
        COACHING_03_ROLE_GRANT_FORWARD_RELATIVE_PATH
      );
      const roleSql = readFileSync(roleAbs, "utf8");
      if (/SELECT\s+'COACH'/i.test(roleSql) && /INSERT INTO public\.role_permissions/i.test(roleSql)) {
        // Defense: refuse if proposal unexpectedly grants COACH.
        if (/INSERT INTO public\.role_permissions[\s\S]*SELECT\s+'COACH'/i.test(roleSql)) {
          throw new Error("Role grant SQL unexpectedly assigns COACH — refused.");
        }
      }
      const stepStarted = new Date().toISOString();
      await executeStagingSql(
        accessToken,
        roleSql,
        COACHING_03_ROLE_GRANT_FORWARD_RELATIVE_PATH
      );
      applied.push({
        order: 70,
        path: COACHING_03_ROLE_GRANT_FORWARD_RELATIVE_PATH,
        checkpoint: "after-role-grants",
        ok: true,
        startedAt: stepStarted,
        finishedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    const failed = {
      phase: "COACHING-03",
      APPLY_MODE: "PARTIAL_OR_FAILED",
      ok: false,
      verdict: COACHING_03_VERDICTS.APPLY_BLOCKED,
      sqlApplied: applied.length > 0,
      databaseWrites: applied.length,
      applied,
      lastCheckpoint:
        applied.length > 0 ? applied[applied.length - 1].checkpoint : "before-any-write",
      error: redactSecrets(err?.message || String(err)),
      automaticRollback: false,
      message:
        "Stopped on first error. Owner must decide rollback per 05_COACHING_03_ROLLBACK_AND_RECOVERY.md",
      secretsPrinted: false,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
    writeEvidence(repoRoot, "APPLY_FAILURE.json", failed);
    console.log(JSON.stringify(failed, null, 2));
    process.exit(1);
  }

  const success = {
    phase: "COACHING-03",
    APPLY_MODE: "EXECUTED",
    ok: true,
    verdict: "COACHING_03_STAGING_FORWARD_APPLIED",
    stagingProjectRef: COACHING_03_STAGING_PROJECT_REF,
    productionConnected: false,
    sqlApplied: true,
    databaseWrites: applied.length,
    applied,
    roleGrantsApplied: args.includeRoleGrants === true,
    includeRoleGrantsRequested: args.includeRoleGrants,
    coachGrantsApplied: false,
    playerGrantsApplied: false,
    secretsPrinted: false,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
  writeEvidence(repoRoot, "APPLY_SUCCESS.json", success);
  console.log(JSON.stringify(success, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        APPLY_MODE: "REFUSED",
        ok: false,
        error: redactSecrets(err?.message || String(err)),
        sqlApplied: false,
        databaseWrites: 0,
        secretsPrinted: false,
      },
      null,
      2
    )
  );
  process.exit(1);
});
