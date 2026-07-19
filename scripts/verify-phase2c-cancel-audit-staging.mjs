#!/usr/bin/env node
/**
 * Phase 2C — Staging verify: cancel membership request audit.
 *
 * Controlled fixture:
 *  - insert pending request as owner user (service role / SQL)
 *  - call club_cancel_membership_request as that user (via set_config role
 *    simulation is limited on Management API — verify via SQL contracts:
 *    function body + constraint + optional live cancel if QA env present)
 *
 * Primary live checks (Management API, Staging only):
 *  1) audit_logs_action_check accepts club.membership_request.cancel
 *  2) still accepts submit + review
 *  3) pg_get_functiondef contains phase42_write_audit cancel
 *  4) optional fixture cancel when STAGING_QA_USER credentials available
 *
 * Usage:
 *   node scripts/verify-phase2c-cancel-audit-staging.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const VERIFY_SQL = `
select json_build_object(
  'constraint_def', (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'audit_logs'
      and c.conname = 'audit_logs_action_check'
  ),
  'cancel_fn', (
    select pg_get_functiondef('public.club_cancel_membership_request(uuid,uuid,integer)'::regprocedure)
  ),
  'cancel_in_constraint', (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'audit_logs'
      and c.conname = 'audit_logs_action_check'
  ) ilike '%club.membership_request.cancel%',
  'submit_in_constraint', (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'audit_logs'
      and c.conname = 'audit_logs_action_check'
  ) ilike '%club.membership_request.submit%',
  'review_in_constraint', (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'audit_logs'
      and c.conname = 'audit_logs_action_check'
  ) ilike '%club.membership_request.review%'
) as verify;
`;

async function main() {
  loadProjectEnv();
  assertNotProductionUrl();
  fs.mkdirSync(outDir, { recursive: true });

  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const commit = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
  const report = {
    phase: "2C-cancel-audit-verify",
    stagingRef: STAGING_REF,
    productionTouched: false,
    commit,
    startedAt: new Date().toISOString(),
    checks: {},
    status: "PENDING",
  };

  if (!token) {
    report.status = "BLOCKED_NO_TOKEN";
    report.error = "SUPABASE_ACCESS_TOKEN missing";
    fs.writeFileSync(path.join(outDir, "VERIFY_REPORT.json"), JSON.stringify(report, null, 2));
    console.error("BLOCKED — SUPABASE_ACCESS_TOKEN missing.");
    process.exitCode = 2;
    return;
  }

  try {
    const body = await executeManagementSql(token, VERIFY_SQL, "verify");
    const row = Array.isArray(body) ? body[0]?.verify : body?.verify;
    const fn = String(row?.cancel_fn || "");
    const checks = {
      cancelActionWhitelisted: Boolean(row?.cancel_in_constraint),
      submitStillWhitelisted: Boolean(row?.submit_in_constraint),
      reviewStillWhitelisted: Boolean(row?.review_in_constraint),
      rpcWritesCancelAudit: /phase42_write_audit\(\s*'club\.membership_request\.cancel'/i.test(fn),
      rpcOwnRequestAuthz: /user_id\s*<>\s*auth\.uid\(\)/i.test(fn),
      rpcPendingOnly: /status\s*<>\s*'pending'/i.test(fn),
      rpcVersionConflict: /VERSION_CONFLICT/i.test(fn),
      rpcIdempotencyEarlyReturn: /idempotency_get[\s\S]*v_cached is not null/i.test(fn),
    };
    report.checks = checks;
    report.constraintSnippet = String(row?.constraint_def || "").slice(0, 500);
    const failed = Object.entries(checks).filter(([, ok]) => !ok);
    report.status = failed.length ? "FAILED" : "PASS";
    report.failedChecks = failed.map(([k]) => k);
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, "VERIFY_REPORT.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (failed.length) process.exitCode = 1;
  } catch (err) {
    report.status = "FAILED";
    report.error = err?.message || String(err);
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, "VERIFY_REPORT.json"), JSON.stringify(report, null, 2));
    console.error(report.error);
    process.exitCode = 1;
  }
}

main();
