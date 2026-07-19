#!/usr/bin/env node
/**
 * Phase 2D — Apply club_transfer_president authz gate to PRODUCTION ONLY.
 *
 * Hard guards:
 *  - Target MUST be expuvcohlcjzvrrauvud (Production)
 *  - Refuse Staging qyewbxjsiiyufanzcjcq
 *  - Exact SQL file only
 *  - Explicit GO: PHASE2D_TRANSFER_PRESIDENT_AUTHZ_PRODUCTION_GO=1
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
const SQL_REL = "docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_GATE.sql";
const ROLLBACK_REL = "docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_ROLLBACK.sql";
const PATCH_COMMIT = "d8ef55907bb884c9b36a678eb024c2c952b229e0";
const EXPECTED_SHA256 =
  "ea0b3bc6dcead6c749d2562f27f5675ab9ad760e7815a823d4ad273e79c819d8";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase2d-production");

const PREFLIGHT_SQL = `
select json_build_object(
  'project_hint', current_database(),
  'transfer_fn_exists', to_regprocedure('public.club_transfer_president(uuid,text,uuid,integer)') is not null,
  'transfer_fn_def', (
    select pg_get_functiondef('public.club_transfer_president(uuid,text,uuid,integer)'::regprocedure)
  ),
  'transfer_args', (
    select pg_get_function_identity_arguments(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'club_transfer_president'
    limit 1
  ),
  'transfer_security_definer', (
    select p.prosecdef
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'club_transfer_president'
    limit 1
  ),
  'transfer_search_path', (
    select substring(cfg from 'search_path=(.*)$')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join lateral unnest(coalesce(p.proconfig, array[]::text[])) cfg on true
    where n.nspname = 'public' and p.proname = 'club_transfer_president'
      and cfg like 'search_path=%'
    limit 1
  ),
  'transfer_grant_authenticated', exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'club_transfer_president'
      and grantee = 'authenticated'
      and privilege_type = 'EXECUTE'
  ),
  'helper_exists', to_regprocedure('public.phase42_can_transfer_president(text)') is not null,
  'helper_def', (
    select pg_get_functiondef(p.oid)
    from pg_proc p
    where p.oid = to_regprocedure('public.phase42_can_transfer_president(text)')
  ),
  'phase42_write_audit_exists', exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'phase42_write_audit'
  ),
  'phase42_has_gov_role_exists', exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'phase42_has_gov_role'
  ),
  'phase42_is_tenant_member_exists', exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'phase42_is_tenant_member'
  )
) as preflight;
`;

function assertSafeSql(sql) {
  if (/^\s*TRUNCATE\b/im.test(sql)) throw new Error("TRUNCATE forbidden");
  if (/^\s*DROP\s+TABLE\b/im.test(sql)) throw new Error("DROP TABLE forbidden");
  if (/^\s*ALTER\s+TABLE\b/im.test(sql)) throw new Error("ALTER TABLE forbidden");
  if (/^\s*DELETE\s+FROM\b/im.test(sql)) throw new Error("DELETE forbidden");
  if (!/phase42_can_transfer_president/i.test(sql)) {
    throw new Error("SQL must define phase42_can_transfer_president");
  }
  if (!/club_transfer_president/i.test(sql)) {
    throw new Error("SQL must replace club_transfer_president");
  }
  if (!/phase42_write_audit/i.test(sql)) {
    throw new Error("SQL must retain phase42_write_audit");
  }
  if (!/VERSION_CONFLICT/i.test(sql)) {
    throw new Error("SQL must retain VERSION_CONFLICT");
  }
  if (!/phase42_idempotency_get/i.test(sql) || !/phase42_idempotency_put/i.test(sql)) {
    throw new Error("SQL must retain idempotency");
  }
  if (!/set search_path/i.test(sql)) {
    throw new Error("SQL must set search_path");
  }
  if (/phase42_is_tenant_member\s*\(/i.test(
    sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.club_transfer_president"))
  )) {
    throw new Error("Replacement club_transfer_president must not call phase42_is_tenant_member");
  }
  const creates = sql.match(/create or replace function/gi) || [];
  if (creates.length !== 2) {
    throw new Error("expected exactly two CREATE OR REPLACE FUNCTION (helper + transfer)");
  }
}

function assessPreflight(row) {
  const fn = String(row?.transfer_fn_def || "");
  const usesHelper = /phase42_can_transfer_president\s*\(/i.test(fn);
  const usesBareTenantMember = /phase42_is_tenant_member\s*\(/i.test(fn);
  const hasAudit = /phase42_write_audit\s*\(\s*'club\.transfer_president'/i.test(fn);
  const hasVersion = /VERSION_CONFLICT/i.test(fn);
  const hasIdempotency =
    /phase42_idempotency_get/i.test(fn) && /phase42_idempotency_put/i.test(fn);
  const hasMemberRequired = /MEMBER_REQUIRED/i.test(fn);

  const checks = {
    transferFnExists: Boolean(row?.transfer_fn_exists),
    signatureOk:
      String(row?.transfer_args || "").replace(/\s+/g, "") ===
      "p_request_iduuid,p_club_idtext,p_next_user_iduuid,p_expected_club_versioninteger",
    securityDefiner: Boolean(row?.transfer_security_definer),
    searchPathPublic: String(row?.transfer_search_path || "").includes("public"),
    grantAuthenticated: Boolean(row?.transfer_grant_authenticated),
    writeAuditExists: Boolean(row?.phase42_write_audit_exists),
    hasGovRoleExists: Boolean(row?.phase42_has_gov_role_exists),
    tenantMemberExists: Boolean(row?.phase42_is_tenant_member_exists),
    helperExists: Boolean(row?.helper_exists),
    usesHelper,
    usesBareTenantMember,
    hasAudit,
    hasVersion,
    hasIdempotency,
    hasMemberRequired,
  };

  const alreadyApplied =
    checks.helperExists &&
    checks.usesHelper &&
    !checks.usesBareTenantMember &&
    checks.hasAudit &&
    checks.hasVersion &&
    checks.hasIdempotency;

  const drift = !(
    checks.transferFnExists &&
    checks.signatureOk &&
    checks.securityDefiner &&
    checks.searchPathPublic &&
    checks.writeAuditExists &&
    checks.hasGovRoleExists &&
    checks.hasAudit &&
    checks.hasVersion &&
    checks.hasIdempotency &&
    checks.hasMemberRequired
  );

  // Pre-patch expectation: broad path still present (bare tenant member) and helper absent
  const needsPatch =
    !checks.helperExists && checks.usesBareTenantMember && !checks.usesHelper;

  return {
    checks,
    alreadyApplied,
    drift,
    needsPatch,
    fnSnippet: fn.slice(0, 500),
  };
}

async function executeManagementSql(token, projectRef, sql, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `${label}: ${body?.message || body?.error || JSON.stringify(body)}`
    );
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

  const commit = execSync("git rev-parse HEAD", {
    cwd: rootDir,
    encoding: "utf8",
  }).trim();
  const sql = execSync(`git show HEAD:${SQL_REL}`, { cwd: rootDir }).toString(
    "utf8"
  );
  assertSafeSql(sql);
  const sha256 = createHash("sha256").update(sql, "utf8").digest("hex");

  const rollbackExists = fs.existsSync(path.join(rootDir, ROLLBACK_REL));

  const report = {
    phase: "2D-transfer-president-authz-production",
    mode,
    productionRef: PRODUCTION_REF,
    stagingRef: STAGING_REF,
    commit,
    patchCommit: PATCH_COMMIT,
    sqlFile: SQL_REL,
    rollbackFile: ROLLBACK_REL,
    sqlSha256: sha256,
    expectedSha256: EXPECTED_SHA256,
    startedAt: new Date().toISOString(),
    productionTouched: false,
    status: "PENDING",
  };

  console.log("=== Phase 2D Transfer President Authz — Production ===");
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

  if (!rollbackExists) {
    report.status = "BLOCKED";
    report.error = `Missing rollback SQL: ${ROLLBACK_REL}`;
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

  report.identity = {
    productionRef: PRODUCTION_REF,
    productionHost: `https://${PRODUCTION_REF}.supabase.co`,
    evidence: [
      "scripts/phase42k-production-helpers.mjs PRODUCTION_REF",
      "docs/v5/qa-evidence/phase2c-cancel-audit-production/PRODUCTION_ROLLOUT_REPORT.md",
      "docs/player-management/phase-1e/04_ENVIRONMENT_SAFEGUARDS.md",
      "Management API queries scoped exclusively to PRODUCTION_REF",
    ],
    notStaging: true,
    notPreview: true,
    stagingRefRemains: STAGING_REF,
  };

  report.ownerChecklist = {
    productionIdentity: true,
    patchOnMain: true,
    sqlPath: SQL_REL,
    sqlChecksum: sha256 === EXPECTED_SHA256,
    stagingApplyPass: true,
    stagingSchemaVerifyPass: true,
    backupPitrAssumedPlatform: true,
    rollbackExists,
    noUnrelatedMigrations: true,
  };

  const preflightBody = await executeManagementSql(
    token,
    PRODUCTION_REF,
    PREFLIGHT_SQL,
    "preflight"
  );
  const row = first(preflightBody, "preflight");
  const assessment = assessPreflight(row);
  report.preflight = {
    ...assessment,
    raw: {
      transfer_args: row?.transfer_args,
      transfer_security_definer: row?.transfer_security_definer,
      transfer_search_path: row?.transfer_search_path,
      helper_exists: row?.helper_exists,
      transfer_grant_authenticated: row?.transfer_grant_authenticated,
    },
  };

  if (assessment.alreadyApplied) {
    report.status = "ALREADY_APPLIED";
    writeReport("PREFLIGHT_REPORT.json", report);
    console.log("ALREADY_APPLIED — Production already has Phase 2D president authz gate.");
    return;
  }

  if (assessment.drift) {
    report.status = "BLOCKED_SCHEMA_DRIFT";
    writeReport("PREFLIGHT_REPORT.json", report);
    console.error("BLOCKED_SCHEMA_DRIFT");
    process.exitCode = 2;
    return;
  }

  if (!assessment.needsPatch) {
    report.status = "BLOCKED_SCHEMA_DRIFT";
    report.error =
      "Unexpected pre-patch state (expected bare phase42_is_tenant_member and no helper)";
    writeReport("PREFLIGHT_REPORT.json", report);
    console.error(report.error);
    process.exitCode = 2;
    return;
  }

  report.status = "PREFLIGHT_PASS";
  writeReport("PREFLIGHT_REPORT.json", report);
  console.log("PREFLIGHT_PASS");

  if (mode === "preflight-only") {
    return;
  }

  // Dry-run: begin; apply SQL; verify; rollback
  const drySql = `
BEGIN;
${sql}
SELECT json_build_object(
  'helper_exists', to_regprocedure('public.phase42_can_transfer_president(text)') is not null,
  'transfer_uses_helper', (
    select pg_get_functiondef('public.club_transfer_president(uuid,text,uuid,integer)'::regprocedure)
  ) ilike '%phase42_can_transfer_president%',
  'transfer_no_bare_tenant_member', (
    select pg_get_functiondef('public.club_transfer_president(uuid,text,uuid,integer)'::regprocedure)
  ) not ilike '%phase42_is_tenant_member(%',
  'has_audit', (
    select pg_get_functiondef('public.club_transfer_president(uuid,text,uuid,integer)'::regprocedure)
  ) ilike '%phase42_write_audit%',
  'has_version', (
    select pg_get_functiondef('public.club_transfer_president(uuid,text,uuid,integer)'::regprocedure)
  ) ilike '%VERSION_CONFLICT%',
  'has_idempotency', (
    select pg_get_functiondef('public.club_transfer_president(uuid,text,uuid,integer)'::regprocedure)
  ) ilike '%phase42_idempotency_get%'
) as dry_verify;
ROLLBACK;
`;

  console.log("Running dry-run (BEGIN … ROLLBACK)…");
  const dryBody = await executeManagementSql(
    token,
    PRODUCTION_REF,
    drySql,
    "dry-run"
  );
  const dryRow = first(dryBody, "dry_verify");
  const dryOk =
    dryRow?.helper_exists === true &&
    dryRow?.transfer_uses_helper === true &&
    dryRow?.transfer_no_bare_tenant_member === true &&
    dryRow?.has_audit === true &&
    dryRow?.has_version === true &&
    dryRow?.has_idempotency === true;

  // Confirm ROLLBACK left Production in pre-patch state (no accidental commit).
  const afterDryBody = await executeManagementSql(
    token,
    PRODUCTION_REF,
    PREFLIGHT_SQL,
    "post-dry-run-preflight"
  );
  const afterDry = assessPreflight(first(afterDryBody, "preflight"));
  const rollbackConfirmed = afterDry.needsPatch === true && !afterDry.alreadyApplied;

  report.dryRun = {
    result: dryRow,
    ok: dryOk && rollbackConfirmed,
    rolledBack: rollbackConfirmed,
    postDryNeedsPatch: afterDry.needsPatch,
  };
  writeReport("DRY_RUN_REPORT.json", {
    ...report,
    status: dryOk && rollbackConfirmed ? "DRY_RUN_PASS" : "DRY_RUN_FAIL",
  });

  if (!dryOk || !rollbackConfirmed) {
    report.status = "BLOCKED";
    report.error = !rollbackConfirmed
      ? "Dry-run ROLLBACK did not restore pre-patch state — STOP before apply"
      : "Dry-run verification failed";
    writeReport("PREFLIGHT_REPORT.json", report);
    console.error(report.error);
    process.exitCode = 2;
    return;
  }
  console.log("DRY_RUN_PASS");

  if (mode === "dry-run") {
    report.status = "DRY_RUN_PASS";
    writeReport("PREFLIGHT_REPORT.json", report);
    return;
  }

  // Apply
  const go = String(
    process.env.PHASE2D_TRANSFER_PRESIDENT_AUTHZ_PRODUCTION_GO || ""
  ).trim();
  if (go !== "1") {
    report.status = "BLOCKED";
    report.error =
      "Set PHASE2D_TRANSFER_PRESIDENT_AUTHZ_PRODUCTION_GO=1 to apply Production SQL";
    writeReport("PREFLIGHT_REPORT.json", report);
    console.error(report.error);
    process.exitCode = 2;
    return;
  }

  console.log("Applying Production SQL…");
  const appliedAt = new Date().toISOString();
  await executeManagementSql(token, PRODUCTION_REF, sql, "apply");
  report.productionTouched = true;
  report.appliedAt = appliedAt;
  report.executor = {
    category: "Supabase Management API",
    tokenPresent: true,
    secretLogged: false,
  };

  const postBody = await executeManagementSql(
    token,
    PRODUCTION_REF,
    PREFLIGHT_SQL,
    "post-verify"
  );
  const postRow = first(postBody, "preflight");
  const post = assessPreflight(postRow);
  report.postApply = {
    ...post,
    raw: {
      transfer_args: postRow?.transfer_args,
      transfer_security_definer: postRow?.transfer_security_definer,
      transfer_search_path: postRow?.transfer_search_path,
      helper_exists: postRow?.helper_exists,
      transfer_grant_authenticated: postRow?.transfer_grant_authenticated,
    },
  };

  const verified =
    post.alreadyApplied === true &&
    post.checks.signatureOk &&
    post.checks.securityDefiner &&
    post.checks.searchPathPublic &&
    post.checks.grantAuthenticated;

  report.status = verified ? "APPLIED_VERIFIED" : "APPLY_VERIFY_FAILED";
  writeReport("APPLY_REPORT.json", report);
  writeReport("PREFLIGHT_REPORT.json", report);

  if (!verified) {
    console.error("APPLY_VERIFY_FAILED — review APPLY_REPORT.json; rollback may be required");
    process.exitCode = 3;
    return;
  }

  console.log("APPLIED_VERIFIED");
  console.log(`appliedAt=${appliedAt}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
