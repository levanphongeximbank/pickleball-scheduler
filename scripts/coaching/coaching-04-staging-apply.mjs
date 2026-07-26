#!/usr/bin/env node
/**
 * COACHING-04 — Guarded Staging apply runner.
 *
 * DEFAULT: APPLY_MODE=REFUSED (no database connection, no writes).
 *
 * Live execute (future only) requires ALL of:
 *   --execute
 *   --environment=staging
 *   --project-ref=qyewbxjsiiyufanzcjcq
 *   --expected-commit=<exact full 40-char HEAD SHA>
 *   --owner-approved-commit=<exact full 40-char HEAD SHA>
 *   --expected-manifest-hash=<exact combinedManifestHash>
 *   --expected-aggregate-sql-hash=<exact aggregateSha256Forward>
 *   --owner-go=COACHING_04_OWNER_GO_APPLY_STAGING
 *   --preflight-pass
 *   clean worktree
 *   matching SQL manifest hashes
 *
 * Owner GO is NOT granted in this package step.
 * Never auto-applies. Never runs rollback automatically.
 * Never creates mapping rows. Never runs backfill.
 * Never activates durable runtime. Never retires localStorage.
 * Never touches Production. Never deletes files.
 * CODEX_DELETE_ALLOWED=NO.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COACHING_04_APPLY_EXECUTION_ORDER,
  COACHING_04_ENVIRONMENT_LABEL,
  COACHING_04_EVIDENCE_DIR,
  COACHING_04_FORWARD_SQL_ORDER,
  COACHING_04_OWNER_GO_TOKEN,
  COACHING_04_PINNED_AGGREGATE_SHA256_FORWARD,
  COACHING_04_PINNED_COMBINED_MANIFEST_HASH,
  COACHING_04_ROLLBACK_SQL_PATH,
  COACHING_04_STAGING_PROJECT_REF,
  COACHING_04_VERDICTS,
  evaluateCoaching04ApplyGuards,
  getCoaching04RepoRoot,
  loadCoaching04MigrationManifest,
  sha256File,
  verifyCoaching04MigrationManifest,
} from "./coaching-04-activation-lib.mjs";
import { resolveStagingEvidenceDir } from "../shared/resolve-staging-evidence-dir.mjs";

function parseArgs(argv) {
  const args = {
    execute: false,
    environment: null,
    projectRef: null,
    expectedCommit: null,
    ownerApprovedCommit: null,
    expectedManifestHash: null,
    expectedAggregateSqlHash: null,
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
    } else if (raw.startsWith("--expected-manifest-hash=")) {
      args.expectedManifestHash = String(
        raw.slice("--expected-manifest-hash=".length)
      ).trim();
    } else if (raw.startsWith("--expected-aggregate-sql-hash=")) {
      args.expectedAggregateSqlHash = String(
        raw.slice("--expected-aggregate-sql-hash=".length)
      ).trim();
    } else if (raw.startsWith("--owner-go=")) {
      args.ownerGo = String(raw.slice("--owner-go=".length)).trim();
    } else if (raw === "--preflight-pass") args.preflightPass = true;
    else if (raw === "--production-allowed") args.productionAllowed = true;
  }
  return args;
}

function writeEvidence(repoRoot, filename, payload) {
  const dir = resolveStagingEvidenceDir({
    repoRoot,
    canonicalRelativeDir: COACHING_04_EVIDENCE_DIR,
  });
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

function baseSafety(extra = {}) {
  return {
    phase: "COACHING-04-GUARDED-STAGING-APPLY",
    script: "coaching-04-staging-apply",
    ownerGoRequired: COACHING_04_OWNER_GO_TOKEN,
    stagingProjectRefExpected: COACHING_04_STAGING_PROJECT_REF,
    targetProject: COACHING_04_STAGING_PROJECT_REF,
    databaseConnectionOpened: false,
    databaseWrites: 0,
    sqlApplied: false,
    mappingRowsCreated: 0,
    backfillExecuted: false,
    runtimeActivated: false,
    localStorageRetired: false,
    roleGrantsApplied: false,
    productionTouched: false,
    filesDeleted: false,
    automaticRetry: false,
    automaticRollback: false,
    CODEX_DELETE_ALLOWED: "NO",
    secretsPrinted: false,
    ...extra,
  };
}

async function executeStagingSql(accessToken, sql, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${COACHING_04_STAGING_PROJECT_REF}/database/query`,
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
  const repoRoot = getCoaching04RepoRoot(import.meta.url);
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const manifest = loadCoaching04MigrationManifest(repoRoot);
  const verify = verifyCoaching04MigrationManifest({ repoRoot, manifest });

  const gates = evaluateCoaching04ApplyGuards({
    execute: args.execute,
    environment: args.environment || COACHING_04_ENVIRONMENT_LABEL,
    projectRef: args.projectRef,
    expectedCommit: args.expectedCommit,
    ownerApprovedCommit: args.ownerApprovedCommit,
    expectedManifestHash: args.expectedManifestHash,
    expectedAggregateSqlHash: args.expectedAggregateSqlHash,
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
        : COACHING_04_VERDICTS.APPLY_REFUSED_OWNER_GO_NOT_GRANTED,
      ownerGoGranted: false,
      executionCommit: gates.actualGitHead || gates.headSha,
      manifestHash:
        verify.combinedManifestHash ||
        manifest.combinedManifestHash ||
        COACHING_04_PINNED_COMBINED_MANIFEST_HASH,
      aggregateSqlHash:
        verify.aggregateSha256Forward ||
        manifest.aggregateSha256Forward ||
        COACHING_04_PINNED_AGGREGATE_SHA256_FORWARD,
      orderedFiles: [...COACHING_04_APPLY_EXECUTION_ORDER],
      forwardOnly: [...COACHING_04_FORWARD_SQL_ORDER],
      rollbackPathExcluded: COACHING_04_ROLLBACK_SQL_PATH,
      rollbackAutoExecute: false,
      appliedFileCount: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
      actualGitHead: gates.actualGitHead || gates.headSha,
      commitMismatchReasons: gates.commitMismatchReasons || [],
      hashMismatchReasons: gates.hashMismatchReasons || [],
      blockers: gates.blockers,
      manifestOk: verify.ok,
      manifestErrors: verify.errors || [],
      migrationsWouldApply: COACHING_04_APPLY_EXECUTION_ORDER.map((p, idx) => ({
        order: idx + 1,
        path: p,
      })),
      verificationRunsOnlyAfterForwardSuccess: true,
      finalVerdict: gates.ownerGoGranted
        ? gates.verdict
        : COACHING_04_VERDICTS.APPLY_REFUSED_OWNER_GO_NOT_GRANTED,
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
      verdict: COACHING_04_VERDICTS.MISSING_CREDENTIALS_REFUSED,
      message: "SUPABASE_ACCESS_TOKEN required for live apply.",
      ownerGoGranted: true,
      executionCommit: gates.actualGitHead,
      manifestHash: verify.combinedManifestHash,
      aggregateSqlHash: verify.aggregateSha256Forward,
      orderedFiles: [...COACHING_04_APPLY_EXECUTION_ORDER],
      appliedFileCount: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
      finalVerdict: COACHING_04_VERDICTS.MISSING_CREDENTIALS_REFUSED,
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
  try {
    for (const entry of forward) {
      const abs = path.join(repoRoot, entry.path);
      const actual = sha256File(abs);
      if (actual !== String(entry.sha256).toLowerCase()) {
        throw new Error(`Checksum drift before apply: ${entry.path}`);
      }
      if (String(entry.path).replace(/\\/g, "/") === COACHING_04_ROLLBACK_SQL_PATH) {
        throw new Error("Rollback SQL unexpectedly in forward plan — refused.");
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

    // Verification runs only after all forward files succeed.
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
      verdict: COACHING_04_VERDICTS.APPLY_BLOCKED,
      databaseConnectionOpened: true,
      sqlApplied: applied.length > 0,
      databaseWrites: applied.length,
      applied,
      appliedFileCount: applied.length,
      lastCheckpoint:
        applied.length > 0
          ? applied[applied.length - 1].checkpoint
          : "before-any-write",
      error: String(err?.message || err),
      automaticRollback: false,
      automaticRetry: false,
      message:
        "Stopped on first error. Owner must decide rollback separately. No automatic rollback. No partial continuation.",
      ownerGoGranted: true,
      executionCommit: gates.actualGitHead,
      manifestHash: verify.combinedManifestHash,
      aggregateSqlHash: verify.aggregateSha256Forward,
      orderedFiles: [...COACHING_04_APPLY_EXECUTION_ORDER],
      startedAt,
      finishedAt: new Date().toISOString(),
      finalVerdict: COACHING_04_VERDICTS.APPLY_BLOCKED,
    });
    writeEvidence(repoRoot, "APPLY_FAILURE.json", failed);
    console.log(JSON.stringify(failed, null, 2));
    process.exit(1);
    return;
  }

  const success = baseSafety({
    APPLY_MODE: "EXECUTED",
    ok: true,
    verdict: "COACHING_04_STAGING_FORWARD_APPLIED",
    stagingProjectRef: COACHING_04_STAGING_PROJECT_REF,
    targetProject: COACHING_04_STAGING_PROJECT_REF,
    databaseConnectionOpened: true,
    sqlApplied: true,
    databaseWrites: applied.length,
    appliedFileCount: applied.length,
    mappingRowsCreated: 0,
    backfillExecuted: false,
    runtimeActivated: false,
    localStorageRetired: false,
    roleGrantsApplied: true,
    applied,
    ownerGoGranted: true,
    executionCommit: gates.actualGitHead,
    manifestHash: verify.combinedManifestHash,
    aggregateSqlHash: verify.aggregateSha256Forward,
    orderedFiles: [...COACHING_04_APPLY_EXECUTION_ORDER],
    startedAt,
    finishedAt: new Date().toISOString(),
    finalVerdict: "COACHING_04_STAGING_FORWARD_APPLIED",
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
          verdict: COACHING_04_VERDICTS.APPLY_REFUSED,
          error: String(err?.message || err),
          ownerGoGranted: false,
          appliedFileCount: 0,
          finalVerdict: COACHING_04_VERDICTS.APPLY_REFUSED,
        }),
        null,
        2
      )
    );
    process.exit(1);
  });
}
