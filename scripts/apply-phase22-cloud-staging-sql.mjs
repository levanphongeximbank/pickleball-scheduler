/**
 * Phase 22 — Apply cloud persistence SQL on Supabase staging.
 * Usage: npm run apply:phase22-cloud-staging-sql
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const SQL_FILE = "docs/v5/PHASE_22_CLOUD_PERSISTENCE.sql";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveDbUrl() {
  loadProjectEnv();
  const stagingLocal = path.join(rootDir, ".env.staging.local");
  if (fs.existsSync(stagingLocal)) {
    for (const rawLine of fs.readFileSync(stagingLocal, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line.startsWith("STAGING_SUPABASE_DB_URL=")) {
        process.env.STAGING_SUPABASE_DB_URL = line.slice("STAGING_SUPABASE_DB_URL=".length).trim();
      }
    }
  }
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

function printManualInstructions() {
  console.log("\n=== Manual apply (Supabase SQL Editor — staging) ===\n");
  console.log(`https://supabase.com/dashboard/project/${STAGING_REF}/sql/new`);
  console.log(`File: ${SQL_FILE}\n`);
}

async function executeManagementSql(token, sql) {
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
    throw new Error(body?.message || body?.error || res.statusText);
  }
  return body;
}

async function verifyTables() {
  const env = loadStagingServiceEnv();
  const url = String(env.VITE_SUPABASE_URL || "");
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url.includes(STAGING_REF) || !serviceKey) {
    throw new Error("Thiếu staging service role trong .env.staging.local");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const table of ["court_engine_stores", "court_engine_active_sessions"]) {
    const { error } = await admin.from(table).select("tenant_id").limit(1);
    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
    console.log(`✅ ${table}`);
  }

  const { error: versionErr } = await admin.from("club_data_v3").select("version").limit(1);
  if (versionErr) {
    console.warn(`⚠️  club_data_v3.version: ${versionErr.message}`);
  } else {
    console.log("✅ club_data_v3.version");
  }
}

async function main() {
  console.log("=== Phase 22 — Cloud SQL Apply (staging) ===\n");

  const dbUrl = resolveDbUrl();
  const accessToken = resolveAccessToken();
  const sql = fs.readFileSync(path.join(rootDir, SQL_FILE), "utf8");

  if (!dbUrl && !accessToken) {
    console.warn("⚠️  Thiếu STAGING_SUPABASE_DB_URL hoặc SUPABASE_ACCESS_TOKEN");
    printManualInstructions();
    process.exit(2);
  }

  try {
    if (dbUrl) {
      if (!dbUrl.includes(STAGING_REF)) {
        throw new Error(`DB URL phải chứa ${STAGING_REF}`);
      }
      const pg = await import("pg");
      const client = new pg.default.Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
      });
      await client.connect();
      await client.query(sql);
      await client.end();
      console.log("✅ SQL applied (postgres)\n");
    } else {
      console.log("Mode: Management API\n");
      await executeManagementSql(accessToken, sql);
      console.log("✅ SQL applied (management API)\n");
    }

    await verifyTables();
    console.log("\n✅ Phase 22 staging apply PASS.\n");
  } catch (error) {
    console.error(`\n❌ ${error?.message || error}`);
    printManualInstructions();
    process.exit(1);
  }
}

main();
