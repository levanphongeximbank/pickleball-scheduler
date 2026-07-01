/**
 * Phase 10E — Verify profiles.venue_id ↔ venues.id ↔ tenant_subscriptions.tenant_id
 *
 * Usage:
 *   node scripts/verify-billing-tenant-mapping-staging.mjs
 *
 * Requires in .env.local:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 * Optional (full alignment report):
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

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

async function main() {
  console.log("=== Phase 10E — Billing Tenant Mapping Verify ===\n");

  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    fail("Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong .env.local");
  }

  loadProjectEnv();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!serviceKey) {
    warn("Thiếu SUPABASE_SERVICE_ROLE_KEY — chỉ probe venues/subscriptions anon-safe.");
    info("Thêm service role key để kiểm tra profiles.venue_id alignment.");
  }

  const admin = serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("\n--- venues.id (service role or anon RLS) ---\n");

  const venueClient = admin || anon;
  const { data: venues, error: venuesErr } = await venueClient
    .from("venues")
    .select("id, name, status")
    .order("name");

  if (venuesErr) {
    warn(`venues: ${venuesErr.message}`);
  } else {
    ok(`venues: ${venues?.length ?? 0} rows`);
    for (const venue of venues || []) {
      info(`  · ${venue.id} — ${venue.name} (${venue.status})`);
    }
  }

  console.log("\n--- tenant_subscriptions.tenant_id ---\n");

  const { data: subs, error: subsErr } = await venueClient
    .from("tenant_subscriptions")
    .select("id, tenant_id, status, plan_id, trial_end_date")
    .order("created_at", { ascending: false });

  if (subsErr) {
    warn(`tenant_subscriptions: ${subsErr.message}`);
  } else {
    ok(`tenant_subscriptions: ${subs?.length ?? 0} rows`);
    const venueIds = new Set((venues || []).map((v) => v.id));
    let orphanSubs = 0;
    for (const sub of subs || []) {
      const orphan = !venueIds.has(sub.tenant_id);
      if (orphan) orphanSubs += 1;
      info(
        `  · ${sub.tenant_id} — ${sub.status} / ${sub.plan_id}${orphan ? " [ORPHAN tenant_id]" : ""}`
      );
    }
    if (orphanSubs > 0) {
      warn(`${orphanSubs} subscription(s) có tenant_id không khớp venues.id`);
    } else if ((subs || []).length > 0) {
      ok("Tất cả tenant_subscriptions.tenant_id khớp venues.id");
    }
  }

  if (admin) {
    console.log("\n--- profiles.venue_id alignment ---\n");

    const { data: profiles, error: profilesErr } = await admin
      .from("profiles")
      .select("email, role, venue_id")
      .order("email");

    if (profilesErr) {
      warn(`profiles: ${profilesErr.message}`);
    } else {
      const venueIds = new Set((venues || []).map((v) => v.id));
      const blocklist = new Set(["tenant-demo", "tenant_demo", "demo-tenant"]);
      let issues = 0;

      for (const profile of profiles || []) {
        const email = profile.email || profile.id;
        if (!profile.venue_id) {
          if (["COURT_OWNER", "VENUE_OWNER", "CLUB_OWNER", "VENUE_MANAGER"].includes(profile.role)) {
            warn(`${email} (${profile.role}) — venue_id NULL`);
            issues += 1;
          }
          continue;
        }
        if (blocklist.has(String(profile.venue_id).toLowerCase())) {
          warn(`${email} — blocklisted venue_id: ${profile.venue_id}`);
          issues += 1;
        } else if (!venueIds.has(profile.venue_id)) {
          warn(`${email} — orphan venue_id: ${profile.venue_id}`);
          issues += 1;
        }
      }

      if (issues === 0) {
        ok("profiles.venue_id alignment — không phát hiện orphan/blocklist (owner roles)");
      } else {
        warn(`${issues} profile alignment issue(s) — apply docs/supabase-billing-phase10e-staging-tenant-align.sql`);
      }
    }
  }

  console.log("\n--- Kết luận ---\n");
  info("Mapping chuẩn: profiles.venue_id = venues.id = tenant_subscriptions.tenant_id");
  info("Fix staging: docs/supabase-billing-phase10e-staging-tenant-align.sql");
  console.log("");
}

main().catch((error) => {
  fail(error?.message || String(error));
});
