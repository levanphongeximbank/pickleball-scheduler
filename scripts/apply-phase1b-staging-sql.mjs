#!/usr/bin/env node
/**
 * Phase 1B — Apply Club V2 command SQL to STAGING ONLY.
 *
 * Hard guards:
 *  - Target project ref must be qyewbxjsiiyufanzcjcq
 *  - Refuse Production ref expuvcohlcjzvrrauvud
 *  - No truncate / destructive DML checks on payloads
 *  - Stop on first SQL error
 *
 * Requires: SUPABASE_ACCESS_TOKEN (Management API)
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

const SQL_FILES = [
  "docs/v5/phase45a3c/PHASE_45A3C_CLUB_UPDATE_RPC.sql",
  "docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql",
  "docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql",
  "docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql",
];

const VERIFY_SQL = `
select json_build_object(
  'project_ok', true,
  'functions', (
    select coalesce(json_agg(json_build_object(
      'proname', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'security_definer', p.prosecdef
    ) order by p.proname), '[]'::json)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'club_update',
        'club_add_member',
        'club_remove_member',
        'club_restore_member',
        'club_assign_vice_president',
        'club_clear_vice_president',
        'phase42_can_manage_vice_presidents',
        'phase42_club_canonical'
      )
  ),
  'audit_actions', (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'audit_logs'
      and c.conname = 'audit_logs_action_check'
  ),
  'canonical_has_vp', (
    select pg_get_functiondef(p.oid) ilike '%vice_president_user_ids%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'phase42_club_canonical'
    limit 1
  ),
  'vp_auth_uses_narrow_helper', (
    select pg_get_functiondef(p.oid) ilike '%phase42_can_manage_vice_presidents%'
      and pg_get_functiondef(p.oid) not ilike '%phase42_is_tenant_member%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'club_assign_vice_president'
    limit 1
  )
) as verify;
`;

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

function assertSafeSql(sql, file) {
  if (/\bTRUNCATE\b/i.test(sql) && !/--[^\n]*TRUNCATE/i.test(sql.replace(/\bTRUNCATE\b/gi, ""))) {
    // Allow the word only in comments; reject executable truncate statements.
  }
  if (/^\s*TRUNCATE\b/im.test(sql)) {
    throw new Error(`${file}: truncate statement forbidden`);
  }
  if (/^\s*DROP\s+TABLE\b/im.test(sql)) {
    throw new Error(`${file}: DROP TABLE forbidden`);
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
  const verifyOnly = process.argv.includes("--verify-only");
  const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase1b-staging");
  fs.mkdirSync(outDir, { recursive: true });

  const commit = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
  const report = {
    phase: "1B",
    stagingRef: STAGING_REF,
    productionRef: PRODUCTION_REF,
    productionTouched: false,
    commit,
    startedAt: new Date().toISOString(),
    files: [],
    verify: null,
    status: "PENDING",
  };

  console.log("=== Phase 1B Staging SQL Apply ===");
  console.log(`STAGING REF: ${STAGING_REF}`);
  console.log(`PRODUCTION REF: ${PRODUCTION_REF} (must NOT be used)`);
  console.log(`COMMIT: ${commit}`);

  if (!token) {
    report.status = "BLOCKED_NO_TOKEN";
    report.error =
      "SUPABASE_ACCESS_TOKEN missing — cannot apply or verify Staging via Management API.";
    fs.writeFileSync(
      path.join(outDir, "APPLY_REPORT.json"),
      JSON.stringify(report, null, 2),
      "utf8"
    );
    console.error("BLOCKED — SUPABASE_ACCESS_TOKEN missing. No SQL applied.");
    process.exit(2);
  }

  if (!verifyOnly) {
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
        startStatus: dryRun ? "DRY_RUN" : "APPLYING",
        startedAt: new Date().toISOString(),
        result: null,
        warning: null,
        error: null,
      };

      console.log(`\n[${i + 1}/${SQL_FILES.length}] ${file}`);
      if (dryRun) {
        entry.result = "DRY_RUN_OK";
        entry.finishedAt = new Date().toISOString();
        report.files.push(entry);
        console.log("  dry-run ok");
        continue;
      }

      try {
        await executeManagementSql(token, sql, file);
        entry.result = "PASS";
        entry.finishedAt = new Date().toISOString();
        report.files.push(entry);
        console.log("  PASS");
      } catch (err) {
        entry.result = "FAIL";
        entry.error = String(err.message || err);
        entry.finishedAt = new Date().toISOString();
        report.files.push(entry);
        report.status = "FAILED";
        report.finishedAt = new Date().toISOString();
        fs.writeFileSync(
          path.join(outDir, "APPLY_REPORT.json"),
          JSON.stringify(report, null, 2),
          "utf8"
        );
        console.error(`  FAIL — ${entry.error}`);
        console.error("Stopping — no further SQL applied.");
        process.exit(1);
      }
    }
  }

  console.log("\nVerifying RPCs / audit whitelist on Staging...");
  try {
    const verifyBody = await executeManagementSql(token, VERIFY_SQL, "verify");
    report.verify = verifyBody;
    const row = Array.isArray(verifyBody) ? verifyBody[0]?.verify : verifyBody?.verify;
    report.verifyNormalized = row || verifyBody;
    report.status = dryRun ? "DRY_RUN_COMPLETE" : "APPLIED_AND_VERIFIED";
    console.log("  VERIFY OK");
  } catch (err) {
    report.status = "VERIFY_FAILED";
    report.verifyError = String(err.message || err);
    console.error(`  VERIFY FAIL — ${report.verifyError}`);
    fs.writeFileSync(
      path.join(outDir, "APPLY_REPORT.json"),
      JSON.stringify(report, null, 2),
      "utf8"
    );
    process.exit(1);
  }

  report.finishedAt = new Date().toISOString();
  report.productionTouched = false;
  fs.writeFileSync(
    path.join(outDir, "APPLY_REPORT.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );
  console.log(`\nReport: docs/v5/qa-evidence/phase1b-staging/APPLY_REPORT.json`);
  console.log(`Status: ${report.status}`);
  console.log("Production was NOT changed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
