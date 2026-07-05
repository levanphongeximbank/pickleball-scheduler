/**
 * Phase 23D — Apply Team Tournament SQL on staging (optional automation).
 *
 * Requires SUPABASE_DB_URL in .env.local (Session pooler URI from Supabase Dashboard).
 * Without it, prints manual SQL Editor instructions and exits 2.
 *
 * NEVER commit .env.local or DB password.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SQL_FILES = [
  "docs/v5/PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql",
  "docs/v5/PHASE_23D_TEAM_TOURNAMENT_STAGING_PROBE.sql",
];

const PROBE_TABLES = [
  "team_tournaments",
  "team_tournament_teams",
  "team_tournament_matchups",
  "team_tournament_lineups",
];

function assertStagingDbUrl(url) {
  if (
    !String(url || "").includes(STAGING_REF) &&
    !String(url || "").toLowerCase().includes("staging")
  ) {
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
  console.log("\nVerify schema:");
  console.log("  npm run seed:team-tournament-cloud:dry-run -- --blob-path=tests/fixtures/team-tournament-blob-probe.json");
  console.log("  npm run verify:team-tournament-cloud\n");
}

async function probeSchema() {
  loadProjectEnv();
  const { url } = getSupabaseEnv();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceKey) {
    return { ok: false, error: "missing_supabase_env" };
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tableStatus = {};
  for (const table of PROBE_TABLES) {
    const { error } = await admin.from(table).select("id").limit(1);
    tableStatus[table] = error ? error.message : "ok";
  }

  const { error: rpcError } = await admin.rpc("team_tournament_get_setup", {
    p_tournament_id: "__probe__",
  });
  const rpcReady = rpcError
    ? String(rpcError.message || "").includes("Could not find the function")
      ? "missing"
      : "ok"
    : "ok";

  return { ok: true, tableStatus, rpcReady };
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
  console.log("=== Phase 23D — Team Tournament Staging SQL Apply ===\n");

  const before = await probeSchema();
  if (before.ok) {
    console.log("Schema before apply:");
    for (const [table, status] of Object.entries(before.tableStatus)) {
      console.log(`  ${table}: ${status === "ok" ? "✅" : "❌ " + status}`);
    }
    console.log(`  rpc team_tournament_get_setup: ${before.rpcReady === "ok" ? "✅" : "❌ missing"}\n`);
  }

  loadProjectEnv();
  const dbUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();

  if (!dbUrl) {
    console.warn("⚠️  SUPABASE_DB_URL chưa set — không thể apply tự động.");
    printManualInstructions();
    process.exit(2);
  }

  assertStagingDbUrl(dbUrl);

  try {
    await applyWithPg(dbUrl);
    console.log("\n--- Schema after apply ---\n");
    const after = await probeSchema();
    if (after.ok) {
      for (const [table, status] of Object.entries(after.tableStatus)) {
        console.log(`  ${table}: ${status === "ok" ? "✅" : "❌ " + status}`);
      }
      console.log(`  rpc team_tournament_get_setup: ${after.rpcReady === "ok" ? "✅" : "❌ missing"}`);
    }
    console.log("\n✅ Apply hoàn tất.\n");
  } catch (error) {
    console.error(`\n❌ Apply failed: ${error?.message || error}`);
    printManualInstructions();
    process.exit(1);
  }
}

main();
