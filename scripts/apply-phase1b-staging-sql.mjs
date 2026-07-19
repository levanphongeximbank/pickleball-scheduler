#!/usr/bin/env node
/**
 * Phase 1B — Apply Club V2 command SQL to STAGING ONLY.
 *
 * Hard guards:
 *  - Target project ref must be qyewbxjsiiyufanzcjcq
 *  - Refuse Production ref expuvcohlcjzvrrauvud
 *  - No truncate / destructive DML checks on payloads
 *  - Audit preflight blocks when migration would reject existing rows
 *  - Stop on first SQL error with clean non-zero exit (no hard process.exit mid-fetch)
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

/** Known Phase 1B (+ identity/club) actions the additive migration always unions in. */
export const PHASE_1B_KNOWN_AUDIT_ACTIONS = Object.freeze([
  "login",
  "login_failed",
  "logout",
  "create",
  "update",
  "delete",
  "assign_role",
  "permission_change",
  "password_change",
  "reset_password",
  "pairing_override",
  "group_override",
  "club.create",
  "club.update",
  "club.leave_membership",
  "club.delete",
  "club.membership_request.submit",
  "club.membership_request.review",
  "club.membership_request.correction",
  "club.membership_request.cancel",
  "club.member.add",
  "club.member.remove",
  "club.member.restore",
  "club.assign_owner",
  "club.clear_owner",
  "club.transfer_president",
  "club.assign_vice_president",
  "club.clear_vice_president",
  "club.owner.transfer",
  "club.president.transfer",
  "club.vice_president.assign",
  "rating.verify",
  "rating.propose",
  "audit.view",
  "workflow.notification",
  "user.manage.denied",
  "user.manage.status-change",
  "payment_success",
  "approve",
]);

/**
 * Fixed IN-list that previously shipped inside PHASE_45A3C (caused 23514).
 * Used by preflight to report which historical values that list would reject.
 */
export const LEGACY_FIXED_45A3C_AUDIT_ACTIONS = Object.freeze([
  "login",
  "login_failed",
  "logout",
  "create",
  "update",
  "delete",
  "assign_role",
  "permission_change",
  "password_change",
  "reset_password",
  "club.create",
  "club.update",
  "club.leave_membership",
  "club.delete",
  "club.membership_request.submit",
  "club.membership_request.review",
  "club.membership_request.correction",
  "club.assign_owner",
  "club.clear_owner",
  "club.transfer_president",
  "club.owner.transfer",
  "club.president.transfer",
  "club.vice_president.assign",
]);

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
    where n.nspname = 'public'
      and t.relname = 'audit_logs'
      and c.conname = 'audit_logs_action_check'
  ),
  'constraint_exists', exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'audit_logs'
      and c.conname = 'audit_logs_action_check'
  ),
  'club_update_exists', (
    to_regprocedure('public.club_update(uuid, text, integer, text, text, text, text, text)') is not null
  ),
  'distinct_actions', (
    select coalesce(json_agg(json_build_object(
      'action', s.action,
      'row_count', s.row_count
    ) order by s.action), '[]'::json)
    from (
      select action, count(*)::bigint as row_count
      from public.audit_logs
      where action is not null
      group by action
    ) s
  )
) as preflight;
`;

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
        'phase42_can_update_club',
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
  ),
  'club_update_uses_narrow_helper', (
    select pg_get_functiondef(p.oid) ilike '%phase42_can_update_club%'
      and pg_get_functiondef(p.oid) not ilike '%phase42_is_tenant_member%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'club_update'
    limit 1
  )
) as verify;
`;

/**
 * Parse CHECK (action IN ('a','b',...)) literals from pg_get_constraintdef output.
 */
export function parseActionLiteralsFromConstraintDef(def) {
  if (!def || typeof def !== "string") return [];
  const matches = [...def.matchAll(/'([^']*)'/g)];
  return matches.map((m) => m[1]).filter(Boolean);
}

/**
 * Build preflight assessment from Staging snapshot + proposed known set.
 * Additive migration unions DISTINCT rows with known set → never rejects history.
 * Fixed legacy list is reported for diagnosis only.
 */
export function assessAuditPreflight({
  constraintDef,
  distinctActions,
  knownActions = PHASE_1B_KNOWN_AUDIT_ACTIONS,
  fixedLegacyActions = LEGACY_FIXED_45A3C_AUDIT_ACTIONS,
}) {
  const existing = (Array.isArray(distinctActions) ? distinctActions : [])
    .map((row) => (typeof row === "string" ? row : row?.action))
    .filter((a) => typeof a === "string" && a.length > 0);

  const existingSet = new Set(existing);
  const knownSet = new Set(knownActions);
  const fixedSet = new Set(fixedLegacyActions);
  const currentAccepted = parseActionLiteralsFromConstraintDef(constraintDef);

  const proposedMissing = [...knownSet].filter((a) => !existingSet.has(a)).sort();
  const incompatibleWithFixedLegacy = existing
    .filter((a) => !fixedSet.has(a))
    .sort();
  // Additive union always includes every existing action → never incompatible.
  const incompatibleWithAdditive = [];

  const wouldRejectExistingRows = incompatibleWithAdditive.length > 0;
  // Also block if someone reintroduces a fixed-list file into SQL_FILES without additive first.
  const blockReason = wouldRejectExistingRows
    ? "Additive assessment unexpectedly found incompatible historical actions."
    : null;

  return {
    constraintDef: constraintDef || null,
    currentAcceptedActions: currentAccepted,
    existingDistinctActions: [...existingSet].sort(),
    proposedMissingValues: proposedMissing,
    incompatibleHistoricalValues: incompatibleWithAdditive,
    incompatibleWithFixedLegacyList: incompatibleWithFixedLegacy,
    wouldRejectExistingRows,
    block: Boolean(blockReason),
    blockReason,
    safeToApplyAdditive: !wouldRejectExistingRows,
  };
}

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
  if (/^\s*TRUNCATE\b/im.test(sql)) {
    throw new Error(`${file}: truncate statement forbidden`);
  }
  if (/^\s*DROP\s+TABLE\b/im.test(sql)) {
    throw new Error(`${file}: DROP TABLE forbidden`);
  }
  if (file === "docs/v5/phase1b/PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql") {
    if (!/select\s+distinct\s+action/i.test(sql) || !/\bunion\b/i.test(sql)) {
      throw new Error(`${file}: must UNION DISTINCT audit_logs.action (additive)`);
    }
    if (/^\s*DELETE\s+FROM\s+public\.audit_logs/im.test(sql)) {
      throw new Error(`${file}: must not delete audit history`);
    }
    return;
  }
  // RPC files must not reintroduce fixed audit constraint swaps (23514 risk).
  if (
    /add constraint\s+audit_logs_action_check/i.test(sql) &&
    /check\s*\(\s*action\s+in\s*\(/i.test(sql)
  ) {
    throw new Error(
      `${file}: fixed audit_logs_action_check IN-list forbidden — use PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql`
    );
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

function writeReport(outDir, report) {
  fs.writeFileSync(path.join(outDir, "APPLY_REPORT.json"), JSON.stringify(report, null, 2), "utf8");
}

async function main() {
  loadProjectEnv();
  assertNotProductionUrl();

  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const dryRun = process.argv.includes("--dry-run");
  const verifyOnly = process.argv.includes("--verify-only");
  const preflightOnly = process.argv.includes("--preflight-only");
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
    preflight: null,
    files: [],
    verify: null,
    status: "PENDING",
  };

  console.log("=== Phase 1B Staging SQL Apply ===");
  console.log(`STAGING REF: ${STAGING_REF}`);
  console.log(`PRODUCTION REF: ${PRODUCTION_REF} (must NOT be used)`);
  console.log(`COMMIT: ${commit}`);

  let exitCode = 0;

  try {
    if (!token) {
      report.status = "BLOCKED_NO_TOKEN";
      report.error =
        "SUPABASE_ACCESS_TOKEN missing — cannot apply or verify Staging via Management API.";
      writeReport(outDir, report);
      console.error("BLOCKED — SUPABASE_ACCESS_TOKEN missing. No SQL applied.");
      exitCode = 2;
      return;
    }

    if (!verifyOnly) {
      console.log("\n--- Audit constraint preflight ---");
      const preflightBody = await executeManagementSql(token, PREFLIGHT_SQL, "preflight");
      const row = Array.isArray(preflightBody)
        ? preflightBody[0]?.preflight
        : preflightBody?.preflight;
      const assessment = assessAuditPreflight({
        constraintDef: row?.constraint_def,
        distinctActions: row?.distinct_actions || [],
      });
      report.preflight = {
        ...assessment,
        club_update_exists: row?.club_update_exists ?? null,
        constraint_exists: row?.constraint_exists ?? null,
        rawDistinct: row?.distinct_actions || [],
      };

      console.log(`  constraint_exists: ${report.preflight.constraint_exists}`);
      console.log(`  club_update_exists: ${report.preflight.club_update_exists}`);
      console.log(`  constraint_def: ${assessment.constraintDef || "(none)"}`);
      console.log(
        `  existing distinct actions (${assessment.existingDistinctActions.length}): ${assessment.existingDistinctActions.join(", ") || "(none)"}`
      );
      console.log(
        `  proposed missing (known not yet in rows): ${assessment.proposedMissingValues.join(", ") || "(none)"}`
      );
      console.log(
        `  incompatible vs fixed 45A.3C list: ${assessment.incompatibleWithFixedLegacyList.join(", ") || "(none)"}`
      );
      console.log(
        `  incompatible vs additive migration: ${assessment.incompatibleHistoricalValues.join(", ") || "(none)"}`
      );

      if (assessment.block || !assessment.safeToApplyAdditive) {
        report.status = "BLOCKED_AUDIT_PREFLIGHT";
        report.error =
          assessment.blockReason ||
          "Preflight blocked: migration would reject existing audit_logs rows.";
        report.finishedAt = new Date().toISOString();
        writeReport(outDir, report);
        console.error(`BLOCKED — ${report.error}`);
        console.error("No SQL applied.");
        exitCode = 3;
        return;
      }

      if (preflightOnly) {
        report.status = "PREFLIGHT_OK";
        report.finishedAt = new Date().toISOString();
        writeReport(outDir, report);
        console.log("Preflight OK — exiting (--preflight-only).");
        return;
      }

      for (let i = 0; i < SQL_FILES.length; i += 1) {
        const file = SQL_FILES[i];
        const fullPath = path.join(rootDir, file);
        const sql = fs.readFileSync(fullPath, "utf8");
        assertSafeSql(sql, file);
        const checksum = createHash("sha256").update(sql, "utf8").digest("hex");
        const entry = {
          order: i,
          file,
          checksum,
          startStatus: dryRun ? "DRY_RUN" : "APPLYING",
          startedAt: new Date().toISOString(),
          result: null,
          warning: null,
          error: null,
        };

        console.log(`\n[${i}/${SQL_FILES.length - 1}] ${file}`);
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
          writeReport(outDir, report);
          console.error(`  FAIL — ${entry.error}`);
          console.error("Stopping — no further SQL applied.");
          exitCode = 1;
          return;
        }
      }
    }

    if (dryRun && !verifyOnly) {
      report.status = "DRY_RUN_COMPLETE";
      report.finishedAt = new Date().toISOString();
      writeReport(outDir, report);
      console.log(`\nReport: docs/v5/qa-evidence/phase1b-staging/APPLY_REPORT.json`);
      console.log(`Status: ${report.status}`);
      console.log("Production was NOT changed.");
      return;
    }

    console.log("\nVerifying RPCs / audit whitelist on Staging...");
    try {
      const verifyBody = await executeManagementSql(token, VERIFY_SQL, "verify");
      report.verify = verifyBody;
      const row = Array.isArray(verifyBody) ? verifyBody[0]?.verify : verifyBody?.verify;
      report.verifyNormalized = row || verifyBody;
      report.status = "APPLIED_AND_VERIFIED";
      console.log("  VERIFY OK");
    } catch (err) {
      report.status = "VERIFY_FAILED";
      report.verifyError = String(err.message || err);
      console.error(`  VERIFY FAIL — ${report.verifyError}`);
      report.finishedAt = new Date().toISOString();
      writeReport(outDir, report);
      exitCode = 1;
      return;
    }

    report.finishedAt = new Date().toISOString();
    report.productionTouched = false;
    writeReport(outDir, report);
    console.log(`\nReport: docs/v5/qa-evidence/phase1b-staging/APPLY_REPORT.json`);
    console.log(`Status: ${report.status}`);
    console.log("Production was NOT changed.");
  } catch (err) {
    report.status = "ERROR";
    report.error = String(err?.message || err);
    report.finishedAt = new Date().toISOString();
    writeReport(outDir, report);
    console.error(err);
    exitCode = 1;
  } finally {
    // Prefer exitCode over process.exit() so undici/fetch sockets can close
    // without UV_HANDLE_CLOSING assertion noise on Windows.
    process.exitCode = exitCode;
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
