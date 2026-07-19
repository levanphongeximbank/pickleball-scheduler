/**
 * Phase 2B — Read-only Production verification for Notification schema.
 *
 * Returns: PASS | BLOCKED_UNSAFE | FAIL
 * Does not crash when objects/columns are missing — reports findings.
 *
 * Default: fixture / static mode (no live DB).
 * Live read-only query only when NOTIFICATION_PHASE2B_PRODUCTION_VERIFY_LIVE=1
 * AND an explicitly approved Production preflight DB URL is present.
 *
 * Usage:
 *   node scripts/verify-notification-phase2b-production.mjs
 *   node scripts/verify-notification-phase2b-production.mjs --fixture
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";
import {
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
  PRODUCTION_RUNTIME_DEFAULTS,
  assertProductionRuntimeConfig,
} from "../src/features/notifications/config/productionSafetyConfig.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_TABLES = [
  "notification_inbox",
  "notification_delivery_jobs",
  "notification_delivery_attempts",
  "notification_runtime_config",
  "notification_worker_runs",
];

const REQUIRED_JOB_COLUMNS = [
  "tenant_id",
  "environment",
  "run_namespace",
  "status",
  "claim_token",
  "lease_expires_at",
  "delivery_idempotency_key",
  "replay_generation",
  "cancel_requested",
];

const REQUIRED_RPCS = [
  "notification_delivery_claim_jobs",
  "notification_delivery_complete_job",
  "notification_delivery_record_attempt",
  "notification_delivery_recover_stale_leases",
  "notification_delivery_replay_job",
  "notification_delivery_cancel_job",
  "notification_qa_cleanup_run_namespace",
  "notification_queue_health",
  "notification_worker_run_start",
  "notification_assert_environment_allowed",
];

const SQL_PACK_FILES = [
  "docs/supabase-notification-phase2b-production-13-foundation.sql",
  "docs/supabase-notification-phase2b-production-13-rpc-hardening.sql",
  "docs/supabase-notification-phase2b-production-15-delivery-worker.sql",
  "docs/supabase-notification-phase2b-production-16-ops.sql",
  "docs/supabase-notification-phase2b-production-runtime-config.sql",
  "docs/supabase-notification-phase2b-production-security-hardening.sql",
  "docs/supabase-notification-phase2b-production-rollback.sql",
];

function addFinding(findings, severity, code, detail = {}) {
  findings.push({ severity, code, ...detail });
}

function verdictFromFindings(findings) {
  if (findings.some((f) => f.severity === "BLOCKED_UNSAFE")) return "BLOCKED_UNSAFE";
  if (findings.some((f) => f.severity === "FAIL")) return "FAIL";
  return "PASS";
}

/**
 * Static / fixture verification — no DB connection.
 * Validates Production SQL pack contents + optional fixture config map.
 */
export function verifyPhase2bProductionFixture(options = {}) {
  const findings = [];

  for (const rel of SQL_PACK_FILES) {
    const filePath = path.join(rootDir, rel);
    if (!fs.existsSync(filePath)) {
      addFinding(findings, "FAIL", "missing_sql_pack_file", { file: rel });
      continue;
    }
    let content = "";
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch (err) {
      addFinding(findings, "FAIL", "unreadable_sql_pack_file", {
        file: rel,
        message: String(err?.message || err),
      });
      continue;
    }

    if (rel.includes("rollback")) {
      if (/DROP TABLE IF EXISTS public\.audit_logs/i.test(content)) {
        addFinding(findings, "BLOCKED_UNSAFE", "rollback_touches_shared_audit", {
          file: rel,
        });
      }
      if (/DROP TABLE IF EXISTS public\.profiles/i.test(content)) {
        addFinding(findings, "BLOCKED_UNSAFE", "rollback_touches_profiles", {
          file: rel,
        });
      }
      continue;
    }

    if (content.includes(STAGING_PROJECT_REF)) {
      addFinding(findings, "BLOCKED_UNSAFE", "staging_ref_in_production_sql", {
        file: rel,
      });
    }
    if (/allow_worker',\s*'true'/i.test(content)) {
      addFinding(findings, "BLOCKED_UNSAFE", "allow_worker_true", { file: rel });
    }
    if (/allow_qa_cleanup',\s*'true'/i.test(content)) {
      addFinding(findings, "BLOCKED_UNSAFE", "allow_qa_cleanup_true", { file: rel });
    }
    if (/environment',\s*'staging'/i.test(content)) {
      addFinding(findings, "BLOCKED_UNSAFE", "staging_environment_seed", {
        file: rel,
      });
    }

    // Schema presence via SQL text (column-aware, no crash)
    if (rel.includes("13-foundation")) {
      for (const table of ["notification_inbox", "notification_delivery_jobs"]) {
        if (!content.includes(`public.${table}`)) {
          addFinding(findings, "FAIL", "missing_table_ddl", { file: rel, table });
        }
      }
    }
    if (rel.includes("15-delivery")) {
      for (const col of ["claim_token", "lease_expires_at", "delivery_idempotency_key"]) {
        if (!content.includes(col)) {
          addFinding(findings, "FAIL", "missing_column_ddl", { file: rel, column: col });
        }
      }
      if (!/SET search_path = public/i.test(content)) {
        addFinding(findings, "FAIL", "missing_search_path", { file: rel });
      }
      if (!/REVOKE ALL ON FUNCTION/i.test(content)) {
        addFinding(findings, "FAIL", "missing_revoke", { file: rel });
      }
    }
    if (rel.includes("16-ops")) {
      for (const rpc of [
        "notification_delivery_replay_job",
        "notification_delivery_cancel_job",
        "notification_queue_health",
      ]) {
        if (!content.includes(rpc)) {
          addFinding(findings, "FAIL", "missing_rpc_ddl", { file: rel, rpc });
        }
      }
      if (!content.includes("production_replay_blocked") && !content.includes("allow_replay")) {
        addFinding(findings, "FAIL", "replay_guard_missing", { file: rel });
      }
    }
  }

  const config = options.runtimeConfig || { ...PRODUCTION_RUNTIME_DEFAULTS };
  const cfg = assertProductionRuntimeConfig(config);
  for (const f of cfg.findings) {
    findings.push(f);
  }

  // Fixture: expected schema inventory (simulates missing objects without crash)
  const presentTables = options.presentTables || REQUIRED_TABLES;
  for (const table of REQUIRED_TABLES) {
    if (!presentTables.includes(table)) {
      addFinding(findings, "FAIL", "missing_table", { table });
    }
  }
  const presentColumns = options.presentJobColumns || REQUIRED_JOB_COLUMNS;
  for (const column of REQUIRED_JOB_COLUMNS) {
    if (!presentColumns.includes(column)) {
      addFinding(findings, "FAIL", "missing_column", {
        table: "notification_delivery_jobs",
        column,
      });
    }
  }
  const presentRpcs = options.presentRpcs || REQUIRED_RPCS;
  for (const rpc of REQUIRED_RPCS) {
    if (!presentRpcs.includes(rpc)) {
      addFinding(findings, "FAIL", "missing_rpc", { rpc });
    }
  }

  if (options.seededStagingNamespace) {
    addFinding(findings, "BLOCKED_UNSAFE", "staging_namespace_present", {
      namespace: options.seededStagingNamespace,
    });
  }
  if (options.qaRecipientsPresent) {
    addFinding(findings, "BLOCKED_UNSAFE", "qa_recipients_present");
  }
  if (options.seededDeliveryJobs) {
    addFinding(findings, "BLOCKED_UNSAFE", "seeded_delivery_jobs_present");
  }

  // Rollback compatibility markers
  const rollbackPath = path.join(
    rootDir,
    "docs/supabase-notification-phase2b-production-rollback.sql"
  );
  if (fs.existsSync(rollbackPath)) {
    const rb = fs.readFileSync(rollbackPath, "utf8");
    if (!/DATA-PRESERVING/i.test(rb)) {
      addFinding(findings, "FAIL", "rollback_missing_data_preserving_mode");
    }
    if (!/DESTRUCTIVE/i.test(rb)) {
      addFinding(findings, "FAIL", "rollback_missing_destructive_docs");
    }
  }

  const verdict = verdictFromFindings(findings);
  return {
    ok: verdict === "PASS",
    verdict,
    findings,
    productionRef: PRODUCTION_PROJECT_REF,
    checks: {
      requiredTables: REQUIRED_TABLES,
      requiredJobColumns: REQUIRED_JOB_COLUMNS,
      requiredRpcs: REQUIRED_RPCS,
      allow_worker: config.allow_worker,
      allow_qa_cleanup: config.allow_qa_cleanup,
      external_providers_enabled: config.external_providers_enabled,
    },
  };
}

async function verifyLiveReadOnly(env) {
  const findings = [];
  const dbUrl = String(env.SUPABASE_DB_URL || env.DATABASE_URL || "").trim();
  if (!dbUrl) {
    addFinding(findings, "FAIL", "live_db_url_missing");
    return { ok: false, verdict: "FAIL", findings, live: true };
  }
  if (!dbUrl.includes(PRODUCTION_PROJECT_REF)) {
    addFinding(findings, "BLOCKED_UNSAFE", "live_url_not_production");
    return { ok: false, verdict: "BLOCKED_UNSAFE", findings, live: true };
  }
  if (dbUrl.includes(STAGING_PROJECT_REF)) {
    addFinding(findings, "BLOCKED_UNSAFE", "live_url_is_staging");
    return { ok: false, verdict: "BLOCKED_UNSAFE", findings, live: true };
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    addFinding(findings, "FAIL", "pg_package_missing");
    return { ok: false, verdict: "FAIL", findings, live: true };
  }

  const client = new pg.default.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
  } catch (err) {
    addFinding(findings, "FAIL", "live_connect_failed", {
      message: String(err?.message || err).slice(0, 120),
    });
    return { ok: false, verdict: "FAIL", findings, live: true };
  }

  try {
    for (const table of REQUIRED_TABLES) {
      const { rows } = await client.query(
        `select to_regclass($1) as reg`,
        [`public.${table}`]
      );
      if (!rows[0]?.reg) {
        addFinding(findings, "FAIL", "missing_table", { table });
      }
    }

    const { rows: cols } = await client.query(
      `select column_name from information_schema.columns
       where table_schema='public' and table_name='notification_delivery_jobs'`
    );
    const colSet = new Set(cols.map((r) => r.column_name));
    for (const column of REQUIRED_JOB_COLUMNS) {
      if (!colSet.has(column)) {
        addFinding(findings, "FAIL", "missing_column", {
          table: "notification_delivery_jobs",
          column,
        });
      }
    }

    const { rows: fns } = await client.query(
      `select p.proname, p.prosecdef,
              (select cfg from unnest(coalesce(p.proconfig, array[]::text[])) cfg
               where cfg like 'search_path=%' limit 1) as search_path
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public' and p.proname = any($1::text[])`,
      [REQUIRED_RPCS]
    );
    const byName = new Map(fns.map((r) => [r.proname, r]));
    for (const rpc of REQUIRED_RPCS) {
      const row = byName.get(rpc);
      if (!row) {
        addFinding(findings, "FAIL", "missing_rpc", { rpc });
        continue;
      }
      if (!row.prosecdef) {
        addFinding(findings, "FAIL", "rpc_not_security_definer", { rpc });
      }
      if (!String(row.search_path || "").includes("public")) {
        addFinding(findings, "FAIL", "rpc_missing_search_path", { rpc });
      }
    }

    let cfgRows = [];
    try {
      const res = await client.query(
        `select key, value from public.notification_runtime_config`
      );
      cfgRows = res.rows;
    } catch {
      addFinding(findings, "FAIL", "missing_table", {
        table: "notification_runtime_config",
      });
    }
    const config = Object.fromEntries(cfgRows.map((r) => [r.key, r.value]));
    const cfg = assertProductionRuntimeConfig(config);
    findings.push(...cfg.findings);

    const verdict = verdictFromFindings(findings);
    return { ok: verdict === "PASS", verdict, findings, live: true, config };
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  loadProjectEnv();
  const env = globalThis.process?.env || {};
  const live =
    process.argv.includes("--live") ||
    String(env.NOTIFICATION_PHASE2B_PRODUCTION_VERIFY_LIVE || "").trim() === "1";

  console.log("=== Phase 2B — Production Verify ===");
  console.log(`Mode: ${live ? "live-readonly" : "fixture/static"}`);

  let result;
  if (live) {
    // Only when explicitly approved
    if (String(env.NOTIFICATION_PHASE2B_PRODUCTION_PREFLIGHT_APPROVED || "").trim() !== "1") {
      result = {
        ok: false,
        verdict: "BLOCKED_UNSAFE",
        findings: [
          {
            severity: "BLOCKED_UNSAFE",
            code: "live_verify_requires_preflight_approval",
          },
        ],
      };
    } else {
      result = await verifyLiveReadOnly(env);
    }
  } else {
    result = verifyPhase2bProductionFixture();
  }

  console.log(`Verdict: ${result.verdict}`);
  console.log(`Findings: ${result.findings.length}`);
  for (const f of result.findings.slice(0, 50)) {
    console.log(`  [${f.severity}] ${f.code}${f.file ? ` @ ${f.file}` : ""}${f.table ? ` table=${f.table}` : ""}${f.column ? ` col=${f.column}` : ""}${f.rpc ? ` rpc=${f.rpc}` : ""}`);
  }
  if (result.findings.length > 50) {
    console.log(`  ... ${result.findings.length - 50} more`);
  }

  process.exit(result.verdict === "PASS" ? 0 : result.verdict === "BLOCKED_UNSAFE" ? 3 : 1);
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main();
}
