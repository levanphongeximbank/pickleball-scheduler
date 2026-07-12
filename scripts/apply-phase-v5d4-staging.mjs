#!/usr/bin/env node
/**
 * Apply Referee V5-D.4 migration to STAGING ONLY.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const SQL_FILE = "docs/v5/referee-v5/PHASE_V5D4_ATOMIC_ROLLBACK.sql";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  loadProjectEnv();
  const url = String(process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "");
  if (url.includes(PRODUCTION_REF)) {
    throw new Error("STOP — production ref");
  }
  if (!url.includes(STAGING_REF)) {
    throw new Error(`STOP — expected staging ref ${STAGING_REF}`);
  }

  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    console.error("Missing SUPABASE_ACCESS_TOKEN");
    process.exit(2);
  }

  const sql = fs.readFileSync(path.join(rootDir, SQL_FILE), "utf8");
  console.log(`Applying ${SQL_FILE} to ${STAGING_REF} ...`);

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
    console.error(body?.message || body?.error || JSON.stringify(body));
    process.exit(1);
  }

  console.log("PASS — V5-D.4 atomic rollback SQL applied");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
