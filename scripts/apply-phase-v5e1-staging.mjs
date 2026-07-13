#!/usr/bin/env node
/**
 * Apply V5-E1 Realtime publication on staging (NOT production).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";

async function main() {
  loadProjectEnv();
  const { url } = getStagingSupabaseEnv();
  if (String(url).includes(PRODUCTION_REF)) {
    throw new Error("STOP — production ref");
  }
  if (!String(url).includes(STAGING_REF)) {
    throw new Error("STOP — expected staging ref");
  }

  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    throw new Error("Missing SUPABASE_ACCESS_TOKEN");
  }

  const sql = readFileSync(
    join(process.cwd(), "docs/v5/referee-v5/PHASE_V5E1_REALTIME_SYNC.sql"),
    "utf8",
  );

  const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `apply failed HTTP ${res.status}`);
  }

  console.log("V5-E1 realtime publication applied on staging");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
