/**
 * V5.2 — Apply RBAC + staging seed on Supabase **staging** (qyewbxjsiiyufanzcjcq).
 *
 * Requires in .env.local (không commit):
 *   STAGING_SUPABASE_DB_URL=postgresql://postgres.qyewbxjsiiyufanzcjcq:PASSWORD@...pooler.supabase.com:6543/postgres
 *
 * Hoặc SUPABASE_ACCESS_TOKEN (cùng PAT dùng cho Cursor MCP):
 *   Windows User env — script gọi Supabase Management API như MCP execute_sql.
 *
 * Usage:
 *   npm run apply:v52-staging-sql
 *   npm run apply:v52-staging-sql -- --dry-run
 *   npm run apply:v52-staging-sql -- --seed-only
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const SQL_RBAC = "docs/v5/PHASE_V52_PRODUCTION_RBAC_ROLES.sql";
const SQL_SEED = "docs/v5/PHASE_V52_STAGING_RBAC_SEED.sql";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function assertStagingDbUrl(url) {
  if (!String(url || "").includes(STAGING_REF)) {
    console.error(
      `❌ DB URL phải chứa staging ref ${STAGING_REF} — dừng để tránh apply nhầm production.`
    );
    process.exit(1);
  }
}

function printManualInstructions() {
  console.log("\n=== Manual apply (Supabase SQL Editor — staging) ===\n");
  console.log(`1. Mở https://supabase.com/dashboard/project/${STAGING_REF}/sql/new`);
  console.log("2. Kiểm tra URL có chữ: qyewbxjsiiyufanzcjcq");
  console.log("3. Run theo thứ tự:");
  console.log(`   - ${SQL_RBAC}`);
  console.log(`   - ${SQL_SEED}`);
  console.log("4. Verify: npm run verify:v52-staging\n");
}

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
    const msg = body?.message || body?.error || res.statusText;
    throw new Error(`${label}: ${msg}`);
  }
  return body;
}

async function runVerificationQueriesPg(client) {
  const checks = [
    {
      id: "V52-S3",
      sql: `select
        (select count(*)::int from public.role_permissions where role_id = 'SYSTEM_TECHNICIAN') as tech_perm_count,
        (select count(*)::int from public.role_permissions where role_id = 'TEAM_CAPTAIN') as captain_perm_count`,
    },
    {
      id: "V52-S4",
      sql: `select email, role, venue_id, tournament_id, team_id, status
        from public.profiles
        where email in ('tech@staging.local', 'player@staging.local')
        order by email`,
    },
    {
      id: "V52-S5",
      sql: `select t.email as missing_auth_user
        from (values ('tech@staging.local'), ('player@staging.local')) as t(email)
        where not exists (select 1 from auth.users u where u.email = t.email)`,
    },
  ];

  console.log("\n--- Verification ---\n");
  for (const check of checks) {
    const { rows } = await client.query(check.sql);
    console.log(`${check.id}:`, JSON.stringify(rows, null, 2));
  }
}

async function runVerificationQueries(token) {
  const checks = [
    {
      id: "V52-S3",
      sql: `select
        (select count(*)::int from public.role_permissions where role_id = 'SYSTEM_TECHNICIAN') as tech_perm_count,
        (select count(*)::int from public.role_permissions where role_id = 'TEAM_CAPTAIN') as captain_perm_count`,
    },
    {
      id: "V52-S4",
      sql: `select email, role, venue_id, tournament_id, team_id, status
        from public.profiles
        where email in ('tech@staging.local', 'player@staging.local')
        order by email`,
    },
    {
      id: "V52-S5",
      sql: `select t.email as missing_auth_user
        from (values ('tech@staging.local'), ('player@staging.local')) as t(email)
        where not exists (select 1 from auth.users u where u.email = t.email)`,
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
    console.log(`▶ Applying ${rel} (Management API) ...`);
    await executeManagementSql(token, sql, rel);
    console.log(`✅ ${rel}`);
  }
  await runVerificationQueries(token);
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

  await runVerificationQueriesPg(client);
  await client.end();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const seedOnly = process.argv.includes("--seed-only");
  const files = seedOnly ? [SQL_SEED] : [SQL_RBAC, SQL_SEED];

  console.log("=== V5.2 — Staging RBAC SQL Apply ===\n");
  console.log(`Project ref: ${STAGING_REF}\n`);

  const dbUrl = resolveDbUrl();
  const accessToken = resolveAccessToken();

  if (!dbUrl && !accessToken) {
    console.warn("⚠️  Thiếu STAGING_SUPABASE_DB_URL hoặc SUPABASE_ACCESS_TOKEN");
    printManualInstructions();
    process.exit(2);
  }

  if (dbUrl) {
    assertStagingDbUrl(dbUrl);
  }

  if (dryRun) {
    console.log("✅ dry-run OK — sẵn sàng apply staging.");
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
    console.log("\n✅ V5.2 staging apply PASS.\n");
  } catch (error) {
    console.error(`\n❌ Apply failed: ${error?.message || error}`);
    printManualInstructions();
    process.exit(1);
  }
}

main();
