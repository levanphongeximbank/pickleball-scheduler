import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

loadProjectEnv();
const { url, anonKey, stagingRef } = getStagingSupabaseEnv();
if (!url || !anonKey) throw new Error("Missing Staging URL or anon key");

const actors = [
  { label: "Owner A", email: process.env.STAGING_OWNER_A_EMAIL || "owner@staging.local", password: process.env.STAGING_OWNER_A_PASSWORD, tenantId: process.env.STAGING_TENANT_A_ID || "venue-staging-a", foreignTenantId: process.env.STAGING_TENANT_B_ID || "venue-staging-b" },
  { label: "Owner B", email: process.env.STAGING_OWNER_B_EMAIL || "owner-b@staging.local", password: process.env.STAGING_OWNER_B_PASSWORD, tenantId: process.env.STAGING_TENANT_B_ID || "venue-staging-b", foreignTenantId: process.env.STAGING_TENANT_A_ID || "venue-staging-a" },
];

const results = [];
for (const actor of actors) {
  if (!actor.password) {
    results.push({ actor: actor.label, email: actor.email, authenticated: false, status: "BLOCKED_MISSING_PASSWORD" });
    continue;
  }
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await client.auth.signInWithPassword({ email: actor.email, password: actor.password });
  if (authError) {
    results.push({ actor: actor.label, email: actor.email, authenticated: false, status: "BLOCKED_LOGIN_FAILED", error: authError.message });
    continue;
  }

  const { data: profile, error: profileError } = await client.from("profiles").select("id,email,venue_id,role,status").eq("id", authData.user.id).single();
  if (profileError) throw new Error(`${actor.label}: profile failed: ${profileError.message}`);
  if (profile.venue_id !== actor.tenantId) throw new Error(`${actor.label}: expected ${actor.tenantId}, got ${profile.venue_id}`);

  const { data: tenants, error: tenantsError } = await client.from("tenants").select("id");
  if (tenantsError) throw new Error(`${actor.label}: tenants failed: ${tenantsError.message}`);
  const tenantIds = tenants.map((row) => row.id);
  const tenantsPass = tenantIds.includes(actor.tenantId) && !tenantIds.includes(actor.foreignTenantId) && tenantIds.every((id) => id === actor.tenantId);

  const { data: blobs, error: blobsError } = await client.from("club_data_v3_safe").select("club_id,venue_id");
  if (blobsError) throw new Error(`${actor.label}: club_data_v3_safe failed: ${blobsError.message}`);
  const blobTenantIds = [...new Set(blobs.map((row) => row.venue_id))];
  const blobsNoLeak = !blobTenantIds.includes(actor.foreignTenantId) && blobTenantIds.every((id) => id === actor.tenantId);

  results.push({
    actor: actor.label,
    email: actor.email,
    authenticated: true,
    profile: { venue_id: profile.venue_id, role: profile.role, status: profile.status },
    tenants: { status: tenantsPass ? "PASS" : "FAIL", visible_ids: tenantIds, foreign_visible: tenantIds.includes(actor.foreignTenantId) },
    club_data_v3_safe: { status: !blobsNoLeak ? "FAIL" : blobs.length === 0 ? "EMPTY_FIXTURE" : "PASS", row_count: blobs.length, visible_tenant_ids: blobTenantIds, foreign_visible: blobTenantIds.includes(actor.foreignTenantId) },
  });
  await client.auth.signOut();
}

const failed = results.some((row) => row.tenants?.status === "FAIL" || row.club_data_v3_safe?.status === "FAIL");
const blocked = results.some((row) => !row.authenticated);
const emptyFixture = results.some((row) => row.club_data_v3_safe?.status === "EMPTY_FIXTURE");
const status = failed ? "FAIL" : blocked ? "PARTIAL_BLOCKED_LOGIN" : emptyFixture ? "PASS_WITH_EMPTY_FIXTURE" : "PASS";
console.log(JSON.stringify({ staging_ref: stagingRef, mode: "authenticated_jwt_read_only", data_mutations: 0, results, status }, null, 2));
if (failed || blocked) process.exitCode = 1;
