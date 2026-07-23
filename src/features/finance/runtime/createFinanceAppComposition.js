/**
 * Finance authenticated Staging app composition (Phase 1J).
 *
 * Opt-in behind VITE_FINANCE_STAGING_RUNTIME_ENABLED (default OFF).
 * Constructs disabled Finance runtime by default.
 * Staging + flag ON → Supabase Finance runtime via injected authenticated client.
 * Production always forced disabled (no adapter instantiation).
 *
 * No Finance commands/queries on composition. No tenant resolution on composition.
 * No startup DB writes. No memory fallback from Supabase. No live provider.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { createAuthenticatedFinanceTenantResolver } from "./adapters/createAuthenticatedFinanceTenantResolver.js";
import { createFinanceRuntime } from "./createFinanceRuntime.js";
import {
  FINANCE_PROVIDER_STRATEGY,
  FINANCE_RUNTIME_ENVIRONMENT,
  FINANCE_RUNTIME_MODE,
  FINANCE_TENANT_STRATEGY,
} from "./config.js";
import { throwFinanceRuntimeError } from "./errors.js";
import {
  FINANCE_APP_ENVIRONMENT,
  FINANCE_STAGING_ACTIVATION_REASON,
  resolveFinanceStagingActivation,
} from "./stagingFlags.js";

/**
 * Map classified app environment onto Phase 1I runtime environment allowlist.
 * Unknown stays reportable at composition layer; runtime config uses a safe disabled value.
 * @param {string} classified
 * @returns {string}
 */
function toRuntimeEnvironment(classified) {
  if (classified === FINANCE_APP_ENVIRONMENT.STAGING) {
    return FINANCE_RUNTIME_ENVIRONMENT.STAGING;
  }
  if (classified === FINANCE_APP_ENVIRONMENT.PRODUCTION) {
    return FINANCE_RUNTIME_ENVIRONMENT.PRODUCTION;
  }
  if (classified === FINANCE_APP_ENVIRONMENT.DEVELOPMENT) {
    return FINANCE_RUNTIME_ENVIRONMENT.DEVELOPMENT;
  }
  if (classified === FINANCE_APP_ENVIRONMENT.TEST) {
    return FINANCE_RUNTIME_ENVIRONMENT.TEST;
  }
  return FINANCE_RUNTIME_ENVIRONMENT.TEST;
}

/**
 * @param {object} activation
 * @param {object} runtime
 * @param {object} [extra]
 */
function buildCompositionSurface(activation, runtime, extra = {}) {
  const getReadiness = () =>
    Object.freeze({
      ...runtime.getReadiness(),
      featureFlagEnabled: activation.flagEnabled,
      activationReason: activation.reason,
      activationBlocked:
        activation.activate === false ? activation.reason : null,
      classifiedEnvironment: activation.environment,
      productionAuthorized: false,
      compositionPhase: "1J",
      ...(extra.readinessOverlay || {}),
    });

  const getCapabilities = () =>
    Object.freeze({
      ...runtime.getCapabilities(),
      productionAuthorized: false,
      compositionPhase: "1J",
      featureFlagEnabled: activation.flagEnabled,
      activationReason: activation.reason,
    });

  return Object.freeze({
    phase: "1J",
    activation,
    runtime,
    enabled: runtime.enabled === true,
    mode: runtime.mode,
    config: runtime.config,
    readiness: getReadiness(),
    capabilities: getCapabilities(),
    persistence: runtime.persistence,
    tenant: runtime.tenant,
    application: runtime.application,
    repositories: runtime.repositories,
    paymentProvider: runtime.paymentProvider,
    commands: runtime.commands,
    getReadiness,
    getCapabilities,
    requireApplication: () => runtime.requireApplication(),
    inspectHealth: (options) => runtime.inspectHealth(options),
    /** Explicit: composition never ran Finance business commands. */
    autoInvokedCommands: false,
    /** Explicit: composition never resolved tenant. */
    resolvedTenantAtComposition: false,
    /** Explicit: composition never queried/wrote the database. */
    databaseTouchedAtComposition: false,
    clientSource: extra.clientSource || "none",
  });
}

/**
 * Compose Finance for the authenticated app boundary.
 *
 * @param {{
 *   env?: Record<string, unknown>,
 *   appEnvironment?: string,
 *   supabaseClient?: object|null,
 *   tenantResolver?: { resolveTenantId: Function },
 *   transactionalExecutor?: Function,
 *   resolveEffectiveTenantId?: Function,
 *   forceDisabled?: boolean,
 *   disableReason?: string,
 * }} [options]
 * @returns {Readonly<object>}
 */
export function createFinanceAppComposition(options = {}) {
  if (options.forceDisabled === true) {
    const activation = Object.freeze({
      activate: false,
      flagEnabled: false,
      environment: classifyOrUnknown(options.appEnvironment),
      reason:
        options.disableReason || FINANCE_STAGING_ACTIVATION_REASON.FLAG_OFF,
      productionAuthorized: false,
    });
    const runtime = createFinanceRuntime({
      enabled: false,
      mode: FINANCE_RUNTIME_MODE.DISABLED,
      environment: toRuntimeEnvironment(activation.environment),
      providerStrategy: FINANCE_PROVIDER_STRATEGY.NONE,
      tenantStrategy: FINANCE_TENANT_STRATEGY.EXPLICIT_PER_COMMAND,
    });
    return buildCompositionSurface(activation, runtime, {
      clientSource: "none",
      readinessOverlay: {
        warnings: Object.freeze([
          ...(runtime.readiness.warnings || []),
          "Finance app composition forced disabled (fail closed).",
        ]),
      },
    });
  }

  const activation = resolveFinanceStagingActivation({
    env: options.env,
    appEnvironment: options.appEnvironment,
  });

  if (!activation.activate) {
    const runtime = createFinanceRuntime({
      enabled: false,
      mode: FINANCE_RUNTIME_MODE.DISABLED,
      environment: toRuntimeEnvironment(activation.environment),
      providerStrategy: FINANCE_PROVIDER_STRATEGY.NONE,
      tenantStrategy: FINANCE_TENANT_STRATEGY.EXPLICIT_PER_COMMAND,
    });

    const warning =
      activation.reason ===
      FINANCE_STAGING_ACTIVATION_REASON.PRODUCTION_NOT_AUTHORIZED
        ? "Finance Production environment is not authorized; runtime forced disabled."
        : activation.reason ===
            FINANCE_STAGING_ACTIVATION_REASON.UNKNOWN_ENVIRONMENT
          ? "Finance Staging runtime fail-closed: unknown environment."
          : activation.reason ===
              FINANCE_STAGING_ACTIVATION_REASON.NON_STAGING_ENVIRONMENT
            ? "Finance Staging runtime activates only when VITE_APP_ENV=staging."
            : "Finance Staging runtime feature flag is OFF (default).";

    return buildCompositionSurface(activation, runtime, {
      clientSource: "none",
      readinessOverlay: {
        warnings: Object.freeze([
          ...(runtime.readiness.warnings || []),
          warning,
        ]),
      },
    });
  }

  // Staging + flag ON — require explicit injected authenticated client.
  if (options.supabaseClient == null) {
    throwFinanceRuntimeError(
      FINANCE_ERROR_CODES.MISSING_RUNTIME_DEPENDENCY,
      "Finance Staging composition requires an explicitly injected authenticated supabaseClient.",
      { field: "supabaseClient", environment: activation.environment }
    );
  }

  // Never create a client here. Never fall back to memory.
  const tenantResolver =
    options.tenantResolver ||
    createAuthenticatedFinanceTenantResolver({
      resolveEffectiveTenantId: options.resolveEffectiveTenantId,
    });

  const runtime = createFinanceRuntime(
    {
      enabled: true,
      mode: FINANCE_RUNTIME_MODE.SUPABASE,
      environment: FINANCE_RUNTIME_ENVIRONMENT.STAGING,
      tenantStrategy: FINANCE_TENANT_STRATEGY.INJECTED_TRUSTED_RESOLVER,
      providerStrategy: FINANCE_PROVIDER_STRATEGY.NONE,
    },
    {
      supabaseClient: options.supabaseClient,
      tenantResolver,
      transactionalExecutor: options.transactionalExecutor,
    }
  );

  if (runtime.persistence?.adapter !== "supabase") {
    throwFinanceRuntimeError(
      FINANCE_ERROR_CODES.PERSISTENCE_NOT_READY,
      "Finance Staging composition refused memory fallback; Supabase adapter required.",
      { adapter: runtime.persistence?.adapter }
    );
  }

  return buildCompositionSurface(activation, runtime, {
    clientSource: "injected-authenticated",
  });
}

/**
 * @param {unknown} raw
 */
function classifyOrUnknown(raw) {
  const value = String(raw == null ? "" : raw)
    .trim()
    .toLowerCase();
  if (value === "production" || value === "prod") {
    return FINANCE_APP_ENVIRONMENT.PRODUCTION;
  }
  if (value === "staging" || value === "stage") {
    return FINANCE_APP_ENVIRONMENT.STAGING;
  }
  if (value === "development" || value === "dev") {
    return FINANCE_APP_ENVIRONMENT.DEVELOPMENT;
  }
  if (value === "test") return FINANCE_APP_ENVIRONMENT.TEST;
  return FINANCE_APP_ENVIRONMENT.UNKNOWN;
}
