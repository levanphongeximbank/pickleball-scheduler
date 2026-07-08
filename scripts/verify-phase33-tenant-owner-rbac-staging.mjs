/**
 * Phase 33 — Verify tenant.role.customize + chủ sân RBAC trên Supabase staging.
 * Usage: npm run verify:phase33-tenant-owner-rbac-staging
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const SQL_FILE = "docs/v5/PHASE_33_TENANT_ROLE_CUSTOMIZE.sql";
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

async function main() {
  const env = loadStagingServiceEnv();
  const url = String(env.VITE_SUPABASE_URL || "");
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");

  console.log("=== Phase 33 — Tenant Owner RBAC Verify (staging) ===\n");

  if (!url.includes(STAGING_REF) || !serviceKey) {
    console.log("Thiếu .env.staging.local — chỉ in hướng dẫn:\n");
    console.log(`https://supabase.com/dashboard/project/${STAGING_REF}/sql/new`);
    console.log(`File: ${SQL_FILE}`);
    console.log("\nnpm run apply:phase33-tenant-role-customize-staging-sql\n");
    process.exit(2);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const checks = [];

  const { data: permission, error: permError } = await admin
    .from("permissions")
    .select("id, module, action")
    .eq("id", "tenant.role.customize")
    .maybeSingle();

  checks.push({
    name: "permissions.tenant.role.customize",
    ok: !permError && permission?.id === "tenant.role.customize",
    detail: permError?.message || (permission ? "" : "missing row"),
  });

  for (const roleId of ["VENUE_OWNER", "COURT_OWNER"]) {
    const { data, error } = await admin
      .from("role_permissions")
      .select("role_id, permission_id")
      .eq("role_id", roleId)
      .eq("permission_id", "tenant.role.customize")
      .maybeSingle();

    checks.push({
      name: `role_permissions.${roleId}.tenant.role.customize`,
      ok: !error && Boolean(data?.permission_id),
      detail: error?.message || (data ? "" : "missing row"),
    });
  }

  const { data: ownerProfiles, error: profileError } = await admin
    .from("profiles")
    .select("id, email, role, venue_id")
    .in("role", ["VENUE_OWNER", "COURT_OWNER"])
    .limit(3);

  checks.push({
    name: "profiles.VENUE_OWNER sample",
    ok: !profileError && (ownerProfiles?.length || 0) > 0,
    detail: profileError?.message || `count=${ownerProfiles?.length || 0}`,
  });

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
    console.log(`\n⚠️  ${failed} check(s) failed. Apply SQL:\n`);
    console.log(`https://supabase.com/dashboard/project/${STAGING_REF}/sql/new`);
    console.log(`File: ${SQL_FILE}\n`);
    process.exit(1);
  }

  console.log("\n✅ Phase 33 staging DB ready.");
  console.log("Tiếp theo: QA manual theo docs/v5/PHASE_33_QA_CHECKLIST.md\n");
}

main();
