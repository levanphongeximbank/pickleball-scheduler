/**
 * Phase 33 — Verify tenant.role.customize on Supabase production.
 * Usage: npm run verify:phase33-tenant-owner-rbac-production
 *
 * Requires .env.production.local with VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const SQL_FILE = "docs/v5/PHASE_33_TENANT_ROLE_CUSTOMIZE.sql";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadProductionServiceEnv() {
  for (const name of [".env.production.local", ".env.staging.local"]) {
    const filePath = path.join(rootDir, name);
    if (!fs.existsSync(filePath)) continue;
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
  return {};
}

async function main() {
  const env = loadProductionServiceEnv();
  const url = String(env.VITE_SUPABASE_URL || "");
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");

  console.log("=== Phase 33 — Tenant Owner RBAC Verify (production) ===\n");

  if (!url.includes(PRODUCTION_REF) || !serviceKey) {
    console.log("Thiếu .env.production.local — apply SQL thủ công:\n");
    console.log(`https://supabase.com/dashboard/project/${PRODUCTION_REF}/sql/new`);
    console.log(`File: ${SQL_FILE}`);
    console.log("\nHoặc MCP production: apply_migration phase_33_tenant_role_customize\n");
    process.exit(2);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const checks = [];

  const { data: permission, error: permError } = await admin
    .from("permissions")
    .select("id")
    .eq("id", "tenant.role.customize")
    .maybeSingle();

  checks.push({
    name: "permissions.tenant.role.customize",
    ok: !permError && permission?.id === "tenant.role.customize",
    detail: permError?.message || (permission ? "" : "missing — chạy PHASE_33 SQL"),
  });

  for (const roleId of ["VENUE_OWNER", "COURT_OWNER"]) {
    const { data, error } = await admin
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId)
      .eq("permission_id", "tenant.role.customize")
      .maybeSingle();

    checks.push({
      name: `role_permissions.${roleId}`,
      ok: !error && Boolean(data?.permission_id),
      detail: error?.message || (data ? "" : "missing"),
    });
  }

  let failed = 0;
  for (const check of checks) {
    if (check.ok) {
      console.log(`✅ ${check.name}`);
    } else {
      failed += 1;
      console.log(`❌ ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
    }
  }

  if (failed > 0) {
    console.log(`\n⚠️  Apply: ${SQL_FILE}\n`);
    process.exit(1);
  }

  console.log("\n✅ Phase 33 production DB ready.\n");
}

main();
