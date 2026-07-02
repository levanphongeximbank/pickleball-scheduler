/**
 * Phase 11E — audit store mode resolution (server/serverless).
 * AUDIT_STORE=supabase requires SUPABASE_SERVICE_ROLE_KEY — no anon/publishable key.
 */

import {
  ApiKeyStoreConfigError,
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
  resolveApiKeyStoreMode,
} from "./apiKeyStoreConfig.js";

export { ApiKeyStoreConfigError, getSupabaseServerUrl, getSupabaseServiceRoleKey };

function readEnv(key, fallback = "") {
  const nodeEnv = globalThis.process?.env;
  if (nodeEnv?.[key] !== undefined && String(nodeEnv[key]).trim()) {
    return String(nodeEnv[key]).trim();
  }
  return fallback;
}

function assertSupabaseAuditEnv() {
  const url = getSupabaseServerUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) {
    throw new ApiKeyStoreConfigError(
      "AUDIT_STORE=supabase requires SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY on the server."
    );
  }
}

export function resolveAuditStoreMode() {
  const raw = String(readEnv("AUDIT_STORE", "")).toLowerCase();
  if (raw === "memory") {
    return "memory";
  }
  if (raw === "supabase") {
    assertSupabaseAuditEnv();
    return "supabase";
  }

  try {
    if (resolveApiKeyStoreMode() === "supabase") {
      assertSupabaseAuditEnv();
      return "supabase";
    }
  } catch {
    return "memory";
  }

  return "memory";
}

export function getAuditInsertTimeoutMs() {
  const raw = Number(readEnv("AUDIT_INSERT_TIMEOUT_MS", "500"));
  return Number.isFinite(raw) && raw > 0 ? raw : 500;
}

let auditStoreModeOverride = null;

/** @internal test hook */
export function setAuditStoreModeForTests(mode) {
  auditStoreModeOverride = mode;
}

/** @internal test hook */
export function resetAuditStoreModeForTests() {
  auditStoreModeOverride = null;
}

export function getEffectiveAuditStoreMode() {
  if (auditStoreModeOverride) {
    return auditStoreModeOverride;
  }
  return resolveAuditStoreMode();
}
