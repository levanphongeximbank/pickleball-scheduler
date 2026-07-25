#!/usr/bin/env node
/**
 * PM-ID-01 — Guarded Staging apply runner.
 *
 * DEFAULT: APPLY_MODE=REFUSED (no database connection, no writes).
 *
 * Live execute (future only) requires ALL of:
 *   --execute
 *   --environment=staging
 *   --project-ref=qyewbxjsiiyufanzcjcq
 *   --expected-commit=<exact full 40-char HEAD SHA>
 *   --owner-approved-commit=<exact full 40-char HEAD SHA>
 *   --owner-go=PM_ID_01_OWNER_GO_APPLY_STAGING
 *   --preflight-pass
 *   clean worktree
 *   matching SQL manifest hashes
 *
 * Owner GO is NOT granted in this package step.
 * Never auto-applies. Never runs rollback automatically.
 * Never touches Production. Never deletes files.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PM_ID_01_APPLY_EXECUTION_ORDER,
  PM_ID_01_ENVIRONMENT_LABEL,
  PM_ID_01_EVIDENCE_DIR,
  PM_ID_01_FORWARD_SQL_ORDER,
  PM_ID_01_OWNER_GO_TOKEN,
  PM_ID_01_STAGING_PROJECT_REF,
  PM_ID_01_VERDICTS,
  evaluatePmId01ApplyGuards,
  getPmId01RepoRoot,
  loadPmId01MigrationManifest,
  sha256File,
  verifyPmId01MigrationManifest,
} from "./pm-id-01-activation-lib.mjs";

function parseArgs(argv) {
  const args = {
    execute: false,
    environment: null,
    projectRef: null,
    expectedCommit: null,
    ownerApprovedCommit: null,
    ownerGo: null,
    preflightPass: false,
    productionAllowed: false,
  };
  for (const raw of argv) {
    if (raw === "--execute" || raw === "--apply" || raw === "--apply-staging") {
      args.execute = true;
    } else if (raw.startsWith("--environment=")) {
      args.environment = String(raw.slice("--environment=".length)).toLowerCase();
    } else if (raw.startsWith("--project-ref=")) {
      args.projectRef = String(raw.slice("--project-ref=".length)).trim();
    } else if (raw.startsWith("--expected-commit=")) {
      args.expectedCommit = String(raw.slice("--expected-commit=".length)).trim();
    } else if (raw.startsWith("--owner-approved-commit=")) {
      args.ownerApprovedCommit = String(
        raw.slice("--owner-approved-commit=".length)
      ).trim();
    } else if (raw.startsWith("--owner-go=")) {
      args.ownerGo = String(raw.slice("--owner-go=".length)).trim();
    } else if (raw === "--preflight-pass") args.preflightPass = true;
    else if (raw === "--production-allowed") args.productionAllowed = true;
  }
  return args;
}

function writeEvidence(repoRoot, filename, payload) {
  const dir = path.join(repoRoot, PM_ID_01_EVIDENCE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

function baseSafety(extra = {}) {
  return {
    phase: "PM-ID-01-GUARDED-STAGING-APPLY",
    script: "pm-id-01-staging-apply",
    ownerGoRequired: PM_ID_01_OWNER_GO_TOKEN,
    stagingProjectRefExpected: PM_ID_01_STAGING_PROJECT_REF,
    databaseConnectionOpened: false,
    databaseWrites: 0,
    sqlApplied: false,
    mappingRowsCreated: 0,
    backfillExecuted: false,
    roleGrantsApplied: false,
    productionTouched: false,
    filesDeleted: false,
    CODEX_DELETE_ALLOWED: "NO",
    automaticRollback: false,
    coachingChanges: false,
    secretsPrinted: false,
    ...extra,
  };
}

async function executeStagingSql(accessToken, sql, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PM_ID_01_STAGING_PROJECT_REF}/database/query`,
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
    const msg = body?.message || body?.error || `HTTP ${res.status}`;
    throw new Error(`${label}: ${String(msg)}`);
  }
  return { ok: true, label };
}

async function main() {
  const repoRoot = getPmId01RepoRoot(import.meta.url);
  const args = parseArgs(process.argv.slice(2));
  const manifest = loadPmId01MigrationManifest(repoRoot);
  const verify = verifyPmId01MigrationManifest({ repoRoot, manifest });

  const gates = evaluatePmId01ApplyGuards({
    execute: args.execute,
    environment: args.environment || PM_ID_01_ENVIRONMENT_LABEL,
    projectRef: args.projectRef,
    expectedCommit: args.expectedCommit,
    ownerApprovedCommit: args.ownerApprovedCommit,
    ownerGoToken: args.ownerGo,
    preflightPass: args.preflightPass,
    productionAllowed: args.productionAllowed,
    requireApprovalEvidence: args.execute === true,
    repoRoot,
    requireCleanWorktree: true,
    env: process.env,
  });

  console.log(`APPLY_MODE=${gates.applyMode}`);

  if (!args.execute || gates.applyMode === "REFUSED" || !gates.canWrite) {
    const report = baseSafety({
      APPLY_MODE: "REFUSED",
      ok: verify.ok,
      canWrite: false,
      verdict: gates.ownerGoGranted
        ? gates.verdict
        : PM_ID_01_VERDICTS.APPLY_REFUSED_OWNER_GO_NOT_GRANTED,
      ownerGoGranted: false,
      actualGitHead: gates.actualGitHead || gates.headSha,
      commitMismatchReasons: gates.commitMismatchReasons || [],
      blockers: gates.blockers,
      manifestOk: verify.ok,
      manifestErrors: verify.errors || [],
      combinedManifestHash: verify.combinedManifestHash || manifest.combinedManifestHash,
      aggregateSha256Forward:
        verify.aggregateSha256Forward || manifest.aggregateSha256Forward,
      migrationsWouldApply: PM_ID_01_APPLY_EXECUTION_ORDER.map((p, idx) => ({
        order: idx + 1,
        path: p,
      })),
      forwardOnly: [...PM_ID_01_FORWARD_SQL_ORDER],
      rollbackAutoExecute: false,
      finishedAt: new Date().toISOString(),
    });
    writeEvidence(repoRoot, "APPLY_REFUSED_NO_GO.json", report);
    console.log(JSON.stringify(report, null, 2));
    process.exit(args.execute ? 1 : 0);
    return;
  }

  // Beyond this point requires Owner GO — not granted in current authorization.
  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    const blocked = baseSafety({
      APPLY_MODE: "REFUSED",
      ok: false,
      verdict: PM_ID_01_VERDICTS.APPLY_BLOCKED,
      message: "SUPABASE_ACCESS_TOKEN required for live apply.",
      ownerGoGranted: true,
    });
    writeEvidence(repoRoot, "APPLY_GATE_REFUSAL.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exit(1);
    return;
  }

  const forward = [...manifest.migrations]
    .filter((m) => m.classification === "forward")
    .sort((a, b) => Number(a.order) - Number(b.order));
  const verification = manifest.migrations.find(
    (m) => m.classification === "verification"
  );

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

    if (verification) {
      const abs = path.join(repoRoot, verification.path);
      const sql = readFileSync(abs, "utf8");
      const stepStarted = new Date().toISOString();
      await executeStagingSql(accessToken, sql, verification.path);
      applied.push({
        order: verification.order,
        path: verification.path,
        checkpoint: verification.checkpoint || "after-verification",
        sha256: verification.sha256,
        ok: true,
        startedAt: stepStarted,
        finishedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    const failed = baseSafety({
      APPLY_MODE: "PARTIAL_OR_FAILED",
      ok: false,
      verdict: PM_ID_01_VERDICTS.APPLY_BLOCKED,
      databaseConnectionOpened: true,
      sqlApplied: applied.length > 0,
      databaseWrites: applied.length,
      applied,
      lastCheckpoint:
        applied.length > 0
          ? applied[applied.length - 1].checkpoint
          : "before-any-write",
      error: String(err?.message || err),
      automaticRollback: false,
      message:
        "Stopped on first error. Owner must decide rollback separately. No automatic rollback.",
      ownerGoGranted: true,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
    writeEvidence(repoRoot, "APPLY_FAILURE.json", failed);
    console.log(JSON.stringify(failed, null, 2));
    process.exit(1);
    return;
  }

  const success = baseSafety({
    APPLY_MODE: "EXECUTED",
    ok: true,
    verdict: "PM_ID_01_STAGING_FORWARD_APPLIED",
    stagingProjectRef: PM_ID_01_STAGING_PROJECT_REF,
    databaseConnectionOpened: true,
    sqlApplied: true,
    databaseWrites: applied.length,
    mappingRowsCreated: 0,
    backfillExecuted: false,
    roleGrantsApplied: false,
    applied,
    ownerGoGranted: true,
    startedAt,
    finishedAt: new Date().toISOString(),
  });
  writeEvidence(repoRoot, "APPLY_SUCCESS.json", success);
  console.log(JSON.stringify(success, null, 2));
  process.exit(0);
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((err) => {
    console.error(
      JSON.stringify(
        baseSafety({
          APPLY_MODE: "REFUSED",
          ok: false,
          verdict: PM_ID_01_VERDICTS.APPLY_REFUSED,
          error: String(err?.message || err),
          ownerGoGranted: false,
        }),
        null,
        2
      )
    );
    process.exit(1);
  });
}
