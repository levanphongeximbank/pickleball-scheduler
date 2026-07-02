/**
 * Phase 11B — Apply Marketplace/API SQL on staging (optional automation).
 *
 * Requires SUPABASE_DB_URL in .env.local (Session pooler URI from Supabase Dashboard).
 * Without it, prints manual SQL Editor instructions and exits 2.
 *
 * NEVER commit .env.local or DB password.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SQL_FILES = [
  "docs/supabase-sprint10.sql",
  "docs/supabase-sprint10-phase11a-rls.sql",
  "docs/supabase-sprint10-phase11b-persistence.sql",
];

function assertStagingDbUrl(url) {
  if (!String(url || "").includes(STAGING_REF) && !String(url || "").includes("staging")) {
    console.error("❌ SUPABASE_DB_URL không khớp staging — dừng để tránh apply nhầm production.");
    process.exit(1);
  }
}

function printManualInstructions() {
  console.log("\n=== Manual apply (Supabase SQL Editor) ===\n");
  console.log(`Project: ${STAGING_REF}`);
  console.log("Paste và Run theo thứ tự:\n");
  for (const file of SQL_FILES) {
    console.log(`  - ${file}`);
  }
  console.log("\nRollback: docs/supabase-sprint10-phase11b-rollback.sql");
  console.log("          docs/supabase-sprint10-phase11a-rollback.sql\n");
  console.log("Verify: node scripts/verify-phase11b-marketplace-rls-staging.mjs\n");
}

async function applyWithPg(connectionString) {
  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error("❌ Thiếu package `pg`. Chạy: npm install pg --save-dev");
    process.exit(1);
  }

  const client = new pg.default.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  for (const rel of SQL_FILES) {
    const filePath = path.join(rootDir, rel);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing SQL file: ${rel}`);
    }
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`▶ Applying ${rel} ...`);
    await client.query(sql);
    console.log(`✅ ${rel}`);
  }

  await client.end();
}

async function main() {
  loadProjectEnv();
  const dbUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();

  console.log("=== Phase 11B — Staging SQL Apply ===\n");

  if (!dbUrl) {
    console.warn("⚠️  SUPABASE_DB_URL chưa set — chỉ in hướng dẫn manual apply.");
    printManualInstructions();
    process.exit(2);
  }

  assertStagingDbUrl(dbUrl);

  try {
    await applyWithPg(dbUrl);
    console.log("\n✅ Apply hoàn tất. Chạy verify JWT:\n");
    console.log("   node scripts/verify-phase11b-marketplace-rls-staging.mjs\n");
  } catch (error) {
    console.error(`\n❌ Apply failed: ${error?.message || error}`);
    printManualInstructions();
    process.exit(1);
  }
}

main();
