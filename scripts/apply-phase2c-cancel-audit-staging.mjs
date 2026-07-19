#!/usr/bin/env node
/**
 * Phase 2C — Apply cancel membership-request audit SQL to STAGING ONLY.
 *
 * Hard guards:
 *  - Target project ref qyewbxjsiiyufanzcjcq
 *  - Refuse Production ref expuvcohlcjzvrrauvud
 *  - Single SQL file (whitelist + RPC) applied atomically as one query batch
 *
 * Requires: SUPABASE_ACCESS_TOKEN
 *
 * Usage:
 *   node scripts/apply-phase2c-cancel-audit-staging.mjs
 *   node scripts/apply-phase2c-cancel-audit-staging.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL_REL = "docs/v5/phase2c-cancel-audit/PHASE_2C_CANCEL_MEMBERSHIP_REQUEST_AUDIT.sql";
const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase2c-cancel-audit-staging");

function assertNotProductionUrl() {
  const url = String(
    process.env.VITE_SUPABASE_URL ||
      process.env.STAGING_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      ""
  );
  if (url.includes(PRODUCTION_REF)) {
    throw new Error(`REFUSED — URL points to Production ${PRODUCTION_REF}`);
  }
}

function assertSafeSql(sql) {
  if (/^\s*TRUNCATE\b/im.test(sql)) throw new Error("truncate forbidden");
  if (/^\s*DROP\s+TABLE\b/im.test(sql)) throw new Error("DROP TABLE forbidden");
  if (!/club\.membership_request\.cancel/.test(sql)) {
    throw new Error("patch must include club.membership_request.cancel");
  }
  if (!/select\s+distinct\s+action/i.test(sql) || !/\bunion\b/i.test(sql)) {
    throw new Error("whitelist must be additive UNION over audit_logs.action");
  }
  if (!/phase42_write_audit\(\s*'club\.membership_request\.cancel'/i.test(sql)) {
    throw new Error("RPC must call phase42_write_audit for cancel");
  }
}

async function executeManagementSql(token, sql, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.message || body?.error || JSON.stringify(body) || res.statusText;
    throw new Error(`${label}: ${msg}`);
  }
  return body;
}

async function main() {
  loadProjectEnv();
  assertNotProductionUrl();

  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const dryRun = process.argv.includes("--dry-run");
  fs.mkdirSync(outDir, { recursive: true });

  const commit = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
  const sqlPath = path.join(rootDir, SQL_REL);
  const sql = fs.readFileSync(sqlPath, "utf8");
  assertSafeSql(sql);
  const sha256 = createHash("sha256").update(sql).digest("hex");

  const report = {
    phase: "2C-cancel-audit",
    stagingRef: STAGING_REF,
    productionRef: PRODUCTION_REF,
    productionTouched: false,
    commit,
    sqlFile: SQL_REL,
    sqlSha256: sha256,
    startedAt: new Date().toISOString(),
    status: "PENDING",
  };

  console.log("=== Phase 2C Cancel Audit — Staging Apply ===");
  console.log(`STAGING: ${STAGING_REF}`);
  console.log(`PRODUCTION: ${PRODUCTION_REF} (must NOT be used)`);
  console.log(`COMMIT: ${commit}`);
  console.log(`SQL: ${SQL_REL} sha256=${sha256}`);

  if (!token) {
    report.status = "BLOCKED_NO_TOKEN";
    report.error = "SUPABASE_ACCESS_TOKEN missing";
    fs.writeFileSync(path.join(outDir, "APPLY_REPORT.json"), JSON.stringify(report, null, 2));
    console.error("BLOCKED — SUPABASE_ACCESS_TOKEN missing. No SQL applied.");
    process.exitCode = 2;
    return;
  }

  if (dryRun) {
    report.status = "DRY_RUN";
    fs.writeFileSync(path.join(outDir, "APPLY_REPORT.json"), JSON.stringify(report, null, 2));
    console.log("DRY RUN — no SQL applied.");
    return;
  }

  try {
    await executeManagementSql(token, sql, "apply-cancel-audit");
    report.status = "APPLIED";
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, "APPLY_REPORT.json"), JSON.stringify(report, null, 2));
    console.log("APPLIED — Staging cancel audit patch OK.");
  } catch (err) {
    report.status = "FAILED";
    report.error = err?.message || String(err);
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, "APPLY_REPORT.json"), JSON.stringify(report, null, 2));
    console.error("FAILED:", report.error);
    process.exitCode = 1;
  }
}

main();
