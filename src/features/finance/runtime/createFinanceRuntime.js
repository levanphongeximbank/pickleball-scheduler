/**
 * Finance runtime composition factory (Phase 1I).
 *
 * Explicit DI only. No env reads, no global Supabase client, no network during
 * construction, no startup writes, no hidden tenant, no Production activation,
 * no live payment provider, no UI/router imports.
 */

import { createFinanceApplication, createSequentialIdGenerator } from "../application/createFinanceApplication.js";
import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { createMockPaymentProvider } from "../providers/mock/createMockPaymentProvider.js";
import { createInMemoryFinanceRepositories } from "../repositories/inMemory.js";
import { createSupabaseFinanceRepositories } from "../persistence/supabase/createSupabaseFinanceRepositories.js";
import { buildFinanceCapabilityReport } from "./capabilities.js";
import {
  FINANCE_PROVIDER_STRATEGY,
  FINANCE_RUNTIME_MODE,
  FINANCE_TENANT_STRATEGY,
  validateFinanceRuntimeConfig,
} from "./config.js";
import {
  throwFinanceRuntimeError,
  throwRuntimeDisabled,
  throwApplicationCommandsUnavailable,
} from "./errors.js";
import {
  deriveFinanceReadiness,
  inspectFinanceRuntimeHealth,
} from "./readiness.js";

const ALLOWED_DEPENDENCY_KEYS = Object.freeze([
  "supabaseClient",
  "transactionalExecutor",
  "paymentProvider",
  "tenantResolver",
  "idGenerator",
  "clock",
  "persistenceProbe",
  "providerProbe",
]);

/**
 * @param {object} [dependencies]
 */
function assertDependencyKeys(dependencies) {
  if (dependencies == null) return;
  if (typeof dependencies !== "object" || Array.isArray(dependencies)) {
    throwFinanceRuntimeError(
      FINANCE_ERROR_CODES.INVALID_RUNTIME_CONFIGURATION,
      "Finance runtime dependencies must be a plain object.",
      { field: "dependencies" }
    );
  }
  for (const key of Object.keys(dependencies)) {
    if (!ALLOWED_DEPENDENCY_KEYS.includes(key)) {
      throwFinanceRuntimeError(
        FINANCE_ERROR_CODES.INVALID_RUNTIME_CONFIGURATION,
        `Unknown Finance runtime dependency key rejected: ${key}`,
        { field: key, allowedKeys: [...ALLOWED_DEPENDENCY_KEYS] }
      );
    }
    if (
      /secret|password|token|service_role|api_key|apikey|credential/i.test(key)
    ) {
      throwFinanceRuntimeError(
        FINANCE_ERROR_CODES.INVALID_RUNTIME_CONFIGURATION,
        "Finance runtime dependencies must not include credential keys.",
        { field: key }
      );
    }
  }
}

/**
 * Disabled command surface — any command attempt throws typed disabled error.
 * @returns {Readonly<object>}
 */
function createDisabledCommandSurface() {
  const handler = {
    get(_target, prop) {
      if (prop === "then" || prop === "toJSON" || typeof prop === "symbol") {
        return undefined;
      }
      return () => throwRuntimeDisabled(
        `Finance command '${String(prop)}' is unavailable while runtime is disabled.`
      );
    },
  };
  const service = new Proxy({}, handler);
  return Object.freeze({
    fees: service,
    obligations: service,
    invoices: service,
    payments: service,
    receipts: service,
    refunds: service,
    eventRecorder: service,
  });
}

/**
 * Durable adapter present, but Phase 1C sync application commands are not bridged.
 * Fail closed — do not expose a broken command surface.
 * @param {object} [context]
 * @returns {Readonly<object>}
 */
function createUnsupportedApplicationCommandSurface(context = {}) {
  const handler = {
    get(_target, prop) {
      if (prop === "then" || prop === "toJSON" || typeof prop === "symbol") {
        return undefined;
      }
      return () =>
        throwApplicationCommandsUnavailable(
          `Finance application command '${String(prop)}' is unavailable: durable Supabase repositories are async and are not bridged to the Phase 1C sync application port.`,
          context
        );
    },
  };
  const service = new Proxy({}, handler);
  return Object.freeze({
    fees: service,
    obligations: service,
    invoices: service,
    payments: service,
    receipts: service,
    refunds: service,
    eventRecorder: service,
  });
}

/**
 * @param {object} config
 * @param {object} dependencies
 */
function resolvePaymentProvider(config, dependencies) {
  if (config.providerStrategy === FINANCE_PROVIDER_STRATEGY.NONE) {
    if (dependencies.paymentProvider != null) {
      throwFinanceRuntimeError(
        FINANCE_ERROR_CODES.INVALID_RUNTIME_CONFIGURATION,
        "paymentProvider dependency is not allowed when providerStrategy is 'none'.",
        { field: "paymentProvider", providerStrategy: config.providerStrategy }
      );
    }
    return null;
  }

  if (config.providerStrategy === FINANCE_PROVIDER_STRATEGY.MOCK) {
    if (dependencies.paymentProvider != null) {
      return dependencies.paymentProvider;
    }
    return createMockPaymentProvider({
      idGenerator:
        typeof dependencies.idGenerator === "function"
          ? dependencies.idGenerator
          : createSequentialIdGenerator("mock"),
    });
  }

  throwFinanceRuntimeError(
    FINANCE_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
    `Finance provider strategy is not configured for runtime: ${config.providerStrategy}`,
    { providerStrategy: config.providerStrategy }
  );
}

/**
 * @param {object} config
 * @param {object} dependencies
 */
function createTenantBoundary(config, dependencies) {
  if (config.tenantStrategy === FINANCE_TENANT_STRATEGY.EXPLICIT_PER_COMMAND) {
    return Object.freeze({
      strategy: config.tenantStrategy,
      /**
       * Runtime does not resolve tenants. Callers must pass tenantId per command.
       * @returns {never}
       */
      resolveTenant() {
        throwFinanceRuntimeError(
          FINANCE_ERROR_CODES.TENANT_RESOLUTION_UNAVAILABLE,
          "Finance tenant strategy is explicit-per-command; pass tenantId on each command.",
          { tenantStrategy: config.tenantStrategy }
        );
      },
    });
  }

  if (config.tenantStrategy === FINANCE_TENANT_STRATEGY.INJECTED_TRUSTED_RESOLVER) {
    const resolver = dependencies.tenantResolver;
    if (resolver == null || typeof resolver.resolveTenantId !== "function") {
      throwFinanceRuntimeError(
        FINANCE_ERROR_CODES.MISSING_RUNTIME_DEPENDENCY,
        "injected-trusted-resolver requires dependencies.tenantResolver.resolveTenantId.",
        { field: "tenantResolver" }
      );
    }
    return Object.freeze({
      strategy: config.tenantStrategy,
      /**
       * @param {object} [input]
       * @returns {string|Promise<string>}
       */
      resolveTenant(input) {
        return resolver.resolveTenantId(input);
      },
    });
  }

  throwFinanceRuntimeError(
    FINANCE_ERROR_CODES.INVALID_RUNTIME_CONFIGURATION,
    `Unsupported Finance tenant strategy: ${config.tenantStrategy}`,
    { tenantStrategy: config.tenantStrategy }
  );
}

/**
 * Compose a Finance runtime from validated config + explicit dependencies.
 *
 * @param {object|null|undefined} [rawConfig]
 * @param {object} [dependencies]
 * @returns {Readonly<object>}
 */
export function createFinanceRuntime(rawConfig, dependencies = {}) {
  assertDependencyKeys(dependencies);
  const config = validateFinanceRuntimeConfig(rawConfig);
  const tenantBoundary = createTenantBoundary(config, dependencies);

  // Disabled mode — no adapters, no mutable repos, no provider.
  if (config.mode === FINANCE_RUNTIME_MODE.DISABLED || config.enabled !== true) {
    const readiness = deriveFinanceReadiness({
      config,
      persistenceAdapter: "none",
      durable: false,
      transactionCapability: "none",
      unmetDependencies: [],
      warnings: [],
      stagingCertified: false,
    });
    const capabilities = buildFinanceCapabilityReport({
      config,
      durablePersistenceAvailable: false,
      multiRecordTransactionCapability: false,
      providerInitiationAvailable: false,
      providerVerificationAvailable: false,
      refundProviderCapability: false,
      appendOnlyEventPersistence: false,
      tenantIsolationBoundary: config.tenantStrategy,
      knownLimitations: [
        "Disabled mode exposes capability inspection only; mutation commands are blocked.",
      ],
    });

    const runtime = Object.freeze({
      enabled: false,
      mode: FINANCE_RUNTIME_MODE.DISABLED,
      config,
      readiness,
      capabilities,
      application: null,
      repositories: null,
      paymentProvider: null,
      persistence: Object.freeze({
        adapter: "none",
        durable: false,
        isSupabaseCompatible: false,
      }),
      tenant: tenantBoundary,
      commands: createDisabledCommandSurface(),
      probes: Object.freeze({}),
      requireApplication() {
        return throwRuntimeDisabled(
          "Finance application is unavailable while runtime is disabled."
        );
      },
      getReadiness() {
        return readiness;
      },
      getCapabilities() {
        return capabilities;
      },
      async inspectHealth(options) {
        return inspectFinanceRuntimeHealth(runtime, options);
      },
    });
    return runtime;
  }

  let repositories = null;
  let persistenceAdapter = "none";
  let durable = false;
  let transactionCapability = "none";
  let multiRecordTransactionCapability = false;
  let appendOnlyEventPersistence = false;
  /** @type {object[]} */
  const unmetDependencies = [];
  /** @type {string[]} */
  const warnings = [];
  let stagingCertified = false;
  /** @type {object|null} */
  let unitOfWork = null;

  if (config.mode === FINANCE_RUNTIME_MODE.MEMORY) {
    repositories = createInMemoryFinanceRepositories();
    persistenceAdapter = "memory";
    durable = false;
    transactionCapability = "memory-best-effort";
    multiRecordTransactionCapability = false;
    appendOnlyEventPersistence = true;
    warnings.push("In-memory Finance repositories are not durable.");
  } else if (config.mode === FINANCE_RUNTIME_MODE.SUPABASE) {
    if (dependencies.supabaseClient == null) {
      throwFinanceRuntimeError(
        FINANCE_ERROR_CODES.MISSING_RUNTIME_DEPENDENCY,
        "Supabase Finance runtime requires an explicitly injected supabaseClient.",
        { field: "supabaseClient", mode: config.mode }
      );
    }

    const hasExecutor = typeof dependencies.transactionalExecutor === "function";
    repositories = createSupabaseFinanceRepositories(dependencies.supabaseClient, {
      transactionalExecutor: hasExecutor
        ? dependencies.transactionalExecutor
        : undefined,
      supportsAtomicMultiRecord: hasExecutor,
    });
    persistenceAdapter = "supabase";
    durable = true;
    unitOfWork = repositories.unitOfWork;
    multiRecordTransactionCapability = Boolean(
      repositories.capabilities?.supportsAtomicMultiRecord
    );
    transactionCapability = multiRecordTransactionCapability
      ? "injected-executor"
      : "single-statement";
    appendOnlyEventPersistence = true;
    stagingCertified = true;

    if (!hasExecutor) {
      warnings.push(
        "Transactional executor not injected; multi-record atomic groups fail closed."
      );
      if (
        config.transactionExpectation === "supabase-injected-executor"
      ) {
        unmetDependencies.push({
          dependency: "transactionalExecutor",
          reason: "Required by transactionExpectation supabase-injected-executor.",
        });
      }
    }
  } else {
    throwFinanceRuntimeError(
      FINANCE_ERROR_CODES.UNSUPPORTED_RUNTIME_MODE,
      `Unsupported Finance runtime mode: ${config.mode}`,
      { mode: config.mode }
    );
  }

  // Fail closed: never fall back from Supabase to memory.
  if (
    config.mode === FINANCE_RUNTIME_MODE.SUPABASE &&
    persistenceAdapter !== "supabase"
  ) {
    throwFinanceRuntimeError(
      FINANCE_ERROR_CODES.PERSISTENCE_NOT_READY,
      "Supabase Finance runtime refused silent fallback to memory persistence.",
      { persistenceAdapter }
    );
  }

  if (unmetDependencies.length > 0 && config.mode === FINANCE_RUNTIME_MODE.SUPABASE) {
    // Composition still returns, but readiness is NOT_READY when expectation unmet.
    // Missing client already throws above. Missing executor with strict expectation → NOT_READY.
  }

  const paymentProvider = resolvePaymentProvider(config, dependencies);
  let providerInitiationAvailable = false;
  let providerVerificationAvailable = false;
  let refundProviderCapability = false;

  if (paymentProvider) {
    const caps =
      typeof paymentProvider.getCapabilities === "function"
        ? paymentProvider.getCapabilities()
        : null;
    providerInitiationAvailable = Boolean(caps?.paymentInitiation);
    providerVerificationAvailable = Boolean(
      caps?.asynchronousConfirmation || caps?.synchronousConfirmation
    );
    refundProviderCapability = Boolean(caps?.partialRefund || caps?.fullRefund);
  }

  const idGenerator =
    typeof dependencies.idGenerator === "function"
      ? dependencies.idGenerator
      : createSequentialIdGenerator("fin");

  // OPTION A (Phase 1L / F-04): do not attach Phase 1C sync application commands
  // over async Supabase durable repositories. Memory mode keeps the application surface.
  const attachApplicationCommands =
    config.mode === FINANCE_RUNTIME_MODE.MEMORY;

  if (config.mode === FINANCE_RUNTIME_MODE.SUPABASE) {
    warnings.push(
      "Durable application commands unavailable: Phase 1C sync ports are not bridged over async Supabase repositories."
    );
  }

  const application = attachApplicationCommands
    ? createFinanceApplication({
        repositories,
        paymentProvider,
        idGenerator,
        useInMemoryRepositories: false,
      })
    : null;

  const readiness = deriveFinanceReadiness({
    config,
    persistenceAdapter,
    durable,
    transactionCapability,
    unmetDependencies,
    warnings,
    stagingCertified,
  });

  const capabilities = buildFinanceCapabilityReport({
    config,
    durablePersistenceAvailable: durable,
    multiRecordTransactionCapability,
    providerInitiationAvailable,
    providerVerificationAvailable,
    refundProviderCapability,
    appendOnlyEventPersistence,
    tenantIsolationBoundary: config.tenantStrategy,
    knownLimitations: warnings,
  });

  const probes = Object.freeze({
    persistence:
      typeof dependencies.persistenceProbe === "function"
        ? dependencies.persistenceProbe
        : undefined,
    provider:
      typeof dependencies.providerProbe === "function"
        ? dependencies.providerProbe
        : paymentProvider && typeof paymentProvider.getCapabilities === "function"
          ? () => paymentProvider.getCapabilities()
          : undefined,
  });

  const commands = attachApplicationCommands
    ? Object.freeze({
        fees: application.fees,
        obligations: application.obligations,
        invoices: application.invoices,
        payments: application.payments,
        receipts: application.receipts,
        refunds: application.refunds,
        eventRecorder: application.eventRecorder,
      })
    : createUnsupportedApplicationCommandSurface({
        runtimeMode: config.mode,
        persistenceAdapter,
      });

  const runtime = Object.freeze({
    enabled: true,
    mode: config.mode,
    config,
    readiness,
    capabilities,
    application,
    repositories,
    paymentProvider,
    persistence: Object.freeze({
      adapter: persistenceAdapter,
      durable,
      isSupabaseCompatible: persistenceAdapter === "supabase",
      transactionCapability,
      unitOfWork,
      capabilities: repositories?.capabilities || null,
    }),
    tenant: tenantBoundary,
    commands,
    probes,
    requireApplication() {
      if (!application) {
        return throwApplicationCommandsUnavailable(
          "Finance application commands are unavailable for durable Supabase runtime composition.",
          { runtimeMode: config.mode, persistenceAdapter }
        );
      }
      return application;
    },
    getReadiness() {
      return readiness;
    },
    getCapabilities() {
      return capabilities;
    },
    async inspectHealth(options) {
      return inspectFinanceRuntimeHealth(runtime, options);
    },
  });

  return runtime;
}

/**
 * Test-only composition harness. Explicitly marks non-production use.
 * Does not activate Production. Does not read env. Does not open network.
 *
 * @param {object} [options]
 * @param {object} [options.config]
 * @param {object} [options.dependencies]
 * @returns {Readonly<object>}
 */
export function createFinanceRuntimeTestHarness(options = {}) {
  const incoming = options.config && typeof options.config === "object" ? options.config : {};
  const config = {
    mode: FINANCE_RUNTIME_MODE.MEMORY,
    environment: "test",
    providerStrategy: FINANCE_PROVIDER_STRATEGY.NONE,
    tenantStrategy: FINANCE_TENANT_STRATEGY.EXPLICIT_PER_COMMAND,
    ...incoming,
    enabled: true,
    featureFlags: {
      exposeTestHarness: true,
      allowOptionalHealthProbes: true,
      ...(incoming.featureFlags || {}),
    },
  };

  // Ensure harness cannot silently request production.
  if (config.environment === "production") {
    throwFinanceRuntimeError(
      FINANCE_ERROR_CODES.ENVIRONMENT_NOT_AUTHORIZED,
      "Finance test harness cannot use Production environment classification.",
      { environment: config.environment }
    );
  }

  const runtime = createFinanceRuntime(config, options.dependencies || {});
  return Object.freeze({
    enabled: runtime.enabled,
    mode: runtime.mode,
    config: runtime.config,
    readiness: runtime.readiness,
    capabilities: runtime.capabilities,
    application: runtime.application,
    repositories: runtime.repositories,
    paymentProvider: runtime.paymentProvider,
    persistence: runtime.persistence,
    tenant: runtime.tenant,
    commands: runtime.commands,
    probes: runtime.probes,
    requireApplication: runtime.requireApplication,
    getReadiness: runtime.getReadiness,
    getCapabilities: runtime.getCapabilities,
    inspectHealth: runtime.inspectHealth,
    isTestHarness: true,
    resetAllForTests() {
      if (
        runtime.repositories &&
        typeof runtime.repositories.resetAllForTests === "function"
      ) {
        runtime.repositories.resetAllForTests();
      }
    },
  });
}
