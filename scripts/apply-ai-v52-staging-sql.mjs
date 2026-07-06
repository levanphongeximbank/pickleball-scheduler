/**
 * AI V5.2 — Apply Court Engine + Phase 5 SQL on Supabase **staging** (qyewbxjsiiyufanzcjcq).
 *
 * Requires: SUPABASE_ACCESS_TOKEN hoặc STAGING_SUPABASE_DB_URL (ref staging)
 *
 * Usage:
 *   npm run apply:ai-v52-staging-sql
 *   npm run apply:ai-v52-staging-sql -- --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const SQL_FILES = [
  "docs/v5/PHASE_AI_COURT_ENGINE_CLOUD.sql",
  "docs/v5/PHASE_AI_V52_PHASE5.sql",
];
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
    console.error(`❌ DB URL phải chứa staging ref ${STAGING_REF}`);
    process.exit(1);
  }
}

function printManualInstructions() {
  console.log("\n=== Manual apply (Supabase SQL Editor — staging) ===\n");
  console.log(`1. Mở https://supabase.com/dashboard/project/${STAGING_REF}/sql/new`);
  console.log("2. Run theo thứ tự:");
  for (const rel of SQL_FILES) {
    console.log(`   - ${rel}`);
  }
  console.log("3. Verify: npm run verify:ai-v52-staging-smoke\n");
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

async function applyWithManagementApi(token) {
  for (const rel of SQL_FILES) {
    const filePath = path.join(rootDir, rel);
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`▶ Applying ${rel} (Management API) ...`);
    await executeManagementSql(token, sql, rel);
    console.log(`✅ ${rel}`);
  }
}

async function applyWithPg(connectionString) {
  const pg = await import("pg");
  const client = new pg.default.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  for (const rel of SQL_FILES) {
    const filePath = path.join(rootDir, rel);
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`▶ Applying ${rel} ...`);
    await client.query(sql);
    console.log(`✅ ${rel}`);
  }

  await client.end();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("=== AI V5.2 — Staging SQL Apply ===\n");
  console.log(`Project ref: ${STAGING_REF}\n`);

  const dbUrl = resolveDbUrl();
  const accessToken = resolveAccessToken();

  if (!dbUrl && !accessToken) {
    console.warn("⚠️  Thiếu STAGING_SUPABASE_DB_URL hoặc SUPABASE_ACCESS_TOKEN");
    printManualInstructions();
    process.exit(2);
  }

  if (dbUrl) {
    assertStagingDbUrl(dbUrl);
  }

  if (dryRun) {
    console.log("✅ dry-run OK — sẵn sàng apply staging.");
    console.log("Mode:", dbUrl ? "postgres" : "management-api");
    console.log("Files:", SQL_FILES.join(", "));
    process.exit(0);
  }

  try {
    if (dbUrl) {
      await applyWithPg(dbUrl);
    } else {
      console.log("Mode: Supabase Management API (SUPABASE_ACCESS_TOKEN)\n");
      await applyWithManagementApi(accessToken);
    }
    console.log("\n✅ AI V5.2 staging SQL apply PASS.");
    console.log("Tiếp: npm run verify:ai-v52-staging-smoke\n");
  } catch (error) {
    console.error(`\n❌ Apply failed: ${error?.message || error}`);
    printManualInstructions();
    process.exit(1);
  }
}

main();
