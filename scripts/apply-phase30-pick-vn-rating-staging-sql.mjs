/**
 * Phase 30 — Apply Pick_VN player rating SQL on Supabase staging.
 * Usage: npm run apply:phase30-pick-vn-rating-staging-sql
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const SQL_FILE = "docs/v5/PHASE_30_PICK_VN_PLAYER_RATING.sql";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadStagingServiceEnv() {
  const filePath = path.join(rootDir, ".env.staging.local");
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const merged = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    merged[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return merged;
}

async function verifyTable() {
  const env = loadStagingServiceEnv();
  const url = String(env.VITE_SUPABASE_URL || "");
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url.includes(STAGING_REF) || !serviceKey) {
    throw new Error("Thiếu staging service role trong .env.staging.local");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await admin.from("pick_vn_player_ratings").select("id").limit(1);
  if (error) {
    throw new Error(`pick_vn_player_ratings: ${error.message}`);
  }
  console.log("✅ pick_vn_player_ratings");
}

async function main() {
  loadProjectEnv();
  console.log("=== Phase 30 — Pick_VN Player Rating SQL Apply (staging) ===\n");
  console.log("Chạy SQL qua Supabase MCP hoặc SQL Editor:");
  console.log(`https://supabase.com/dashboard/project/${STAGING_REF}/sql/new`);
  console.log(`File: ${SQL_FILE}\n`);

  try {
    await verifyTable();
    console.log("\n✅ Phase 30 staging table exists.\n");
  } catch (error) {
    console.warn(`⚠️  ${error?.message || error}`);
    console.log("\nApply SQL thủ công rồi chạy lại script này.\n");
    process.exit(2);
  }
}

main();
