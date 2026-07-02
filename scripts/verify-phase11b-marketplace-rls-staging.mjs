/**
 * Phase 11B — Marketplace/API RLS verify (authenticated JWT only for conclusions).
 *
 * Usage:
 *   STAGING_OWNER_A_PASSWORD=... STAGING_OWNER_B_PASSWORD=... STAGING_PLAYER_PASSWORD=... \
 *     node scripts/verify-phase11b-marketplace-rls-staging.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { can } from "../src/auth/rbac.js";
import { canAccessRoute } from "../src/auth/menuAccess.js";
import { normalizeUser } from "../src/models/user.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";

const results = [];

function record(scope, actor, status, detail) {
  results.push({ scope, actor, status, detail });
}

function logOk(msg) {
  console.log(`✅ ${msg}`);
}

function logWarn(msg) {
  console.log(`⚠️  ${msg}`);
}

function logInfo(msg) {
  console.log(`ℹ️  ${msg}`);
}

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

function assertStagingUrl(url) {
  if (!String(url || "").includes(STAGING_REF)) {
    fail(`URL không phải staging ${STAGING_REF}`);
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

async function signIn(url, anonKey, email) {
  void url;
  void anonKey;
  return signInStagingUser(email);
}

async function probeSchemaTables(url, anonKey) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const tables = [
    "webhook_endpoints",
    "tenant_integration_settings",
    "integration_audit_logs",
    "api_clients",
    "api_keys",
    "webhook_events",
    "marketplace_products",
  ];

  logInfo("\n--- Schema probe (anon — not RLS verdict) ---\n");
  const schema = {};

  for (const table of tables) {
    const { error } = await client.from(table).select("*").limit(1);
    if (
      error?.code === "PGRST205" ||
      error?.code === "42P01" ||
      (error?.message?.includes("does not exist") &&
        !error?.message?.includes("column"))
    ) {
      schema[table] = "MISSING";
      logWarn(`${table}: MISSING (apply SQL or reload schema)`);
    } else if (error) {
      schema[table] = "EXISTS";
      logOk(`${table}: EXISTS (RLS: ${error.code || "blocked"})`);
    } else {
      schema[table] = "EXISTS";
      logOk(`${table}: EXISTS`);
    }
  }

  return schema;
}

const TABLE_PROBES = [
  { table: "tenant_integration_settings", tenantColumn: "tenant_id" },
  { table: "integration_audit_logs", tenantColumn: "tenant_id" },
  { table: "api_clients", tenantColumn: "tenant_id" },
  { table: "api_keys", tenantColumn: "tenant_id" },
  { table: "webhook_endpoints", tenantColumn: "tenant_id" },
  { table: "webhook_events", tenantColumn: "tenant_id" },
  { table: "marketplace_products", tenantColumn: "tenant_id" },
];

async function probeSelect(client, table) {
  return client.from(table).select("*").limit(50);
}

async function probeFilterOther(client, table, tenantColumn, otherTenantId) {
  return client.from(table).select("*").eq(tenantColumn, otherTenantId).limit(10);
}

async function probeUpsertOwnSettings(client, tenantId, userId) {
  return client.from("tenant_integration_settings").upsert(
    {
      tenant_id: tenantId,
      settings: {
        tenantId,
        mockPaymentEnabled: true,
        zaloEnabled: false,
        updatedAt: new Date().toISOString(),
      },
      updated_by: userId,
    },
    { onConflict: "tenant_id" }
  );
}

async function probeUpsertOtherSettings(client, otherTenantId, userId) {
  return client.from("tenant_integration_settings").upsert(
    {
      tenant_id: otherTenantId,
      settings: { tenantId: otherTenantId, zaloEnabled: true },
      updated_by: userId,
    },
    { onConflict: "tenant_id" }
  );
}

async function probeInsertApiClient(client, tenantId) {
  return client.from("api_clients").insert({
    name: "rls-probe-client",
    tenant_id: tenantId,
    status: "active",
  });
}

async function probeInsertWebhookEndpoint(client, tenantId) {
  return client.from("webhook_endpoints").insert({
    tenant_id: tenantId,
    url: "https://example.invalid/webhook-probe",
    event_types: ["payment.succeeded"],
    status: "active",
  });
}

async function runReadProbes({ label, client, ownTenantId, otherTenantId }) {
  logInfo(`\n--- ${label} read probes ---`);

  for (const { table, tenantColumn } of TABLE_PROBES) {
    const { data, error } = await probeSelect(client, table);

    if (error) {
      if (error.message.includes("does not exist") || error.code === "42P01") {
        record(table, label, "NOT_APPLICABLE", "table missing — apply SQL");
        logWarn(`${table}: NOT_APPLICABLE (chưa apply SQL)`);
        continue;
      }
      record(table, label, "BLOCKED", error.message);
      logWarn(`${table}: BLOCKED — ${error.message}`);
      continue;
    }

    const rows = data || [];
    const foreign = hasForeignTenant(rows, tenantColumn, ownTenantId, otherTenantId);
    if (foreign.leak) {
      record(table, label, "FAIL", foreign.reason);
      logWarn(`${table}: LEAK — ${foreign.reason}`);
      continue;
    }

    record(table, label, "PASS", `${rows.length} rows isolated`);
    logOk(`${table}: isolated (${rows.length} rows)`);
  }

  if (otherTenantId) {
    const filtered = await probeFilterOther(
      client,
      "tenant_integration_settings",
      "tenant_id",
      otherTenantId
    );
    if (filtered.error) {
      logWarn(`filter tenant_integration_settings: ${filtered.error.message}`);
    } else if ((filtered.data || []).length > 0) {
      record("tenant_integration_settings(filter)", label, "FAIL", `đọc ${otherTenantId}`);
      logWarn(`tenant_integration_settings filter ${otherTenantId}: LEAK`);
    } else {
      logOk(`tenant_integration_settings filter ${otherTenantId}: 0 rows`);
    }
  }
}

async function runManageProbes({ label, client, profile, ownTenantId, otherTenantId, expectManage }) {
  logInfo(`\n--- ${label} manage probes (expectManage=${expectManage}) ---`);

  const upsertOwn = await probeUpsertOwnSettings(client, ownTenantId, profile.id);
  if (expectManage) {
    if (upsertOwn.error?.message?.includes("row-level security") || upsertOwn.error?.code === "42501") {
      record("tenant_integration_settings(upsert-own)", label, "FAIL", "RLS blocked own tenant");
      logWarn(`${label}: upsert own settings BLOCKED`);
    } else if (upsertOwn.error) {
      record("tenant_integration_settings(upsert-own)", label, "PARTIAL", upsertOwn.error.message);
      logWarn(`${label}: upsert own — ${upsertOwn.error.message}`);
    } else {
      record("tenant_integration_settings(upsert-own)", label, "PASS", "own tenant OK");
      logOk(`${label}: upsert own settings OK`);
    }
  } else {
    if (upsertOwn.error?.message?.includes("row-level security") || upsertOwn.error?.code === "42501") {
      record("tenant_integration_settings(upsert-own)", label, "PASS", "blocked as expected");
      logOk(`${label}: upsert own blocked (expected)`);
    } else if (!upsertOwn.error) {
      record("tenant_integration_settings(upsert-own)", label, "FAIL", "PLAYER managed settings");
      logWarn(`${label}: upsert own UNEXPECTEDLY allowed`);
    }
  }

  if (otherTenantId) {
    const upsertOther = await probeUpsertOtherSettings(client, otherTenantId, profile.id);
    if (upsertOther.error?.message?.includes("row-level security") || upsertOther.error?.code === "42501") {
      record("tenant_integration_settings(upsert-other)", label, "PASS", "cross-tenant blocked");
      logOk(`${label}: upsert other tenant blocked`);
    } else if (!upsertOther.error) {
      record("tenant_integration_settings(upsert-other)", label, "FAIL", "cross-tenant write");
      logWarn(`${label}: upsert other tenant ALLOWED — FAIL`);
    } else {
      record("tenant_integration_settings(upsert-other)", label, "PARTIAL", upsertOther.error.message);
      logWarn(`${label}: upsert other — ${upsertOther.error.message}`);
    }
  }

  const apiClient = await probeInsertApiClient(client, ownTenantId);
  if (expectManage) {
    if (apiClient.error?.message?.includes("row-level security")) {
      record("api_clients(insert)", label, "FAIL", "owner cannot insert");
      logWarn(`${label}: api_clients insert blocked`);
    } else if (!apiClient.error) {
      record("api_clients(insert)", label, "PASS", "insert own tenant");
      logOk(`${label}: api_clients insert OK`);
    }
  } else if (apiClient.error?.message?.includes("row-level security")) {
    record("api_clients(insert)", label, "PASS", "blocked");
    logOk(`${label}: api_clients insert blocked`);
  }

  const webhook = await probeInsertWebhookEndpoint(client, ownTenantId);
  if (expectManage) {
    if (!webhook.error) {
      record("webhook_endpoints(insert)", label, "PASS", "insert own");
      logOk(`${label}: webhook_endpoints insert OK`);
    } else if (webhook.error.message.includes("does not exist")) {
      record("webhook_endpoints(insert)", label, "NOT_APPLICABLE", webhook.error.message);
    }
  } else if (webhook.error?.message?.includes("row-level security")) {
    record("webhook_endpoints(insert)", label, "PASS", "blocked");
    logOk(`${label}: webhook_endpoints insert blocked`);
  }
}

function runIntegrationRbac(profile) {
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
  const perm = (p) => can(user, p, scope, rbac);

  return {
    integrationsRoute: check("/settings/integrations"),
    integrationManage: perm(PERMISSIONS.INTEGRATION_MANAGE),
    billing: check("/billing"),
    courtEngine: check("/court-engine"),
  };
}

async function main() {
  console.log("=== Phase 11B — Marketplace/API RLS Verify (JWT) ===\n");

  loadProjectEnv();
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    fail("Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  }
  assertStagingUrl(url);

  await probeSchemaTables(url, anonKey);

  const ownerAEmail = process.env.STAGING_OWNER_A_EMAIL || "owner@staging.local";
  const ownerBEmail = process.env.STAGING_OWNER_B_EMAIL || "owner-b@staging.local";
  const playerEmail = process.env.STAGING_PLAYER_EMAIL || "player@staging.local";

  const tenantA = process.env.STAGING_TENANT_A_ID || TENANT_A;
  const tenantB = process.env.STAGING_TENANT_B_ID || TENANT_B;

  const ownerA = await signIn(url, anonKey, ownerAEmail);
  const ownerB = await signIn(url, anonKey, ownerBEmail);
  const player = await signIn(url, anonKey, playerEmail);

  if (ownerA.error) fail(`Owner A login: ${ownerA.error}`);

  logOk(`Owner A: ${ownerA.profile.email} @ ${ownerA.profile.venue_id}`);

  let playerOk = false;
  if (player.error) {
    logWarn(`Player login skipped: ${player.error}`);
    record("_setup", "Player", "BLOCKED", player.error);
  } else {
    playerOk = true;
    logOk(`Player: ${player.profile.email} @ ${player.profile.venue_id}`);
  }

  let ownerBOk = false;
  if (ownerB.error) {
    logWarn(`Owner B login skipped: ${ownerB.error}`);
    record("_setup", "OwnerB", "BLOCKED", ownerB.error);
  } else {
    ownerBOk = true;
    logOk(`Owner B: ${ownerB.profile.email} @ ${ownerB.profile.venue_id}`);
  }

  await runReadProbes({
    label: "OwnerA",
    client: ownerA.client,
    ownTenantId: tenantA,
    otherTenantId: tenantB,
  });
  await runManageProbes({
    label: "OwnerA",
    client: ownerA.client,
    profile: ownerA.profile,
    ownTenantId: tenantA,
    otherTenantId: tenantB,
    expectManage: true,
  });

  if (ownerBOk) {
    await runReadProbes({
      label: "OwnerB",
      client: ownerB.client,
      ownTenantId: tenantB,
      otherTenantId: tenantA,
    });
    await runManageProbes({
      label: "OwnerB",
      client: ownerB.client,
      profile: ownerB.profile,
      ownTenantId: tenantB,
      otherTenantId: tenantA,
      expectManage: true,
    });
  }

  if (playerOk) {
    await runReadProbes({
      label: "Player",
      client: player.client,
      ownTenantId: tenantA,
      otherTenantId: tenantB,
    });
    await runManageProbes({
      label: "Player",
      client: player.client,
      profile: player.profile,
      ownTenantId: tenantA,
      otherTenantId: tenantB,
      expectManage: false,
    });
  }

  const rbacA = runIntegrationRbac(ownerA.profile);
  const rbacPlayer = playerOk ? runIntegrationRbac(player.profile) : null;
  logInfo(`\nRBAC Owner A integrations route: ${rbacA.integrationsRoute ? "allowed" : "blocked"}`);
  logInfo(`RBAC Owner A INTEGRATION_MANAGE: ${rbacA.integrationManage ? "yes" : "no"}`);
  logInfo(`RBAC Player integrations route: ${rbacPlayer ? (rbacPlayer.integrationsRoute ? "allowed" : "blocked") : "skipped"}`);
  logInfo(`RBAC Player INTEGRATION_MANAGE: ${rbacPlayer ? (rbacPlayer.integrationManage ? "yes" : "no") : "skipped"}`);

  const pass = results.filter((r) => r.status === "PASS").length;
  const partial = results.filter((r) => r.status === "PARTIAL").length;
  const notApp = results.filter((r) => r.status === "NOT_APPLICABLE").length;
  const blocked = results.filter((r) => r.status === "BLOCKED").length;
  const fails = results.filter((r) => r.status === "FAIL").length;

  console.log(`\n=== Summary ===`);
  console.log(`PASS=${pass} PARTIAL=${partial} NOT_APPLICABLE=${notApp} BLOCKED=${blocked} FAIL=${fails}`);

  if (fails > 0) {
    process.exit(1);
  }
}

main();
