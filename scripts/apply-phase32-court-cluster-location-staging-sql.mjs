/**
 * Phase 32 — Apply court cluster location SQL on Supabase staging.
 * Usage: npm run apply:phase32-court-cluster-location-staging-sql
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const SQL_FILE = "docs/v5/PHASE_32_COURT_CLUSTER_LOCATION.sql";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  loadProjectEnv();
  const sqlPath = path.join(rootDir, SQL_FILE);

  console.log("=== Phase 32 — Court Cluster Location SQL Apply (staging) ===\n");
  console.log("Chạy SQL qua Supabase SQL Editor hoặc MCP apply_migration:");
  console.log(`https://supabase.com/dashboard/project/${STAGING_REF}/sql/new`);
  console.log(`File: ${SQL_FILE}\n`);

  if (fs.existsSync(sqlPath)) {
    const lines = fs.readFileSync(sqlPath, "utf8").split(/\r?\n/).length;
    console.log(`SQL file: ${lines} lines\n`);
  }

  console.log("Sau khi apply, chạy verify:");
  console.log("  npm run verify:phase32-court-clusters-staging\n");
}

main();
