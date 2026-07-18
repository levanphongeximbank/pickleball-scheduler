#!/usr/bin/env node
/**
 * Phase 1B — Apply Club V2 command SQL to PRODUCTION.
 *
 * Requires explicit Owner GO:
 *   PHASE1B_PRODUCTION_GO=1
 *   APPROVED_MAIN_SHA=959c8067ea756aa32e50b549a97cd4e762786ff7
 *   SUPABASE_ACCESS_TOKEN
 *
 * Hard guards:
 *  - Target MUST be expuvcohlcjzvrrauvud
 *  - Refuse Staging ref
 *  - Stop on first SQL error
 *  - No truncate / DROP TABLE / audit DELETE
 *  - No RLS disable
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";
import {
  assessAuditPreflight,
  PHASE_1B_KNOWN_AUDIT_ACTIONS,
  LEGACY_FIXED_45A3C_AUDIT_ACTIONS,
} from "./apply-phase1b-staging-sql.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const APPROVED_MAIN_SHA = "959c8067ea756aa32e50b549a97cd4e762786ff7";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase1b-production");

const SQL_FILES = [
  "docs/v5/phase1b/PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql",
  "docs/v5/phase45a3c/PHASE_45A3C_CLUB_UPDATE_RPC.sql",
  "docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql",
  "docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql",
  "docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql",
  "docs/v5/phase1b/PHASE_1B_CLUB_UPDATE_AUTHZ_SECURITY_GATE.sql",
];

const PREFLIGHT_SQL = `
select json_build_object(
  'constraint_def', (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'audit_logs'
      and c.conname = 'audit_logs_action_check'
  ),
  'distinct_actions', (
    select coalesce(json_agg(json_build_object('action', s.action, 'row_count', s.row_count) order by s.action), '[]'::json)
    from (
      select action, count(*)::bigint as row_count
      from public.audit_logs where action is not null group by action
    ) s
  ),
  'rls_enabled', (
    select coalesce(json_agg(json_build_object(
      'table', c.relname, 'rls_enabled', c.relrowsecurity
    ) order by c.relname), '[]'::json)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('clubs','club_members','club_governance_assignments','audit_logs')
  )
) as preflight;
`;

const VERIFY_SQL = `
select json_build_object(
  'functions', (
    select coalesce(json_agg(json_build_object(
      'proname', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'security_definer', p.prosecdef,
      'search_path', (
        select substring(cfg from 'search_path=(.*)$')
        from unnest(coalesce(p.proconfig, array[]::text[])) cfg
        where cfg like 'search_path=%' limit 1
      )
    ) order by p.proname), '[]'::json)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'club_update','phase42_can_update_club',
        'club_add_member','club_remove_member','club_restore_member',
        'club_assign_vice_president','club_clear_vice_president',
        'phase42_can_manage_vice_presidents','phase42_club_canonical'
      )
  ),
  'audit_actions', (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'audit_logs'
      and c.conname = 'audit_logs_action_check'
  ),
  'canonical_has_vp', (
    select bool_or(pg_get_functiondef(p.oid) ilike '%vice_president_user_ids%')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'phase42_club_canonical'
  ),
  'vp_auth_uses_narrow_helper', (
    select bool_and(
      pg_get_functiondef(p.oid) ilike '%phase42_can_manage_vice_presidents%'
      and pg_get_functiondef(p.oid) not ilike '%phase42_is_tenant_member%'
    )
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('club_assign_vice_president','club_clear_vice_president')
  ),
  'club_update_uses_narrow_helper', (
    select pg_get_functiondef(p.oid) ilike '%phase42_can_update_club%'
      and pg_get_functiondef(p.oid) not ilike '%phase42_is_tenant_member%'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'club_update'
    limit 1
  ),
  'helpers_exist', json_build_object(
    'phase42_can_update_club', to_regprocedure('public.phase42_can_update_club(text)') is not null
      or exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='phase42_can_update_club'),
    'phase42_can_manage_vice_presidents', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='phase42_can_manage_vice_presidents'
    ),
    'club_clear_vice_president', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='club_clear_vice_president'
    )
  ),
  'rls_still_enabled', (
    select bool_and(c.relrowsecurity)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('clubs','club_members','club_governance_assignments','audit_logs')
  )
) as verify;
`;

function assertSafeSql(sql, file) {
  if (/^\s*TRUNCATE\b/im.test(sql)) throw new Error(`${file}: TRUNCATE forbidden`);
  if (/^\s*DROP\s+TABLE\b/im.test(sql)) throw new Error(`${file}: DROP TABLE forbidden`);
  if (/^\s*DELETE\s+FROM\s+public\.audit_logs\b/im.test(sql)) {
    throw new Error(`${file}: audit_logs DELETE forbidden`);
  }
  if (/disable\s+row\s+level\s+security/i.test(sql)) {
    throw new Error(`${file}: DISABLE RLS forbidden`);
  }
  if (file === "docs/v5/phase1b/PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql") {
    if (!/select\s+distinct\s+action/i.test(sql) || !/\bunion\b/i.test(sql)) {
      throw new Error(`${file}: must UNION DISTINCT audit_logs.action`);
    }
    return;
  }
  if (
    /add constraint\s+audit_logs_action_check/i.test(sql) &&
    /check\s*\(\s*action\s+in\s*\(/i.test(sql)
  ) {
    throw new Error(`${file}: fixed audit IN-list forbidden`);
  }
}

async function executeProductionSql(token, sql, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PRODUCTION_REF}/database/query`,
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
    const msg = body?.message || body?.error || JSON.stringify(body) || res.statusText;
    throw new Error(`${label}: ${msg}`);
  }
  return body;
}

async function main() {
  loadProjectEnv();
  fs.mkdirSync(outDir, { recursive: true });

  const go = String(process.env.PHASE1B_PRODUCTION_GO || "").trim() === "1";
  const approved = String(process.env.APPROVED_MAIN_SHA || APPROVED_MAIN_SHA).trim();
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const originMain = execSync("git rev-parse origin/main", { cwd: rootDir, encoding: "utf8" }).trim();

  const report = {
    phase: "1B",
    kind: "PRODUCTION_SQL_APPLY",
    productionRef: PRODUCTION_REF,
    stagingRef: STAGING_REF,
    approvedMainSha: APPROVED_MAIN_SHA,
    originMainSha: originMain,
    startedAt: new Date().toISOString(),
    preflight: null,
    files: [],
    verify: null,
    status: "PENDING",
    productionSqlApplied: false,
  };

  console.log("=== Phase 1B PRODUCTION SQL Apply ===");
  console.log(`PRODUCTION: ${PRODUCTION_REF}`);
  console.log(`STAGING (must not use): ${STAGING_REF}`);
  console.log(`APPROVED SHA: ${APPROVED_MAIN_SHA}`);
  console.log(`origin/main: ${originMain}`);

  if (!go) {
    report.status = "BLOCKED_NO_GO";
    report.error = "Set PHASE1B_PRODUCTION_GO=1";
    fs.writeFileSync(path.join(outDir, "APPLY_REPORT.json"), JSON.stringify(report, null, 2));
    console.error("BLOCKED — PHASE1B_PRODUCTION_GO=1 required");
    process.exitCode = 2;
    return;
  }
  if (approved !== APPROVED_MAIN_SHA) {
    report.status = "BLOCKED_SHA_MISMATCH";
    report.error = `APPROVED_MAIN_SHA must be ${APPROVED_MAIN_SHA}`;
    fs.writeFileSync(path.join(outDir, "APPLY_REPORT.json"), JSON.stringify(report, null, 2));
    console.error(report.error);
    process.exitCode = 2;
    return;
  }
  if (originMain !== APPROVED_MAIN_SHA) {
    report.status = "BLOCKED_ORIGIN_MAIN_DRIFT";
    report.error = `origin/main ${originMain} != approved ${APPROVED_MAIN_SHA}`;
    fs.writeFileSync(path.join(outDir, "APPLY_REPORT.json"), JSON.stringify(report, null, 2));
    console.error(report.error);
    process.exitCode = 2;
    return;
  }
  if (!token) {
    report.status = "BLOCKED_NO_TOKEN";
    fs.writeFileSync(path.join(outDir, "APPLY_REPORT.json"), JSON.stringify(report, null, 2));
    console.error("BLOCKED — SUPABASE_ACCESS_TOKEN missing");
    process.exitCode = 2;
    return;
  }

  let exitCode = 0;
  try {
    console.log("\n--- Preflight ---");
    const preBody = await executeProductionSql(token, PREFLIGHT_SQL, "preflight");
    const pre = Array.isArray(preBody) ? preBody[0]?.preflight : preBody?.preflight;
    const assessment = assessAuditPreflight({
      constraintDef: pre?.constraint_def,
      distinctActions: pre?.distinct_actions || [],
      knownActions: PHASE_1B_KNOWN_AUDIT_ACTIONS,
      fixedLegacyActions: LEGACY_FIXED_45A3C_AUDIT_ACTIONS,
    });
    report.preflight = { ...assessment, rls_enabled: pre?.rls_enabled || [] };
    console.log(`  additive safe: ${assessment.safeToApplyAdditive}`);
    console.log(`  incompatible additive: ${assessment.incompatibleHistoricalValues.length}`);

    if (!assessment.safeToApplyAdditive || assessment.block) {
      report.status = "BLOCKED_AUDIT_PREFLIGHT";
      report.error = assessment.blockReason || "Additive audit preflight failed";
      fs.writeFileSync(path.join(outDir, "APPLY_REPORT.json"), JSON.stringify(report, null, 2));
      console.error(`BLOCKED — ${report.error}`);
      exitCode = 3;
      return;
    }

    for (let i = 0; i < SQL_FILES.length; i += 1) {
      const file = SQL_FILES[i];
      const fullPath = path.join(rootDir, file);
      const sql = fs.readFileSync(fullPath, "utf8");
      assertSafeSql(sql, file);
      const checksum = createHash("sha256").update(sql, "utf8").digest("hex");
      const entry = {
        order: i + 1,
        file,
        checksum,
        startedAt: new Date().toISOString(),
        result: null,
        error: null,
      };
      console.log(`\n[${i + 1}/${SQL_FILES.length}] ${file}`);
      try {
        await executeProductionSql(token, sql, file);
        entry.result = "PASS";
        entry.finishedAt = new Date().toISOString();
        report.files.push(entry);
        report.productionSqlApplied = true;
        console.log("  PASS");
      } catch (err) {
        entry.result = "FAIL";
        entry.error = String(err.message || err);
        entry.finishedAt = new Date().toISOString();
        report.files.push(entry);
        report.status = "FAILED";
        report.finishedAt = new Date().toISOString();
        fs.writeFileSync(path.join(outDir, "APPLY_REPORT.json"), JSON.stringify(report, null, 2));
        console.error(`  FAIL — ${entry.error}`);
        console.error("STOP — no further SQL applied.");
        exitCode = 1;
        return;
      }
    }

    console.log("\n--- Catalog verification ---");
    const verifyBody = await executeProductionSql(token, VERIFY_SQL, "verify");
    const verify = Array.isArray(verifyBody) ? verifyBody[0]?.verify : verifyBody?.verify;
    report.verify = verify;

    const ok =
      verify?.helpers_exist?.phase42_can_update_club &&
      verify?.helpers_exist?.phase42_can_manage_vice_presidents &&
      verify?.helpers_exist?.club_clear_vice_president &&
      verify?.club_update_uses_narrow_helper === true &&
      verify?.vp_auth_uses_narrow_helper === true &&
      verify?.canonical_has_vp === true &&
      verify?.rls_still_enabled === true;

    if (!ok) {
      report.status = "VERIFY_FAILED";
      report.verifyOk = false;
      report.finishedAt = new Date().toISOString();
      fs.writeFileSync(path.join(outDir, "APPLY_REPORT.json"), JSON.stringify(report, null, 2));
      console.error("VERIFY FAIL:", JSON.stringify(verify, null, 2));
      exitCode = 1;
      return;
    }

    report.verifyOk = true;
    report.status = "APPLIED_AND_VERIFIED";
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, "APPLY_REPORT.json"), JSON.stringify(report, null, 2));
    console.log("  VERIFY PASS");
    console.log(`\nReport: docs/v5/qa-evidence/phase1b-production/APPLY_REPORT.json`);
    console.log(`Status: ${report.status}`);
  } catch (err) {
    report.status = "ERROR";
    report.error = String(err?.message || err);
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, "APPLY_REPORT.json"), JSON.stringify(report, null, 2));
    console.error(err);
    exitCode = 1;
  } finally {
    process.exitCode = exitCode;
  }
}

main();
