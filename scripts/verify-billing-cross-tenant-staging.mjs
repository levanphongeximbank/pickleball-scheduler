/**
 * Authenticated cross-tenant RLS smoke for Phase 9 billing (staging).
 *
 * Usage:
 *   node scripts/verify-billing-cross-tenant-staging.mjs
 *
 * Optional in .env.local (manual QA automation):
 *   STAGING_OWNER_A_EMAIL=...
 *   STAGING_OWNER_A_PASSWORD=...
 *   STAGING_OWNER_B_EMAIL=...
 *   STAGING_OWNER_B_PASSWORD=...
 *   STAGING_SUPER_ADMIN_EMAIL=...
 *   STAGING_SUPER_ADMIN_PASSWORD=...
 *   STAGING_TENANT_A_ID=venue-id-a
 *   STAGING_TENANT_B_ID=venue-id-b
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const BILLING_TABLES = ["tenant_subscriptions", "invoices", "payments"];

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function warn(message) {
  console.log(`⚠️  ${message}`);
}

function info(message) {
  console.log(`ℹ️  ${message}`);
}

async function signIn(url, anonKey, email, password) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { client: null, error: error.message };
  }
  return { client, user: data.user, error: null };
}

async function probeBillingTables(client, label) {
  const results = {};
  for (const table of BILLING_TABLES) {
    const { data, error } = await client.from(table).select("id, tenant_id");
    if (error) {
      results[table] = { error: error.message, rows: [] };
    } else {
      results[table] = { error: null, rows: data || [] };
    }
  }
  info(`${label} probe: ${JSON.stringify(
    Object.fromEntries(
      Object.entries(results).map(([table, value]) => [
        table,
        value.error ? `ERR: ${value.error}` : `${value.rows.length} rows`,
      ])
    )
  )}`);
  return results;
}

function tenantIdsInRows(rows) {
  return [...new Set((rows || []).map((row) => row.tenant_id).filter(Boolean))];
}

function assertOwnerIsolation({ label, results, ownTenantId, otherTenantId }) {
  let pass = true;
  for (const table of BILLING_TABLES) {
    const { error, rows } = results[table];
    if (error) {
      warn(`${label} ${table}: ${error}`);
      pass = false;
      continue;
    }
    const tenants = tenantIdsInRows(rows);
    if (otherTenantId && tenants.includes(otherTenantId)) {
      warn(`${label} ${table}: LEAK — thấy tenant B (${otherTenantId})`);
      pass = false;
    }
    if (ownTenantId && rows.length > 0 && !tenants.every((id) => id === ownTenantId)) {
      warn(`${label} ${table}: rows không thuộc tenant A (${ownTenantId}): ${tenants.join(", ")}`);
      pass = false;
    }
    if (pass) {
      ok(`${label} ${table}: không leak tenant khác (${rows.length} rows)`);
    }
  }
  return pass;
}

async function main() {
  console.log("=== Verify Billing Cross-Tenant RLS — Staging ===\n");

  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    fail("Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong .env.local");
  }

  loadProjectEnv();
  const tenantA = String(process.env.STAGING_TENANT_A_ID || "").trim();
  const tenantB = String(process.env.STAGING_TENANT_B_ID || "").trim();

  const ownerAEmail = String(process.env.STAGING_OWNER_A_EMAIL || "").trim();
  const ownerAPassword = String(process.env.STAGING_OWNER_A_PASSWORD || "").trim();
  const ownerBEmail = String(process.env.STAGING_OWNER_B_EMAIL || "").trim();
  const ownerBPassword = String(process.env.STAGING_OWNER_B_PASSWORD || "").trim();
  const adminEmail = String(process.env.STAGING_SUPER_ADMIN_EMAIL || "").trim();
  const adminPassword = String(process.env.STAGING_SUPER_ADMIN_PASSWORD || "").trim();

  const hasOwnerCreds = ownerAEmail && ownerAPassword && ownerBEmail && ownerBPassword;
  const hasAdminCreds = adminEmail && adminPassword;

  if (!hasOwnerCreds) {
    console.log("--- Authenticated cross-tenant probe ---\n");
    info("Bỏ qua — thêm STAGING_OWNER_A/B_EMAIL + PASSWORD vào .env.local để chạy tự động.");
    info("Manual matrix: docs/v5/PHASE_9_STAGING_BILLING_APPLY.md § RLS cross-tenant smoke");
    console.log("\n--- Kết luận ---\n");
    ok("Anon RLS: dùng verify-billing-phase9-staging.mjs");
    warn("Authenticated cross-tenant: ⏳ Manual hoặc thêm staging user creds");
    return;
  }

  const ownerA = await signIn(url, anonKey, ownerAEmail, ownerAPassword);
  if (ownerA.error) {
    fail(`Owner A sign-in failed: ${ownerA.error}`);
  }

  const ownerB = await signIn(url, anonKey, ownerBEmail, ownerBPassword);
  if (ownerB.error) {
    fail(`Owner B sign-in failed: ${ownerB.error}`);
  }

  console.log("\n--- Owner A ---\n");
  const ownerAResults = await probeBillingTables(ownerA.client, "Owner A");
  const ownerAPass = assertOwnerIsolation({
    label: "Owner A",
    results: ownerAResults,
    ownTenantId: tenantA || null,
    otherTenantId: tenantB || null,
  });

  console.log("\n--- Owner B ---\n");
  const ownerBResults = await probeBillingTables(ownerB.client, "Owner B");
  const ownerBPass = assertOwnerIsolation({
    label: "Owner B",
    results: ownerBResults,
    ownTenantId: tenantB || null,
    otherTenantId: tenantA || null,
  });

  let adminPass = null;
  if (hasAdminCreds) {
    console.log("\n--- SUPER_ADMIN ---\n");
    const admin = await signIn(url, anonKey, adminEmail, adminPassword);
    if (admin.error) {
      warn(`SUPER_ADMIN sign-in failed: ${admin.error}`);
      adminPass = false;
    } else {
      const adminResults = await probeBillingTables(admin.client, "SUPER_ADMIN");
      const subCount = adminResults.tenant_subscriptions.rows.length;
      ok(`SUPER_ADMIN tenant_subscriptions: ${subCount} rows (expect ≥1 nếu có seed)`);
      adminPass = true;
    }
  } else {
    info("Bỏ qua SUPER_ADMIN — thêm STAGING_SUPER_ADMIN_EMAIL/PASSWORD");
  }

  console.log("\n--- Trial RPC ---\n");
  const { error: rpcMetaError } = await ownerA.client.rpc("billing_create_trial_subscription", {
    p_tenant_id: tenantA || null,
  });
  if (rpcMetaError?.message?.includes("billing_create_trial_subscription")) {
    warn("RPC billing_create_trial_subscription chưa apply — docs/supabase-billing-phase9-trial-rpc.sql");
  } else if (rpcMetaError) {
    info(`RPC probe: ${rpcMetaError.message}`);
  } else {
    ok("RPC billing_create_trial_subscription khả dụng (idempotent)");
  }

  console.log("\n--- Kết luận ---\n");
  if (ownerAPass && ownerBPass) {
    ok("Cross-tenant authenticated RLS: Owner A/B isolation PASS");
  } else {
    fail("Cross-tenant authenticated RLS: FAIL — xem log trên");
  }
}

main().catch((error) => {
  fail(error?.message || String(error));
});
