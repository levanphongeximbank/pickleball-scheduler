/**
 * Operator credential loading — process environment only.
 * Never accepts CLI argv secrets or VITE_* values.
 */

import {
  ENV_SUPABASE_SECRET_KEY,
  ENV_SUPABASE_SERVICE_ROLE_KEY,
  ENV_SUPABASE_URL,
  EXPECTED_PRODUCTION_PROJECT_REF,
  FORBIDDEN_ENV_SECRET_PREFIXES,
} from "./constants.js";

function readEnv(name) {
  return String(globalThis.process?.env?.[name] || "").trim();
}

export function assertNodeOperatorRuntime() {
  if (typeof globalThis.window !== "undefined") {
    return { ok: false, reason: "browser_runtime_rejected" };
  }
  if (!globalThis.process?.versions?.node) {
    return { ok: false, reason: "node_runtime_required" };
  }
  return { ok: true };
}

/**
 * Reject VITE_* secret usage even if present.
 */
export function assertNoViteSecrets() {
  for (const key of Object.keys(globalThis.process?.env || {})) {
    const upper = key.toUpperCase();
    for (const prefix of FORBIDDEN_ENV_SECRET_PREFIXES) {
      if (
        upper.startsWith(prefix) &&
        (upper.includes("SERVICE_ROLE") ||
          upper.includes("SECRET") ||
          upper.includes("SUPABASE_KEY"))
      ) {
        return { ok: false, reason: "vite_secret_rejected" };
      }
    }
  }
  // Explicit common anti-pattern
  if (readEnv("VITE_SUPABASE_SERVICE_ROLE_KEY")) {
    return { ok: false, reason: "vite_secret_rejected" };
  }
  return { ok: true };
}

/**
 * Parse Supabase project ref from URL host.
 * Expected: https://<ref>.supabase.co
 */
export function extractProjectRefFromSupabaseUrl(urlString) {
  try {
    const url = new URL(String(urlString || "").trim());
    const host = url.hostname.toLowerCase();
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function assertSupabaseUrlMatchesProject(
  urlString,
  expectedRef = EXPECTED_PRODUCTION_PROJECT_REF
) {
  const ref = extractProjectRefFromSupabaseUrl(urlString);
  if (!ref) {
    return { ok: false, reason: "invalid_supabase_url" };
  }
  if (ref !== expectedRef) {
    return { ok: false, reason: "supabase_url_project_ref_mismatch" };
  }
  return { ok: true, projectRef: ref };
}

/**
 * Load credentials for mutation-capable client construction.
 * Dry-run callers must not invoke this.
 */
export function loadOperatorCredentials(env = globalThis.process?.env || {}) {
  const viteGuard = assertNoViteSecrets();
  if (!viteGuard.ok) return { ok: false, reasons: [viteGuard.reason] };

  const url = String(env[ENV_SUPABASE_URL] || "").trim();
  const secret =
    String(env[ENV_SUPABASE_SECRET_KEY] || "").trim() ||
    String(env[ENV_SUPABASE_SERVICE_ROLE_KEY] || "").trim();

  const reasons = [];
  if (!url) reasons.push("missing_supabase_url");
  if (!secret) reasons.push("missing_supabase_secret_key");

  if (reasons.length) {
    return { ok: false, reasons };
  }

  const urlGuard = assertSupabaseUrlMatchesProject(url);
  if (!urlGuard.ok) {
    return { ok: false, reasons: [urlGuard.reason] };
  }

  const usedFallback = !String(env[ENV_SUPABASE_SECRET_KEY] || "").trim();

  return {
    ok: true,
    url,
    // Never return secret to callers that might log — only for createClient.
    // Callers must not serialize this object.
    secretKey: secret,
    projectRef: urlGuard.projectRef,
    usedServiceRoleFallback: usedFallback,
  };
}
