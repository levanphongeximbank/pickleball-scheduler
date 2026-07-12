/**
 * Phase TT-2E — Apply atomic publish SQL on staging only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL_FILE = "docs/v5/PHASE_TT2E_ATOMIC_PUBLISH_WORKFLOW.sql";

function assertStagingTarget(url) {
  if (String(url || "").includes(PRODUCTION_REF)) {
    console.error("❌ TT-2E: chặn apply trên Production ref.");
    process.exit(1);
  }
  if (!String(url || "").includes(STAGING_REF)) {
    console.error(`❌ URL phải trỏ staging ref ${STAGING_REF}`);
    process.exit(1);
  }
}

async function main() {
  loadProjectEnv();
  const dryRun = process.argv.includes("--dry-run");
  const { url } = getStagingSupabaseEnv();
  assertStagingTarget(url);

  const sql = fs.readFileSync(path.join(rootDir, SQL_FILE), "utf8");
  if (dryRun) {
    console.log(`[dry-run] Would apply ${SQL_FILE} (${sql.length} chars)`);
    return;
  }

  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    console.log("Thiếu SUPABASE_ACCESS_TOKEN — apply thủ công qua Supabase MCP staging.");
    console.log(`File: ${SQL_FILE}`);
    process.exit(0);
  }

  const response = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = await response.text();
  if (!response.ok) {
    console.error("Apply failed:", response.status, body);
    process.exit(1);
  }
  console.log("✅ TT-2E SQL applied on staging.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
