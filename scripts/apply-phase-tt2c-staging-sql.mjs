/**
 * Phase TT-2C — Apply lineup validation SQL on staging only.
 *
 * Usage:
 *   node scripts/apply-phase-tt2c-staging-sql.mjs
 *   node scripts/apply-phase-tt2c-staging-sql.mjs --dry-run
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
  "docs/v5/PHASE_TT2C_LINEUP_VALIDATION.sql",
  "docs/v5/PHASE_TT2C_SUBMIT_LINEUP_VALIDATION.sql",
];

function assertStagingTarget(url) {
  if (String(url || "").includes(PRODUCTION_REF)) {
    console.error("❌ TT-2C: chặn apply trên Production ref.");
    process.exit(1);
  }
  if (!String(url || "").includes(STAGING_REF)) {
    console.error(`❌ URL phải trỏ staging ref ${STAGING_REF}`);
    process.exit(1);
  }
}

function resolveAccessToken() {
  loadProjectEnv();
  return String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
}

function printManualInstructions() {
  console.log("\n=== Manual apply (Supabase SQL Editor — staging) ===\n");
  console.log(`Project ref: ${STAGING_REF}`);
  console.log(`URL: https://supabase.com/dashboard/project/${STAGING_REF}/sql/new`);
  console.log("\nRun files (in order):");
  for (const file of SQL_FILES) {
    console.log(`  - ${file}`);
  }
  console.log("\nVerify:");
  console.log("  node scripts/prep-tt2c-staging-player-genders.mjs");
  console.log("  node scripts/verify-phase-tt2c-validation.mjs\n");
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

  console.log("✅ TT-2C SQL applied via Management API");
  return true;
}

async function probeValidator(admin) {
  const { data, error } = await admin.rpc("team_tournament_normalize_gender_key", {
    p_gender: "Nam",
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const token = resolveAccessToken();
  const { url, serviceKey } = getStagingSupabaseEnv();

  assertStagingTarget(url);

  if (token) {
    const applied = await applyViaManagementApi(token, dryRun);
    if (!applied) {
      printManualInstructions();
      process.exit(1);
    }
  } else {
    console.log("⚠️  SUPABASE_ACCESS_TOKEN missing — SQL already applied via MCP or manual apply required.");
    printManualInstructions();
    if (!dryRun && !process.argv.includes("--skip-manual-exit")) {
      process.exit(2);
    }
  }

  if (dryRun || !serviceKey) {
    return;
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const probe = await probeValidator(admin);
  console.log(
    probe.ok
      ? `✅ probe team_tournament_normalize_gender_key('Nam') => ${JSON.stringify(probe.data)}`
      : `❌ probe failed: ${probe.error}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
