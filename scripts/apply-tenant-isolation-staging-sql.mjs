/**
 * Apply tenant isolation QA seed on Supabase staging (qyewbxjsiiyufanzcjcq).
 *
 * Requires one of:
 *   STAGING_SUPABASE_DB_URL
 *   SUPABASE_ACCESS_TOKEN
 *
 * Usage:
 *   npm run apply:tenant-isolation-staging-sql
 *   npm run apply:tenant-isolation-staging-sql -- --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const SQL_FILES = [
  "docs/supabase-billing-phase10e-staging-tenant-align.sql",
  "docs/supabase-staging-phase10d-tenant-b-seed.sql",
  "docs/supabase-staging-tenant-isolation-seed.sql",
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
  console.log(`https://supabase.com/dashboard/project/${STAGING_REF}/sql/new`);
  for (const rel of SQL_FILES) {
    console.log(`  - ${rel}`);
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

async function applyWithManagementApi(token, files) {
  for (const rel of files) {
    const filePath = path.join(rootDir, rel);
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`▶ Applying ${rel} (management API) ...`);
    await executeManagementSql(token, sql, rel);
    console.log(`✅ ${rel}`);
  }
}

async function applyWithPg(connectionString, files) {
  const pg = await import("pg");
  const client = new pg.default.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  for (const rel of files) {
    const filePath = path.join(rootDir, rel);
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`▶ Applying ${rel} ...`);
    await client.query(sql);
    console.log(`✅ ${rel}`);
  }

  const verify = await client.query(`
    select club_id, venue_id,
      jsonb_array_length(coalesce(data->'courts', '[]'::jsonb)) as court_count
    from public.club_data_v3
    where club_id in ('club-staging-a', 'club-staging-b')
    order by club_id
  `);
  console.log("\nVerify club_data_v3:");
  console.table(verify.rows);

  await client.end();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log("=== Tenant Isolation — Staging SQL Apply ===\n");

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
    console.log("✅ dry-run OK");
    console.log("Files:", SQL_FILES.join(", "));
    process.exit(0);
  }

  try {
    if (dbUrl) {
      await applyWithPg(dbUrl, SQL_FILES);
    } else {
      await applyWithManagementApi(accessToken, SQL_FILES);
    }
    console.log("\n✅ Tenant isolation staging SQL apply PASS.\n");
  } catch (error) {
    console.error(`\n❌ Apply failed: ${error?.message || error}`);
    printManualInstructions();
    process.exit(1);
  }
}

main();
