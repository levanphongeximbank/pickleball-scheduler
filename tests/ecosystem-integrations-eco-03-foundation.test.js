/**
 * ECO-03 — Provider Adapter Foundation (contracts, registry, selection, adapters).
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ADAPTER_READINESS,
  ADAPTER_SELECTION_OUTCOME,
  ECOSYSTEM_INTEGRATIONS_PHASE,
  IDEMPOTENCY_OUTCOME,
  INTEGRATION_ERROR_CODE,
  INVOCATION_RESULT_STATUS,
  REDACTED_MARKER,
  classifyIntegrationRetry,
  createCalendarAdapterReadinessContract,
  createConnectorCapabilityBinding,
  createDataExchangeAdapterReadinessContract,
  createFakeProviderAdapter,
  createIdentityAdapterReadinessContract,
  createMessagingAdapterReadinessContract,
  createNoOpProviderAdapter,
  createPaymentAdapterReadinessContract,
  createProviderAdapterDescriptor,
  createProviderAdapterObservation,
  createProviderAdapterRegistry,
  createProviderInvocationRequest,
  createProviderInvocationResult,
  createRedactedDiagnostics,
  isRetryableIntegrationErrorCode,
  mapProviderFailureToIntegrationError,
  projectProviderAdapterReadiness,
  selectProviderAdapter,
} from "../src/features/ecosystem-integrations/index.js";

function baseDescriptor(overrides = {}) {
  return {
    adapterId: "eco.adapter.test.a",
    providerKey: "test.adapter.a",
    connectorKind: "GENERIC",
    supportedCapabilityIds: ["eco.capability.test.invoke"],
    supportedInvocationModes: ["SYNC"],
    supportedEnvironments: ["TEST", "SANDBOX"],
    lifecycleState: "ACTIVE",
    credentialRequirement: "NONE",
    retrySupport: true,
    idempotencySupport: true,
    webhookSupport: false,
    enabled: true,
    priority: 10,
    publicMetadata: { purpose: "test", productionBlocked: true },
    ...overrides,
  };
}

test("ECO-03 phase metadata records provider adapter foundation", () => {
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.id, "ECO-03");
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.priorPhase, "ECO-02b");
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasProviderAdapterFoundation, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasRealProviders, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasNetworkClients, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasLiveCredentialResolver, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.productionBlocked, true);
  assert.ok(Object.isFrozen(ECOSYSTEM_INTEGRATIONS_PHASE));
});

test("descriptor is immutable and rejects credential-shaped metadata", () => {
  const result = createProviderAdapterDescriptor(baseDescriptor());
  assert.equal(result.ok, true);
  assert.ok(Object.isFrozen(result.value));
  assert.throws(() => {
    result.value.adapterId = "mutated";
  });

  const bad = createProviderAdapterDescriptor(
    baseDescriptor({
      publicMetadata: { apiKey: "x" },
    })
  );
  assert.equal(bad.ok, false);
});

test("duplicate adapter and invalid capability binding are rejected", () => {
  const dup = createProviderAdapterRegistry({
    adapters: [baseDescriptor(), baseDescriptor()],
  });
  assert.equal(dup.ok, false);
  assert.equal(dup.error.code, "PROVIDER_ADAPTER_REGISTRY_DUPLICATE_ADAPTER");

  const unknownAdapter = createProviderAdapterRegistry({
    adapters: [baseDescriptor()],
    bindings: [
      {
        connectorId: "eco.connector.test",
        capabilityId: "eco.capability.test.invoke",
        adapterId: "missing.adapter",
      },
    ],
  });
  assert.equal(unknownAdapter.ok, false);

  const undeclaredCap = createProviderAdapterRegistry({
    adapters: [baseDescriptor()],
    bindings: [
      {
        connectorId: "eco.connector.test",
        capabilityId: "eco.capability.other",
        adapterId: "eco.adapter.test.a",
      },
    ],
  });
  assert.equal(undeclaredCap.ok, false);

  const dupBinding = createProviderAdapterRegistry({
    adapters: [baseDescriptor()],
    bindings: [
      {
        bindingId: "b1",
        connectorId: "eco.connector.test",
        capabilityId: "eco.capability.test.invoke",
        adapterId: "eco.adapter.test.a",
      },
      {
        bindingId: "b1",
        connectorId: "eco.connector.test",
        capabilityId: "eco.capability.test.invoke",
        adapterId: "eco.adapter.test.a",
      },
    ],
  });
  assert.equal(dupBinding.ok, false);
});

test("registry lookup and selection are deterministic", () => {
  const registry = createProviderAdapterRegistry({
    adapters: [
      baseDescriptor({
        adapterId: "eco.adapter.b",
        providerKey: "test.b",
        priority: 20,
      }),
      baseDescriptor({
        adapterId: "eco.adapter.a",
        providerKey: "test.a",
        priority: 10,
      }),
    ],
    bindings: [
      createConnectorCapabilityBinding({
        connectorId: "eco.connector.test",
        capabilityId: "eco.capability.test.invoke",
        adapterId: "eco.adapter.a",
        priority: 10,
      }).value,
      createConnectorCapabilityBinding({
        connectorId: "eco.connector.test",
        capabilityId: "eco.capability.test.invoke",
        adapterId: "eco.adapter.b",
        priority: 20,
      }).value,
    ],
  });
  assert.equal(registry.ok, true);

  const found = registry.value.findAdaptersByCapability(
    "eco.capability.test.invoke"
  );
  assert.equal(found.ok, true);
  assert.deepEqual(
    found.value.map((a) => a.adapterId),
    ["eco.adapter.a", "eco.adapter.b"]
  );

  const selected = selectProviderAdapter({
    registry: registry.value,
    capabilityId: "eco.capability.test.invoke",
    environment: "TEST",
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.value.outcome, ADAPTER_SELECTION_OUTCOME.SELECTED);
  assert.equal(selected.value.selectedAdapterId, "eco.adapter.a");

  const selectedAgain = selectProviderAdapter({
    registry: registry.value,
    capabilityId: "eco.capability.test.invoke",
    environment: "TEST",
  });
  assert.equal(
    selectedAgain.value.selectedAdapterId,
    selected.value.selectedAdapterId
  );
});

test("unsupported capability and no-ready-adapter outcomes", () => {
  const registry = createProviderAdapterRegistry({
    adapters: [
      baseDescriptor({
        lifecycleState: "DISABLED",
        enabled: true,
      }),
    ],
  }).value;

  const unsupported = selectProviderAdapter({
    registry,
    capabilityId: "eco.capability.missing",
    environment: "TEST",
  });
  assert.equal(
    unsupported.value.outcome,
    ADAPTER_SELECTION_OUTCOME.UNSUPPORTED_CAPABILITY
  );

  const blocked = selectProviderAdapter({
    registry,
    capabilityId: "eco.capability.test.invoke",
    environment: "TEST",
  });
  assert.equal(
    blocked.value.outcome,
    ADAPTER_SELECTION_OUTCOME.LIFECYCLE_BLOCKED
  );
  assert.equal(blocked.value.selectedAdapterId, null);
});

test("environment eligibility and lifecycle blocking", () => {
  const descriptor = createProviderAdapterDescriptor(
    baseDescriptor({
      supportedEnvironments: ["TEST"],
      lifecycleState: "DECLARED",
    })
  ).value;

  const production = projectProviderAdapterReadiness({
    descriptor: createProviderAdapterDescriptor(
      baseDescriptor({ supportedEnvironments: ["TEST", "SANDBOX", "PRODUCTION"] })
    ).value,
    environment: "PRODUCTION",
    capabilityId: "eco.capability.test.invoke",
  });
  assert.equal(production.value.productionBlocked, true);
  assert.equal(
    production.value.readinessStatus,
    ADAPTER_READINESS.PRODUCTION_BLOCKED
  );

  const env = projectProviderAdapterReadiness({
    descriptor: createProviderAdapterDescriptor(
      baseDescriptor({ supportedEnvironments: ["TEST"] })
    ).value,
    environment: "STAGING",
    capabilityId: "eco.capability.test.invoke",
  });
  assert.equal(env.value.environmentEligible, false);
  assert.equal(env.value.readinessStatus, ADAPTER_READINESS.UNAVAILABLE);
  assert.equal(env.value.blockedReason, "environment_not_eligible");

  const life = projectProviderAdapterReadiness({
    descriptor,
    environment: "TEST",
    capabilityId: "eco.capability.test.invoke",
  });
  assert.equal(life.value.lifecycleActive, false);
  assert.equal(life.value.readinessStatus, ADAPTER_READINESS.UNAVAILABLE);
});

test("credential-required absent fails closed; enabled does not mean ready", () => {
  const descriptor = createProviderAdapterDescriptor(
    baseDescriptor({
      credentialRequirement: "REQUIRED",
      credentialRequirementRefs: ["INTEGRATION_TEST_SECRET"],
      enabled: true,
    })
  ).value;

  const absent = projectProviderAdapterReadiness({
    descriptor,
    environment: "TEST",
    capabilityId: "eco.capability.test.invoke",
    credentialPresent: false,
  });
  assert.equal(absent.value.operationallyReady, false);
  assert.equal(absent.value.blockedReason, "credential_required_absent");

  const enabledOnly = projectProviderAdapterReadiness({
    descriptor: createProviderAdapterDescriptor(
      baseDescriptor({
        enabled: true,
        lifecycleState: "DISABLED",
      })
    ).value,
    environment: "TEST",
    capabilityId: "eco.capability.test.invoke",
  });
  assert.equal(enabledOnly.value.enabled, true);
  assert.equal(enabledOnly.value.operationallyReady, false);
});

test("invocation request and result validation preserve correlation/idempotency", () => {
  const request = createProviderInvocationRequest({
    requestId: "req-1",
    adapterId: "eco.adapter.test.a",
    connectorId: "eco.connector.test",
    capabilityId: "eco.capability.test.invoke",
    operation: "INVOKE",
    requestedEnvironment: "TEST",
    payload: { amountMinor: 1000, currency: "VND" },
    correlationId: "corr-1",
    causationId: "cause-1",
    idempotencyKey: "idem-1",
    tenantId: "tenant-a",
    timeoutPolicy: { timeoutMs: 5000 },
  });
  assert.equal(request.ok, true);
  assert.equal(request.value.correlationId, "corr-1");
  assert.equal(request.value.causationId, "cause-1");
  assert.equal(request.value.idempotencyKey, "idem-1");
  assert.ok(Object.isFrozen(request.value));

  const badPayload = createProviderInvocationRequest({
    requestId: "req-bad",
    adapterId: "eco.adapter.test.a",
    connectorId: "eco.connector.test",
    capabilityId: "eco.capability.test.invoke",
    operation: "INVOKE",
    payload: { apiKey: "secret-value" },
  });
  assert.equal(badPayload.ok, false);

  const result = createProviderInvocationResult({
    requestId: "req-1",
    resultStatus: INVOCATION_RESULT_STATUS.SUCCEEDED,
    adapterId: "eco.adapter.test.a",
    providerKey: "test.adapter.a",
    completedAt: "2026-07-25T12:00:00.000Z",
    output: { receipt: "r-1" },
    correlationId: "corr-1",
    causationId: "cause-1",
    idempotencyKey: "idem-1",
    idempotencyOutcome: IDEMPOTENCY_OUTCOME.NEW,
    diagnostics: { token: "should-redact", statusCode: 200 },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.correlationId, "corr-1");
  assert.equal(result.value.idempotencyKey, "idem-1");
  assert.equal(result.value.idempotencyOutcome, IDEMPOTENCY_OUTCOME.NEW);
  assert.equal(result.value.diagnostics.diagnostics.token, REDACTED_MARKER);
});

test("error taxonomy and retry classification are reused", () => {
  const auth = mapProviderFailureToIntegrationError({
    failureClass: "authentication",
    message: "missing credential",
  });
  assert.equal(
    auth.integrationError.code,
    INTEGRATION_ERROR_CODE.AUTHENTICATION
  );
  assert.equal(auth.retryClassification.retryable, false);
  assert.equal(
    isRetryableIntegrationErrorCode(INTEGRATION_ERROR_CODE.AUTHENTICATION),
    false
  );

  const timeout = mapProviderFailureToIntegrationError("timeout");
  assert.equal(timeout.integrationError.code, INTEGRATION_ERROR_CODE.TIMEOUT);
  assert.equal(timeout.retryClassification.retryable, true);

  const rate = mapProviderFailureToIntegrationError({
    failureClass: "rate_limited",
  });
  assert.equal(rate.retryClassification.retryable, true);

  const permanent = mapProviderFailureToIntegrationError({
    failureClass: "permanent_rejection",
  });
  assert.equal(permanent.retryClassification.retryable, false);

  const direct = classifyIntegrationRetry(INTEGRATION_ERROR_CODE.NETWORK);
  assert.equal(direct.retryable, true);
});

test("sensitive diagnostic redaction", () => {
  const redacted = createRedactedDiagnostics({
    password: "x",
    safe: "ok",
  });
  assert.equal(redacted.ok, true);
  assert.equal(redacted.value.diagnostics.password, REDACTED_MARKER);
  assert.equal(redacted.value.diagnostics.safe, "ok");
});

test("no-op adapter is deterministic", () => {
  const adapter = createNoOpProviderAdapter();
  const first = adapter.invoke({
    requestId: "noop-1",
    connectorId: "eco.noop.test",
    capabilityId: "eco.capability.noop.invoke",
    operation: "PING",
    payload: { n: 1 },
  });
  const second = adapter.invoke({
    requestId: "noop-2",
    connectorId: "eco.noop.test",
    capabilityId: "eco.capability.noop.invoke",
    operation: "PING",
    payload: { n: 1 },
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.value.resultStatus, INVOCATION_RESULT_STATUS.SUCCEEDED);
  assert.equal(first.value.output.pong, true);
  assert.equal(second.value.output.pong, true);
  assert.equal(adapter.getInvokeCount(), 2);
  assert.equal(adapter.productionReady, false);
});

test("fake adapter is deterministic including idempotency outcomes", () => {
  const adapter = createFakeProviderAdapter();
  const a = adapter.invoke({
    requestId: "fake-1",
    connectorId: "eco.fake.test",
    capabilityId: "eco.capability.fake.invoke",
    operation: "INVOKE",
    payload: { x: 1 },
    idempotencyKey: "same-key",
  });
  const b = adapter.invoke({
    requestId: "fake-2",
    connectorId: "eco.fake.test",
    capabilityId: "eco.capability.fake.invoke",
    operation: "INVOKE",
    payload: { x: 1 },
    idempotencyKey: "same-key",
  });
  const conflict = adapter.invoke({
    requestId: "fake-3",
    connectorId: "eco.fake.test",
    capabilityId: "eco.capability.fake.invoke",
    operation: "INVOKE",
    payload: { x: 2 },
    idempotencyKey: "same-key",
  });

  assert.equal(a.value.idempotencyOutcome, IDEMPOTENCY_OUTCOME.NEW);
  assert.equal(b.value.idempotencyOutcome, IDEMPOTENCY_OUTCOME.DUPLICATE);
  assert.equal(conflict.value.resultStatus, INVOCATION_RESULT_STATUS.FAILED);
  assert.equal(
    conflict.value.integrationError.code,
    INTEGRATION_ERROR_CODE.CONFLICT_DUPLICATE
  );
});

test("observation metadata is created safely", () => {
  const obs = createProviderAdapterObservation({
    observationId: "obs-1",
    adapterId: "eco.adapter.test.a",
    requestId: "req-1",
    correlationId: "corr-1",
    resultStatus: "SUCCEEDED",
    attributes: { secret: "nope", operation: "INVOKE" },
  });
  assert.equal(obs.ok, true);
  assert.equal(obs.value.attributes.diagnostics.secret, REDACTED_MARKER);
});

test("domain readiness contracts are contract-only for five domains", () => {
  const payment = createPaymentAdapterReadinessContract();
  const messaging = createMessagingAdapterReadinessContract();
  const calendar = createCalendarAdapterReadinessContract();
  const identity = createIdentityAdapterReadinessContract();
  const dataExchange = createDataExchangeAdapterReadinessContract();

  for (const result of [payment, messaging, calendar, identity, dataExchange]) {
    assert.equal(result.ok, true);
    assert.equal(result.value.contractOnly, true);
    assert.equal(result.value.liveProviderAllowed, false);
    assert.equal(result.value.productionActivationAllowed, false);
    assert.equal(result.value.networkAllowed, false);
    assert.equal(result.value.status, "CONTRACT_ONLY_READY");
  }

  assert.equal(payment.value.domain, "payment");
  assert.equal(messaging.value.domain, "messaging");
  assert.equal(calendar.value.domain, "calendar");
  assert.equal(identity.value.domain, "identity");
  assert.equal(dataExchange.value.domain, "data-exchange");

  const liveBlocked = createPaymentAdapterReadinessContract({
    liveProviderAllowed: true,
  });
  assert.equal(liveBlocked.ok, false);
});

test("public facade exports ECO-03 symbols", async () => {
  const facade = await import(
    "../src/features/ecosystem-integrations/index.js"
  );
  for (const name of [
    "createProviderAdapterDescriptor",
    "createProviderAdapterPort",
    "createProviderInvocationRequest",
    "createProviderInvocationResult",
    "createConnectorCapabilityBinding",
    "createProviderAdapterRegistry",
    "selectProviderAdapter",
    "projectProviderAdapterReadiness",
    "createProviderAdapterObservation",
    "mapProviderFailureToIntegrationError",
    "createNoOpProviderAdapter",
    "createFakeProviderAdapter",
    "createPaymentAdapterReadinessContract",
    "createMessagingAdapterReadinessContract",
    "createCalendarAdapterReadinessContract",
    "createIdentityAdapterReadinessContract",
    "createDataExchangeAdapterReadinessContract",
  ]) {
    assert.equal(typeof facade[name], "function", name);
  }
});
