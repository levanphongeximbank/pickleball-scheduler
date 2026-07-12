/**
 * Phase TT-2B — Apply lineup deadline server-time SQL on staging only.
 *
 * Usage:
 *   node scripts/apply-phase-tt2b-staging-sql.mjs
 *   node scripts/apply-phase-tt2b-staging-sql.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SQL_FILES = ["docs/v5/PHASE_TT2B_LINEUP_DEADLINE_SERVER_TIME.sql"];

function assertStagingTarget(url) {
  if (String(url || "").includes(PRODUCTION_REF)) {
    console.error("❌ TT-2B: chặn apply trên Production ref.");
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
  console.log("\nRun file:");
  for (const file of SQL_FILES) {
    console.log(`  - ${file}`);
  }
  console.log("\nVerify:");
  console.log("  node scripts/verify-phase-tt2b-deadline.mjs\n");
}

async function applyViaManagementApi(token, dryRun) {
  const sql = SQL_FILES.map((file) =>
    fs.readFileSync(path.join(rootDir, file), "utf8")
  ).join("\n\n");

  if (dryRun) {
    console.log(`[dry-run] Would apply ${SQL_FILES.join(", ")} (${sql.length} chars)`);
    return true;
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    console.error(`❌ Management API apply failed (${response.status}): ${body.slice(0, 500)}`);
    return false;
  }

  console.log("✅ TT-2B SQL applied via Management API");
  return true;
}

async function probeHelper(admin) {
  const { data, error } = await admin.rpc("team_tournament_lineup_deadline_fields", {
    p_lineup_lock_at: new Date(Date.now() + 3600000).toISOString(),
    p_matchup_status: "lineup_open",
    p_lineup_status: "draft",
    p_lineup_locked_at: null,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const dbUrl = resolveDbUrl();
  const token = resolveAccessToken();
  const { url, serviceKey } = getStagingSupabaseEnv();

  assertStagingTarget(url);

  if (dbUrl) {
    console.log("ℹ️  STAGING_SUPABASE_DB_URL set — prefer Management API or manual psql.");
  }

  if (token) {
    const applied = await applyViaManagementApi(token, dryRun);
    if (!applied) {
      printManualInstructions();
      process.exit(1);
    }
  } else {
    console.log("⚠️  SUPABASE_ACCESS_TOKEN missing — manual apply required.");
    printManualInstructions();
    if (!dryRun) {
      process.exit(2);
    }
    return;
  }

  if (dryRun || !serviceKey) {
    return;
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const probe = await probeHelper(admin);
  console.log(
    probe.ok
      ? `✅ probe team_tournament_lineup_deadline_fields: ${JSON.stringify(probe.data)}`
      : `❌ probe failed: ${probe.error}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
