/**
 * Phase 33 — Apply tenant.role.customize on Supabase production.
 * Usage: npm run apply:phase33-tenant-role-customize-production-sql
 *
 * Đã apply staging qua MCP phase_33_tenant_role_customize.
 * Production: chạy SQL Editor hoặc MCP apply_migration (cần owner approve).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const SQL_FILE = "docs/v5/PHASE_33_TENANT_ROLE_CUSTOMIZE.sql";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const sqlPath = path.join(rootDir, SQL_FILE);

  console.log("=== Phase 33 — Tenant Role Customize SQL (production) ===\n");
  console.log(`SQL Editor: https://supabase.com/dashboard/project/${PRODUCTION_REF}/sql/new`);
  console.log(`File: ${SQL_FILE}\n`);

  if (fs.existsSync(sqlPath)) {
    console.log(`SQL file: ${fs.readFileSync(sqlPath, "utf8").split(/\r?\n/).length} lines\n`);
  }

  console.log("Sau khi apply:");
  console.log("  npm run verify:phase33-tenant-owner-rbac-production\n");
}

main();
