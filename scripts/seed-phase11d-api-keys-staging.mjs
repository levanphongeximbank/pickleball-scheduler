/**
 * Phase 11D — Staging API key seed (service role).
 * Seeds probe keys into Supabase; never prints raw API keys.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-phase11d-api-keys-staging.mjs
 *
 * Returns fixture handles via stdout summary (prefix only) when run standalone.
 */
import { createClient } from "@supabase/supabase-js";
import { generateApiKey } from "../src/features/api/utils/hashKey.js";
import { API_SCOPES } from "../src/features/api/constants/apiScopes.js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

export const PHASE11D_SEED_PREFIX = "Phase11D Probe";
export const TENANT_A = "venue-staging-a";
export const TENANT_B = "venue-staging-b";

const FIXTURE_DEFS = [
  {
    id: "tenantARead",
    label: "TenantA-Read",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.TENANT_READ],
    status: "active",
    expiresAt: null,
  },
  {
    id: "tenantBRead",
    label: "TenantB-Read",
    tenantId: TENANT_B,
    scopes: [API_SCOPES.TENANT_READ],
    status: "active",
    expiresAt: null,
  },
  {
    id: "tenantANoIntegrations",
    label: "TenantA-NoIntegrations",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.TENANT_READ],
    status: "active",
    expiresAt: null,
  },
  {
    id: "tenantAIntegrations",
    label: "TenantA-Integrations",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.TENANT_READ, API_SCOPES.INTEGRATIONS_READ],
    status: "active",
    expiresAt: null,
  },
  {
    id: "tenantAIntegrationsWrite",
    label: "TenantA-IntegrationsWrite",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.INTEGRATIONS_READ, API_SCOPES.INTEGRATIONS_WRITE],
    status: "active",
    expiresAt: null,
  },
  {
    id: "tenantARevoked",
    label: "TenantA-Revoked",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.TENANT_READ],
    status: "revoked",
    expiresAt: null,
  },
  {
    id: "tenantAExpired",
    label: "TenantA-Expired",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.TENANT_READ],
    status: "active",
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  },
  {
    id: "tenantAWebhookRw",
    label: "TenantA-WebhookRW",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.WEBHOOKS_READ, API_SCOPES.WEBHOOKS_WRITE],
    status: "active",
    expiresAt: null,
  },
  {
    id: "tenantAWebhookRo",
    label: "TenantA-WebhookRO",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.WEBHOOKS_READ],
    status: "active",
    expiresAt: null,
  },
  {
    id: "tenantARateLimit",
    label: "TenantA-RateLimit",
    tenantId: TENANT_A,
    scopes: [API_SCOPES.TENANT_READ],
    status: "active",
    expiresAt: null,
  },
];

function createAdminClient() {
  loadProjectEnv();
  const { url } = getSupabaseEnv();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceKey) {
    throw new Error(
      "Thiếu VITE_SUPABASE_URL/SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function cleanupPhase11dSeed(admin) {
  const client = admin || createAdminClient();
  const { data: clients, error: listError } = await client
    .from("api_clients")
    .select("id")
    .like("name", `${PHASE11D_SEED_PREFIX}%`);

  if (listError) {
    return { ok: false, error: listError.message };
  }

  const clientIds = (clients || []).map((row) => row.id);
  if (clientIds.length > 0) {
    await client.from("api_keys").delete().in("client_id", clientIds);
    await client.from("api_clients").delete().in("id", clientIds);
  }

  return { ok: true, removedClients: clientIds.length };
}

async function insertFixture(client, def) {
  const { plainKey, prefix, hashedKey } = await generateApiKey();

  const clientInsert = await client
    .from("api_clients")
    .insert({
      name: `${PHASE11D_SEED_PREFIX} ${def.label}`,
      tenant_id: def.tenantId,
      status: "active",
    })
    .select("id")
    .single();

  if (clientInsert.error) {
    return { ok: false, error: clientInsert.error.message, def };
  }

  const keyInsert = await client
    .from("api_keys")
    .insert({
      client_id: clientInsert.data.id,
      tenant_id: def.tenantId,
      key_prefix: prefix,
      hashed_key: hashedKey,
      scopes: def.scopes,
      status: def.status,
      expires_at: def.expiresAt,
    })
    .select("id, key_prefix, tenant_id, status")
    .single();

  if (keyInsert.error) {
    await client.from("api_clients").delete().eq("id", clientInsert.data.id);
    return { ok: false, error: keyInsert.error.message, def };
  }

  return {
    ok: true,
    id: def.id,
    plainKey,
    prefix,
    keyId: keyInsert.data.id,
    clientId: clientInsert.data.id,
    tenantId: def.tenantId,
    scopes: def.scopes,
    status: def.status,
  };
}

/**
 * Seed all Phase 11D fixtures. Caller must cleanup after verify.
 * @returns {{ ok: boolean, fixtures?: Record<string, object>, error?: string }}
 */
export async function seedPhase11dFixtures(admin = null) {
  const client = admin || createAdminClient();
  await cleanupPhase11dSeed(client);

  const fixtures = {};
  const errors = [];

  for (const def of FIXTURE_DEFS) {
    const result = await insertFixture(client, def);
    if (!result.ok) {
      errors.push(`${def.id}: ${result.error}`);
      continue;
    }
    fixtures[result.id] = {
      plainKey: result.plainKey,
      prefix: result.prefix,
      keyId: result.keyId,
      clientId: result.clientId,
      tenantId: result.tenantId,
      scopes: result.scopes,
      status: result.status,
    };
  }

  if (errors.length > 0) {
    await cleanupPhase11dSeed(client);
    return { ok: false, error: errors.join("; ") };
  }

  return { ok: true, fixtures };
}

async function main() {
  console.log("Phase 11D — seed staging API keys (no raw keys logged)\n");
  const seeded = await seedPhase11dFixtures();
  if (!seeded.ok) {
    console.error(`Seed FAILED: ${seeded.error}`);
    process.exit(1);
  }

  console.log(`Seeded ${Object.keys(seeded.fixtures).length} fixtures:`);
  for (const [id, fx] of Object.entries(seeded.fixtures)) {
    console.log(`  ${id}: prefix=${fx.prefix} tenant=${fx.tenantId}`);
  }
  console.log("\nRun verify script next; cleanup runs automatically after verify.");
}

const isMain =
  import.meta.url === new URL(process.argv[1], "file:").href ||
  process.argv[1]?.endsWith("seed-phase11d-api-keys-staging.mjs");

if (isMain) {
  main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
}
