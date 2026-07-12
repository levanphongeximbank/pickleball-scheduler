#!/usr/bin/env node
/**
 * Apply Referee V5 migrations to STAGING ONLY (V5A → V5D → V5D1).
 * Requires SUPABASE_ACCESS_TOKEN and confirms staging project ref.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";

const MIGRATIONS = [
  { name: "phase_v5a_referee_foundation", file: "docs/v5/referee-v5/PHASE_V5A_REFEREE_FOUNDATION.sql" },
  { name: "phase_v5d_referee_persistence", file: "docs/v5/referee-v5/PHASE_V5D_REFEREE_PERSISTENCE.sql" },
  { name: "phase_v5d1_referee_hardening", file: "docs/v5/referee-v5/PHASE_V5D1_REFEREE_HARDENING.sql" },
];

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
    const msg = body?.message || body?.error || JSON.stringify(body) || res.statusText;
    throw new Error(`${label}: ${msg}`);
  }
  return body;
}

function assertNotProduction() {
  const url = String(process.env.VITE_SUPABASE_URL || process.env.STAGING_SUPABASE_URL || "");
  if (url.includes(PRODUCTION_REF)) {
    throw new Error(`STOP — VITE_SUPABASE_URL points to production ref ${PRODUCTION_REF}`);
  }
  if (url && !url.includes(STAGING_REF)) {
    console.warn(`WARN: Supabase URL ref not recognized — ${url}`);
  }
}

async function main() {
  loadProjectEnv();
  assertNotProduction();

  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    console.error("Missing SUPABASE_ACCESS_TOKEN");
    process.exit(2);
  }

  const commit = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
  const results = [];

  console.log("=== Referee V5-D.2 Staging Apply ===");
  console.log(`STAGING PROJECT REF: ${STAGING_REF}`);
  console.log(`PRODUCTION PROJECT REF: ${PRODUCTION_REF} (must NOT match)`);
  console.log(`COMMIT: ${commit}\n`);

  for (const migration of MIGRATIONS) {
    const filePath = path.join(rootDir, migration.file);
    const sql = fs.readFileSync(filePath, "utf8");
    const checksum = createHash("sha256").update(sql, "utf8").digest("hex");
    const start = new Date().toISOString();
    console.log(`Applying ${migration.name} ...`);
    try {
      await executeManagementSql(token, sql, migration.file);
      const end = new Date().toISOString();
      results.push({
        migration: migration.name,
        file: migration.file,
        checksum,
        startTime: start,
        endTime: end,
        result: "PASS",
      });
      console.log(`PASS — ${migration.name}\n`);
    } catch (err) {
      const end = new Date().toISOString();
      results.push({
        migration: migration.name,
        file: migration.file,
        checksum,
        startTime: start,
        endTime: end,
        result: "FAIL",
        error: err.message,
      });
      console.error(`FAIL — ${migration.name}: ${err.message}`);
      break;
    }
  }

  const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase-v5d2");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "MIGRATION_APPLY_REPORT.json"), JSON.stringify({ stagingRef: STAGING_REF, productionRef: PRODUCTION_REF, commit, results }, null, 2));

  if (results.some((r) => r.result === "FAIL")) {
    process.exit(1);
  }
  console.log("All migrations applied on staging.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
