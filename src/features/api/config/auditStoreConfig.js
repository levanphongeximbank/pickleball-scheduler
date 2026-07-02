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

let auditConfigWarned = false;

export function isAuditDebugEnabled() {
  return String(readEnv("AUDIT_DEBUG", "")).toLowerCase() === "true";
}

/**
 * When API_KEY_STORE=supabase, audit must not silently use memory on Preview/serverless.
 */
export function warnIfAuditStoreMisconfigured() {
  if (auditConfigWarned) {
    return;
  }

  let apiKeyMode;
  try {
    apiKeyMode = resolveApiKeyStoreMode();
  } catch {
    return;
  }

  const auditMode = getEffectiveAuditStoreMode();
  const explicitAuditStore = String(readEnv("AUDIT_STORE", "")).toLowerCase();

  if (apiKeyMode === "supabase" && auditMode === "memory" && explicitAuditStore !== "memory") {
    auditConfigWarned = true;
    console.warn(
      "[integrationAudit] API_KEY_STORE=supabase but audit store resolved to memory. Set AUDIT_STORE=supabase and verify SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on the server."
    );
  }

  if (apiKeyMode === "supabase" && !explicitAuditStore && auditMode === "supabase") {
    auditConfigWarned = true;
    console.warn(
      "[integrationAudit] AUDIT_STORE unset — following API_KEY_STORE=supabase for audit persistence."
    );
  }
}

export function resolveAuditStoreMode() {
  const explicit = String(readEnv("AUDIT_STORE", "")).toLowerCase();

  if (explicit === "memory") {
    return "memory";
  }

  if (explicit === "supabase") {
    assertSupabaseAuditEnv();
    return "supabase";
  }

  if (explicit && explicit !== "supabase" && explicit !== "memory") {
    console.warn(`[integrationAudit] Unknown AUDIT_STORE="${explicit}" — using memory.`);
    return "memory";
  }

  // AUDIT_STORE unset — follow API_KEY_STORE (no silent catch fallback).
  if (resolveApiKeyStoreMode() === "supabase") {
    assertSupabaseAuditEnv();
    return "supabase";
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
  auditConfigWarned = false;
}

export function getEffectiveAuditStoreMode() {
  if (auditStoreModeOverride) {
    return auditStoreModeOverride;
  }
  return resolveAuditStoreMode();
}
