/**
 * Phase 1J — Authenticated Staging Finance composition wiring tests.
 *
 * No Staging reconnect. No Production activation. No live provider.
 * No process.env required — flags injected via options.env.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import * as Finance from "../src/features/finance/index.js";
import {
  createFinanceAppComposition,
  createAuthenticatedFinanceTenantResolver,
  createFakeSupabaseFinanceClient,
  resolveFinanceStagingActivation,
  isFinanceStagingRuntimeFlagEnabled,
  FINANCE_STAGING_RUNTIME_FLAG,
  FINANCE_APP_ENV_KEY,
  FINANCE_STAGING_ACTIVATION_REASON,
  FINANCE_READINESS_STATE,
  FINANCE_ERROR_CODES,
  FINANCE_RUNTIME_MODE,
  isFinanceError,
} from "../src/features/finance/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assertThrowsCode(fn, code) {
  try {
    fn();
    assert.fail(`Expected FinanceError ${code}`);
  } catch (err) {
    assert.equal(isFinanceError(err), true);
    assert.equal(err.code, code);
  }
}

describe("Phase 1J feature flag behavior", () => {
  it("defaults OFF and creates disabled runtime", () => {
    assert.equal(isFinanceStagingRuntimeFlagEnabled({}), false);
    const composition = createFinanceAppComposition({ env: {} });
    assert.equal(composition.enabled, false);
    assert.equal(composition.mode, FINANCE_RUNTIME_MODE.DISABLED);
    assert.equal(composition.activation.reason, FINANCE_STAGING_ACTIVATION_REASON.FLAG_OFF);
    assert.equal(composition.readiness.state, FINANCE_READINESS_STATE.DISABLED);
    assert.equal(composition.repositories, null);
    assert.equal(composition.databaseTouchedAtComposition, false);
    assert.equal(composition.resolvedTenantAtComposition, false);
    assert.equal(composition.autoInvokedCommands, false);
  });

  it("ON in Staging creates Supabase runtime with injected client", () => {
    const client = createFakeSupabaseFinanceClient();
    const before = client.getCalls().length;
    let tenantCalls = 0;
    const composition = createFinanceAppComposition({
      env: {
        [FINANCE_STAGING_RUNTIME_FLAG]: "true",
        [FINANCE_APP_ENV_KEY]: "staging",
      },
      supabaseClient: client,
      tenantResolver: {
        resolveTenantId() {
          tenantCalls += 1;
          return "tenant-a";
        },
      },
    });
    assert.equal(client.getCalls().length, before);
    assert.equal(tenantCalls, 0);
    assert.equal(composition.enabled, true);
    assert.equal(composition.mode, "supabase");
    assert.equal(composition.persistence.adapter, "supabase");
    assert.equal(composition.clientSource, "injected-authenticated");
    assert.equal(composition.capabilities.productionAuthorized, false);
    assert.equal(composition.runtime.config.providerStrategy, "none");
    assert.notEqual(composition.persistence.adapter, "memory");
  });

  it("ON in Production remains disabled; unknown env fails closed", () => {
    const client = createFakeSupabaseFinanceClient();
    const prod = createFinanceAppComposition({
      env: {
        [FINANCE_STAGING_RUNTIME_FLAG]: "true",
        [FINANCE_APP_ENV_KEY]: "production",
      },
      supabaseClient: client,
    });
    assert.equal(prod.enabled, false);
    assert.equal(prod.mode, FINANCE_RUNTIME_MODE.DISABLED);
    assert.equal(
      prod.activation.reason,
      FINANCE_STAGING_ACTIVATION_REASON.PRODUCTION_NOT_AUTHORIZED
    );
    assert.equal(prod.repositories, null);
    assert.equal(prod.persistence.adapter, "none");
    assert.equal(client.getCalls().length, 0);

    const unknown = resolveFinanceStagingActivation({
      env: { [FINANCE_STAGING_RUNTIME_FLAG]: "true" },
      appEnvironment: "weird-cloud",
    });
    assert.equal(unknown.activate, false);
    assert.equal(
      unknown.reason,
      FINANCE_STAGING_ACTIVATION_REASON.UNKNOWN_ENVIRONMENT
    );

    const unknownComposition = createFinanceAppComposition({
      env: { [FINANCE_STAGING_RUNTIME_FLAG]: "true" },
      appEnvironment: "weird-cloud",
      supabaseClient: client,
    });
    assert.equal(unknownComposition.enabled, false);
    assert.equal(unknownComposition.repositories, null);
  });

  it("Staging ON without injected client fails closed", () => {
    assertThrowsCode(
      () =>
        createFinanceAppComposition({
          env: {
            [FINANCE_STAGING_RUNTIME_FLAG]: "true",
            [FINANCE_APP_ENV_KEY]: "staging",
          },
        }),
      FINANCE_ERROR_CODES.MISSING_RUNTIME_DEPENDENCY
    );
  });
});

describe("Phase 1J authenticated tenant resolver", () => {
  it("resolves authoritative tenant on explicit operation only", () => {
    const resolver = createAuthenticatedFinanceTenantResolver({
      resolveEffectiveTenantId: (user) => user?.venueId || null,
    });
    assert.equal(
      resolver.resolveTenantId({ user: { id: "u1", venueId: "venue-1" } }),
      "venue-1"
    );
  });

  it("fails on missing / ambiguous tenant; rejects client tenant claims", () => {
    const resolver = createAuthenticatedFinanceTenantResolver();
    assertThrowsCode(
      () => resolver.resolveTenantId({ user: { id: "u1" } }),
      FINANCE_ERROR_CODES.TENANT_RESOLUTION_UNAVAILABLE
    );
    assertThrowsCode(
      () =>
        resolver.resolveTenantId({
          user: { id: "u1", tenantId: "t-a", venueId: "t-b" },
        }),
      FINANCE_ERROR_CODES.TENANT_RESOLUTION_UNAVAILABLE
    );
    assertThrowsCode(
      () =>
        resolver.resolveTenantId({
          user: { id: "u1", venueId: "venue-1" },
          tenantId: "spoofed",
        }),
      FINANCE_ERROR_CODES.TENANT_RESOLUTION_UNAVAILABLE
    );
    assertThrowsCode(
      () =>
        resolver.resolveTenantId({
          user: { id: "u1", venueId: "venue-1" },
          overrideTenantId: "spoofed",
        }),
      FINANCE_ERROR_CODES.TENANT_RESOLUTION_UNAVAILABLE
    );
  });

  it("does not resolve tenant during composition", () => {
    let calls = 0;
    createFinanceAppComposition({
      env: {
        [FINANCE_STAGING_RUNTIME_FLAG]: "true",
        [FINANCE_APP_ENV_KEY]: "staging",
      },
      supabaseClient: createFakeSupabaseFinanceClient(),
      tenantResolver: {
        resolveTenantId() {
          calls += 1;
          return "t1";
        },
      },
    });
    assert.equal(calls, 0);
  });
});

describe("Phase 1J readiness", () => {
  it("reports disabled, Staging enabled, and Production unauthorized safely", () => {
    const disabled = createFinanceAppComposition({ env: {} });
    assert.equal(disabled.getReadiness().state, FINANCE_READINESS_STATE.DISABLED);
    assert.equal(disabled.getReadiness().featureFlagEnabled, false);
    assert.equal(disabled.getReadiness().productionAuthorized, false);

    const staging = createFinanceAppComposition({
      env: {
        [FINANCE_STAGING_RUNTIME_FLAG]: "true",
        [FINANCE_APP_ENV_KEY]: "staging",
      },
      supabaseClient: createFakeSupabaseFinanceClient(),
    });
    const ready = staging.getReadiness();
    assert.equal(ready.runtimeMode, "supabase");
    assert.equal(ready.classifiedEnvironment, "staging");
    assert.equal(ready.productionAuthorized, false);
    assert.ok(ready.stagingCertificationReference);
    assert.equal(ready.providerStrategy, "none");
    assert.equal(ready.tenantStrategy, "injected-trusted-resolver");

    const prod = createFinanceAppComposition({
      env: {
        [FINANCE_STAGING_RUNTIME_FLAG]: "true",
        [FINANCE_APP_ENV_KEY]: "production",
      },
    });
    const prodReady = prod.getReadiness();
    assert.equal(prodReady.state, FINANCE_READINESS_STATE.DISABLED);
    assert.equal(
      prodReady.activationReason,
      FINANCE_STAGING_ACTIVATION_REASON.PRODUCTION_NOT_AUTHORIZED
    );
    const serialized = JSON.stringify(prodReady);
    assert.equal(/service_role|eyJ|password|apikey|supabase\.co/i.test(serialized), false);
  });
});

describe("Phase 1J scope and app-shell wiring", () => {
  it("MainLayout mounts FinanceStagingRuntimeProvider without routes/menus/business wiring", () => {
    const layout = readSrc("src/layouts/MainLayout.jsx");
    assert.ok(layout.includes("FinanceStagingRuntimeProvider"));
    assert.ok(layout.includes("NotificationRuntimeProvider"));
    assert.equal(/createObligation|initiatePayment|createInvoice/.test(layout), false);
    assert.equal(/Route path=.*finance/i.test(layout), false);

    const nav = readSrc("src/config/navigationConfig.js");
    assert.equal(/finance-foundation|FinanceStaging|FINANCE_STAGING/i.test(nav), false);

    const router = readSrc("src/router.jsx");
    assert.equal(/FinanceStaging|finance\/runtime|createFinanceAppComposition/.test(router), false);

    assert.equal(typeof Finance.createFinanceAppComposition, "function");
    assert.equal(Finance.FINANCE_STAGING_RUNTIME_FLAG, "VITE_FINANCE_STAGING_RUNTIME_ENABLED");
  });

  it("does not wire Booking/Tournament/Competition modules", () => {
    const compositionSrc = readSrc(
      "src/features/finance/runtime/createFinanceAppComposition.js"
    );
    const providerSrc = readSrc(
      "src/features/finance/runtime/FinanceStagingRuntimeProvider.jsx"
    );
    for (const src of [compositionSrc, providerSrc]) {
      assert.equal(/features\/booking|features\/tournament|competition-core/i.test(src), false);
      assert.equal(/service_role|createClient\(/.test(src), false);
    }
    // Provider may reference getSupabaseAuthClient but must not createClient.
    assert.ok(providerSrc.includes("getSupabaseAuthClient"));
    assert.equal(/createClient\s*\(/.test(providerSrc), false);
  });
});
