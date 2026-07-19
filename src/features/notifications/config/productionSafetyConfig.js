/**
 * Phase 2B — Production-safe Notification configuration design.
 *
 * Mandatory Production defaults (fail-closed):
 *   environment=production
 *   allow_worker=false
 *   allow_qa_cleanup=false
 *   external_providers_enabled=false
 *   worker_concurrency=0
 *
 * Production worker may start ONLY when ALL are true:
 *   1. environment is explicitly production
 *   2. NOTIFICATION_PRODUCTION_WORKER_ENABLE=true (dedicated enable flag)
 *   3. NOTIFICATION_PRODUCTION_ROLLOUT_APPROVED=true (second approval flag)
 *   4. required namespace + tenant guards present
 *
 * Phase 2B does NOT enable the Production worker.
 */

export const PRODUCTION_PROJECT_REF = "expuvcohlcjzvrrauvud";
export const STAGING_PROJECT_REF = "qyewbxjsiiyufanzcjcq";

/** Known non-Production refs that must never receive Production apply. */
export const BLOCKED_PROJECT_REFS = Object.freeze([
  STAGING_PROJECT_REF,
  "qyewbxjsiiyufanzcjcq",
]);

export const PRODUCTION_RUNTIME_DEFAULTS = Object.freeze({
  environment: "production",
  project_ref: PRODUCTION_PROJECT_REF,
  allow_worker: "false",
  allow_qa_cleanup: "false",
  live_delivery_enabled: "false",
  external_providers_enabled: "false",
  worker_concurrency: "0",
  production_worker_enable: "false",
  production_rollout_approved: "false",
  allow_replay: "false",
  allow_cancel: "false",
  allow_stale_lease_recovery: "false",
});

function envFlagTrue(name, env = globalThis.process?.env || {}) {
  const v = String(env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function readEnv(name, env = globalThis.process?.env || {}) {
  return String(env[name] ?? "").trim();
}

/**
 * Resolve Production worker enablement — dual-flag + environment + scope.
 * Defaults fail closed when required configuration is absent.
 */
export function resolveProductionWorkerGate(options = {}) {
  const env = options.env || globalThis.process?.env || {};
  const environment = String(
    options.environment || readEnv("NOTIFICATION_WORKER_ENV", env) || ""
  )
    .trim()
    .toLowerCase();
  const projectRef = String(
    options.projectRef ||
      readEnv("NOTIFICATION_PROJECT_REF", env) ||
      readEnv("VITE_SUPABASE_PROJECT_REF", env) ||
      ""
  ).trim();

  const isProductionTarget =
    environment === "production" || projectRef === PRODUCTION_PROJECT_REF;

  if (!isProductionTarget) {
    return {
      ok: true,
      productionTarget: false,
      workerAllowed: false,
      concurrency: 0,
      reason: "not_production_target",
    };
  }

  // Explicit environment required for Production execution path
  if (environment !== "production") {
    return {
      ok: false,
      productionTarget: true,
      workerAllowed: false,
      concurrency: 0,
      error: "production_environment_required",
      reason: "environment_not_explicitly_production",
    };
  }

  const enableFlag =
    options.productionWorkerEnable === true ||
    envFlagTrue("NOTIFICATION_PRODUCTION_WORKER_ENABLE", env);
  const rolloutFlag =
    options.productionRolloutApproved === true ||
    envFlagTrue("NOTIFICATION_PRODUCTION_ROLLOUT_APPROVED", env);

  // Legacy single flag alone is insufficient in Phase 2B+
  const legacyAllow = options.allowProductionWorker === true;

  if (!enableFlag || !rolloutFlag) {
    return {
      ok: false,
      productionTarget: true,
      workerAllowed: false,
      concurrency: 0,
      error: "production_worker_blocked",
      reason: !enableFlag
        ? "production_worker_enable_false"
        : "production_rollout_approved_false",
      legacyAllowIgnored: legacyAllow && (!enableFlag || !rolloutFlag),
    };
  }

  const tenantId = String(options.tenantId || "").trim();
  const runNamespace = String(options.runNamespace || "").trim();
  if (!tenantId) {
    return {
      ok: false,
      productionTarget: true,
      workerAllowed: false,
      concurrency: 0,
      error: "tenant_scope_required",
      reason: "missing_tenant_scope",
    };
  }
  if (!runNamespace) {
    return {
      ok: false,
      productionTarget: true,
      workerAllowed: false,
      concurrency: 0,
      error: "namespace_scope_required",
      reason: "missing_namespace_scope",
    };
  }

  const concurrencyRaw = Number(
    options.workerConcurrency ??
      readEnv("NOTIFICATION_WORKER_CONCURRENCY", env) ??
      0
  );
  const concurrency = Number.isFinite(concurrencyRaw)
    ? Math.max(0, Math.floor(concurrencyRaw))
    : 0;

  if (concurrency <= 0) {
    return {
      ok: false,
      productionTarget: true,
      workerAllowed: false,
      concurrency: 0,
      error: "production_worker_concurrency_zero",
      reason: "worker_concurrency_disabled",
    };
  }

  return {
    ok: true,
    productionTarget: true,
    workerAllowed: true,
    concurrency,
    reason: "dual_flag_approved",
  };
}

/**
 * Assert Production runtime config map is fail-closed.
 * Missing keys = fail closed (not inherit Staging).
 */
export function assertProductionRuntimeConfig(config = {}) {
  const findings = [];
  const get = (key) => {
    if (config[key] == null || config[key] === "") return null;
    return String(config[key]).trim();
  };

  for (const [key, expected] of Object.entries(PRODUCTION_RUNTIME_DEFAULTS)) {
    const actual = get(key);
    if (actual == null) {
      findings.push({
        severity: "FAIL",
        code: "missing_config",
        key,
        expected,
        actual: null,
      });
      continue;
    }
    if (actual !== expected) {
      // phase16_ops_enabled may be true; allow that one divergence from defaults map
      if (key === "phase16_ops_enabled") continue;
      findings.push({
        severity: actual === "true" && expected === "false" ? "BLOCKED_UNSAFE" : "FAIL",
        code: "config_mismatch",
        key,
        expected,
        actual,
      });
    }
  }

  const env = get("environment");
  if (env && env !== "production") {
    findings.push({
      severity: "BLOCKED_UNSAFE",
      code: "non_production_environment",
      key: "environment",
      expected: "production",
      actual: env,
    });
  }

  const ref = get("project_ref");
  if (ref && BLOCKED_PROJECT_REFS.includes(ref)) {
    findings.push({
      severity: "BLOCKED_UNSAFE",
      code: "staging_project_ref",
      key: "project_ref",
      expected: PRODUCTION_PROJECT_REF,
      actual: ref,
    });
  }

  const blocked =
    findings.some((f) => f.severity === "BLOCKED_UNSAFE") ||
    findings.some((f) => f.code === "missing_config");
  const failed = findings.some((f) => f.severity === "FAIL");

  return {
    ok: !blocked && !failed,
    verdict: blocked ? "BLOCKED_UNSAFE" : failed ? "FAIL" : "PASS",
    findings,
  };
}

export function isBlockedProjectRef(ref) {
  const value = String(ref || "").trim();
  if (!value) return false;
  return BLOCKED_PROJECT_REFS.some((blocked) => value.includes(blocked));
}

export function requireProductionProjectRef(ref) {
  const value = String(ref || "").trim();
  if (!value) {
    return { ok: false, error: "project_ref_missing" };
  }
  if (isBlockedProjectRef(value)) {
    return { ok: false, error: "staging_or_qa_project_ref_blocked" };
  }
  if (!value.includes(PRODUCTION_PROJECT_REF)) {
    return { ok: false, error: "production_project_ref_mismatch" };
  }
  return { ok: true, projectRef: PRODUCTION_PROJECT_REF };
}
