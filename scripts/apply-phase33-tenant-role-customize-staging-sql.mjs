/**
 * Phase 33 — tenant.role.customize (chủ sân tùy chỉnh quyền nhân viên).
 * Usage: npm run apply:phase33-tenant-role-customize-staging-sql
 *
 * Đã apply qua MCP migration `phase_33_tenant_role_customize` trên staging.
 * Script này in hướng dẫn re-apply thủ công nếu cần.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const SQL_FILE = "docs/v5/PHASE_33_TENANT_ROLE_CUSTOMIZE.sql";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const sqlPath = path.join(rootDir, SQL_FILE);

  console.log("=== Phase 33 — Tenant Role Customize SQL (staging) ===\n");
  console.log("MCP migration: phase_33_tenant_role_customize");
  console.log(`SQL Editor: https://supabase.com/dashboard/project/${STAGING_REF}/sql/new`);
  console.log(`File: ${SQL_FILE}\n`);

  if (fs.existsSync(sqlPath)) {
    const lines = fs.readFileSync(sqlPath, "utf8").split(/\r?\n/).length;
    console.log(`SQL file: ${lines} lines\n`);
  }

  console.log("Sau khi apply, chạy verify:");
  console.log("  npm run verify:phase33-tenant-owner-rbac-staging\n");
}

main();
