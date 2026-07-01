/**
 * Phase 10D — Authenticated cross-tenant RLS verify (staging only).
 *
 * Kết luận RLS dựa trên Supabase client JWT (anon key + signInWithPassword).
 * KHÔNG dùng service_role để đánh giá quyền user.
 *
 * Usage:
 *   STAGING_OWNER_A_PASSWORD=... STAGING_OWNER_B_PASSWORD=... \
 *     node scripts/verify-cross-tenant-rls-staging.mjs
 *
 * Optional .env.local (passwords — never commit):
 *   STAGING_OWNER_A_EMAIL=owner@staging.local
 *   STAGING_OWNER_A_PASSWORD=...
 *   STAGING_OWNER_B_EMAIL=owner-b@staging.local
 *   STAGING_OWNER_B_PASSWORD=...
 *   STAGING_PLAYER_EMAIL=player@staging.local
 *   STAGING_PLAYER_PASSWORD=...
 *   STAGING_SUPER_ADMIN_EMAIL=admin@staging.local
 *   STAGING_SUPER_ADMIN_PASSWORD=...
 *   STAGING_TENANT_A_ID=venue-staging-a
 *   STAGING_TENANT_B_ID=venue-staging-b
 */
import { createClient } from "@supabase/supabase-js";
import { can } from "../src/auth/rbac.js";
import { canAccessRoute } from "../src/auth/menuAccess.js";
import { normalizeUser } from "../src/models/user.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";

const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";

/** @type {Array<{table:string, tenantColumn?:string, mode:'tenant'|'own-user'|'global-catalog'|'venue-id'|'blocked-empty'|'policy-open'}>} */
const TABLE_PROBES = [
  { table: "profiles", mode: "venue-id", tenantColumn: "venue_id" },
  { table: "venues", mode: "venue-id", tenantColumn: "id" },
  { table: "tenant_subscriptions", mode: "tenant", tenantColumn: "tenant_id" },
  { table: "invoices", mode: "tenant", tenantColumn: "tenant_id" },
  { table: "payments", mode: "tenant", tenantColumn: "tenant_id" },
  { table: "billing_audit_logs", mode: "tenant", tenantColumn: "tenant_id" },
  { table: "billing_events", mode: "tenant", tenantColumn: "tenant_id" },
  { table: "club_data_v3", mode: "tenant", tenantColumn: "venue_id" },
  { table: "tournament_match_live", mode: "blocked-empty", tenantColumn: "club_id" },
  { table: "notifications", mode: "own-user", tenantColumn: "user_id" },
  { table: "push_subscriptions", mode: "own-user", tenantColumn: "user_id" },
  { table: "qr_tokens", mode: "policy-open", tenantColumn: "tenant_id" },
  { table: "checkins", mode: "policy-open", tenantColumn: "tenant_id" },
  { table: "audit_logs", mode: "venue-id", tenantColumn: "venue_id" },
  { table: "ai_suggestions", mode: "tenant", tenantColumn: "tenant_id" },
  { table: "plans", mode: "global-catalog" },
  { table: "plan_limits", mode: "global-catalog" },
];

const results = [];

function record(table, actor, status, detail) {
  results.push({ table, actor, status, detail });
}

function logLine(prefix, message) {
  console.log(`${prefix} ${message}`);
}

function ok(message) {
  logLine("✅", message);
}

function warn(message) {
  logLine("⚠️ ", message);
}

function info(message) {
  logLine("ℹ️ ", message);
}

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function assertStagingUrl(url) {
  if (!String(url || "").includes(STAGING_REF)) {
    fail(`URL không phải staging ${STAGING_REF} — dừng.`);
  }
}

function tenantValues(rows, column) {
  return [...new Set((rows || []).map((row) => row[column]).filter(Boolean))];
}

function hasForeignTenant(rows, column, ownTenantId, otherTenantId) {
  const values = tenantValues(rows, column);
  if (otherTenantId && values.includes(otherTenantId)) {
    return { leak: true, reason: `thấy ${otherTenantId}` };
  }
  if (ownTenantId && values.length > 0 && !values.every((id) => id === ownTenantId)) {
    return { leak: true, reason: `tenant lạ: ${values.join(", ")}` };
  }
  return { leak: false };
}

async function signIn(url, anonKey, email, password) {
  if (!email || !password) {
    return { client: null, profile: null, error: "missing_credentials" };
  }
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { client: null, profile: null, error: error.message };
  }
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, email, role, venue_id, club_id, status")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) {
    return { client, profile: null, error: profileError.message };
  }
  return { client, profile, userId: data.user.id, error: null };
}

async function probeSelect(client, table) {
  return client.from(table).select("*").limit(50);
}

async function probeSelectOtherTenant(client, table, tenantColumn, otherTenantId) {
  return client.from(table).select("*").eq(tenantColumn, otherTenantId).limit(10);
}

async function probeInsertOtherTenantSubscription(client, otherTenantId) {
  return client.from("tenant_subscriptions").insert({
    tenant_id: otherTenantId,
    status: "trialing",
    plan_id: "plan-TRIAL",
  });
}

async function runTenantActorProbes({ label, client, profile, ownTenantId, otherTenantId }) {
  info(`\n--- ${label} (${profile.email}, venue=${profile.venue_id}) ---\n`);

  for (const probe of TABLE_PROBES) {
    const { table, tenantColumn, mode } = probe;
    const { data, error } = await probeSelect(client, table);

    if (error) {
      if (error.message.includes("does not exist") || error.code === "42P01") {
        record(table, label, "NOT_APPLICABLE", error.message);
        info(`${table}: NOT_APPLICABLE — ${error.message}`);
        continue;
      }
      record(table, label, "BLOCKED", error.message);
      warn(`${table}: ERR ${error.message}`);
      continue;
    }

    const rows = data || [];

    if (mode === "global-catalog") {
      record(table, label, "PASS", `catalog ${rows.length} rows (global by design)`);
      ok(`${table}: global catalog OK (${rows.length})`);
      continue;
    }

    if (mode === "own-user") {
      const foreignUsers = rows.filter((row) => row.user_id && row.user_id !== profile.id);
      if (foreignUsers.length > 0) {
        record(table, label, "FAIL", `leak user_id khác (${foreignUsers.length})`);
        warn(`${table}: LEAK — rows của user khác`);
      } else {
        record(table, label, "PASS", `${rows.length} rows own-user`);
        ok(`${table}: own-user OK (${rows.length})`);
      }
      continue;
    }

    if (mode === "policy-open") {
      if (rows.length === 0) {
        record(table, label, "PARTIAL", "0 rows — policy USING(true), chưa có data leak thực tế");
        warn(`${table}: POLICY OPEN (USING true) — 0 rows, cần seed cross-tenant để xác nhận leak`);
      } else {
        const foreign = hasForeignTenant(rows, tenantColumn, ownTenantId, otherTenantId);
        if (foreign.leak) {
          record(table, label, "FAIL", `policy open + ${foreign.reason}`);
          warn(`${table}: FAIL — policy open + ${foreign.reason}`);
        } else {
          record(table, label, "PARTIAL", `policy open nhưng chỉ own tenant trong sample`);
          warn(`${table}: policy open — chỉ thấy tenant own trong ${rows.length} rows`);
        }
      }
      continue;
    }

    if (tenantColumn) {
      const foreign = hasForeignTenant(rows, tenantColumn, ownTenantId, otherTenantId);
      if (foreign.leak) {
        record(table, label, "FAIL", foreign.reason);
        warn(`${table}: LEAK — ${foreign.reason}`);
        continue;
      }
    }

    record(table, label, rows.length ? "PASS" : "PASS", `${rows.length} rows isolated`);
    ok(`${table}: isolated OK (${rows.length} rows)`);
  }

  if (otherTenantId) {
    const filtered = await probeSelectOtherTenant(
      client,
      "tenant_subscriptions",
      "tenant_id",
      otherTenantId
    );
    if (filtered.error) {
      warn(`filter tenant_subscriptions ${otherTenantId}: ${filtered.error.message}`);
    } else if ((filtered.data || []).length > 0) {
      record("tenant_subscriptions(filter)", label, "FAIL", `đọc được ${otherTenantId}`);
      warn(`tenant_subscriptions filter ${otherTenantId}: LEAK`);
    } else {
      ok(`tenant_subscriptions filter ${otherTenantId}: 0 rows`);
    }

    const insertResult = await probeInsertOtherTenantSubscription(client, otherTenantId);
    if (insertResult.error?.message?.includes("row-level security")) {
      ok(`insert tenant_subscriptions ${otherTenantId}: blocked by RLS`);
    } else if (insertResult.error) {
      warn(`insert tenant_subscriptions ${otherTenantId}: ${insertResult.error.message}`);
    } else {
      record("tenant_subscriptions(insert)", label, "FAIL", "insert thành công");
      warn(`insert tenant_subscriptions ${otherTenantId}: FAIL — insert không bị chặn`);
    }
  }
}

function runRouteRbacChecks(profile) {
  const user = normalizeUser({
    id: profile.id,
    email: profile.email,
    role: profile.role,
    venueId: profile.venue_id,
    clubId: profile.club_id,
    status: profile.status,
  });
  const rbac = { rbacEnabled: true };
  const scope = { venueId: profile.venue_id, tenantId: profile.venue_id, clubId: profile.club_id };
  const check = (path) => canAccessRoute((perm, s) => can(user, perm, s, rbac), path, scope);

  return {
    billing: check("/billing"),
    adminBilling: check("/admin/billing"),
    courtEngine: check("/court-engine"),
    users: check("/users"),
  };
}

async function main() {
  console.log("=== Phase 10D — Cross-tenant RLS Verify (authenticated JWT) ===\n");

  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    fail("Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong .env.local");
  }
  assertStagingUrl(url);

  loadProjectEnv();

  const tenantA = String(process.env.STAGING_TENANT_A_ID || TENANT_A).trim();
  const tenantB = String(process.env.STAGING_TENANT_B_ID || TENANT_B).trim();

  const creds = {
    ownerA: {
      email: String(process.env.STAGING_OWNER_A_EMAIL || "owner@staging.local").trim(),
      password: String(process.env.STAGING_OWNER_A_PASSWORD || "").trim(),
    },
    ownerB: {
      email: String(process.env.STAGING_OWNER_B_EMAIL || "owner-b@staging.local").trim(),
      password: String(process.env.STAGING_OWNER_B_PASSWORD || "").trim(),
    },
    player: {
      email: String(process.env.STAGING_PLAYER_EMAIL || "player@staging.local").trim(),
      password: String(process.env.STAGING_PLAYER_PASSWORD || "").trim(),
    },
    admin: {
      email: String(process.env.STAGING_SUPER_ADMIN_EMAIL || "admin@staging.local").trim(),
      password: String(process.env.STAGING_SUPER_ADMIN_PASSWORD || "").trim(),
    },
  };

  let ownerA = await signIn(url, anonKey, creds.ownerA.email, creds.ownerA.password);
  if (ownerA.error) {
    fail(`Owner A login failed: ${ownerA.error}`);
  }
  ok(`Owner A login: ${creds.ownerA.email}`);

  await runTenantActorProbes({
    label: "Owner A",
    client: ownerA.client,
    profile: ownerA.profile,
    ownTenantId: tenantA,
    otherTenantId: tenantB,
  });

  const ownerARoutes = runRouteRbacChecks(ownerA.profile);
  info(`Owner A routes: billing=${ownerARoutes.billing} admin/billing=${ownerARoutes.adminBilling}`);

  let ownerBBlocked = false;
  const ownerB = await signIn(url, anonKey, creds.ownerB.email, creds.ownerB.password);
  if (ownerB.error) {
    ownerBBlocked = true;
    warn(`Owner B login skipped: ${ownerB.error} — seed docs/supabase-staging-phase10d-tenant-b-seed.sql`);
    record("_setup", "Owner B", "BLOCKED", ownerB.error);
  } else {
    ok(`Owner B login: ${creds.ownerB.email}`);
    await runTenantActorProbes({
      label: "Owner B",
      client: ownerB.client,
      profile: ownerB.profile,
      ownTenantId: tenantB,
      otherTenantId: tenantA,
    });
  }

  const player = await signIn(url, anonKey, creds.player.email, creds.player.password);
  if (player.error) {
    warn(`PLAYER login skipped: ${player.error}`);
    record("_setup", "PLAYER", "BLOCKED", player.error);
  } else {
    ok(`PLAYER login: ${creds.player.email}`);
    const playerRoutes = runRouteRbacChecks(player.profile);
    info(`PLAYER routes: billing=${playerRoutes.billing} admin/billing=${playerRoutes.adminBilling} court-engine=${playerRoutes.courtEngine}`);
    if (playerRoutes.billing || playerRoutes.adminBilling) {
      record("_routes", "PLAYER", "FAIL", "PLAYER có quyền billing/admin");
      warn("PLAYER: FAIL — có quyền billing/admin route");
    } else {
      record("_routes", "PLAYER", "PASS", "không có billing/admin");
      ok("PLAYER: billing/admin routes blocked");
    }
    const { data: subs } = await player.client.from("tenant_subscriptions").select("tenant_id");
    const leak = hasForeignTenant(subs, "tenant_id", player.profile.venue_id, tenantB);
    if (leak.leak && subs?.length) {
      record("tenant_subscriptions", "PLAYER", "FAIL", leak.reason);
      warn(`PLAYER tenant_subscriptions: ${leak.reason}`);
    } else {
      ok(`PLAYER tenant_subscriptions: ${subs?.length || 0} rows OK`);
    }
  }

  const admin = await signIn(url, anonKey, creds.admin.email, creds.admin.password);
  if (admin.error) {
    warn(`SUPER_ADMIN login skipped: ${admin.error}`);
  } else {
    ok(`SUPER_ADMIN login: ${creds.admin.email}`);
    const { data: venues } = await admin.client.from("venues").select("id");
    const venueIds = (venues || []).map((v) => v.id);
    info(`SUPER_ADMIN venues: ${venueIds.join(", ") || "(none)"}`);
    record("venues", "SUPER_ADMIN", venueIds.length >= 2 ? "PASS" : "PARTIAL", venueIds.join(","));
  }

  console.log("\n--- Summary ---\n");
  const counts = { PASS: 0, PARTIAL: 0, FAIL: 0, BLOCKED: 0, NOT_APPLICABLE: 0 };
  for (const row of results) {
    counts[row.status] = (counts[row.status] || 0) + 1;
  }
  info(`PASS=${counts.PASS || 0} PARTIAL=${counts.PARTIAL || 0} FAIL=${counts.FAIL || 0} BLOCKED=${counts.BLOCKED || 0} N/A=${counts.NOT_APPLICABLE || 0}`);

  if (ownerBBlocked) {
    warn("Tenant B bidirectional QA: BLOCKED — cần seed owner-b@staging.local");
  }

  const fails = results.filter((row) => row.status === "FAIL");
  if (fails.length > 0) {
    fail(`Cross-tenant RLS: FAIL (${fails.length} findings)`);
  }

  if (ownerBBlocked) {
    warn("Kết luận: PARTIAL — Owner A PASS; Owner B/PLAYER cần creds staging");
    process.exit(0);
  }

  ok("Cross-tenant RLS authenticated probe: PASS (no FAIL rows)");
}

main().catch((error) => {
  fail(error?.message || String(error));
});
