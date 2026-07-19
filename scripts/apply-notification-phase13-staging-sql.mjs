/**
 * Phase 1.3S — Apply Notification Phase 1.3 SQL on Supabase Staging only.
 *
 * Requires SUPABASE_DB_URL (or DATABASE_URL) pointing at staging Session pooler.
 * Staging ref: qyewbxjsiiyufanzcjcq
 *
 * NEVER apply to Production. NEVER commit .env.local.
 *
 * Usage:
 *   node scripts/apply-notification-phase13-staging-sql.mjs
 *   node scripts/apply-notification-phase13-staging-sql.mjs --with-hardening
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SQL_FILES = ["docs/supabase-notification-phase13.sql"];
const HARDENING_FILE = "docs/supabase-notification-phase13-rpc-hardening.sql";

function assertStagingDbUrl(url) {
  const value = String(url || "");
  if (value.includes(PRODUCTION_REF)) {
    console.error("❌ SUPABASE_DB_URL trỏ Production — dừng.");
    process.exit(1);
  }
  if (!value.includes(STAGING_REF) && !value.toLowerCase().includes("staging")) {
    console.error(`❌ SUPABASE_DB_URL không khớp staging ${STAGING_REF} — dừng.`);
    process.exit(1);
  }
}

function printManual() {
  console.log("\n=== Manual apply (Supabase SQL Editor — Staging only) ===\n");
  console.log(`Project: ${STAGING_REF}`);
  console.log("Paste và Run:");
  for (const file of SQL_FILES) console.log(`  - ${file}`);
  console.log(`  - ${HARDENING_FILE} (recommended before Phase 1.4)`);
  console.log("\nRollback: docs/supabase-notification-phase13-rollback.sql\n");
  console.log("Verify: node scripts/verify-notification-phase13-staging.mjs\n");
}

async function applyWithPg(connectionString, files) {
  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error("❌ Thiếu package `pg`. Chạy: npm install pg --save-dev");
    process.exit(1);
  }

  const client = new pg.default.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Preflight: confirm we are on expected DB and legacy notifications still exists.
  const { rows: dbRows } = await client.query("select current_database() as db");
  console.log(`ℹ️  Connected database: ${dbRows[0]?.db}`);

  const { rows: legacy } = await client.query(`
    select to_regclass('public.notifications') as legacy_notifications
  `);
  console.log(
    `ℹ️  Legacy public.notifications: ${legacy[0]?.legacy_notifications || "missing (ok if never applied)"}`
  );

  for (const rel of files) {
    const filePath = path.join(rootDir, rel);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing SQL file: ${rel}`);
    }
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`▶ Applying ${rel} ...`);
    await client.query(sql);
    console.log(`✅ ${rel}`);
  }

  // Post-verify objects
  const { rows: tables } = await client.query(`
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('notification_inbox', 'notification_delivery_jobs')
      and c.relkind = 'r'
    order by 1
  `);
  console.log(
    `ℹ️  Tables present: ${tables.map((r) => r.relname).join(", ") || "(none)"}`
  );

  await client.end();
}

async function main() {
  loadProjectEnv();
  const withHardening = process.argv.includes("--with-hardening");
  const dbUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();
  const timestamp = new Date().toISOString();

  console.log("=== Phase 1.3S — Staging SQL Apply ===");
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Staging ref: ${STAGING_REF}`);
  console.log(`Hardening: ${withHardening ? "yes" : "no"}\n`);

  if (!dbUrl) {
    console.warn("⚠️  SUPABASE_DB_URL chưa set — chỉ in hướng dẫn manual apply.");
    printManual();
    process.exit(2);
  }

  assertStagingDbUrl(dbUrl);

  const files = [...SQL_FILES];
  if (withHardening) files.push(HARDENING_FILE);

  try {
    await applyWithPg(dbUrl, files);
    console.log("\n✅ Apply hoàn tất.");
    console.log("   Verify: node scripts/verify-notification-phase13-staging.mjs\n");
  } catch (error) {
    console.error(`\n❌ Apply failed: ${error?.message || error}`);
    printManual();
    process.exit(1);
  }
}

main();
