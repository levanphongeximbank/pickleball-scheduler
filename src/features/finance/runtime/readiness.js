/**
 * Finance runtime readiness contract (Phase 1I).
 *
 * Deterministic, secret-free serialization. No mandatory external calls.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import {
  FINANCE_PROVIDER_STRATEGY,
  FINANCE_RUNTIME_ENVIRONMENT,
  FINANCE_RUNTIME_MODE,
} from "./config.js";
import { createFinanceRuntimeError } from "./errors.js";
import { FINANCE_STAGING_CERTIFICATION_REFERENCE } from "./capabilities.js";

export const FINANCE_READINESS_STATE = Object.freeze({
  DISABLED: "DISABLED",
  READY: "READY",
  READY_WITH_CONDITIONS: "READY_WITH_CONDITIONS",
  NOT_READY: "NOT_READY",
});

export const FINANCE_READINESS_STATE_VALUES = Object.freeze(
  Object.values(FINANCE_READINESS_STATE)
);

export const FINANCE_DEFAULT_PROBE_TIMEOUT_MS = 2000;

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sanitizeProbeDetail(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.slice(0, 200);
    if (/secret|token|password|service_role|apikey|bearer\s/i.test(trimmed)) {
      return "[redacted]";
    }
    return trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeProbeDetail(item));
  }
  if (typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const key of Object.keys(value).sort().slice(0, 20)) {
      if (/secret|token|password|key|authorization|credential/i.test(key)) {
        out[key] = "[redacted]";
      } else {
        out[key] = sanitizeProbeDetail(/** @type {any} */ (value)[key]);
      }
    }
    return out;
  }
  return String(value).slice(0, 100);
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function buildFinanceReadinessReport(input) {
  const {
    state,
    config,
    persistenceAdapter = "none",
    durable = false,
    transactionCapability = "none",
    unmetDependencies = [],
    warnings = [],
    productionAuthorized = false,
    stagingCertified = false,
  } = input;

  if (!FINANCE_READINESS_STATE_VALUES.includes(state)) {
    throw createFinanceRuntimeError(
      FINANCE_ERROR_CODES.INVALID_RUNTIME_CONFIGURATION,
      `Invalid Finance readiness state: ${String(state)}`,
      { state }
    );
  }

  const stagingReference = config.diagnostics.includeStagingCertificationReference
    ? {
        phase: FINANCE_STAGING_CERTIFICATION_REFERENCE.phase,
        document: FINANCE_STAGING_CERTIFICATION_REFERENCE.document,
        verdictClass: FINANCE_STAGING_CERTIFICATION_REFERENCE.verdictClass,
      }
    : null;

  const report = Object.freeze({
    state,
    runtimeMode: config.mode,
    environment: config.environment,
    persistenceAdapter,
    durability: durable ? "durable" : "non-durable",
    durable: Boolean(durable),
    transactionCapability,
    providerStrategy: config.providerStrategy,
    tenantStrategy: config.tenantStrategy,
    stagingCertificationReference: stagingReference,
    stagingCertified: Boolean(stagingCertified),
    productionAuthorized: Boolean(productionAuthorized),
    productionAuthorizationStatus: productionAuthorized
      ? "authorized"
      : "not-authorized",
    unmetDependencies: Object.freeze(
      (unmetDependencies || []).map((item) =>
        typeof item === "string"
          ? item
          : Object.freeze({
              dependency: String(item.dependency || "unknown"),
              reason: String(item.reason || "unmet"),
            })
      )
    ),
    warnings: Object.freeze((warnings || []).map((w) => String(w))),
  });

  return report;
}

/**
 * Deterministic JSON serialization of readiness (stable key order via rebuild).
 * @param {object} readiness
 * @returns {string}
 */
export function serializeFinanceReadiness(readiness) {
  return JSON.stringify(readiness, Object.keys(readiness).sort());
}

/**
 * @param {() => Promise<unknown>|unknown} probe
 * @param {number} timeoutMs
 * @returns {Promise<{ ok: boolean, timedOut?: boolean, detail?: unknown, errorCode?: string }>}
 */
async function runProbeWithTimeout(probe, timeoutMs) {
  let timer;
  try {
    const result = await Promise.race([
      Promise.resolve().then(() => probe()),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const err = createFinanceRuntimeError(
            FINANCE_ERROR_CODES.READINESS_PROBE_FAILED,
            "Finance readiness probe timed out.",
            { timeoutMs }
          );
          err.timedOut = true;
          reject(err);
        }, timeoutMs);
      }),
    ]);
    return {
      ok: true,
      detail: sanitizeProbeDetail(result),
    };
  } catch (err) {
    const timedOut = Boolean(err && err.timedOut);
    return {
      ok: false,
      timedOut,
      errorCode: timedOut
        ? FINANCE_ERROR_CODES.READINESS_PROBE_FAILED
        : FINANCE_ERROR_CODES.READINESS_PROBE_FAILED,
      detail: sanitizeProbeDetail({
        message: err && typeof err.message === "string" ? err.message : "probe failed",
        code: err && typeof err.code === "string" ? err.code : undefined,
      }),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Optional, explicit health/readiness probes. Never runs during construction.
 *
 * @param {object} runtime
 * @param {{
 *   runPersistenceProbe?: boolean,
 *   runProviderProbe?: boolean,
 *   timeoutMs?: number,
 *   persistenceProbe?: () => Promise<unknown>|unknown,
 *   providerProbe?: () => Promise<unknown>|unknown,
 * }} [options]
 * @returns {Promise<Readonly<object>>}
 */
export async function inspectFinanceRuntimeHealth(runtime, options = {}) {
  const config = runtime.config;
  const timeoutMs =
    typeof options.timeoutMs === "number" && options.timeoutMs > 0
      ? Math.min(options.timeoutMs, 30_000)
      : FINANCE_DEFAULT_PROBE_TIMEOUT_MS;

  const probesRequested = {
    persistence: options.runPersistenceProbe === true,
    provider: options.runProviderProbe === true,
  };

  if (
    (probesRequested.persistence || probesRequested.provider) &&
    config.featureFlags.allowOptionalHealthProbes !== true
  ) {
    throw createFinanceRuntimeError(
      FINANCE_ERROR_CODES.INVALID_RUNTIME_CONFIGURATION,
      "Optional Finance health probes require featureFlags.allowOptionalHealthProbes: true.",
      { field: "featureFlags.allowOptionalHealthProbes" }
    );
  }

  if (config.environment === FINANCE_RUNTIME_ENVIRONMENT.PRODUCTION) {
    throw createFinanceRuntimeError(
      FINANCE_ERROR_CODES.ENVIRONMENT_NOT_AUTHORIZED,
      "Finance Production health probes are not authorized in Phase 1I.",
      { environment: config.environment }
    );
  }

  /** @type {Record<string, object>} */
  const probeResults = {};

  if (probesRequested.persistence) {
    const probe =
      typeof options.persistenceProbe === "function"
        ? options.persistenceProbe
        : runtime.probes && typeof runtime.probes.persistence === "function"
          ? runtime.probes.persistence
          : null;
    if (!probe) {
      probeResults.persistence = Object.freeze({
        ok: false,
        errorCode: FINANCE_ERROR_CODES.MISSING_RUNTIME_DEPENDENCY,
        detail: sanitizeProbeDetail({ message: "No persistence probe injected." }),
      });
    } else {
      probeResults.persistence = Object.freeze(
        await runProbeWithTimeout(probe, timeoutMs)
      );
    }
  }

  if (probesRequested.provider) {
    if (config.providerStrategy === FINANCE_PROVIDER_STRATEGY.NONE) {
      probeResults.provider = Object.freeze({
        ok: false,
        errorCode: FINANCE_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
        detail: sanitizeProbeDetail({ message: "Provider strategy is none." }),
      });
    } else {
      const probe =
        typeof options.providerProbe === "function"
          ? options.providerProbe
          : runtime.probes && typeof runtime.probes.provider === "function"
            ? runtime.probes.provider
            : null;
      if (!probe) {
        probeResults.provider = Object.freeze({
          ok: false,
          errorCode: FINANCE_ERROR_CODES.MISSING_RUNTIME_DEPENDENCY,
          detail: sanitizeProbeDetail({ message: "No provider probe injected." }),
        });
      } else {
        probeResults.provider = Object.freeze(
          await runProbeWithTimeout(probe, timeoutMs)
        );
      }
    }
  }

  const anyFailed = Object.values(probeResults).some((r) => r && r.ok === false);

  return Object.freeze({
    readiness: runtime.readiness,
    compositionValidated: true,
    probesRequested: Object.freeze(probesRequested),
    probeTimeoutMs: timeoutMs,
    probesRun: Object.freeze(probeResults),
    overallOk: !anyFailed,
    runtimeMode: config.mode,
    environment: config.environment,
    // Explicit: construction never auto-probes.
    probedDuringConstruction: false,
  });
}

/**
 * Derive readiness for a composed runtime snapshot.
 * @param {object} params
 */
export function deriveFinanceReadiness(params) {
  const {
    config,
    persistenceAdapter,
    durable,
    transactionCapability,
    unmetDependencies = [],
    warnings = [],
    stagingCertified = false,
  } = params;

  if (config.mode === FINANCE_RUNTIME_MODE.DISABLED || config.enabled !== true) {
    return buildFinanceReadinessReport({
      state: FINANCE_READINESS_STATE.DISABLED,
      config,
      persistenceAdapter: "none",
      durable: false,
      transactionCapability: "none",
      unmetDependencies: [],
      warnings: ["Finance runtime default is disabled (opt-in)."],
      productionAuthorized: false,
      stagingCertified: false,
    });
  }

  if (unmetDependencies.length > 0) {
    return buildFinanceReadinessReport({
      state: FINANCE_READINESS_STATE.NOT_READY,
      config,
      persistenceAdapter,
      durable,
      transactionCapability,
      unmetDependencies,
      warnings,
      productionAuthorized: false,
      stagingCertified,
    });
  }

  const conditionWarnings = [...warnings];
  let state = FINANCE_READINESS_STATE.READY;

  if (
    config.mode === FINANCE_RUNTIME_MODE.SUPABASE &&
    transactionCapability !== "injected-executor"
  ) {
    state = FINANCE_READINESS_STATE.READY_WITH_CONDITIONS;
    conditionWarnings.push(
      "Supabase multi-record atomicity requires an injected transactional executor."
    );
  }

  if (config.mode === FINANCE_RUNTIME_MODE.MEMORY) {
    conditionWarnings.push(
      "Memory persistence is non-durable and not suitable for Production."
    );
  }

  if (config.providerStrategy === FINANCE_PROVIDER_STRATEGY.MOCK) {
    conditionWarnings.push("Mock payment provider is not a live provider.");
  }

  return buildFinanceReadinessReport({
    state,
    config,
    persistenceAdapter,
    durable,
    transactionCapability,
    unmetDependencies: [],
    warnings: conditionWarnings,
    productionAuthorized: false,
    stagingCertified,
  });
}
