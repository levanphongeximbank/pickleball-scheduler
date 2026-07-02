/**
 * Phase 11C — Edge API key guard staging verify.
 *
 * Usage:
 *   STAGING_OWNER_A_PASSWORD=... STAGING_OWNER_B_PASSWORD=... STAGING_PLAYER_PASSWORD=... \
 *     node scripts/verify-phase11c-api-key-guard-staging.mjs
 *
 * Never prints raw API keys or secrets.
 */
import { createClient } from "@supabase/supabase-js";
import { can } from "../src/auth/rbac.js";
import { normalizeUser } from "../src/models/user.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";
import {
  createApiClientWithKey,
  revokeApiKey,
} from "../src/features/api/services/apiKeyService.js";
import { clearApiStorage } from "../src/features/api/storage/apiStorage.js";
import { guardApiKey } from "../src/features/api/guards/apiKeyGuard.js";
import { invokeEdgeApi } from "../src/features/api/router/edgeApiRouter.js";
import { API_SCOPES } from "../src/features/api/constants/apiScopes.js";
import { canManageApiKeys } from "../src/features/api/services/apiKeyManagementService.js";
import { enableRbac } from "../src/auth/authService.js";
import { hashApiKey } from "../src/features/api/utils/hashKey.js";
import { EDGE_API_ERROR_CODES } from "../src/features/api/constants/edgeApiErrors.js";

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

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function tenantValues(rows, column) {
  return [...new Set((rows || []).map((row) => row[column]).filter(Boolean))];
}

async function probeApiKeysRls(client, ownTenantId, otherTenantId, label) {
  const { data, error } = await client.from("api_keys").select("id, tenant_id, key_prefix, status").limit(50);

  if (error) {
    if (error.message?.includes("does not exist") || error.code === "42P01") {
      record("api_keys", label, "NOT_APPLICABLE", "table missing");
      logWarn(`${label}: api_keys MISSING`);
      return;
    }
    record("api_keys", label, "BLOCKED", error.message);
    logOk(`${label}: api_keys blocked (${error.code || "RLS"})`);
    return;
  }

  const tenants = tenantValues(data, "tenant_id");
  if (otherTenantId && tenants.includes(otherTenantId)) {
    record("api_keys", label, "FAIL", `leak ${otherTenantId}`);
    logWarn(`${label}: api_keys LEAK other tenant`);
    return;
  }
  if (tenants.length > 0 && !tenants.every((id) => id === ownTenantId)) {
    record("api_keys", label, "FAIL", `foreign tenants: ${tenants.join(",")}`);
    logWarn(`${label}: api_keys foreign tenant leak`);
    return;
  }

  record("api_keys", label, "PASS", `${(data || []).length} rows isolated`);
  logOk(`${label}: api_keys isolated (${(data || []).length} rows)`);
}

async function runInMemoryGuardChecks() {
  logInfo("\n--- In-memory API key guard (no network) ---\n");
  globalThis.localStorage = createLocalStorageMock();
  process.env.VITE_API_ENABLED = "true";
  clearApiStorage();

  const keyA = await createApiClientWithKey({
    name: "Staging Probe A",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.TENANT_READ, API_SCOPES.INTEGRATIONS_READ],
  });
  const keyB = await createApiClientWithKey({
    name: "Staging Probe B",
    tenantId: TENANT_B,
    scopes: [API_SCOPES.TENANT_READ],
  });

  const passA = await guardApiKey(keyA.plainKey, { requiredScope: API_SCOPES.TENANT_READ });
  if (!passA.ok || passA.tenantId !== TENANT_A) {
    fail("Owner A key guard failed");
  }
  logOk("Owner A key + scope: PASS");

  const crossB = await guardApiKey(keyA.plainKey, {
    requiredScope: API_SCOPES.TENANT_READ,
    tenantId: TENANT_B,
  });
  if (crossB.ok || crossB.code !== EDGE_API_ERROR_CODES.TENANT_NOT_FOUND) {
    fail("Owner A key must not access Tenant B");
  }
  logOk("Owner A key on Tenant B: BLOCKED");

  const passB = await guardApiKey(keyB.plainKey, { requiredScope: API_SCOPES.TENANT_READ });
  if (!passB.ok || passB.tenantId !== TENANT_B) {
    fail("Owner B key guard failed");
  }
  logOk("Owner B key + scope: PASS");

  const crossA = await guardApiKey(keyB.plainKey, {
    requiredScope: API_SCOPES.TENANT_READ,
    tenantId: TENANT_A,
  });
  if (crossA.ok || crossA.code !== EDGE_API_ERROR_CODES.TENANT_NOT_FOUND) {
    fail("Owner B key must not access Tenant A");
  }
  logOk("Owner B key on Tenant A: BLOCKED");

  revokeApiKey(keyA.apiKey.id);
  const revoked = await guardApiKey(keyA.plainKey, { requiredScope: API_SCOPES.TENANT_READ });
  if (revoked.ok || revoked.code !== EDGE_API_ERROR_CODES.INVALID_API_KEY) {
    fail("Revoked key must be blocked");
  }
  logOk("Revoked key: BLOCKED");

  const scopeDenied = await guardApiKey(keyB.plainKey, { requiredScope: API_SCOPES.INTEGRATIONS_READ });
  if (scopeDenied.ok || scopeDenied.code !== EDGE_API_ERROR_CODES.SCOPE_DENIED) {
    fail("Scope denied must block");
  }
  logOk("Scope denied: BLOCKED");

  const edge = await invokeEdgeApi({
    method: "GET",
    path: "/api/v1/tenant",
    headers: { "x-api-key": keyB.plainKey },
  });
  if (edge.statusCode !== 200 || edge.body?.data?.tenantId !== TENANT_B) {
    fail("invokeEdgeApi tenant route failed");
  }
  logOk("invokeEdgeApi /tenant with valid key: PASS");

  const hashOnly = await hashApiKey(keyB.plainKey);
  assertNoRawKeyInOutput(hashOnly, keyB.plainKey);
  record("guard", "memory", "PASS", "cross-tenant + revoke + scope");
}

function assertNoRawKeyInOutput(output, rawKey) {
  const secretPart = rawKey.split(".")[1] || "";
  if (secretPart && String(output).includes(secretPart)) {
    fail("Raw API key secret leaked to output");
  }
}

function runRbacProbe(profile) {
  if (!profile?.id) {
    return { apiManage: null, manageKeys: null, skipped: true };
  }
  enableRbac();
  const user = normalizeUser({
    id: profile.id,
    email: profile.email,
    role: profile.role,
    venueId: profile.venue_id,
    tenantId: profile.venue_id,
    clubId: profile.club_id,
    status: profile.status,
  });
  const rbac = { rbacEnabled: true };
  const scope = { venueId: profile.venue_id, tenantId: profile.venue_id };
  const apiManage = can(user, PERMISSIONS.API_MANAGE, scope, rbac);
  const manageKeys = canManageApiKeys(user);
  return { apiManage, manageKeys: manageKeys.ok };
}

async function main() {
  console.log("=== Phase 11C — Edge API Key Guard Verify ===\n");

  await runInMemoryGuardChecks();

  loadProjectEnv();
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    logWarn("Thiếu Supabase env — bỏ qua RLS probes");
    summarize();
    return;
  }

  if (!String(url).includes(STAGING_REF)) {
    logWarn(`URL không phải staging ${STAGING_REF} — chỉ chạy guard memory`);
    summarize();
    return;
  }

  logInfo("\n--- Staging JWT RLS probes ---\n");

  const ownerA = await signInStagingUser(process.env.STAGING_OWNER_A_EMAIL || "owner-a@staging.local");
  const ownerB = await signInStagingUser(process.env.STAGING_OWNER_B_EMAIL || "owner-b@staging.local");
  const player = await signInStagingUser(process.env.STAGING_PLAYER_EMAIL || "player@staging.local");

  const clientA = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${ownerA.accessToken}` } },
  });
  const clientB = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${ownerB.accessToken}` } },
  });
  const clientP = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${player.accessToken}` } },
  });

  await probeApiKeysRls(clientA, TENANT_A, TENANT_B, "Owner A");
  await probeApiKeysRls(clientB, TENANT_B, TENANT_A, "Owner B");
  await probeApiKeysRls(clientP, player.profile?.venue_id, TENANT_A, "PLAYER");

  const rbacA = runRbacProbe(ownerA.profile);
  const rbacP = runRbacProbe(player.profile);
  if (rbacA.skipped || rbacP.skipped) {
    logWarn("Staging JWT sign-in thiếu profile — bỏ qua RBAC probes");
    record("rbac", "staging", "NOT_APPLICABLE", "missing credentials");
  } else {
    if (!rbacA.manageKeys) {
      record("rbac", "Owner A", "FAIL", "cannot manage api keys");
      logWarn("Owner A API manage: FAIL");
    } else {
      record("rbac", "Owner A", "PASS", "api.manage");
      logOk("Owner A API manage: PASS");
    }

    if (rbacP.manageKeys) {
      record("rbac", "PLAYER", "FAIL", "unexpected api.manage");
      logWarn("PLAYER API manage: UNEXPECTEDLY allowed");
    } else {
      record("rbac", "PLAYER", "PASS", "blocked");
      logOk("PLAYER API manage: BLOCKED");
    }
  }

  summarize();
}

function summarize() {
  const failed = results.filter((r) => r.status === "FAIL");
  console.log("\n=== Summary ===");
  console.log(`Total checks: ${results.length}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length > 0) {
    for (const f of failed) {
      console.log(`  - ${f.scope}/${f.actor}: ${f.detail}`);
    }
    process.exit(1);
  }
  const skipped = results.filter((r) => r.status === "NOT_APPLICABLE");
  if (skipped.length > 0) {
    console.log(`Skipped: ${skipped.length} (credentials/SQL not available)`);
  }
  console.log("Phase 11C guard verify: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
