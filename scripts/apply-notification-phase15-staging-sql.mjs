/**
 * Phase 1.5 — Apply Notification delivery-worker SQL on Supabase Staging only.
 *
 * Requires SUPABASE_DB_URL (or DATABASE_URL) pointing at staging Session pooler.
 * Staging ref: qyewbxjsiiyufanzcjcq
 *
 * NEVER apply to Production. NEVER commit .env.local.
 *
 * Usage:
 *   node scripts/apply-notification-phase15-staging-sql.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL_FILE = "docs/supabase-notification-phase15.sql";

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
  console.log(`Paste và Run: ${SQL_FILE}`);
  console.log("\nRollback: docs/supabase-notification-phase15-rollback.sql\n");
  console.log("Verify: node scripts/verify-notification-phase15-delivery-worker-staging.mjs\n");
}

async function applyWithPg(connectionString) {
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

  const { rows: dbRows } = await client.query("select current_database() as db");
  console.log(`ℹ️  Connected database: ${dbRows[0]?.db}`);

  const filePath = path.join(rootDir, SQL_FILE);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing SQL file: ${SQL_FILE}`);
  }
  const sql = fs.readFileSync(filePath, "utf8");
  console.log(`▶ Applying ${SQL_FILE} ...`);
  await client.query(sql);
  console.log(`✅ ${SQL_FILE}`);

  const { rows: cfg } = await client.query(`
    select key, value from public.notification_runtime_config order by key
  `);
  console.log("ℹ️  Runtime config:");
  for (const row of cfg) {
    console.log(`   - ${row.key}=${row.value}`);
  }

  const { rows: fns } = await client.query(`
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'notification_delivery_claim_jobs',
        'notification_delivery_complete_job',
        'notification_delivery_record_attempt',
        'notification_qa_cleanup_namespaced_inbox'
      )
    order by 1
  `);
  console.log(
    `ℹ️  Functions present: ${fns.map((r) => r.proname).join(", ") || "(none)"}`
  );

  await client.end();
}

async function main() {
  loadProjectEnv();
  const dbUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();
  const timestamp = new Date().toISOString();

  console.log("=== Phase 1.5 — Staging SQL Apply ===");
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Staging ref: ${STAGING_REF}\n`);

  if (!dbUrl) {
    console.warn("⚠️  SUPABASE_DB_URL chưa set — chỉ in hướng dẫn manual apply.");
    printManual();
    process.exit(2);
  }

  assertStagingDbUrl(dbUrl);

  try {
    await applyWithPg(dbUrl);
    console.log("\n✅ Apply hoàn tất.");
    console.log(
      "   Verify: node scripts/verify-notification-phase15-delivery-worker-staging.mjs\n"
    );
  } catch (error) {
    console.error(`\n❌ Apply failed: ${error?.message || error}`);
    printManual();
    process.exit(1);
  }
}

main();
