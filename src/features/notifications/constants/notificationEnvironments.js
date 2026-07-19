/**
 * Notification environments — Phase 1.6 isolation.
 * Assigned server-side; browser cannot choose arbitrary environment.
 */

export const NOTIFICATION_ENVIRONMENTS = Object.freeze({
  LOCAL: "local",
  TEST: "test",
  STAGING: "staging",
  PRODUCTION: "production",
});

export const NOTIFICATION_ENVIRONMENT_VALUES = Object.freeze(
  Object.values(NOTIFICATION_ENVIRONMENTS)
);

export function isValidNotificationEnvironment(value) {
  return NOTIFICATION_ENVIRONMENT_VALUES.includes(String(value || "").toLowerCase());
}

export function normalizeNotificationEnvironment(value, fallback = NOTIFICATION_ENVIRONMENTS.STAGING) {
  const v = String(value || "").trim().toLowerCase();
  if (isValidNotificationEnvironment(v)) return v;
  return fallback;
}

export function assertEnvironmentIsolation({
  workerEnvironment,
  jobEnvironment,
  runtimeEnvironment = null,
  allowProduction = false,
} = {}) {
  const worker = normalizeNotificationEnvironment(workerEnvironment);
  const job = jobEnvironment
    ? normalizeNotificationEnvironment(jobEnvironment)
    : null;
  const runtime = runtimeEnvironment
    ? normalizeNotificationEnvironment(runtimeEnvironment)
    : null;

  if (worker === NOTIFICATION_ENVIRONMENTS.PRODUCTION && !allowProduction) {
    return { ok: false, error: "production_execution_blocked" };
  }
  if (runtime === NOTIFICATION_ENVIRONMENTS.PRODUCTION && !allowProduction) {
    return { ok: false, error: "production_execution_blocked" };
  }
  if (job && job !== worker) {
    return { ok: false, error: "environment_mismatch" };
  }
  if (
    runtime &&
    worker !== runtime &&
    worker !== NOTIFICATION_ENVIRONMENTS.TEST &&
    worker !== NOTIFICATION_ENVIRONMENTS.LOCAL
  ) {
    return { ok: false, error: "environment_mismatch" };
  }
  return { ok: true, environment: worker };
}

/** Allowed QA namespace prefixes for cleanup (exact match after prefix). */
export const QA_NAMESPACE_PREFIXES = Object.freeze([
  "phase14s:",
  "phase15:",
  "phase16:",
]);

export function isAllowedQaNamespacePrefix(prefix) {
  const p = String(prefix || "");
  return QA_NAMESPACE_PREFIXES.some((allowed) => p.startsWith(allowed));
}
