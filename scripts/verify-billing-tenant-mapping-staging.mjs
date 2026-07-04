/**
 * Phase 10E / 20B — Verify billing tenant mapping + pilot operational readiness
 *
 * Usage:
 *   node scripts/verify-billing-tenant-mapping-staging.mjs
 *   npm run test:verify-billing-tenant-mapping
 *
 * Requires in .env.local (staging Preview / Supabase):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 * Optional (full alignment + profiles):
 *   SUPABASE_SERVICE_ROLE_KEY
 * Optional (pilot venue filter):
 *   STAGING_PILOT_VENUE_ID=<venues.id UUID>
 * Optional (owner email hint):
 *   STAGING_PILOT_OWNER_EMAIL=owner@example.com
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

const OPERATIONAL_STATUSES = new Set(["trialing", "active"]);

/** Bảng giải thích lỗi — in khi probe fail (không in secret). */
const ERROR_INTERPRETATION = [
  { match: /unregistered|invalid api key/i, code: "Unregistered API key", meaning: "Key sai hoặc không cùng project", action: "Sửa .env.local — lấy key từ staging qyewbxjsiiyufanzcjcq" },
  { match: /tenant_not_found/i, code: "tenant_not_found", meaning: "Owner chưa gắn đúng venue", action: "Kiểm tra profiles.venue_id khớp venues.id" },
  { match: /no_subscription/i, code: "no_subscription", meaning: "Venue chưa có trial/active subscription", action: "Tạo trial subscription cho tenant_id" },
  { match: /owner_not_found|không tìm thấy profile owner/i, code: "owner_not_found", meaning: "Email owner chưa có profile", action: "Tạo/cập nhật owner trong profiles" },
  { match: /permission denied|42501|row-level security/i, code: "permission denied", meaning: "RLS/role chưa đúng", action: "Kiểm tra role/profile và RLS staging" },
];

function printErrorInterpretation(message) {
  const text = String(message || "");
  console.log("\n--- Bảng lỗi thường gặp ---\n");
  for (const row of ERROR_INTERPRETATION) {
    const hit = row.match.test(text) || row.code.toLowerCase() === text.toLowerCase();
    const marker = hit ? "→ " : "  ";
    console.log(`${marker}| ${row.code} | ${row.meaning} | ${row.action} |`);
  }
  console.log("");
  info("Chi tiết: docs/v5/PHASE_21B_OWNER_STAGING_ENV_FIX.md § Billing tenant mapping");
}

function interpretSupabaseError(error) {
  if (!error) return;
  const message = String(error.message || "");
  printErrorInterpretation(message);

  if (/unregistered|invalid api key/i.test(message)) {
    fail(
      "Unregistered API key — VITE_SUPABASE_ANON_KEY hoặc SUPABASE_SERVICE_ROLE_KEY không khớp project staging. Sửa .env.local, không gửi key qua chat."
    );
  }
}

function isOperationalStatus(status) {
  return OPERATIONAL_STATUSES.has(String(status || "").toLowerCase());
}

function summarizeOperationalReadiness({ venues, subs, pilotVenueId }) {
  const venueIds = new Set((venues || []).map((v) => v.id));
  const subsByTenant = new Map((subs || []).map((s) => [s.tenant_id, s]));
  const targets = pilotVenueId ? [pilotVenueId] : [...venueIds];

  let operationalCount = 0;
  let blockedCount = 0;
  let noSubCount = 0;

  for (const tenantId of targets) {
    if (!venueIds.has(tenantId)) {
      warn(`Pilot venue ${tenantId} không tồn tại trong venues`);
      continue;
    }
    const sub = subsByTenant.get(tenantId);
    if (!sub) {
      noSubCount += 1;
      warn(`${tenantId} — no_subscription (không operational)`);
      continue;
    }
    if (isOperationalStatus(sub.status)) {
      operationalCount += 1;
      ok(`${tenantId} — ${sub.status} (operational)`);
    } else {
      blockedCount += 1;
      warn(`${tenantId} — ${sub.status} (blocked — expired/suspended/past_due)`);
    }
  }

  return { operationalCount, blockedCount, noSubCount, subsByTenant };
}

async function main() {
  console.log("=== Phase 20B — Billing Tenant Mapping + Pilot Operational Verify ===\n");

  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    fail("Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong .env.local");
  }

  loadProjectEnv();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!serviceKey) {
    warn("Thiếu SUPABASE_SERVICE_ROLE_KEY — chỉ probe venues/subscriptions anon-safe.");
    info("Bắt buộc cho profiles.venue_id alignment — thêm key từ Dashboard staging → Settings → API.");
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
    interpretSupabaseError(venuesErr);
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
    if (!venuesErr) interpretSupabaseError(subsErr);
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

  const pilotVenueId = String(process.env.STAGING_PILOT_VENUE_ID || "").trim();
  const pilotOwnerEmail = String(process.env.STAGING_PILOT_OWNER_EMAIL || "").trim();

  console.log("\n--- Phase 20B operational readiness ---\n");

  if (pilotVenueId) {
    info(`Pilot venue filter: ${pilotVenueId}`);
  }
  if (pilotOwnerEmail) {
    info(`Pilot owner hint: ${pilotOwnerEmail}`);
  }

  const readiness = summarizeOperationalReadiness({
    venues: venues || [],
    subs: subs || [],
    pilotVenueId: pilotVenueId || null,
  });

  if (admin && pilotOwnerEmail) {
    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("email, role, venue_id")
      .eq("email", pilotOwnerEmail)
      .maybeSingle();

    if (!ownerProfile) {
      warn(`Không tìm thấy profile owner: ${pilotOwnerEmail}`);
    } else if (!ownerProfile.venue_id) {
      warn(`${pilotOwnerEmail} — venue_id NULL`);
    } else if (pilotVenueId && ownerProfile.venue_id !== pilotVenueId) {
      warn(
        `${pilotOwnerEmail} — venue_id ${ownerProfile.venue_id} ≠ STAGING_PILOT_VENUE_ID ${pilotVenueId}`
      );
    } else {
      const ownerSub = readiness.subsByTenant.get(ownerProfile.venue_id);
      if (!ownerSub) {
        warn(`${pilotOwnerEmail} — venue ${ownerProfile.venue_id} chưa có tenant_subscriptions`);
      } else if (!isOperationalStatus(ownerSub.status)) {
        warn(`${pilotOwnerEmail} — subscription ${ownerSub.status} (app sẽ khóa operational routes)`);
      } else {
        ok(`${pilotOwnerEmail} — venue ${ownerProfile.venue_id} / ${ownerSub.status}`);
      }
    }
  }

  console.log("\n--- App-side lock expectations (manual smoke) ---\n");
  info("no_subscription → OperationalRouteGate khóa /court-engine, /players, /dashboard ops");
  info("expired / suspended → khóa operational; /billing và /billing/support vẫn mở");
  info("trialing / active → operational routes mở (RBAC + route guard)");

  console.log("\n--- Kết luận ---\n");
  info("Mapping chuẩn: profiles.venue_id = venues.id = tenant_subscriptions.tenant_id");
  info("Fix staging: docs/supabase-billing-phase10e-staging-tenant-align.sql");
  info("Owner checklist: docs/v5/PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md");

  if (venuesErr || subsErr) {
    warn("Không đọc được Supabase — kiểm tra VITE_SUPABASE_URL / ANON_KEY / SERVICE_ROLE trong .env.local");
    const errMsg = venuesErr?.message || subsErr?.message || "";
    if (errMsg && !/unregistered|invalid api key/i.test(errMsg)) {
      printErrorInterpretation(errMsg);
    }
    process.exit(2);
  }

  if (pilotVenueId && readiness.operationalCount === 0) {
    warn("Pilot venue chưa sẵn sàng operational — cần trial/active subscription trước khi pilot 1 sân");
    process.exit(1);
  }

  if (readiness.operationalCount > 0) {
    ok(`Có ${readiness.operationalCount} venue operational (trialing/active)`);
  }

  console.log("");
}

main().catch((error) => {
  fail(error?.message || String(error));
});
