/**
 * Phase 1I — Finance runtime composition foundation tests.
 *
 * No Staging reconnect. No Production. No live provider. No env credentials.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as Finance from "../src/features/finance/index.js";
import {
  createFinanceRuntime,
  createFinanceRuntimeTestHarness,
  validateFinanceRuntimeConfig,
  createDefaultFinanceRuntimeConfig,
  FINANCE_RUNTIME_MODE,
  FINANCE_TENANT_STRATEGY,
  FINANCE_PROVIDER_STRATEGY,
  FINANCE_READINESS_STATE,
  FINANCE_ERROR_CODES,
  isFinanceError,
  createFakeSupabaseFinanceClient,
  createMockPaymentProvider,
  serializeFinanceReadiness,
} from "../src/features/finance/index.js";

function assertThrowsCode(fn, code) {
  try {
    fn();
    assert.fail(`Expected FinanceError ${code}`);
  } catch (err) {
    assert.equal(isFinanceError(err), true);
    assert.equal(err.code, code);
  }
}

describe("Phase 1I default / disabled behavior", () => {
  it("omitted config produces disabled mode (default)", () => {
    const runtime = createFinanceRuntime();
    assert.equal(runtime.enabled, false);
    assert.equal(runtime.mode, FINANCE_RUNTIME_MODE.DISABLED);
    assert.equal(runtime.config.mode, FINANCE_RUNTIME_MODE.DISABLED);
    assert.equal(runtime.readiness.state, FINANCE_READINESS_STATE.DISABLED);
    assert.equal(runtime.application, null);
    assert.equal(runtime.repositories, null);
    assert.equal(runtime.paymentProvider, null);
    assert.equal(runtime.persistence.adapter, "none");
  });

  it("disabled mode performs no side effects and blocks commands", () => {
    const runtime = createFinanceRuntime({
      enabled: false,
      mode: "disabled",
      environment: "test",
    });
    assert.equal(runtime.repositories, null);
    assert.equal(runtime.paymentProvider, null);
    assertThrowsCode(
      () => runtime.requireApplication(),
      FINANCE_ERROR_CODES.RUNTIME_DISABLED
    );
    assertThrowsCode(
      () => runtime.commands.fees.registerFee({}),
      FINANCE_ERROR_CODES.RUNTIME_DISABLED
    );
    assertThrowsCode(
      () => runtime.commands.payments.initiatePayment({}),
      FINANCE_ERROR_CODES.RUNTIME_DISABLED
    );
  });
});

describe("Phase 1I configuration", () => {
  it("validates disabled, memory, and Staging supabase configs", () => {
    const disabled = validateFinanceRuntimeConfig({
      enabled: false,
      mode: "disabled",
      environment: "production",
    });
    assert.equal(disabled.mode, "disabled");
    assert.equal(disabled.enabled, false);
    Object.freeze(disabled);
    assert.throws(() => {
      disabled.enabled = true;
    });

    const memory = validateFinanceRuntimeConfig({
      enabled: true,
      mode: "memory",
      environment: "test",
    });
    assert.equal(memory.mode, "memory");
    assert.equal(memory.persistenceExpectation, "memory-non-durable");

    const supabase = validateFinanceRuntimeConfig({
      enabled: true,
      mode: "supabase",
      environment: "staging",
    });
    assert.equal(supabase.mode, "supabase");
    assert.equal(supabase.environment, "staging");
  });

  it("rejects unsupported mode, Production activation, and secrets", () => {
    assertThrowsCode(
      () => validateFinanceRuntimeConfig({ enabled: true, mode: "live-gateway" }),
      FINANCE_ERROR_CODES.UNSUPPORTED_RUNTIME_MODE
    );
    assertThrowsCode(
      () =>
        validateFinanceRuntimeConfig({
          enabled: true,
          mode: "memory",
          environment: "production",
        }),
      FINANCE_ERROR_CODES.ENVIRONMENT_NOT_AUTHORIZED
    );
    assertThrowsCode(
      () =>
        validateFinanceRuntimeConfig({
          enabled: true,
          mode: "supabase",
          environment: "production",
        }),
      FINANCE_ERROR_CODES.ENVIRONMENT_NOT_AUTHORIZED
    );
    assertThrowsCode(
      () =>
        validateFinanceRuntimeConfig({
          enabled: true,
          mode: "memory",
          environment: "test",
          apiKey: "should-not-appear",
        }),
      FINANCE_ERROR_CODES.INVALID_RUNTIME_CONFIGURATION
    );
    assertThrowsCode(
      () =>
        validateFinanceRuntimeConfig({
          enabled: true,
          mode: "memory",
          environment: "test",
          unknownWidget: true,
        }),
      FINANCE_ERROR_CODES.INVALID_RUNTIME_CONFIGURATION
    );
  });

  it("default config factory is disabled and immutable", () => {
    const defaults = createDefaultFinanceRuntimeConfig();
    assert.equal(defaults.enabled, false);
    assert.equal(defaults.mode, FINANCE_RUNTIME_MODE.DISABLED);
    assert.equal(defaults.providerStrategy, FINANCE_PROVIDER_STRATEGY.NONE);
    assert.equal(defaults.tenantStrategy, FINANCE_TENANT_STRATEGY.EXPLICIT_PER_COMMAND);
    assert.throws(() => {
      defaults.mode = "memory";
    });
  });
});

describe("Phase 1I memory composition", () => {
  it("isolates factories, marks non-durable, no singleton leakage", () => {
    const a = createFinanceRuntime({
      enabled: true,
      mode: "memory",
      environment: "test",
    });
    const b = createFinanceRuntime({
      enabled: true,
      mode: "memory",
      environment: "development",
    });
    assert.equal(a.mode, "memory");
    assert.equal(a.capabilities.durablePersistenceAvailable, false);
    assert.equal(a.capabilities.productionAuthorized, false);
    assert.notEqual(a.repositories, b.repositories);
    assert.equal(a.readiness.state, FINANCE_READINESS_STATE.READY);
    assert.equal(a.tenant.strategy, FINANCE_TENANT_STRATEGY.EXPLICIT_PER_COMMAND);
    assertThrowsCode(
      () => a.tenant.resolveTenant(),
      FINANCE_ERROR_CODES.TENANT_RESOLUTION_UNAVAILABLE
    );
  });

  it("test harness wires memory application without Production", () => {
    const harness = createFinanceRuntimeTestHarness();
    assert.equal(harness.isTestHarness, true);
    assert.equal(harness.mode, "memory");
    assert.ok(harness.application);
    assert.equal(typeof harness.resetAllForTests, "function");
    assertThrowsCode(
      () =>
        createFinanceRuntimeTestHarness({
          config: { environment: "production", mode: "memory" },
        }),
      FINANCE_ERROR_CODES.ENVIRONMENT_NOT_AUTHORIZED
    );
  });
});

describe("Phase 1I supabase composition", () => {
  it("rejects missing client; accepts injected client without query/write", () => {
    assertThrowsCode(
      () =>
        createFinanceRuntime({
          enabled: true,
          mode: "supabase",
          environment: "staging",
        }),
      FINANCE_ERROR_CODES.MISSING_RUNTIME_DEPENDENCY
    );

    const client = createFakeSupabaseFinanceClient();
    const before = client.getCalls().length;
    const runtime = createFinanceRuntime(
      {
        enabled: true,
        mode: "supabase",
        environment: "staging",
      },
      { supabaseClient: client }
    );
    const after = client.getCalls().length;
    assert.equal(after, before, "construction must not query or write");
    assert.equal(runtime.mode, "supabase");
    assert.equal(runtime.persistence.adapter, "supabase");
    assert.equal(runtime.persistence.durable, true);
    assert.equal(runtime.repositories.isSupabaseCompatible, true);
    assert.equal(runtime.capabilities.stagingCertified, true);
    assert.equal(runtime.capabilities.productionAuthorized, false);
    assert.equal(
      runtime.readiness.state,
      FINANCE_READINESS_STATE.READY_WITH_CONDITIONS
    );
  });

  it("reports missing transactional executor accurately; no memory fallback", () => {
    const client = createFakeSupabaseFinanceClient();
    const runtime = createFinanceRuntime(
      {
        enabled: true,
        mode: "supabase",
        environment: "staging",
        transactionExpectation: "supabase-injected-executor",
      },
      { supabaseClient: client }
    );
    assert.equal(runtime.readiness.state, FINANCE_READINESS_STATE.NOT_READY);
    assert.equal(runtime.persistence.adapter, "supabase");
    assert.notEqual(runtime.persistence.adapter, "memory");
    assert.ok(
      runtime.readiness.unmetDependencies.some(
        (d) => d.dependency === "transactionalExecutor"
      )
    );

    const withExecutor = createFinanceRuntime(
      {
        enabled: true,
        mode: "supabase",
        environment: "staging",
        transactionExpectation: "supabase-injected-executor",
      },
      {
        supabaseClient: client,
        transactionalExecutor: async (work) => work(),
      }
    );
    assert.equal(withExecutor.persistence.transactionCapability, "injected-executor");
    assert.equal(withExecutor.capabilities.multiRecordTransactionCapability, true);
    assert.equal(withExecutor.readiness.state, FINANCE_READINESS_STATE.READY);
  });
});

describe("Phase 1I provider strategy", () => {
  it("defaults to none; mock requires explicit enablement; no auto-confirm", () => {
    const memory = createFinanceRuntime({
      enabled: true,
      mode: "memory",
      environment: "test",
    });
    assert.equal(memory.config.providerStrategy, FINANCE_PROVIDER_STRATEGY.NONE);
    assert.equal(memory.paymentProvider, null);
    assert.equal(memory.capabilities.providerInitiationAvailable, false);

    assertThrowsCode(
      () =>
        createFinanceRuntime({
          enabled: true,
          mode: "memory",
          environment: "test",
          providerStrategy: "mock",
        }),
      FINANCE_ERROR_CODES.INVALID_RUNTIME_CONFIGURATION
    );

    const mockRuntime = createFinanceRuntime(
      {
        enabled: true,
        mode: "memory",
        environment: "test",
        providerStrategy: "mock",
        featureFlags: { allowMockProvider: true },
      },
      { paymentProvider: createMockPaymentProvider() }
    );
    assert.ok(mockRuntime.paymentProvider);
    assert.equal(mockRuntime.capabilities.providerInitiationAvailable, true);
    assert.ok(
      mockRuntime.capabilities.knownLimitations.some((l) =>
        /auto-confirm/i.test(l)
      )
    );

    assertThrowsCode(
      () =>
        validateFinanceRuntimeConfig({
          enabled: false,
          mode: "disabled",
          environment: "production",
          providerStrategy: "mock",
          featureFlags: { allowMockProvider: true },
        }),
      FINANCE_ERROR_CODES.ENVIRONMENT_NOT_AUTHORIZED
    );
  });
});

describe("Phase 1I tenant strategy", () => {
  it("explicit-per-command default; resolver injection; no startup resolution", () => {
    let resolveCalls = 0;
    const runtime = createFinanceRuntime(
      {
        enabled: true,
        mode: "memory",
        environment: "test",
        tenantStrategy: FINANCE_TENANT_STRATEGY.INJECTED_TRUSTED_RESOLVER,
      },
      {
        tenantResolver: {
          resolveTenantId() {
            resolveCalls += 1;
            return "tenant-from-resolver";
          },
        },
      }
    );
    assert.equal(resolveCalls, 0, "factory must not resolve tenant at startup");
    assert.equal(runtime.tenant.resolveTenant({}), "tenant-from-resolver");
    assert.equal(resolveCalls, 1);

    assertThrowsCode(
      () =>
        createFinanceRuntime({
          enabled: true,
          mode: "memory",
          environment: "test",
          tenantStrategy: FINANCE_TENANT_STRATEGY.INJECTED_TRUSTED_RESOLVER,
        }),
      FINANCE_ERROR_CODES.MISSING_RUNTIME_DEPENDENCY
    );
  });
});

describe("Phase 1I readiness and health probes", () => {
  it("disabled / ready / ready-with-conditions / not-ready; safe deterministic output", () => {
    const disabled = createFinanceRuntime();
    assert.equal(disabled.readiness.state, FINANCE_READINESS_STATE.DISABLED);

    const memory = createFinanceRuntime({
      enabled: true,
      mode: "memory",
      environment: "test",
    });
    assert.equal(memory.readiness.state, FINANCE_READINESS_STATE.READY);

    const client = createFakeSupabaseFinanceClient();
    const supabase = createFinanceRuntime(
      { enabled: true, mode: "supabase", environment: "staging" },
      { supabaseClient: client }
    );
    assert.equal(
      supabase.readiness.state,
      FINANCE_READINESS_STATE.READY_WITH_CONDITIONS
    );

    const s1 = serializeFinanceReadiness(supabase.readiness);
    const s2 = serializeFinanceReadiness(supabase.readiness);
    assert.equal(s1, s2);
    assert.equal(/service_role|eyJ|password|apikey/i.test(s1), false);
    assert.equal(supabase.readiness.productionAuthorized, false);
    assert.ok(supabase.readiness.stagingCertificationReference);
  });

  it("no automatic probe; explicit success/failure/timeout; safe output", async () => {
    const runtime = createFinanceRuntime({
      enabled: true,
      mode: "memory",
      environment: "test",
      featureFlags: { allowOptionalHealthProbes: true },
    });

    const noProbe = await runtime.inspectHealth();
    assert.equal(noProbe.probedDuringConstruction, false);
    assert.equal(noProbe.probesRequested.persistence, false);
    assert.equal(Object.keys(noProbe.probesRun).length, 0);

    const ok = await runtime.inspectHealth({
      runPersistenceProbe: true,
      persistenceProbe: async () => ({ status: "ok" }),
      timeoutMs: 500,
    });
    assert.equal(ok.probesRun.persistence.ok, true);
    assert.equal(ok.overallOk, true);

    const fail = await runtime.inspectHealth({
      runPersistenceProbe: true,
      persistenceProbe: async () => {
        throw new Error("simulated failure with token=super-secret");
      },
      timeoutMs: 500,
    });
    assert.equal(fail.probesRun.persistence.ok, false);
    assert.equal(fail.overallOk, false);
    const detail = JSON.stringify(fail.probesRun.persistence.detail);
    assert.equal(/super-secret/i.test(detail), false);

    const timed = await runtime.inspectHealth({
      runPersistenceProbe: true,
      timeoutMs: 30,
      persistenceProbe: () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ late: true }), 200);
        }),
    });
    assert.equal(timed.probesRun.persistence.ok, false);
    assert.equal(timed.probesRun.persistence.timedOut, true);
    assert.equal(timed.probeTimeoutMs, 30);
  });
});

describe("Phase 1I capability report", () => {
  it("is immutable, accurate, Staging-referenced, Production false", () => {
    const runtime = createFinanceRuntime(
      {
        enabled: true,
        mode: "supabase",
        environment: "staging",
      },
      { supabaseClient: createFakeSupabaseFinanceClient() }
    );
    const caps = runtime.getCapabilities();
    assert.throws(() => {
      caps.productionAuthorized = true;
    });
    assert.equal(caps.financeEnabled, true);
    assert.equal(caps.runtimeMode, "supabase");
    assert.equal(caps.durablePersistenceAvailable, true);
    assert.equal(caps.stagingCertified, true);
    assert.equal(caps.productionAuthorized, false);
    assert.equal(caps.sqlSchemaExpected, true);
    assert.ok(caps.stagingCertificationReference.document.includes("PHASE_1H"));
    assert.equal(caps.multiRecordTransactionCapability, false);
  });
});

describe("Phase 1I public exports", () => {
  it("exposes runtime contracts from finance facade", () => {
    assert.equal(typeof Finance.createFinanceRuntime, "function");
    assert.equal(typeof Finance.createFinanceRuntimeTestHarness, "function");
    assert.equal(typeof Finance.validateFinanceRuntimeConfig, "function");
    assert.equal(Finance.FINANCE_RUNTIME_MODE.DISABLED, "disabled");
    assert.equal(Finance.FINANCE_READINESS_STATE.DISABLED, "DISABLED");
    assert.equal(
      Finance.FINANCE_ERROR_CODES.RUNTIME_DISABLED,
      "FINANCE_RUNTIME_DISABLED"
    );
    assert.equal(Finance.FINANCE_STAGING_CERTIFICATION_REFERENCE.phase, "1H");
    assert.equal(
      Finance.FINANCE_RUNTIME_ENVIRONMENT.PRODUCTION,
      "production"
    );
  });
});
