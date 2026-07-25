/**
 * COMMS-ACT-06 — Production target identity (fail-closed).
 * Never prints secrets. Never mutates remote.
 */

import {
  COMMS_PRODUCTION_PROJECT_REF,
  COMMS_STAGING_PROJECT_REF,
  extractSupabaseProjectRef,
  isEnvTokenPresent,
} from "./stagingTarget.js";

export { COMMS_PRODUCTION_PROJECT_REF, COMMS_STAGING_PROJECT_REF };

/** Env names only — values must never be logged. */
export const COMMS_ACT_06_ENV_NAMES = Object.freeze({
  SUPABASE_URL: "VITE_SUPABASE_URL",
  SUPABASE_URL_ALT: "SUPABASE_URL",
  ANON_KEY: "VITE_SUPABASE_ANON_KEY",
  ANON_KEY_ALT: "SUPABASE_ANON_KEY",
  SERVICE_ROLE: "SUPABASE_SERVICE_ROLE_KEY",
  SYSTEM_PRODUCER_KEY: "COMMS_SYSTEM_PRODUCER_KEY",
  TRUSTED_BACKEND_FLAG: "VITE_COMMUNICATION_TRUSTED_BACKEND",
  RUNTIME_MODE: "VITE_COMMUNICATION_RUNTIME_MODE",
  /** Exact Owner GO token required before API hosts may target Production ref. */
  PRODUCTION_RUNTIME_ENABLE: "COMMS_PRODUCTION_RUNTIME_ENABLE",
  ACCESS_TOKEN: "SUPABASE_ACCESS_TOKEN",
  BACKUP_EVIDENCE: "COMMS_ACT_07_PRODUCTION_BACKUP_EVIDENCE",
  BACKUP_EVIDENCE_PATH: "COMMS_ACT_07_PRODUCTION_BACKUP_EVIDENCE_PATH",
});

export const COMMS_ACT_06_PRODUCTION_ENABLE_TOKEN =
  "OWNER GO COMMS-ACT-07 PRODUCTION ENABLE";

export const COMMS_ACT_06_PROD_SMOKE_MARKER = "COMMS_ACT_07_PROD_SMOKE_";

export const COMMS_ACT_06_CAPABILITY_SCOPE = Object.freeze({
  DIRECT_TRUSTED_BACKEND: "DIRECT_TRUSTED_BACKEND",
  SYSTEM_TRUSTED_PRODUCER: "SYSTEM_TRUSTED_PRODUCER",
  CLUB_SELECT_CLIENT_RLS: "CLUB_SELECT_CLIENT_RLS",
  CLUB_WRITE_ADMIN_TRUSTED_BACKEND: "CLUB_WRITE_ADMIN_TRUSTED_BACKEND",
  COMMUNITY_BLOCKED_FAIL_CLOSED: "COMMUNITY_BLOCKED_FAIL_CLOSED",
  REALTIME_BLOCKED_FAIL_CLOSED: "REALTIME_BLOCKED_FAIL_CLOSED",
});

/**
 * Fail-closed Production URL gate for trusted-backend hosts.
 * Staging URLs always pass. Production URLs require exact Owner GO token.
 *
 * @param {string|undefined|null} url
 * @param {{ enableToken?: string }} [options]
 */
export function evaluateCommunicationProductionRefGate(url, options = {}) {
  const raw = String(url || "").trim();
  const ref = extractSupabaseProjectRef(raw);
  const targetsProduction =
    raw.includes(COMMS_PRODUCTION_PROJECT_REF) ||
    ref === COMMS_PRODUCTION_PROJECT_REF;

  if (!targetsProduction) {
    return Object.freeze({
      ok: true,
      productionTarget: false,
      enabled: false,
      code: null,
      stagingRef: COMMS_STAGING_PROJECT_REF,
      productionRef: COMMS_PRODUCTION_PROJECT_REF,
    });
  }

  const token = String(
    options.enableToken ??
      globalThis.process?.env?.[COMMS_ACT_06_ENV_NAMES.PRODUCTION_RUNTIME_ENABLE] ??
      ""
  ).trim();
  const enabled = token === COMMS_ACT_06_PRODUCTION_ENABLE_TOKEN;

  if (!enabled) {
    return Object.freeze({
      ok: false,
      productionTarget: true,
      enabled: false,
      code: "PRODUCTION_REF_BLOCKED",
      stagingRef: COMMS_STAGING_PROJECT_REF,
      productionRef: COMMS_PRODUCTION_PROJECT_REF,
      error:
        "Production project ref is blocked until Owner GO COMMS-ACT-07 PRODUCTION ENABLE.",
    });
  }

  return Object.freeze({
    ok: true,
    productionTarget: true,
    enabled: true,
    code: null,
    stagingRef: COMMS_STAGING_PROJECT_REF,
    productionRef: COMMS_PRODUCTION_PROJECT_REF,
  });
}

/**
 * Static Production target identity check (no network).
 * @param {{ url?: string, environment?: string, enableToken?: string }} [input]
 */
export function evaluateCommsProductionTargetIdentity(input = {}) {
  const environment = String(input.environment || "production").toLowerCase();
  const url = String(input.url || "").trim();
  const urlRef = extractSupabaseProjectRef(url);
  /** @type {Array<{ code: string, level: string, message: string }>} */
  const findings = [];

  if (environment !== "production") {
    findings.push({
      level: "error",
      code: "ENVIRONMENT_NOT_PRODUCTION",
      message: `Environment must be production (got ${environment}).`,
    });
  }

  if (url.includes(COMMS_STAGING_PROJECT_REF) || urlRef === COMMS_STAGING_PROJECT_REF) {
    findings.push({
      level: "error",
      code: "STAGING_REF_LEAKAGE",
      message: `Staging ref ${COMMS_STAGING_PROJECT_REF} must not appear in Production target URL.`,
    });
  }

  if (url && urlRef && urlRef !== COMMS_PRODUCTION_PROJECT_REF) {
    findings.push({
      level: "error",
      code: "URL_REF_NOT_PRODUCTION",
      message: `Supabase URL project ref is not Production (${urlRef}).`,
    });
  }

  const gate = evaluateCommunicationProductionRefGate(url, {
    enableToken: input.enableToken,
  });

  return Object.freeze({
    status: findings.length === 0 ? "PASS" : "FAIL",
    urlPresent: isEnvTokenPresent(url),
    urlRef: urlRef || null,
    expectedRef: COMMS_PRODUCTION_PROJECT_REF,
    stagingRefBlocked: COMMS_STAGING_PROJECT_REF,
    productionRuntimeGate: gate,
    findings,
  });
}
