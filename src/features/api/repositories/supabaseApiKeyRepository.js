import { createClient } from "@supabase/supabase-js";
import { API_CLIENT_STATUS } from "../models/apiModels.js";
import {
  ApiKeyStoreConfigError,
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
} from "../config/apiKeyStoreConfig.js";

let adminClient = null;

function mapKeyRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    tenantId: row.tenant_id,
    keyPrefix: row.key_prefix,
    hashedKey: row.hashed_key,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    status: row.status,
    expiresAt: row.expires_at || null,
    lastUsedAt: row.last_used_at || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
  };
}

function mapClientRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || "API Client",
    tenantId: row.tenant_id || null,
    status: row.status || API_CLIENT_STATUS.ACTIVE,
  };
}

export function getSupabaseAdminClient() {
  const url = getSupabaseServerUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) {
    throw new ApiKeyStoreConfigError(
      "Supabase API key repository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  if (!adminClient) {
    adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export function resetSupabaseAdminClientForTests() {
  adminClient = null;
}

/**
 * Lookup candidate keys by prefix — hash compare happens in guard layer.
 */
export async function findSupabaseKeyCandidatesByPrefix(prefix) {
  if (!prefix) return [];

  const admin = getSupabaseAdminClient();
  const { data: keyRows, error } = await admin
    .from("api_keys")
    .select(
      "id, client_id, tenant_id, key_prefix, hashed_key, scopes, status, expires_at, last_used_at, created_by, created_at"
    )
    .eq("key_prefix", prefix);

  if (error) {
    throw new Error(`Supabase api_keys lookup failed: ${error.message}`);
  }

  if (!keyRows?.length) {
    return [];
  }

  const clientIds = [...new Set(keyRows.map((row) => row.client_id).filter(Boolean))];
  const { data: clientRows, error: clientError } = await admin
    .from("api_clients")
    .select("id, name, tenant_id, status")
    .in("id", clientIds);

  if (clientError) {
    throw new Error(`Supabase api_clients lookup failed: ${clientError.message}`);
  }

  const clientById = new Map((clientRows || []).map((row) => [row.id, mapClientRow(row)]));

  return keyRows.map((row) => ({
    keyRecord: mapKeyRow(row),
    client: clientById.get(row.client_id) || null,
  }));
}

/** Best-effort async — errors are swallowed by caller. */
export async function touchSupabaseKeyLastUsed(keyId) {
  if (!keyId) return;
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyId);
  if (error) {
    throw error;
  }
}
