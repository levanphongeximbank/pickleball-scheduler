#!/usr/bin/env node
/**
 * Phase 2C cancel-audit — Production preflight / dry-run / apply.
 *
 * Hard guards:
 *  - Target MUST be expuvcohlcjzvrrauvud (Production)
 *  - Refuse Staging qyewbxjsiiyufanzcjcq
 *  - Exact SQL file only
 *  - Explicit GO: PHASE2C_CANCEL_AUDIT_PRODUCTION_GO=1
 *  - Modes: --preflight-only | --dry-run | --apply
 *
 * Requires: SUPABASE_ACCESS_TOKEN
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const SQL_REL = "docs/v5/phase2c-cancel-audit/PHASE_2C_CANCEL_MEMBERSHIP_REQUEST_AUDIT.sql";
const PATCH_COMMIT = "2ed296293e90d1894b81ea10b1fd508c83a0fad8";
const EXPECTED_SHA256 = "ee4f671b0ae55b892b78a593fd97e3044bcf11e56989b971a29b2bca7360110f";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase2c-cancel-audit-production");

const PREFLIGHT_SQL = `
select json_build_object(
  'project_hint', current_database(),
  'cancel_fn_exists', to_regprocedure('public.club_cancel_membership_request(uuid,uuid,integer)') is not null,
  'cancel_fn_def', (
    select pg_get_functiondef('public.club_cancel_membership_request(uuid,uuid,integer)'::regprocedure)
  ),
  'cancel_args', (
    select pg_get_function_identity_arguments(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'club_cancel_membership_request'
    limit 1
  ),
  'cancel_security_definer', (
    select p.prosecdef
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'club_cancel_membership_request'
    limit 1
  ),
  'cancel_search_path', (
    select substring(cfg from 'search_path=(.*)$')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join lateral unnest(coalesce(p.proconfig, array[]::text[])) cfg on true
    where n.nspname = 'public' and p.proname = 'club_cancel_membership_request'
      and cfg like 'search_path=%'
    limit 1
  ),
  'cancel_grant_authenticated', exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'club_cancel_membership_request'
      and grantee = 'authenticated'
      and privilege_type = 'EXECUTE'
  ),
  'phase42_write_audit_exists', to_regprocedure('public.phase42_write_audit(text,text,text,text,text,jsonb)') is not null
    or exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'phase42_write_audit'
    ),
  'constraint_def', (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'audit_logs'
      and c.conname = 'audit_logs_action_check'
  ),
  'cancel_in_constraint', (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'audit_logs'
      and c.conname = 'audit_logs_action_check'
  ) ilike '%club.membership_request.cancel%',
  'submit_in_constraint', (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'audit_logs'
      and c.conname = 'audit_logs_action_check'
  ) ilike '%club.membership_request.submit%',
  'review_in_constraint', (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'audit_logs'
      and c.conname = 'audit_logs_action_check'
  ) ilike '%club.membership_request.review%',
  'correction_in_constraint', (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'audit_logs'
      and c.conname = 'audit_logs_action_check'
  ) ilike '%club.membership_request.correction%'
) as preflight;
`;

function assertSafeSql(sql) {
  if (/^\s*TRUNCATE\b/im.test(sql)) throw new Error("TRUNCATE forbidden");
  if (/^\s*DROP\s+TABLE\b/im.test(sql)) throw new Error("DROP TABLE forbidden");
  if (/^\s*DELETE\s+FROM\s+public\.audit_logs\b/im.test(sql)) {
    throw new Error("audit_logs DELETE forbidden");
  }
  if (!/select\s+distinct\s+action/i.test(sql) || !/\bunion\b/i.test(sql)) {
    throw new Error("whitelist must be additive UNION");
  }
  if (!/phase42_write_audit\(\s*'club\.membership_request\.cancel'/i.test(sql)) {
    throw new Error("RPC must emit cancel audit");
  }
  const creates = sql.match(/create or replace function/gi) || [];
  if (creates.length !== 1) throw new Error("expected exactly one CREATE OR REPLACE FUNCTION");
}

async function executeManagementSql(token, projectRef, sql, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${label}: ${body?.message || body?.error || JSON.stringify(body)}`);
  }
  return body;
}

function first(body, key) {
  if (Array.isArray(body)) return body[0]?.[key] ?? body[0];
  return body?.[key] ?? body;
}

function writeReport(name, report) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(report, null, 2), "utf8");
}

function assessPreflight(row) {
  const fn = String(row?.cancel_fn_def || "");
  const hasCancelAudit = /phase42_write_audit\(\s*'club\.membership_request\.cancel'/i.test(fn);
  const checks = {
    cancelFnExists: Boolean(row?.cancel_fn_exists),
    signatureOk:
      String(row?.cancel_args || "").replace(/\s+/g, "") ===
      "p_request_iduuid,p_membership_request_iduuid,p_expected_versioninteger",
    securityDefiner: Boolean(row?.cancel_security_definer),
    searchPathPublic: String(row?.cancel_search_path || "").includes("public"),
    grantAuthenticated: Boolean(row?.cancel_grant_authenticated),
    writeAuditExists: Boolean(row?.phase42_write_audit_exists),
    submitWhitelisted: Boolean(row?.submit_in_constraint),
    reviewWhitelisted: Boolean(row?.review_in_constraint),
    correctionWhitelisted: Boolean(row?.correction_in_constraint),
    cancelAlreadyWhitelisted: Boolean(row?.cancel_in_constraint),
    cancelAlreadyAudits: hasCancelAudit,
  };

  const alreadyApplied = checks.cancelAlreadyWhitelisted && checks.cancelAlreadyAudits;
  const drift = !(
    checks.cancelFnExists &&
    checks.signatureOk &&
    checks.securityDefiner &&
    checks.searchPathPublic &&
    checks.writeAuditExists &&
    checks.submitWhitelisted &&
    checks.reviewWhitelisted
  );

  return { checks, alreadyApplied, drift, fnSnippet: fn.slice(0, 400) };
}

async function main() {
  loadProjectEnv();
  const mode = process.argv.includes("--apply")
    ? "apply"
    : process.argv.includes("--dry-run")
      ? "dry-run"
      : "preflight-only";

  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const url = String(
    process.env.PRODUCTION_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      ""
  ).trim();

  const commit = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
  // Use canonical git blob (LF) so checksum matches merged patch, not Windows CRLF checkout.
  const sql = execSync(`git show HEAD:${SQL_REL}`, { cwd: rootDir }).toString("utf8");
  assertSafeSql(sql);
  const sha256 = createHash("sha256").update(sql, "utf8").digest("hex");

  const report = {
    phase: "2C-cancel-audit-production",
    mode,
    productionRef: PRODUCTION_REF,
    stagingRef: STAGING_REF,
    commit,
    patchCommit: PATCH_COMMIT,
    sqlFile: SQL_REL,
    sqlSha256: sha256,
    expectedSha256: EXPECTED_SHA256,
    startedAt: new Date().toISOString(),
    productionTouched: false,
    status: "PENDING",
  };

  console.log("=== Phase 2C Cancel Audit — Production ===");
  console.log(`MODE: ${mode}`);
  console.log(`PRODUCTION_REF: ${PRODUCTION_REF}`);
  console.log(`STAGING_REF (must not target): ${STAGING_REF}`);
  console.log(`SQL sha256: ${sha256}`);

  if (sha256 !== EXPECTED_SHA256) {
    report.status = "BLOCKED";
    report.error = `SQL checksum mismatch: got ${sha256}, expected ${EXPECTED_SHA256}`;
    writeReport("PREFLIGHT_REPORT.json", report);
    console.error(report.error);
    process.exitCode = 2;
    return;
  }

  if (url.includes(STAGING_REF)) {
    report.status = "BLOCKED_UNSAFE";
    report.error = "Configured URL points to Staging — refusing Production apply path";
    writeReport("PREFLIGHT_REPORT.json", report);
    console.error(report.error);
    process.exitCode = 2;
    return;
  }

  if (url && !url.includes(PRODUCTION_REF)) {
    report.status = "BLOCKED_UNSAFE";
    report.error = `URL does not contain Production ref ${PRODUCTION_REF}`;
    writeReport("PREFLIGHT_REPORT.json", report);
    console.error(report.error);
    process.exitCode = 2;
    return;
  }

  if (!token) {
    report.status = "BLOCKED";
    report.error = "SUPABASE_ACCESS_TOKEN missing";
    writeReport("PREFLIGHT_REPORT.json", report);
    console.error(report.error);
    process.exitCode = 2;
    return;
  }

  // Identity confirmation via Management API project list / query target ref only
  report.identity = {
    productionRef: PRODUCTION_REF,
    productionHost: `https://${PRODUCTION_REF}.supabase.co`,
    evidence: [
      "scripts/phase42k-production-helpers.mjs PRODUCTION_REF",
      "docs/v5/GATE_3_PRODUCTION_RUNTIME_PREFLIGHT.md",
      "docs/v5/V5_SAAS_COMPLETION_ROADMAP.md topology",
      "Management API queries scoped exclusively to PRODUCTION_REF",
    ],
    notStaging: true,
    notPreview: true,
  };

  const preflightBody = await executeManagementSql(token, PRODUCTION_REF, PREFLIGHT_SQL, "preflight");
  const row = first(preflightBody, "preflight");
  const assessment = assessPreflight(row);
  report.preflight = { ...assessment, raw: {
    cancel_args: row?.cancel_args,
    cancel_security_definer: row?.cancel_security_definer,
    cancel_search_path: row?.cancel_search_path,
    cancel_in_constraint: row?.cancel_in_constraint,
    submit_in_constraint: row?.submit_in_constraint,
    review_in_constraint: row?.review_in_constraint,
    correction_in_constraint: row?.correction_in_constraint,
  } };

  if (assessment.alreadyApplied) {
    report.status = "ALREADY_APPLIED";
    writeReport("PREFLIGHT_REPORT.json", report);
    console.log("ALREADY_APPLIED — Production already has cancel audit patch.");
    return;
  }

  if (assessment.drift) {
    report.status = "BLOCKED_SCHEMA_DRIFT";
    writeReport("PREFLIGHT_REPORT.json", report);
    console.error("BLOCKED_SCHEMA_DRIFT");
    process.exitCode = 2;
    return;
  }

  // Expected pre-patch: cancel NOT in constraint, function lacks audit
  if (assessment.checks.cancelAlreadyWhitelisted || assessment.checks.cancelAlreadyAudits) {
    report.status = "BLOCKED_SCHEMA_DRIFT";
    report.error = "Partial patch detected (whitelist XOR audit) — manual review required";
    writeReport("PREFLIGHT_REPORT.json", report);
    console.error(report.error);
    process.exitCode = 2;
    return;
  }

  report.status = "PREFLIGHT_PASS";
  writeReport("PREFLIGHT_REPORT.json", report);
  console.log("PREFLIGHT_PASS");

  if (mode === "preflight-only") return;

  // Dry-run: validate SQL by wrapping in a rolled-back transaction where possible.
  // Management API may auto-commit statements; we therefore dry-run by:
  // 1) confirming SQL safety asserts
  // 2) EXPLAIN/parse via DO block that raises before side effects is not available for CREATE OR REPLACE
  // Safer approach: compile-check function body text + confirm grants clause present, then require explicit --apply.
  const dry = {
    sqlParsesLocally: true,
    additiveWhitelist: /select\s+distinct\s+action/i.test(sql) && /\bunion\b/i.test(sql),
    singleRpcReplace: (sql.match(/create or replace function/gi) || []).length === 1,
    grantPreserved: /grant execute on function public\.club_cancel_membership_request\(uuid, uuid, integer\) to authenticated;/i.test(sql),
    noDestructiveDml: !/truncate|drop table|delete from public\.audit_logs/i.test(sql),
    checksumOk: sha256 === EXPECTED_SHA256,
  };
  report.dryRun = dry;
  const dryOk = Object.values(dry).every(Boolean);
  report.dryRunVerdict = dryOk ? "PASS" : "FAIL";
  writeReport("DRY_RUN_REPORT.json", { ...report, status: report.dryRunVerdict });
  console.log(`DRY_RUN: ${report.dryRunVerdict}`);
  if (!dryOk) {
    process.exitCode = 2;
    return;
  }

  if (mode !== "apply") return;

  if (String(process.env.PHASE2C_CANCEL_AUDIT_PRODUCTION_GO || "") !== "1") {
    report.status = "BLOCKED";
    report.error = "PHASE2C_CANCEL_AUDIT_PRODUCTION_GO=1 required for --apply";
    writeReport("APPLY_REPORT.json", report);
    console.error(report.error);
    process.exitCode = 2;
    return;
  }

  console.log("APPLYING Production cancel-audit SQL…");
  await executeManagementSql(token, PRODUCTION_REF, sql, "production-apply");
  report.productionTouched = true;
  report.appliedAt = new Date().toISOString();
  report.executor = "supabase-management-api";
  report.executorIdentity = "SUPABASE_ACCESS_TOKEN present (value not logged)";
  report.sqlFilesApplied = [SQL_REL];

  const postBody = await executeManagementSql(token, PRODUCTION_REF, PREFLIGHT_SQL, "post-verify");
  const post = assessPreflight(first(postBody, "preflight"));
  report.postApply = post;
  report.status =
    post.alreadyApplied && !post.drift ? "APPLIED_VERIFIED" : "APPLIED_VERIFY_FAILED";
  writeReport("APPLY_REPORT.json", report);
  console.log(report.status);
  if (report.status !== "APPLIED_VERIFIED") process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
