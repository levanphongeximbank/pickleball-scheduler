#!/usr/bin/env node
/**
 * OPERATION B1B — Staging-only live execution harness.
 *
 * Hard-bound to:
 *   OPERATION_TARGET_MODE=staging_rehearsal
 *   project_ref=qyewbxjsiiyufanzcjcq
 *
 * NEVER auto-detects environment.
 * NEVER accepts Production project ref or Production execute confirmation.
 * NEVER issues Owner GO. Never prints secrets into evidence.
 *
 * Wiring:
 *   createOperationB1BAdminClient
 *   → createOperationB1BLiveAdapters
 *   → createOperationB1BDurableAuthorityClaimer
 *   → runB1BExecute
 *
 * STAGING_APPLY_GO=NO / AUTH_BAN_GO=NO for this remediation WP.
 * Schema 30_* must be applied under a separate Owner GO before live use.
 */

import {
  EXPECTED_PRODUCTION_PROJECT_REF,
  EXPECTED_STAGING_PROJECT_REF,
  OPERATION_TARGET_MODE,
  REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
  createFreshAuthorizationBinding,
  createOperationB1BAdminClient,
  createOperationB1BLiveAdapters,
  createOperationB1BDurableAuthorityClaimer,
  hashExactEightUuidSet,
} from "./lib/index.js";
import { runB1BExecute } from "./execute.mjs";

const STAGING_URL_MARKERS = Object.freeze([
  EXPECTED_STAGING_PROJECT_REF,
  `${EXPECTED_STAGING_PROJECT_REF}.supabase`,
]);

function redactSecrets(value) {
  if (value == null) return value;
  if (typeof value === "string") {
    return value
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
      .replace(/postgresql:\/\/[^@\s]+@/gi, "postgresql://[REDACTED]@")
      .replace(/postgres:\/\/[^@\s]+@/gi, "postgres://[REDACTED]@");
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const key = String(k).toLowerCase();
      if (
        key.includes("password") ||
        key.includes("secret") ||
        key.includes("token") ||
        key.includes("service_role") ||
        key.includes("owner_staging_go") ||
        key.includes("owner_production_go") ||
        key === "apikey"
      ) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out;
  }
  return value;
}

/**
 * Fail-closed Staging credential gate. Never falls back to Production env names.
 * @param {Record<string, unknown>} env
 */
export function resolveStagingLiveCredentials(env = process.env) {
  const reasons = [];
  const url = String(
    env.OPERATION_B1B_STAGING_SUPABASE_URL ||
      env.STAGING_SUPABASE_URL ||
      ""
  ).trim();
  const secretKey = String(
    env.OPERATION_B1B_STAGING_SERVICE_ROLE_KEY ||
      env.STAGING_SUPABASE_SERVICE_ROLE_KEY ||
      ""
  ).trim();

  // Explicit rejection of Production-bound env fallbacks.
  const prodUrl = String(
    env.PRODUCTION_SUPABASE_URL ||
      env.VITE_PRODUCTION_SUPABASE_URL ||
      env.SUPABASE_URL ||
      ""
  ).trim();
  const prodKey = String(
    env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ||
      env.SUPABASE_SERVICE_ROLE_KEY ||
      ""
  ).trim();

  if (!url) {
    reasons.push("missing_staging_supabase_url");
  }
  if (!secretKey) {
    reasons.push("missing_staging_service_role_key");
  }

  const urlLower = url.toLowerCase();
  if (url && urlLower.includes(EXPECTED_PRODUCTION_PROJECT_REF)) {
    reasons.push("production_project_ref_rejected_in_staging_mode");
  }
  if (url && !STAGING_URL_MARKERS.some((m) => urlLower.includes(m.toLowerCase()))) {
    reasons.push("staging_url_missing_expected_project_ref");
  }
  if (prodUrl && !url && prodUrl.toLowerCase().includes(EXPECTED_PRODUCTION_PROJECT_REF)) {
    reasons.push("production_env_fallback_rejected");
  }
  if (prodKey && !secretKey) {
    reasons.push("production_service_role_fallback_rejected");
  }

  // Never accept Production confirmation string via accidental env reuse.
  const confirm = String(env.EXPLICIT_EXECUTE_CONFIRMATION || "").trim();
  if (confirm === REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION) {
    reasons.push("production_execute_confirmation_rejected_in_staging_mode");
  }

  if (reasons.length) {
    return { ok: false, reasons, url: null, secretKey: null };
  }

  return {
    ok: true,
    reasons: [],
    url,
    secretKey,
    projectRef: EXPECTED_STAGING_PROJECT_REF,
  };
}

/**
 * Build staging-only execute input. Rejects Production mode / ref / confirmation.
 * @param {Record<string, unknown>} input
 */
export function buildStagingLiveExecuteInput(input = {}) {
  const reasons = [];
  const mode = String(
    input.OPERATION_TARGET_MODE ?? input.operationTargetMode ?? ""
  )
    .trim()
    .toLowerCase();

  if (mode !== OPERATION_TARGET_MODE.STAGING_REHEARSAL) {
    reasons.push("staging_harness_requires_operation_target_mode_staging_rehearsal");
  }

  const projectRef = String(
    input.TARGET_PROJECT_REF ??
      input.targetProjectRef ??
      input.STAGING_PROJECT_REF ??
      input.stagingProjectRef ??
      ""
  ).trim();

  if (projectRef === EXPECTED_PRODUCTION_PROJECT_REF) {
    reasons.push("production_project_ref_rejected_in_staging_mode");
  } else if (projectRef !== EXPECTED_STAGING_PROJECT_REF) {
    reasons.push("wrong_or_missing_staging_project_ref");
  }

  const dryRunRaw = input.DRY_RUN ?? input.dryRun;
  const dryRunFalse =
    dryRunRaw === false ||
    ["0", "false", "no", "n"].includes(String(dryRunRaw ?? "").trim().toLowerCase());
  if (!dryRunFalse) {
    reasons.push("staging_live_harness_requires_dry_run_false");
  }

  const confirm = String(
    input.EXPLICIT_EXECUTE_CONFIRMATION ??
      input.explicitExecuteConfirmation ??
      ""
  ).trim();
  if (confirm === REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION) {
    reasons.push("production_execute_confirmation_rejected_in_staging_mode");
  }
  if (confirm !== REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION) {
    reasons.push("missing_or_invalid_explicit_staging_execute_confirmation");
  }

  const ownerStagingGo = String(
    input.OWNER_STAGING_GO ?? input.ownerStagingGo ?? ""
  ).trim();
  if (!ownerStagingGo) {
    reasons.push("missing_fresh_owner_staging_go");
  }

  const batchId = String(
    input.OPERATION_B1B_BATCH_ID ?? input.batchId ?? ""
  ).trim();
  const allowlistSha256 = String(
    input.ALLOWLIST_SHA256 ?? input.allowlistSha256 ?? ""
  )
    .trim()
    .toLowerCase();
  const snapshotSha256 = String(
    input.SNAPSHOT_SHA256 ??
      input.RECOVERY_SNAPSHOT_SHA256 ??
      input.snapshotSha256 ??
      ""
  )
    .trim()
    .toLowerCase();

  let binding = input.freshAuthorizationBinding || null;
  if (!binding) {
    const created = createFreshAuthorizationBinding({
      operationTargetMode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
      ownerStagingGo,
      expectedBatchId: batchId,
      allowlistSha256,
      snapshotSha256,
      stagingProjectRef: EXPECTED_STAGING_PROJECT_REF,
      explicitExecuteConfirmation:
        REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
    });
    if (!created.ok) {
      reasons.push(...created.reasons);
    } else {
      binding = created.binding;
    }
  }

  if (reasons.length) {
    return { ok: false, reasons, input: null };
  }

  return {
    ok: true,
    reasons: [],
    input: {
      DRY_RUN: "false",
      OPERATION_TARGET_MODE: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
      STAGING_PROJECT_REF: EXPECTED_STAGING_PROJECT_REF,
      TARGET_PROJECT_REF: EXPECTED_STAGING_PROJECT_REF,
      OPERATION_B1B_BATCH_ID: batchId,
      ALLOWLIST_PATH: String(input.ALLOWLIST_PATH ?? input.allowlistPath ?? ""),
      ALLOWLIST_SHA256: allowlistSha256,
      RECOVERY_SNAPSHOT_PATH: String(
        input.RECOVERY_SNAPSHOT_PATH ??
          input.SNAPSHOT_PATH ??
          input.snapshotPath ??
          ""
      ),
      SNAPSHOT_SHA256: snapshotSha256,
      OWNER_STAGING_GO: ownerStagingGo,
      EXPLICIT_EXECUTE_CONFIRMATION:
        REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
      freshAuthorizationBinding: binding,
      executionVersion:
        input.executionVersion ||
        input.OPERATION_B1B_EXECUTION_VERSION ||
        null,
    },
  };
}

/**
 * Construct Staging live deps: admin → adapters → durable claimer.
 * Does not connect unless createClientImpl / network is available.
 */
export async function createStagingLiveExecutionDeps({
  credentials,
  createClientImpl,
  repoRoots,
  executionVersion = null,
  adaptersOverride = null,
  claimOneTimeLiveAuthorityOverride = null,
} = {}) {
  const creds =
    credentials && credentials.ok
      ? credentials
      : resolveStagingLiveCredentials(credentials || process.env);
  if (!creds.ok) {
    return { ok: false, reasons: creds.reasons, deps: null };
  }

  const admin = await createOperationB1BAdminClient({
    url: creds.url,
    secretKey: creds.secretKey,
    createClientImpl,
  });
  const adapters =
    adaptersOverride || createOperationB1BLiveAdapters({ admin });
  const claimOneTimeLiveAuthority =
    claimOneTimeLiveAuthorityOverride ||
    createOperationB1BDurableAuthorityClaimer({ admin });

  return {
    ok: true,
    reasons: [],
    deps: {
      adapters,
      claimOneTimeLiveAuthority,
      repoRoots,
      freshAuthorizationBinding: null,
      executionVersion,
      // Intentionally omit admin/secret surfaces.
    },
    // Test-only introspection helpers (not returned to evidence).
    _admin: admin,
  };
}

/**
 * Staging-only live execute entry.
 * Structural authorization + allowlist/snapshot/exact-eight validation run
 * inside runB1BExecute BEFORE durable claim consumption.
 *
 * @param {Record<string, unknown>} input
 * @param {object} [options]
 */
export async function runStagingLiveExecute(input = {}, options = {}) {
  const report = {
    operation: "OPERATION_B1B_STAGING_LIVE_EXECUTE",
    operation_target_mode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
    staging_project_ref: EXPECTED_STAGING_PROJECT_REF,
    production_project_ref_rejected: EXPECTED_PRODUCTION_PROJECT_REF,
    ok: false,
    reasons: [],
    durableAuthorityClaimed: false,
    authorityConsumed: false,
    envFallbackPresent: false,
    secretsRedacted: true,
    execute: null,
  };

  const built = buildStagingLiveExecuteInput(input);
  if (!built.ok) {
    report.reasons.push(...built.reasons);
    report.failReason = "staging_harness_structural_rejection";
    return redactSecrets(report);
  }

  const creds = resolveStagingLiveCredentials(options.env || process.env);
  if (!creds.ok) {
    report.reasons.push(...creds.reasons);
    report.failReason = "staging_credentials_fail_closed";
    return redactSecrets(report);
  }

  const wired = await createStagingLiveExecutionDeps({
    credentials: creds,
    createClientImpl: options.createClientImpl,
    repoRoots: options.repoRoots,
    executionVersion:
      built.input.executionVersion || options.executionVersion || null,
    adaptersOverride: options.adapters,
    claimOneTimeLiveAuthorityOverride: options.claimOneTimeLiveAuthority,
  });
  if (!wired.ok) {
    report.reasons.push(...wired.reasons);
    report.failReason = "staging_deps_wiring_failed";
    return redactSecrets(report);
  }

  const executeReport = await runB1BExecute(built.input, {
    ...wired.deps,
    executionVersion: wired.deps.executionVersion,
  });

  report.ok = executeReport.ok === true;
  report.reasons.push(...(executeReport.reasons || []));
  report.failReason = executeReport.failReason || null;
  report.durableAuthorityClaimed = executeReport.durableAuthorityClaimed === true;
  report.authorityConsumed = executeReport.authorityConsumed === true;
  report.mutationCalls = executeReport.mutationCalls || 0;
  report.execute = executeReport.execute || null;
  report.dryRun = executeReport.dryRun;
  report.exactEightUuidSetHashHint = hashExactEightUuidSet; // function ref stripped by redact? keep out
  delete report.exactEightUuidSetHashHint;

  return redactSecrets(report);
}

export {
  EXPECTED_STAGING_PROJECT_REF,
  EXPECTED_PRODUCTION_PROJECT_REF,
  OPERATION_TARGET_MODE,
  redactSecrets,
};
