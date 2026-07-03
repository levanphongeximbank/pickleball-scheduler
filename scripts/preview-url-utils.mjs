/**
 * Shared staging Preview URL resolution for verify scripts.
 * STAGING_PREVIEW_URL takes absolute priority; invalid env values block early (no default fallback).
 */
import { normalizePreviewBaseUrl } from "./phase11c-preview-http.mjs";

const BLOCKED_HOSTNAME_FRAGMENTS = ["verccel", "sccheduler", "scheduleer", ".appp"];

export function validatePreviewUrl(rawUrl) {
  const normalized = normalizePreviewBaseUrl(rawUrl);
  if (!normalized) {
    return { valid: false, reason: "empty URL", normalized: "", hostname: null };
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return { valid: false, reason: "invalid URL", normalized, hostname: null };
  }

  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      reason: "protocol must be https",
      normalized,
      hostname: parsed.hostname,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname.endsWith(".vercel.app")) {
    return {
      valid: false,
      reason: "hostname must end with .vercel.app",
      normalized,
      hostname,
    };
  }

  for (const fragment of BLOCKED_HOSTNAME_FRAGMENTS) {
    if (hostname.includes(fragment)) {
      return {
        valid: false,
        reason: `hostname contains blocked fragment: ${fragment}`,
        normalized,
        hostname,
      };
    }
  }

  return { valid: true, normalized, hostname, baseUrl: normalized };
}

/**
 * @param {string} defaultUrl
 * @returns {{
 *   ok: boolean,
 *   blocked: boolean,
 *   envPresent: boolean,
 *   source: "env" | "default",
 *   baseUrl: string | null,
 *   hostname: string | null,
 *   reason?: string,
 * }}
 */
export function resolveStagingPreviewUrl(defaultUrl) {
  const rawEnv = process.env.STAGING_PREVIEW_URL;
  const envPresent = rawEnv != null && String(rawEnv).trim() !== "";

  if (envPresent) {
    const validation = validatePreviewUrl(rawEnv);
    if (!validation.valid) {
      return {
        ok: false,
        blocked: true,
        envPresent: true,
        source: "env",
        reason: validation.reason,
        hostname: validation.hostname,
        baseUrl: null,
      };
    }
    return {
      ok: true,
      blocked: false,
      envPresent: true,
      source: "env",
      baseUrl: validation.baseUrl,
      hostname: validation.hostname,
    };
  }

  const validation = validatePreviewUrl(defaultUrl);
  if (!validation.valid) {
    return {
      ok: false,
      blocked: true,
      envPresent: false,
      source: "default",
      reason: validation.reason,
      hostname: validation.hostname,
      baseUrl: null,
    };
  }
  return {
    ok: true,
    blocked: false,
    envPresent: false,
    source: "default",
    baseUrl: validation.baseUrl,
    hostname: validation.hostname,
  };
}

export function logPreviewUrlResolution(resolution, logFn = console.log) {
  logFn(`ℹ️  STAGING_PREVIEW_URL present: ${resolution.envPresent}`);
  if (resolution.blocked) {
    logFn(`⚠️  Preview URL resolution BLOCKED: ${resolution.reason} (source=${resolution.source})`);
    if (resolution.hostname) {
      logFn(`ℹ️  Preview hostname: ${resolution.hostname}`);
    }
    return;
  }
  logFn(`ℹ️  Preview URL source: ${resolution.source}`);
  logFn(`ℹ️  Preview base URL: ${resolution.baseUrl}`);
  logFn(`ℹ️  Preview hostname: ${resolution.hostname}`);
}
