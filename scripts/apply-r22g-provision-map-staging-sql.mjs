/**
 * R2-2G — Apply Rally provision map SQL on staging only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL_FILES = ["docs/v5/team-tournament/tt5/R2-2G_PROVISION_MAP.sql"];

function assertStagingTarget(url) {
  if (String(url || "").includes(PRODUCTION_REF)) {
    console.error("❌ R2-2G: chặn apply trên Production ref.");
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

  for (const file of SQL_FILES) {
    const fullPath = path.join(rootDir, file);
    if (!fs.existsSync(fullPath)) {
      console.error(`Missing SQL file: ${file}`);
      process.exit(1);
    }
    const sql = fs.readFileSync(fullPath, "utf8");
    if (dryRun) {
      console.log(`[dry-run] Would apply ${file} (${sql.length} chars)`);
      continue;
    }

    const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
    if (!token) {
      console.log("Thiếu SUPABASE_ACCESS_TOKEN — apply qua Supabase SQL editor / MCP staging.");
      console.log(`Files:\n${SQL_FILES.map((f) => `  - ${f}`).join("\n")}`);
      process.exit(0);
    }

    const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`❌ Apply failed: ${file}`, body?.message || body?.error || res.statusText);
      process.exit(1);
    }
    console.log(`✅ Applied ${file}`);
  }

  console.log(dryRun ? "R2-2G dry-run complete." : "✅ R2-2G staging SQL apply complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
