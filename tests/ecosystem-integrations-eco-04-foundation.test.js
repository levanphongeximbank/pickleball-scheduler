/**
 * ECO-04 — Webhook Ingress Foundation (contracts, registry, routing, handler).
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ECOSYSTEM_INTEGRATIONS_PHASE,
  IDEMPOTENCY_OUTCOME,
  INTEGRATION_ERROR_CODE,
  REDACTED_MARKER,
  WEBHOOK_INGRESS_OUTCOME,
  WEBHOOK_REPLAY_CLASSIFICATION,
  WEBHOOK_ROUTING_OUTCOME,
  WEBHOOK_VERIFICATION_OUTCOME,
  classifyWebhookTimestampTolerance,
  createFakeWebhookIngressHandler,
  createFakeWebhookVerifier,
  createWebhookIngressEnvelope,
  createWebhookIngressObservation,
  createWebhookIngressReceipt,
  createWebhookReplayProjection,
  createWebhookRouteDescriptor,
  createWebhookRouteRegistry,
  createWebhookSubscriptionDescriptor,
  createWebhookTimestampPolicy,
  evaluateWebhookReplayProjection,
  isRetryableIntegrationErrorCode,
  mapWebhookFailureToIntegrationError,
  routeWebhookIngress,
  verifyWebhookRequestFailClosed,
} from "../src/features/ecosystem-integrations/index.js";

const FIXED_TS = "2026-07-26T02:00:00.000Z";
const DIGEST = "digest-abc-001";

function baseRoute(overrides = {}) {
  return {
    routeId: "eco.webhook.route.test",
    routeKey: "payments.test.callback",
    connectorId: "eco.connector.webhook.test",
    connectorKind: "WEBHOOK",
    lifecycleState: "ENABLED",
    endpointClass: "MOCK",
    supportedEnvironments: ["TEST", "SANDBOX"],
    enabled: true,
    verificationRequired: true,
    priority: 10,
    eventTypes: ["payment.succeeded"],
    publicMetadata: { purpose: "test", productionBlocked: true },
    ...overrides,
  };
}

function baseEnvelope(overrides = {}) {
  return {
    ingressId: "ingress-1",
    routeKey: "payments.test.callback",
    connectorId: "eco.connector.webhook.test",
    receivedAt: FIXED_TS,
    environment: "TEST",
    endpointClass: "MOCK",
    bodyDigest: DIGEST,
    signaturePresent: true,
    providerEventId: "evt-1",
    providerEventType: "payment.succeeded",
    providerTimestamp: FIXED_TS,
    correlationId: "corr-1",
    ...overrides,
  };
}

test("ECO-04 phase metadata records webhook ingress foundation", () => {
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.id, "ECO-04");
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.priorPhase, "ECO-03");
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasWebhookIngressFoundation, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasProviderAdapterFoundation, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasProductionWebhooks, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasNetworkClients, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasRealProviders, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.productionBlocked, true);
  assert.ok(Object.isFrozen(ECOSYSTEM_INTEGRATIONS_PHASE));
});

test("ingress envelope is immutable and omits raw signature/secret", () => {
  const result = createWebhookIngressEnvelope(
    baseEnvelope({
      signatureHeader: "sig-should-not-persist",
      rawBody: "must-not-appear",
    })
  );
  assert.equal(result.ok, true);
  assert.ok(Object.isFrozen(result.value));
  assert.equal(result.value.signaturePresent, true);
  assert.equal("signatureHeader" in result.value, false);
  assert.equal("rawBody" in result.value, false);
  assert.throws(() => {
    result.value.ingressId = "mutated";
  });
});

test("timestamp tolerance classifies fresh / expired / malformed / replay", () => {
  const policy = createWebhookTimestampPolicy({ maxSkewSeconds: 300 });
  assert.equal(policy.ok, true);

  const fresh = classifyWebhookTimestampTolerance({
    providerTimestamp: FIXED_TS,
    now: FIXED_TS,
    maxSkewSeconds: 300,
  });
  assert.equal(fresh.value.classification, WEBHOOK_REPLAY_CLASSIFICATION.FRESH);
  assert.equal(fresh.value.accepted, true);

  const expired = classifyWebhookTimestampTolerance({
    providerTimestamp: "2026-07-26T01:00:00.000Z",
    now: FIXED_TS,
    maxSkewSeconds: 60,
  });
  assert.equal(
    expired.value.classification,
    WEBHOOK_REPLAY_CLASSIFICATION.EXPIRED
  );
  assert.equal(expired.value.accepted, false);

  const malformed = classifyWebhookTimestampTolerance({
    timestampMalformed: true,
  });
  assert.equal(
    malformed.value.classification,
    WEBHOOK_REPLAY_CLASSIFICATION.TIMESTAMP_MALFORMED
  );

  const replay = classifyWebhookTimestampTolerance({
    providerTimestamp: FIXED_TS,
    now: FIXED_TS,
    eventIdSeen: true,
  });
  assert.equal(
    replay.value.classification,
    WEBHOOK_REPLAY_CLASSIFICATION.REPLAY_SUSPECTED
  );
});

test("verification remains fail-closed for missing/invalid/expired/replay", () => {
  const missing = verifyWebhookRequestFailClosed({
    connectorId: "eco.connector.webhook.test",
    bodyDigest: DIGEST,
    timestamp: FIXED_TS,
  });
  assert.equal(missing.value.outcome, WEBHOOK_VERIFICATION_OUTCOME.MISSING);

  const invalid = verifyWebhookRequestFailClosed({
    connectorId: "eco.connector.webhook.test",
    signatureHeader: "x",
    bodyDigest: DIGEST,
    expectedBodyDigest: "other",
    timestamp: FIXED_TS,
    now: FIXED_TS,
  });
  assert.equal(invalid.value.outcome, WEBHOOK_VERIFICATION_OUTCOME.INVALID);

  const expired = verifyWebhookRequestFailClosed({
    connectorId: "eco.connector.webhook.test",
    signatureHeader: "x",
    bodyDigest: DIGEST,
    expectedBodyDigest: DIGEST,
    timestamp: "2026-07-26T01:00:00.000Z",
    now: FIXED_TS,
    maxSkewSeconds: 30,
  });
  assert.equal(expired.value.outcome, WEBHOOK_VERIFICATION_OUTCOME.EXPIRED);

  const replay = verifyWebhookRequestFailClosed({
    connectorId: "eco.connector.webhook.test",
    signatureHeader: "x",
    bodyDigest: DIGEST,
    expectedBodyDigest: DIGEST,
    timestamp: FIXED_TS,
    now: FIXED_TS,
    eventId: "evt-seen",
    seenEventIds: ["evt-seen"],
  });
  assert.equal(
    replay.value.outcome,
    WEBHOOK_VERIFICATION_OUTCOME.REPLAY_SUSPECTED
  );
});

test("replay projection distinguishes NEW / DUPLICATE / CONFLICT", () => {
  const first = createWebhookReplayProjection({
    scope: "eco.webhook.route.test",
    providerEventId: "evt-1",
    bodyDigest: DIGEST,
  });
  assert.equal(first.ok, true);

  const neo = evaluateWebhookReplayProjection(
    {
      scope: "eco.webhook.route.test",
      providerEventId: "evt-1",
      bodyDigest: DIGEST,
    },
    []
  );
  assert.equal(neo.value.outcome, IDEMPOTENCY_OUTCOME.NEW);

  const dup = evaluateWebhookReplayProjection(
    {
      scope: "eco.webhook.route.test",
      providerEventId: "evt-1",
      bodyDigest: DIGEST,
    },
    [first.value]
  );
  assert.equal(dup.value.outcome, IDEMPOTENCY_OUTCOME.DUPLICATE);

  const conflict = evaluateWebhookReplayProjection(
    {
      scope: "eco.webhook.route.test",
      providerEventId: "evt-1",
      bodyDigest: "digest-other",
      fingerprint: "digest-other",
    },
    [first.value]
  );
  assert.equal(conflict.value.outcome, IDEMPOTENCY_OUTCOME.CONFLICT);
});

test("route registry rejects duplicates and Production routes", () => {
  const prod = createWebhookRouteDescriptor(
    baseRoute({ endpointClass: "PRODUCTION" })
  );
  assert.equal(prod.ok, false);

  const prodEnv = createWebhookRouteDescriptor(
    baseRoute({ supportedEnvironments: ["TEST", "PRODUCTION"] })
  );
  assert.equal(prodEnv.ok, false);

  const dup = createWebhookRouteRegistry({
    routes: [baseRoute(), baseRoute()],
  });
  assert.equal(dup.ok, false);
  assert.equal(dup.error.code, "WEBHOOK_ROUTE_REGISTRY_DUPLICATE_ROUTE");

  const unknownSub = createWebhookRouteRegistry({
    routes: [baseRoute()],
    subscriptions: [
      {
        routeId: "missing.route",
        handlerKey: "eco.webhook.handle",
      },
    ],
  });
  assert.equal(unknownSub.ok, false);
});

test("ingress routing is deterministic and blocks Production", () => {
  const registry = createWebhookRouteRegistry({
    routes: [
      baseRoute({
        routeId: "eco.webhook.route.b",
        priority: 20,
      }),
      baseRoute({
        routeId: "eco.webhook.route.a",
        priority: 10,
      }),
    ],
    subscriptions: [
      createWebhookSubscriptionDescriptor({
        routeId: "eco.webhook.route.a",
        handlerKey: "eco.webhook.handle.a",
        priority: 5,
        eventTypes: ["payment.succeeded"],
      }).value,
      createWebhookSubscriptionDescriptor({
        routeId: "eco.webhook.route.b",
        handlerKey: "eco.webhook.handle.b",
        priority: 5,
      }).value,
    ],
  });
  assert.equal(registry.ok, true);

  const routed = routeWebhookIngress({
    registry: registry.value,
    routeKey: "payments.test.callback",
    environment: "TEST",
    providerEventType: "payment.succeeded",
  });
  assert.equal(routed.value.outcome, WEBHOOK_ROUTING_OUTCOME.ROUTED);
  assert.equal(routed.value.selectedRouteId, "eco.webhook.route.a");
  assert.equal(
    routed.value.selectedSubscriptionId,
    "eco.webhook.route.a:eco.webhook.handle.a"
  );

  const again = routeWebhookIngress({
    registry: registry.value,
    routeKey: "payments.test.callback",
    environment: "TEST",
    providerEventType: "payment.succeeded",
  });
  assert.equal(
    again.value.selectedRouteId,
    routed.value.selectedRouteId
  );

  const blocked = routeWebhookIngress({
    registry: registry.value,
    routeKey: "payments.test.callback",
    environment: "PRODUCTION",
  });
  assert.equal(
    blocked.value.outcome,
    WEBHOOK_ROUTING_OUTCOME.PRODUCTION_BLOCKED
  );

  const ambiguous = createWebhookRouteRegistry({
    routes: [
      baseRoute({ routeId: "eco.webhook.route.x", priority: 10 }),
      baseRoute({ routeId: "eco.webhook.route.y", priority: 10 }),
    ],
  });
  const amb = routeWebhookIngress({
    registry: ambiguous.value,
    routeKey: "payments.test.callback",
    environment: "TEST",
  });
  assert.equal(amb.value.outcome, WEBHOOK_ROUTING_OUTCOME.AMBIGUOUS);
});

test("receipt + observation redact sensitive diagnostics", () => {
  const receipt = createWebhookIngressReceipt({
    ingressId: "ingress-obs",
    outcome: WEBHOOK_INGRESS_OUTCOME.ACCEPTED,
    accepted: true,
    completedAt: FIXED_TS,
    diagnostics: {
      webhookSecret: "should-redact",
      statusCode: 200,
    },
  });
  assert.equal(receipt.ok, true);
  assert.equal(
    receipt.value.diagnostics.diagnostics.webhookSecret,
    REDACTED_MARKER
  );

  const observation = createWebhookIngressObservation({
    observationId: "obs-1",
    ingressId: "ingress-obs",
    observedAt: FIXED_TS,
    outcome: WEBHOOK_INGRESS_OUTCOME.ACCEPTED,
    attributes: { signature: "nope", routeKey: "payments.test.callback" },
  });
  assert.equal(observation.ok, true);
  assert.equal(observation.value.attributes.diagnostics.signature, REDACTED_MARKER);
});

test("failure mapping reuses ECO taxonomy and retry metadata", () => {
  const mapped = mapWebhookFailureToIntegrationError({
    verificationOutcome: WEBHOOK_VERIFICATION_OUTCOME.MISSING,
    reason: "signature_missing",
  });
  assert.equal(
    mapped.integrationError.code,
    INTEGRATION_ERROR_CODE.AUTHENTICATION
  );
  assert.equal(mapped.retryClassification.retryable, false);
  assert.equal(
    isRetryableIntegrationErrorCode(mapped.integrationError.code),
    false
  );

  const transient = mapWebhookFailureToIntegrationError({
    failureClass: "transient",
    message: "provider blip",
  });
  assert.equal(
    transient.integrationError.code,
    INTEGRATION_ERROR_CODE.TRANSIENT_PROVIDER
  );
  assert.equal(transient.retryClassification.retryable, true);
});

test("fake verifier + fake ingress handler accept/duplicate/conflict/block Production", () => {
  const registry = createWebhookRouteRegistry({
    routes: [baseRoute()],
    subscriptions: [
      {
        routeId: "eco.webhook.route.test",
        handlerKey: "eco.webhook.handle",
        eventTypes: ["payment.succeeded"],
      },
    ],
  }).value;

  const handler = createFakeWebhookIngressHandler({
    expectedBodyDigest: DIGEST,
    registry,
  });

  const accepted = handler.handle(baseEnvelope());
  assert.equal(accepted.ok, true);
  assert.equal(accepted.value.outcome, WEBHOOK_INGRESS_OUTCOME.ACCEPTED);
  assert.equal(accepted.value.idempotencyOutcome, IDEMPOTENCY_OUTCOME.NEW);

  const duplicate = handler.handle(baseEnvelope({ ingressId: "ingress-2" }));
  assert.equal(duplicate.value.outcome, WEBHOOK_INGRESS_OUTCOME.DUPLICATE);
  assert.equal(duplicate.value.accepted, true);

  const seeded = createFakeWebhookIngressHandler({
    expectedBodyDigest: "digest-conflict",
    registry,
    priorProjections: [
      createWebhookReplayProjection({
        scope: "eco.webhook.route.test",
        providerEventId: "evt-1",
        bodyDigest: DIGEST,
      }).value,
    ],
  });
  const conflicted = seeded.handle(
    baseEnvelope({
      ingressId: "ingress-conflict",
      bodyDigest: "digest-conflict",
      signatureHeader: "present",
    })
  );
  assert.equal(conflicted.value.outcome, WEBHOOK_INGRESS_OUTCOME.CONFLICT);
  assert.equal(conflicted.value.accepted, false);

  const prod = handler.handle(
    baseEnvelope({
      ingressId: "ingress-prod",
      environment: "PRODUCTION",
      endpointClass: "STAGING",
    })
  );
  assert.equal(prod.value.outcome, WEBHOOK_INGRESS_OUTCOME.PRODUCTION_BLOCKED);

  const verifier = createFakeWebhookVerifier({ expectedBodyDigest: DIGEST });
  const verified = verifier.verify({
    connectorId: "eco.connector.webhook.test",
    signatureHeader: "x",
    bodyDigest: DIGEST,
    timestamp: FIXED_TS,
    now: FIXED_TS,
    eventId: "evt-fresh",
  });
  assert.equal(verified.value.accepted, true);
});
