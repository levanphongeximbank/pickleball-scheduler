/**
 * Phase TT-1B — Apply Team Tournament SSOT SQL on staging only.
 *
 * Requires one of:
 *   STAGING_SUPABASE_DB_URL / SUPABASE_DB_URL (Session pooler URI)
 *   SUPABASE_ACCESS_TOKEN (Management API — same PAT as Cursor MCP)
 *
 * Usage:
 *   npm run apply:phase-tt1b-staging-sql
 *   npm run apply:phase-tt1b-staging-sql -- --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SQL_FILES = [
  "docs/v5/PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql",
];

const TT1B_TABLES = [
  "team_tournament_command_log",
  "team_tournament_lineup_revisions",
  "team_tournament_dreambreaker_states",
  "team_tournament_forfeit_events",
  "team_tournament_sync_mismatch",
];

const TT1B_RPCS = [
  "team_tournament_get_visible_lineups",
  "team_tournament_apply_forfeit",
  "team_tournament_begin_command",
  "team_tournament_finish_command",
];

function assertStagingTarget(url) {
  if (String(url || "").includes(PRODUCTION_REF)) {
    console.error("❌ TT-1B: chặn apply trên Production ref.");
    process.exit(1);
  }
  if (!String(url || "").includes(STAGING_REF)) {
    console.error(`❌ URL phải trỏ staging ref ${STAGING_REF}`);
    process.exit(1);
  }
}

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

function printManualInstructions() {
  console.log("\n=== Manual apply (Supabase SQL Editor — staging) ===\n");
  console.log(`Project ref: ${STAGING_REF}`);
  console.log(`URL: https://supabase.com/dashboard/project/${STAGING_REF}/sql/new`);
  console.log("\nPrerequisite: PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql applied");
  console.log("\nRun file:");
  for (const file of SQL_FILES) {
    console.log(`  - ${file}`);
  }
  console.log("\nVerify:");
  console.log("  npm run verify:phase-tt1b5-staging");
  console.log("  docs/v5/PHASE_TT1B_VERIFICATION_QUERIES.sql\n");
}

async function probeState() {
  const { url, serviceKey } = getStagingSupabaseEnv();
  assertStagingTarget(url);
  if (!serviceKey) {
    return { ok: false, error: "missing_service_role" };
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tableCounts = {};
  for (const table of TT1B_TABLES) {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
    tableCounts[table] = error ? { exists: false, error: error.message } : { exists: true, count };
  }

  const rpcStatus = {};
  for (const rpc of TT1B_RPCS) {
    const { error } = await admin.rpc(rpc, {
      p_tournament_id: "__tt1b_probe__",
      p_matchup_id: "00000000-0000-0000-0000-000000000001",
      p_team_id: "probe-team",
    });
    const msg = String(error?.message || "");
    rpcStatus[rpc] = msg.includes("Could not find the function") ? "missing" : "present";
  }

  return { ok: true, tableCounts, rpcStatus, url, ref: STAGING_REF };
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
  console.log("=== Phase TT-1B — Staging SQL Apply ===\n");

  const before = await probeState();
  if (before.ok) {
    console.log("Before apply:");
    for (const [table, info] of Object.entries(before.tableCounts)) {
      console.log(`  ${table}: ${info.exists ? `count=${info.count}` : "MISSING"}`);
    }
    for (const [rpc, status] of Object.entries(before.rpcStatus)) {
      console.log(`  rpc ${rpc}: ${status}`);
    }
    console.log("");
  }

  if (dryRun) {
    console.log("Dry-run — không apply SQL.");
    printManualInstructions();
    process.exit(0);
  }

  const dbUrl = resolveDbUrl();
  const token = resolveAccessToken();

  if (!dbUrl && !token) {
    console.warn("⚠️  Thiếu STAGING_SUPABASE_DB_URL và SUPABASE_ACCESS_TOKEN — không apply tự động.");
    printManualInstructions();
    process.exit(2);
  }

  if (dbUrl) {
    assertStagingTarget(dbUrl);
    await applyWithPg(dbUrl);
  } else {
    assertStagingTarget(STAGING_REF);
    for (const rel of SQL_FILES) {
      const filePath = path.join(rootDir, rel);
      const sql = fs.readFileSync(filePath, "utf8");
      console.log(`▶ Applying ${rel} via Management API ...`);
      await executeManagementSql(token, sql, rel);
      console.log(`✅ ${rel}`);
    }
  }

  console.log("\n--- After apply ---\n");
  const after = await probeState();
  if (after.ok) {
    for (const [table, info] of Object.entries(after.tableCounts)) {
      console.log(`  ${table}: ${info.exists ? `count=${info.count}` : "MISSING"}`);
    }
    for (const [rpc, status] of Object.entries(after.rpcStatus)) {
      console.log(`  rpc ${rpc}: ${status}`);
    }
  }

  console.log("\n✅ TT-1B SQL apply hoàn tất.\n");
}

main().catch((error) => {
  console.error(`\n❌ Apply failed: ${error?.message || error}`);
  printManualInstructions();
  process.exit(1);
});
