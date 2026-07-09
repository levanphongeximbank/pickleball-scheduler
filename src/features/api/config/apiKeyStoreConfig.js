/**
 * Phase 11D — API key store mode resolution (server/serverless).
 * API_KEY_STORE=supabase requires SUPABASE_SERVICE_ROLE_KEY — no silent memory fallback.
 */

export class ApiKeyStoreConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ApiKeyStoreConfigError";
  }
}

function readEnv(key, fallback = "") {
  const nodeEnv = globalThis.process?.env;
  if (nodeEnv?.[key] !== undefined && String(nodeEnv[key]).trim()) {
    return String(nodeEnv[key]).trim();
  }
  return fallback;
}

export function getSupabaseServerUrl() {
  return readEnv("SUPABASE_URL") || readEnv("VITE_SUPABASE_URL");
}

/** Anon/publishable key for serverless routes that validate caller JWT (e.g. create-user). */
export function getSupabaseAnonKey() {
  return (
    readEnv("SUPABASE_ANON_KEY") ||
    readEnv("VITE_SUPABASE_ANON_KEY") ||
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

export function getSupabaseServiceRoleKey() {
  return readEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function resolveApiKeyStoreMode() {
  const raw = String(readEnv("API_KEY_STORE", "memory")).toLowerCase();
  if (raw === "supabase") {
    const url = getSupabaseServerUrl();
    const serviceKey = getSupabaseServiceRoleKey();
    if (!url || !serviceKey) {
      throw new ApiKeyStoreConfigError(
        "API_KEY_STORE=supabase requires SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY on the server."
      );
    }
    return "supabase";
  }
  return "memory";
}
