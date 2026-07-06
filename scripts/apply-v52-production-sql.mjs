/**
 * V5.2 — Apply RBAC roles SQL on Production Supabase (expuvcohlcjzvrrauvud).
 *
 * Cách 1 — Database URL trong .env.local:
 *   SUPABASE_DB_URL=postgresql://postgres.expuvcohlcjzvrrauvud:PASSWORD@...pooler.supabase.com:6543/postgres
 *
 * Cách 2 — PAT (cùng token Cursor MCP):
 *   SUPABASE_ACCESS_TOKEN=sbp_...  (Windows User env hoặc .env.local)
 *
 * Usage:
 *   npm run apply:v52-production-sql
 *   npm run apply:v52-production-sql -- --dry-run
 *   npm run apply:v52-production-sql -- --seed-only
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const SQL_RBAC = "docs/v5/PHASE_V52_PRODUCTION_RBAC_ROLES.sql";
const SQL_SEED = "docs/v5/PHASE_V52_PRODUCTION_RBAC_SEED.sql";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveDbUrl() {
  loadProjectEnv();
  return String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();
}

function resolveAccessToken() {
  loadProjectEnv();
  return String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
}

function assertProductionDbUrl(url) {
  if (!String(url || "").includes(PRODUCTION_REF)) {
    console.error(
      `❌ DB URL phải chứa Production ref ${PRODUCTION_REF} — dừng để tránh apply nhầm staging.`
    );
    process.exit(1);
  }
}

function printManualInstructions() {
  console.log("\n=== Manual apply (Supabase SQL Editor — Production) ===\n");
  console.log(`1. Mở https://supabase.com/dashboard/project/${PRODUCTION_REF}/sql/new`);
  console.log("2. Kiểm tra URL có chữ: expuvcohlcjzvrrauvud");
  console.log("3. Run theo thứ tự:");
  console.log(`   - ${SQL_RBAC}`);
  console.log(`   - ${SQL_SEED}`);
  console.log("4. Verify: npm run verify:v52-production\n");
  console.log("Chi tiết: docs/v5/PHASE_V52_PRODUCTION_RBAC_OWNER_STEP_BY_STEP.md\n");
}

async function executeManagementSql(token, sql, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION_REF}/database/query`, {
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

async function runVerification(token) {
  const checks = [
    {
      id: "V52-4",
      sql: "select count(*)::int as tech_perm_count from public.role_permissions where role_id = 'SYSTEM_TECHNICIAN'",
    },
    {
      id: "V52-5",
      sql: "select count(*)::int as captain_perm_count from public.role_permissions where role_id = 'TEAM_CAPTAIN'",
    },
    {
      id: "V52-6",
      sql: `select email, role, tournament_id, team_id, status
        from public.profiles
        where email in ('doitruong@gmail.com', 'kythuat@gmail.com')
        order by email`,
    },
    {
      id: "V52-1",
      sql: `select id, label from public.roles
        where id in ('SYSTEM_TECHNICIAN', 'TEAM_CAPTAIN') order by id`,
    },
  ];

  console.log("\n--- Verification ---\n");
  for (const check of checks) {
    const rows = await executeManagementSql(token, check.sql, check.id);
    console.log(`${check.id}:`, JSON.stringify(rows, null, 2));
  }
}

async function applyWithManagementApi(token, files) {
  for (const rel of files) {
    const filePath = path.join(rootDir, rel);
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`▶ Applying ${rel} (Management API / MCP PAT) ...`);
    await executeManagementSql(token, sql, rel);
    console.log(`✅ ${rel}`);
  }
  await runVerification(token);
}

async function applyWithPg(connectionString, files) {
  const pg = await import("pg");
  const client = new pg.default.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  for (const rel of files) {
    const filePath = path.join(rootDir, rel);
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`▶ Applying ${rel} ...`);
    await client.query(sql);
    console.log(`✅ ${rel}`);
  }

  const token = resolveAccessToken();
  if (token) {
    await runVerification(token);
  } else {
    const checks = [
      "select count(*)::int as tech_perm_count from public.role_permissions where role_id = 'SYSTEM_TECHNICIAN'",
      "select count(*)::int as captain_perm_count from public.role_permissions where role_id = 'TEAM_CAPTAIN'",
      "select email, role, tournament_id, team_id from public.profiles where email = 'doitruong@gmail.com'",
    ];
    console.log("\n--- Verification ---\n");
    for (const sql of checks) {
      const { rows } = await client.query(sql);
      console.log(JSON.stringify(rows, null, 2));
    }
  }

  await client.end();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const seedOnly = process.argv.includes("--seed-only");
  const files = seedOnly ? [SQL_SEED] : [SQL_RBAC, SQL_SEED];

  console.log("=== V5.2 — Production RBAC SQL Apply ===\n");
  console.log(`Project ref: ${PRODUCTION_REF}\n`);

  const dbUrl = resolveDbUrl();
  const accessToken = resolveAccessToken();

  if (!dbUrl && !accessToken) {
    console.warn("⚠️  Thiếu SUPABASE_DB_URL hoặc SUPABASE_ACCESS_TOKEN");
    printManualInstructions();
    process.exit(2);
  }

  if (dbUrl) assertProductionDbUrl(dbUrl);

  if (dryRun) {
    console.log("✅ dry-run OK — sẵn sàng apply Production.");
    console.log("Mode:", dbUrl ? "postgres" : "management-api (MCP PAT)");
    console.log("Files:", files.join(", "));
    process.exit(0);
  }

  try {
    if (dbUrl) {
      await applyWithPg(dbUrl, files);
    } else {
      console.log("Mode: Supabase Management API (SUPABASE_ACCESS_TOKEN)\n");
      await applyWithManagementApi(accessToken, files);
    }
    console.log("\n✅ V5.2 Production apply PASS.\n");
    console.log("Tiếp theo: đăng ký kythuat@gmail.com nếu chưa có, rồi npm run verify:v52-production\n");
  } catch (error) {
    console.error(`\n❌ Apply failed: ${error?.message || error}`);
    printManualInstructions();
    process.exit(1);
  }
}

main();
