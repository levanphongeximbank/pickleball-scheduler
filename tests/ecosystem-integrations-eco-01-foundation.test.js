/**
 * ECO-01 — Canonical Connector & Event Foundation (targeted suite).
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CONNECTOR_KIND,
  ECOSYSTEM_INTEGRATIONS_PHASE,
  IDEMPOTENCY_OUTCOME,
  INTEGRATION_ERROR_CODE,
  OPERATIONAL_STATUS,
  WEBHOOK_VERIFICATION_OUTCOME,
  assertPlatformIntegrationCapabilitySurface,
  classifyIntegrationRetry,
  createConnectorDescriptor,
  createFakeWebhookVerifier,
  createIdempotencyProjection,
  createInboundIntegrationEnvelope,
  createIntegrationError,
  createIntegrationRegistry,
  createNoOpTestProvider,
  createOutboundIntegrationEnvelope,
  createProviderCapabilityDescriptor,
  evaluateIdempotencyProjection,
  isRetryableIntegrationErrorCode,
  projectConnectorToIntegrationPort,
  projectIntegrationReadiness,
  verifyWebhookRequestFailClosed,
} from "../src/features/ecosystem-integrations/index.js";

const FIXED_TS = "2026-07-24T10:00:00.000Z";

test("ECO-01 phase metadata is structural-only", () => {
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.id, "ECO-01");
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasRealProviders, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasNetworkClients, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.productionBlocked, true);
  assert.ok(Object.isFrozen(ECOSYSTEM_INTEGRATIONS_PHASE));
});

test("connector descriptor is immutable and provider-neutral", () => {
  const result = createConnectorDescriptor({
    connectorId: "eco.payment.mock",
    kind: CONNECTOR_KIND.PAYMENT,
    providerKey: "payment.mock",
    direction: "OUTBOUND",
    supportedCapabilities: ["eco.capability.payment.initiate"],
    environmentEligibility: ["TEST", "SANDBOX"],
    lifecycleState: "DECLARED",
    publicMetadata: { label: "Mock payment" },
  });
  assert.equal(result.ok, true);
  assert.ok(Object.isFrozen(result.value));
  assert.throws(() => {
    result.value.connectorId = "mutated";
  });
  assert.equal(result.value.providerKey, "payment.mock");
});

test("connector descriptor rejects credential-like publicMetadata", () => {
  const result = createConnectorDescriptor({
    connectorId: "eco.bad",
    kind: "GENERIC",
    providerKey: "bad",
    direction: "INBOUND",
    publicMetadata: { apiKey: "should-not-pass" },
  });
  assert.equal(result.ok, false);
});

test("provider capability descriptor captures sandbox/idempotency/webhook metadata", () => {
  const result = createProviderCapabilityDescriptor({
    capabilityId: "eco.capability.payment.initiate",
    supportedOperations: ["INITIATE"],
    deliveryModes: ["SYNC", "WEBHOOK"],
    sandboxSupport: true,
    idempotencySupport: true,
    webhookSupport: true,
    credentialRequirement: "REQUIRED",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.webhookSupport, true);
  assert.equal(result.value.credentialRequirement, "REQUIRED");
  assert.ok(Object.isFrozen(result.value));
});

test("immutable registry rejects duplicate connector and capability IDs", () => {
  const dupConnector = createIntegrationRegistry({
    connectors: [
      {
        connectorId: "a",
        kind: "GENERIC",
        providerKey: "p1",
        direction: "OUTBOUND",
      },
      {
        connectorId: "a",
        kind: "GENERIC",
        providerKey: "p2",
        direction: "OUTBOUND",
      },
    ],
  });
  assert.equal(dupConnector.ok, false);
  assert.equal(dupConnector.error.code, "INTEGRATION_REGISTRY_DUPLICATE_CONNECTOR");

  const dupCapability = createIntegrationRegistry({
    capabilities: [
      { capabilityId: "c1", supportedOperations: ["X"] },
      { capabilityId: "c1", supportedOperations: ["Y"] },
    ],
  });
  assert.equal(dupCapability.ok, false);
  assert.equal(dupCapability.error.code, "INTEGRATION_REGISTRY_DUPLICATE_CAPABILITY");

  const dupProvider = createIntegrationRegistry({
    connectors: [
      {
        connectorId: "a",
        kind: "GENERIC",
        providerKey: "same",
        direction: "OUTBOUND",
      },
      {
        connectorId: "b",
        kind: "GENERIC",
        providerKey: "same",
        direction: "OUTBOUND",
      },
    ],
  });
  assert.equal(dupProvider.ok, false);
  assert.equal(dupProvider.error.code, "INTEGRATION_REGISTRY_DUPLICATE_PROVIDER");
});

test("registry lookup and capability discovery are deterministic", () => {
  const registryResult = createIntegrationRegistry({
    connectors: [
      {
        connectorId: "eco.noop",
        kind: "GENERIC",
        providerKey: "noop.test",
        direction: "BIDIRECTIONAL",
        supportedCapabilities: ["eco.capability.noop.invoke"],
      },
      {
        connectorId: "eco.notify",
        kind: "NOTIFICATION",
        providerKey: "notify.sandbox",
        direction: "OUTBOUND",
        supportedCapabilities: ["eco.capability.notify.send"],
      },
    ],
    capabilities: [
      {
        capabilityId: "eco.capability.noop.invoke",
        supportedOperations: ["INVOKE", "PING"],
        sandboxSupport: true,
        webhookSupport: false,
        idempotencySupport: true,
        deliveryModes: ["SYNC"],
      },
      {
        capabilityId: "eco.capability.notify.send",
        supportedOperations: ["SEND"],
        sandboxSupport: true,
        webhookSupport: true,
        idempotencySupport: true,
        deliveryModes: ["ASYNC", "WEBHOOK"],
      },
    ],
  });
  assert.equal(registryResult.ok, true);
  const registry = registryResult.value;

  const byId = registry.getConnector("eco.noop");
  assert.equal(byId.ok, true);
  assert.equal(byId.value.providerKey, "noop.test");

  const byKey = registry.getConnectorByProviderKey("notify.sandbox");
  assert.equal(byKey.ok, true);
  assert.equal(byKey.value.connectorId, "eco.notify");

  const webhookCaps = registry.findCapabilities({ webhookSupport: true });
  assert.equal(webhookCaps.ok, true);
  assert.equal(webhookCaps.value.length, 1);
  assert.equal(webhookCaps.value[0].capabilityId, "eco.capability.notify.send");

  const syncCaps = registry.findCapabilities({
    deliveryMode: "SYNC",
    operation: "PING",
  });
  assert.equal(syncCaps.ok, true);
  assert.equal(syncCaps.value.length, 1);

  const connectors = registry.findConnectorsByCapability(
    "eco.capability.noop.invoke"
  );
  assert.equal(connectors.ok, true);
  assert.equal(connectors.value.length, 1);
  assert.equal(connectors.value[0].connectorId, "eco.noop");
});

test("inbound/outbound envelopes validate identity, correlation, causation, tenant", () => {
  const inbound = createInboundIntegrationEnvelope({
    messageId: "msg-1",
    receivedAt: FIXED_TS,
    occurredAt: FIXED_TS,
    correlationId: "corr-1",
    causationId: "cause-1",
    tenantContext: "tenant-eco-1",
    connectorId: "eco.noop",
    providerKey: "noop.test",
    payloadType: "eco.test.event",
    payloadVersion: "1",
    payload: { hello: "world" },
    delivery: { attempt: 1, idempotencyKey: "idem-1" },
  });
  assert.equal(inbound.ok, true);
  assert.equal(inbound.value.direction, "INBOUND");
  assert.equal(inbound.value.tenantContext.tenantId, "tenant-eco-1");
  assert.equal(inbound.value.causationId, "cause-1");
  assert.ok(Object.isFrozen(inbound.value));

  const outbound = createOutboundIntegrationEnvelope({
    messageId: "msg-2",
    requestedAt: FIXED_TS,
    correlationId: "corr-2",
    tenantContext: { scopeType: "tenant", tenantId: "tenant-eco-2" },
    connectorId: "eco.noop",
    providerKey: "noop.test",
    payloadType: "eco.test.command",
    payload: { action: "ping" },
  });
  assert.equal(outbound.ok, true);
  assert.equal(outbound.value.direction, "OUTBOUND");
  assert.equal(outbound.value.tenantContext.scopeType, "tenant");
});

test("envelope rejects credential-like payload keys and vendor-shaped secrets", () => {
  const bad = createInboundIntegrationEnvelope({
    messageId: "msg-bad",
    receivedAt: FIXED_TS,
    correlationId: "corr",
    connectorId: "eco.noop",
    providerKey: "noop.test",
    payloadType: "eco.test.event",
    payload: { accessToken: "nope" },
  });
  assert.equal(bad.ok, false);
});

test("webhook verifier is fail-closed for missing/malformed/invalid/expired/replay", () => {
  const missing = verifyWebhookRequestFailClosed({
    connectorId: "eco.wh",
    bodyDigest: "abc",
    timestamp: FIXED_TS,
  });
  assert.equal(missing.value.outcome, WEBHOOK_VERIFICATION_OUTCOME.MISSING);
  assert.equal(missing.value.accepted, false);

  const malformed = verifyWebhookRequestFailClosed({
    connectorId: "eco.wh",
    signatureHeader: "sig",
    timestamp: "not-a-timestamp",
    bodyDigest: "abc",
  });
  assert.equal(malformed.value.outcome, WEBHOOK_VERIFICATION_OUTCOME.MALFORMED);

  const invalid = verifyWebhookRequestFailClosed({
    connectorId: "eco.wh",
    signatureHeader: "sig",
    timestamp: FIXED_TS,
    bodyDigest: "abc",
    expectedBodyDigest: "xyz",
    now: FIXED_TS,
  });
  assert.equal(invalid.value.outcome, WEBHOOK_VERIFICATION_OUTCOME.INVALID);

  const expired = verifyWebhookRequestFailClosed({
    connectorId: "eco.wh",
    signatureHeader: "sig",
    timestamp: "2026-07-24T09:00:00.000Z",
    bodyDigest: "abc",
    expectedBodyDigest: "abc",
    now: FIXED_TS,
    maxSkewSeconds: 60,
  });
  assert.equal(expired.value.outcome, WEBHOOK_VERIFICATION_OUTCOME.EXPIRED);

  const replay = verifyWebhookRequestFailClosed({
    connectorId: "eco.wh",
    signatureHeader: "sig",
    timestamp: FIXED_TS,
    bodyDigest: "abc",
    expectedBodyDigest: "abc",
    now: FIXED_TS,
    eventId: "evt-1",
    seenEventIds: ["evt-1"],
  });
  assert.equal(
    replay.value.outcome,
    WEBHOOK_VERIFICATION_OUTCOME.REPLAY_SUSPECTED
  );

  const fake = createFakeWebhookVerifier({ expectedBodyDigest: "digest-ok" });
  const verified = fake.verify({
    connectorId: "eco.wh",
    signatureHeader: "sig",
    timestamp: FIXED_TS,
    bodyDigest: "digest-ok",
    now: FIXED_TS,
    eventId: "evt-new",
  });
  assert.equal(verified.value.outcome, WEBHOOK_VERIFICATION_OUTCOME.VERIFIED);
  assert.equal(verified.value.accepted, true);
});

test("error-to-retry matrix: permanent never retry; transient classified", () => {
  const permanent = [
    INTEGRATION_ERROR_CODE.AUTHENTICATION,
    INTEGRATION_ERROR_CODE.AUTHORIZATION,
    INTEGRATION_ERROR_CODE.VALIDATION,
    INTEGRATION_ERROR_CODE.UNSUPPORTED_CAPABILITY,
    INTEGRATION_ERROR_CODE.PERMANENT_PROVIDER_REJECTION,
    INTEGRATION_ERROR_CODE.CONFIGURATION,
    INTEGRATION_ERROR_CODE.CONFLICT_DUPLICATE,
  ];
  for (const code of permanent) {
    assert.equal(isRetryableIntegrationErrorCode(code), false);
    assert.equal(classifyIntegrationRetry(code).retryable, false);
  }

  const transient = [
    INTEGRATION_ERROR_CODE.RATE_LIMITED,
    INTEGRATION_ERROR_CODE.TRANSIENT_PROVIDER,
    INTEGRATION_ERROR_CODE.TIMEOUT,
    INTEGRATION_ERROR_CODE.NETWORK,
  ];
  for (const code of transient) {
    assert.equal(isRetryableIntegrationErrorCode(code), true);
    assert.equal(classifyIntegrationRetry(code).retryable, true);
  }

  const err = createIntegrationError(
    INTEGRATION_ERROR_CODE.AUTHENTICATION,
    "bad auth",
    { token: "should-be-stripped", providerCode: "noop" }
  );
  assert.equal(err.retryable, false);
  assert.equal(err.context.token, undefined);
  assert.equal(err.context.providerCode, "noop");
});

test("idempotency projection: new / duplicate / conflict", () => {
  const first = createIdempotencyProjection({
    scope: "tenant-a",
    idempotencyKey: "key-1",
    fingerprint: "fp-aaa",
  });
  assert.equal(first.ok, true);

  const neo = evaluateIdempotencyProjection(
    { scope: "tenant-a", idempotencyKey: "key-1", fingerprint: "fp-aaa" },
    []
  );
  assert.equal(neo.value.outcome, IDEMPOTENCY_OUTCOME.NEW);

  const dup = evaluateIdempotencyProjection(
    { scope: "tenant-a", idempotencyKey: "key-1", fingerprint: "fp-aaa" },
    [first.value]
  );
  assert.equal(dup.value.outcome, IDEMPOTENCY_OUTCOME.DUPLICATE);

  const conflict = evaluateIdempotencyProjection(
    { scope: "tenant-a", idempotencyKey: "key-1", fingerprint: "fp-bbb" },
    [first.value]
  );
  assert.equal(conflict.value.outcome, IDEMPOTENCY_OUTCOME.CONFLICT);
});

test("readiness projection derives operational status without reading secrets", () => {
  const ready = projectIntegrationReadiness({
    connectorId: "eco.noop",
    configured: true,
    credentialRequired: true,
    credentialPresent: true,
    capabilityReady: true,
    environment: "SANDBOX",
    environmentEligible: true,
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.value.operationalStatus, OPERATIONAL_STATUS.READY);

  const missingCred = projectIntegrationReadiness({
    connectorId: "eco.noop",
    configured: true,
    credentialRequired: true,
    credentialPresent: false,
    capabilityReady: true,
    environmentEligible: true,
  });
  assert.equal(
    missingCred.value.operationalStatus,
    OPERATIONAL_STATUS.NOT_READY
  );
  assert.equal(missingCred.value.unavailableReason, "credential_required_missing");

  const degraded = projectIntegrationReadiness({
    connectorId: "eco.noop",
    configured: true,
    credentialRequired: false,
    credentialPresent: false,
    capabilityReady: true,
    environmentEligible: true,
    degradedReason: "elevated_latency",
  });
  assert.equal(degraded.value.operationalStatus, OPERATIONAL_STATUS.DEGRADED);
});

test("no-op provider is deterministic and does not touch env/network", () => {
  const provider = createNoOpTestProvider({
    responses: { PING: { ok: true, pong: "eco" } },
  });
  assert.equal(provider.productionReady, false);
  const a = provider.invoke("PING");
  const b = provider.invoke("PING");
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value.result.pong, "eco");
  assert.equal(b.value.invokeCount, 2);

  const unsupported = provider.invoke("UNKNOWN_OP");
  assert.equal(unsupported.ok, false);
  assert.equal(
    unsupported.error.code,
    INTEGRATION_ERROR_CODE.UNSUPPORTED_CAPABILITY
  );
});

test("Platform Core integration capability surface is consumable", () => {
  const surface = assertPlatformIntegrationCapabilitySurface();
  assert.equal(surface.ready, true);

  const port = projectConnectorToIntegrationPort({
    connectorId: "eco.noop.test",
    direction: "BIDIRECTIONAL",
    contractVersion: "eco-connector-1",
  });
  assert.equal(port.ok, true);
  assert.equal(port.value.portName, "eco.noop.test");
  assert.equal(port.value.ownerModule, "ecosystem-integrations");
});
