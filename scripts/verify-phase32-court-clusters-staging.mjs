/**
 * Phase 32 — Verify court cluster location + platform RLS on Supabase staging.
 * Usage: npm run verify:phase32-court-clusters-staging
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const SQL_FILE = "docs/v5/PHASE_32_COURT_CLUSTER_LOCATION.sql";
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

  console.log("=== Phase 32 — Court Cluster Location Verify (staging) ===\n");

  if (!url.includes(STAGING_REF) || !serviceKey) {
    console.log("Thiếu .env.staging.local — chỉ in hướng dẫn apply:\n");
    console.log(`https://supabase.com/dashboard/project/${STAGING_REF}/sql/new`);
    console.log(`File: ${SQL_FILE}\n`);
    console.log("npm run apply:phase32-court-cluster-location-staging-sql\n");
    process.exit(2);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const checks = [];

  const { error: clusterError } = await admin
    .from("court_clusters")
    .select("id, address, google_maps_url")
    .limit(1);

  checks.push({
    name: "court_clusters.address + google_maps_url",
    ok: !clusterError,
    detail: clusterError?.message,
  });

  for (const permissionId of ["cluster.view", "cluster.manage"]) {
    const { data, error } = await admin
      .from("permissions")
      .select("id")
      .eq("id", permissionId)
      .maybeSingle();

    checks.push({
      name: `permissions.${permissionId}`,
      ok: !error && Boolean(data?.id),
      detail: error?.message || (data ? "" : "missing row"),
    });
  }

  const { data: techPerms, error: techError } = await admin
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", "SYSTEM_TECHNICIAN")
    .in("permission_id", ["cluster.view", "cluster.manage"]);

  checks.push({
    name: "SYSTEM_TECHNICIAN cluster permissions",
    ok: !techError && (techPerms?.length || 0) >= 2,
    detail: techError?.message || `count=${techPerms?.length || 0}`,
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

  console.log("\n✅ Phase 32 staging ready.\n");
}

main();
