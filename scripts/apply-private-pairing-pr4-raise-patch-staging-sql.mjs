/**
 * Private Pairing PR-4 RAISE patch — Supabase **staging** only (qyewbxjsiiyufanzcjcq).
 * Fixes duplicate RAISE MESSAGE options (42601) in trigger functions.
 *
 * Requires: SUPABASE_ACCESS_TOKEN or STAGING_SUPABASE_DB_URL
 *
 * Usage:
 *   node scripts/apply-private-pairing-pr4-raise-patch-staging-sql.mjs
 *   node scripts/apply-private-pairing-pr4-raise-patch-staging-sql.mjs --dry-run
 *
 * Writes:
 *   docs/v5/qa-evidence/phase-private-pairing-staging/STAGING_RAISE_PATCH_APPLY.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const SQL_FILE = "docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4_RAISE_PATCH.sql";
const OUT_PATH = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  "docs/v5/qa-evidence/phase-private-pairing-staging/STAGING_RAISE_PATCH_APPLY.json"
);

function resolveDbUrl() {
  loadProjectEnv();
  return String(
    process.env.STAGING_SUPABASE_DB_URL ||
      process.env.SUPABASE_DB_URL ||
      process.env.DATABASE_URL ||
      ""
  ).trim();
}

function resolveAccessToken() {
  loadProjectEnv();
  return String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
}

function assertStagingDbUrl(url) {
  if (!String(url || "").includes(STAGING_REF)) {
    throw new Error(`DB URL must contain staging ref ${STAGING_REF}`);
  }
  if (String(url || "").includes(PRODUCTION_REF)) {
    throw new Error(`Refusing production ref ${PRODUCTION_REF}`);
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
    const msg = body?.message || body?.error || res.statusText;
    throw new Error(`${label}: ${msg}`);
  }
  return body;
}

async function applyWithManagementApi(token, sql) {
  return executeManagementSql(token, sql, SQL_FILE);
}

async function applyWithPg(connectionString, sql) {
  const pg = await import("pg");
  const client = new pg.default.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const startedAt = new Date().toISOString();
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const filePath = path.join(rootDir, SQL_FILE);

  console.log("=== Private Pairing PR-4 RAISE Patch — Staging Apply ===\n");
  console.log(`Project ref: ${STAGING_REF} (staging only)`);
  console.log(`Production ref ${PRODUCTION_REF}: NOT TOUCHED\n`);

  const dbUrl = resolveDbUrl();
  const accessToken = resolveAccessToken();

  if (!dbUrl && !accessToken) {
    const report = {
      phase: "private-pairing-pr4-raise-patch-staging",
      staging_ref: STAGING_REF,
      production_touched: false,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      sql_file: SQL_FILE,
      mode: null,
      overall: "FAIL",
      error: "Missing STAGING_SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN",
    };
    writeReport(report);
    console.error("❌ Missing STAGING_SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN");
    process.exit(2);
  }

  if (dbUrl) {
    assertStagingDbUrl(dbUrl);
  }

  if (dryRun) {
    console.log("✅ dry-run OK — ready to apply staging RAISE patch.");
    console.log("Mode:", dbUrl ? "postgres" : "management-api");
    console.log("File:", SQL_FILE);
    process.exit(0);
  }

  const sql = fs.readFileSync(filePath, "utf8");
  const mode = dbUrl ? "postgres" : "management-api";

  try {
    console.log(`▶ Applying ${SQL_FILE} (${mode}) ...`);
    if (dbUrl) {
      await applyWithPg(dbUrl, sql);
    } else {
      await applyWithManagementApi(accessToken, sql);
    }
    console.log(`✅ ${SQL_FILE}`);

    const report = {
      phase: "private-pairing-pr4-raise-patch-staging",
      staging_ref: STAGING_REF,
      production_touched: false,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      sql_file: SQL_FILE,
      mode,
      overall: "PASS",
      functions_patched: [
        "private_pairing_block_hard_delete_rules",
        "private_pairing_block_audit_mutation",
        "private_pairing_validate_target_insert",
      ],
    };
    writeReport(report);
    console.log(`\nWrote: ${OUT_PATH}`);
    console.log("\n✅ RAISE patch apply PASS.\n");
  } catch (error) {
    const report = {
      phase: "private-pairing-pr4-raise-patch-staging",
      staging_ref: STAGING_REF,
      production_touched: false,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      sql_file: SQL_FILE,
      mode,
      overall: "FAIL",
      error: String(error?.message || error),
    };
    writeReport(report);
    console.error(`\n❌ Apply failed: ${error?.message || error}`);
    process.exit(1);
  }
}

main();
