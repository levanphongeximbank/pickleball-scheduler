/**
 * Seed tenant isolation QA data on Supabase staging via service role.
 * Loads credentials from .env.staging.local (staging project only).
 *
 * Usage: npm run seed:tenant-isolation-staging
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";

const CLUB_PAYLOAD_A = {
  schemaVersion: 3,
  clubId: "club-staging-a",
  tenantId: TENANT_A,
  venueId: TENANT_A,
  courts: [
    { id: "court-a1", name: "Sân A1", number: 1, active: true, tenantId: TENANT_A, clusterId: `${TENANT_A}-main` },
    { id: "court-a2", name: "Sân A2", number: 2, active: true, tenantId: TENANT_A, clusterId: `${TENANT_A}-main` },
    { id: "court-a3", name: "Sân A3", number: 3, active: true, tenantId: TENANT_A, clusterId: `${TENANT_A}-main` },
  ],
  leagues: [{ id: "league-a-internal", name: "Giải A", type: "internal" }],
  players: [{ id: "player-a1", name: "VĐV A1", tenantId: TENANT_A }],
};

const CLUB_PAYLOAD_B = {
  schemaVersion: 3,
  clubId: "club-staging-b",
  tenantId: TENANT_B,
  venueId: TENANT_B,
  courts: [
    { id: "court-b1", name: "Sân B1", number: 1, active: true, tenantId: TENANT_B, clusterId: `${TENANT_B}-main` },
    { id: "court-b2", name: "Sân B2", number: 2, active: true, tenantId: TENANT_B, clusterId: `${TENANT_B}-main` },
    { id: "court-b3", name: "Sân B3", number: 3, active: true, tenantId: TENANT_B, clusterId: `${TENANT_B}-main` },
    { id: "court-b4", name: "Sân B4", number: 4, active: true, tenantId: TENANT_B, clusterId: `${TENANT_B}-main` },
    { id: "court-b5", name: "Sân B5", number: 5, active: true, tenantId: TENANT_B, clusterId: `${TENANT_B}-main` },
  ],
  leagues: [{ id: "league-b-internal", name: "Giải B", type: "internal" }],
  players: [{ id: "player-b1", name: "VĐV B1", tenantId: TENANT_B }],
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadStagingEnv() {
  const filePath = path.join(rootDir, ".env.staging.local");
  if (!fs.existsSync(filePath)) {
    throw new Error("Thiếu .env.staging.local");
  }

  const merged = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    merged[key] = value;
  }
  return merged;
}

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

async function main() {
  console.log("=== Seed Tenant Isolation — Staging ===\n");

  const env = loadStagingEnv();
  const url = String(env.VITE_SUPABASE_URL || "").trim();
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url.includes(STAGING_REF)) {
    fail(`URL không phải staging ${STAGING_REF}`);
  }
  if (!serviceKey) {
    fail("Thiếu SUPABASE_SERVICE_ROLE_KEY trong .env.staging.local");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const venues = [
    { id: TENANT_A, name: "Venue Staging A — Ông A", slug: TENANT_A, status: "active" },
    { id: TENANT_B, name: "Venue Staging B — Ông B", slug: TENANT_B, status: "active" },
  ];

  for (const venue of venues) {
    const { error } = await admin.from("venues").upsert(venue, { onConflict: "id" });
    if (error) fail(`venues ${venue.id}: ${error.message}`);
  }
  ok("venues A/B upserted");

  const profileUpdates = [
    { email: "owner@staging.local", venue_id: TENANT_A, display_name: "Owner Staging A" },
    { email: "owner-b@staging.local", venue_id: TENANT_B, display_name: "Owner Staging B" },
  ];

  for (const item of profileUpdates) {
    const { data: rows, error: selectError } = await admin
      .from("profiles")
      .select("id")
      .eq("email", item.email)
      .limit(1);

    if (selectError) fail(`profiles select ${item.email}: ${selectError.message}`);
    if (!rows?.length) {
      console.warn(`⚠️  Profile chưa có: ${item.email} — đăng ký qua /login trước`);
      continue;
    }

    const { error } = await admin
      .from("profiles")
      .update({
        role: "VENUE_OWNER",
        venue_id: item.venue_id,
        club_id: null,
        status: "active",
        display_name: item.display_name,
        updated_at: new Date().toISOString(),
      })
      .eq("email", item.email);

    if (error) fail(`profiles update ${item.email}: ${error.message}`);
    ok(`profile ${item.email} → ${item.venue_id}`);
  }

  const periodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  for (const tenantId of [TENANT_A, TENANT_B]) {
    const subId = `sub-${tenantId}-enterprise`;
    const { data: existing } = await admin
      .from("tenant_subscriptions")
      .select("id")
      .eq("tenant_id", tenantId)
      .limit(1);

    const rowId = existing?.[0]?.id || subId;
    const payload = {
      id: rowId,
      tenant_id: tenantId,
      status: "active",
      plan_id: "plan-ENTERPRISE",
      billing_cycle: "yearly",
      start_date: now,
      end_date: periodEnd,
      trial_start_date: null,
      trial_end_date: null,
      grace_period_until: null,
      auto_renew: true,
      updated_at: now,
    };

    const { error } = await admin.from("tenant_subscriptions").upsert(payload, { onConflict: "id" });

    if (error) fail(`subscription ${tenantId}: ${error.message}`);
    ok(`subscription ${tenantId} → ENTERPRISE active`);
  }

  const clubRows = [
    { club_id: "club-staging-a", venue_id: TENANT_A, data: CLUB_PAYLOAD_A },
    { club_id: "club-staging-b", venue_id: TENANT_B, data: CLUB_PAYLOAD_B },
  ];

  for (const row of clubRows) {
    const { error } = await admin.from("club_data_v3").upsert(
      {
        club_id: row.club_id,
        venue_id: row.venue_id,
        data: row.data,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "club_id" }
    );
    if (error) fail(`club_data_v3 ${row.club_id}: ${error.message}`);
    ok(`club_data_v3 ${row.club_id} (${row.data.courts.length} courts)`);
  }

  const clusterRows = [
    {
      id: `${TENANT_A}-main`,
      venue_id: TENANT_A,
      name: "Cụm chính A",
      slug: "main",
      status: "active",
      court_count: 3,
    },
    {
      id: `${TENANT_B}-main`,
      venue_id: TENANT_B,
      name: "Cụm chính B",
      slug: "main",
      status: "active",
      court_count: 5,
    },
  ];

  for (const cluster of clusterRows) {
    const { error } = await admin.from("court_clusters").upsert(
      { ...cluster, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
    if (error) fail(`court_clusters ${cluster.id}: ${error.message}`);
    ok(`court_clusters ${cluster.id}`);
  }

  const assignmentPairs = [
    { email: "owner@staging.local", cluster_id: `${TENANT_A}-main` },
    { email: "owner-b@staging.local", cluster_id: `${TENANT_B}-main` },
  ];

  for (const item of assignmentPairs) {
    const { data: rows, error: selectError } = await admin
      .from("profiles")
      .select("id")
      .eq("email", item.email)
      .limit(1);

    if (selectError) fail(`profiles select ${item.email}: ${selectError.message}`);
    if (!rows?.length) continue;

    const { error } = await admin.from("user_cluster_assignments").upsert(
      {
        user_id: rows[0].id,
        cluster_id: item.cluster_id,
        role: "CLUSTER_OWNER",
      },
      { onConflict: "user_id,cluster_id" }
    );
    if (error) fail(`user_cluster_assignments ${item.email}: ${error.message}`);
    ok(`assignment ${item.email} → ${item.cluster_id}`);
  }

  const { data: verify } = await admin
    .from("club_data_v3")
    .select("club_id, venue_id, data")
    .in("club_id", ["club-staging-a", "club-staging-b"])
    .order("club_id");

  console.log("\nVerify:");
  for (const row of verify || []) {
    const courtCount = row.data?.courts?.length ?? 0;
    const league = row.data?.leagues?.[0]?.name ?? "—";
    console.log(`  ${row.club_id}: ${courtCount} courts, league=${league}`);
  }

  const qaEnvPath = path.join(rootDir, ".env.staging-qa.local");
  if (fs.existsSync(qaEnvPath) && env.VITE_SUPABASE_ANON_KEY) {
    let qaContent = fs.readFileSync(qaEnvPath, "utf8");
    if (!qaContent.includes("STAGING_SUPABASE_ANON_KEY=") || /STAGING_SUPABASE_ANON_KEY=\s*$/.test(qaContent)) {
      if (qaContent.includes("STAGING_SUPABASE_ANON_KEY=")) {
        qaContent = qaContent.replace(
          /STAGING_SUPABASE_ANON_KEY=.*/,
          `STAGING_SUPABASE_ANON_KEY=${env.VITE_SUPABASE_ANON_KEY}`
        );
      } else {
        qaContent += `\nSTAGING_SUPABASE_ANON_KEY=${env.VITE_SUPABASE_ANON_KEY}\n`;
      }
      fs.writeFileSync(qaEnvPath, qaContent, "utf8");
      ok(".env.staging-qa.local — STAGING_SUPABASE_ANON_KEY synced");
    }
  }

  console.log("\n✅ Seed tenant isolation staging PASS.\n");
}

main().catch((error) => fail(error?.message || String(error)));
