/**
 * ECO-05 — Observability & Structural Final Certification (foundation).
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  AGGREGATE_HEALTH_STATUS,
  CERTIFICATION_GATE_STATUS,
  ECOSYSTEM_INTEGRATIONS_PHASE,
  IDEMPOTENCY_OUTCOME,
  INTEGRATION_ERROR_CODE,
  OBSERVATION_SOURCE_KIND,
  OPERATIONAL_STATUS,
  REDACTED_MARKER,
  aggregateIntegrationObservations,
  createIntegrationObservation,
  createProviderAdapterObservation,
  createWebhookIngressObservation,
  projectAggregateIntegrationHealth,
  projectAuditSafeEvidence,
  projectAuditSafeEvidenceFromObservation,
  projectCanonicalFromProviderAdapterObservation,
  projectCanonicalFromWebhookIngressObservation,
  projectCertificationMatrix,
  projectStructuralFoundationReadiness,
} from "../src/features/ecosystem-integrations/index.js";

const FIXED_TS = "2026-07-26T04:00:00.000Z";
const SENTINEL = "TEST_ONLY_SENTINEL_DO_NOT_USE_AS_CREDENTIAL";

test("ECO-05 phase metadata records observability + structural certification", () => {
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.id, "ECO-05");
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.priorPhase, "ECO-04");
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasObservabilityFoundation, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasWebhookIngressFoundation, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasProviderAdapterFoundation, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasSecretBoundary, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasLegacySecretCutover, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasRealProviders, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasLiveCredentialResolver, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasProductionWebhooks, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasNetworkClients, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.productionBlocked, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.structuralFoundationComplete, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.wiredToProductionRuntime, false);
  assert.ok(Object.isFrozen(ECOSYSTEM_INTEGRATIONS_PHASE));
});

test("canonical observation is immutable and redacts secret-shaped attributes", () => {
  const result = createIntegrationObservation({
    observationId: "obs-1",
    sourceKind: OBSERVATION_SOURCE_KIND.CONNECTOR,
    subjectId: "eco.connector.test",
    connectorId: "eco.connector.test",
    eventType: "connector.readiness",
    observedAt: FIXED_TS,
    outcome: OPERATIONAL_STATUS.READY,
    correlationId: "corr-1",
    errorCode: INTEGRATION_ERROR_CODE.CONFIGURATION,
    retryable: false,
    idempotencyOutcome: IDEMPOTENCY_OUTCOME.NEW,
    deliveryEvidence: { bodyDigest: "digest-1", apiKey: SENTINEL },
    attributes: { webhookSecret: SENTINEL, status: "ok" },
  });
  assert.equal(result.ok, true);
  assert.ok(Object.isFrozen(result.value));
  assert.equal(result.value.sourceKind, "CONNECTOR");
  assert.equal(
    result.value.attributes.diagnostics.webhookSecret,
    REDACTED_MARKER
  );
  assert.equal(
    result.value.deliveryEvidence.diagnostics.apiKey,
    REDACTED_MARKER
  );
  assert.equal(JSON.stringify(result.value).includes(SENTINEL), false);
  assert.throws(() => {
    result.value.observationId = "mutated";
  });
});

test("adapter and webhook observations project into canonical contract", () => {
  const adapterObs = createProviderAdapterObservation({
    observationId: "adapter-obs",
    adapterId: "eco.adapter.test",
    requestId: "req-1",
    observedAt: FIXED_TS,
    resultStatus: "SUCCEEDED",
    attributes: { token: SENTINEL },
  });
  assert.equal(adapterObs.ok, true);

  const canonicalAdapter = projectCanonicalFromProviderAdapterObservation(
    adapterObs.value,
    { connectorId: "eco.connector.test" }
  );
  assert.equal(canonicalAdapter.ok, true);
  assert.equal(canonicalAdapter.value.sourceKind, "PROVIDER_ADAPTER");
  assert.equal(canonicalAdapter.value.adapterId, "eco.adapter.test");
  assert.equal(canonicalAdapter.value.connectorId, "eco.connector.test");
  assert.equal(JSON.stringify(canonicalAdapter.value).includes(SENTINEL), false);

  const webhookObs = createWebhookIngressObservation({
    observationId: "webhook-obs",
    ingressId: "ingress-1",
    observedAt: FIXED_TS,
    routeId: "eco.webhook.route",
    outcome: "ACCEPTED",
    attributes: { authorization: SENTINEL },
  });
  assert.equal(webhookObs.ok, true);

  const canonicalWebhook = projectCanonicalFromWebhookIngressObservation(
    webhookObs.value
  );
  assert.equal(canonicalWebhook.ok, true);
  assert.equal(canonicalWebhook.value.sourceKind, "WEBHOOK_INGRESS");
  assert.equal(canonicalWebhook.value.ingressId, "ingress-1");
  assert.equal(canonicalWebhook.value.routeId, "eco.webhook.route");
  assert.equal(JSON.stringify(canonicalWebhook.value).includes(SENTINEL), false);
});

test("observation aggregation counts connector/adapter/webhook sources", () => {
  const aggregated = aggregateIntegrationObservations({
    aggregatedAt: FIXED_TS,
    observations: [
      {
        observationId: "a",
        sourceKind: "CONNECTOR",
        subjectId: "c1",
        connectorId: "c1",
        observedAt: FIXED_TS,
        outcome: "READY",
      },
      {
        observationId: "b",
        sourceKind: "PROVIDER_ADAPTER",
        subjectId: "ad1",
        adapterId: "ad1",
        connectorId: "c1",
        observedAt: FIXED_TS,
        outcome: "SUCCEEDED",
      },
      {
        observationId: "c",
        sourceKind: "WEBHOOK_INGRESS",
        subjectId: "ing1",
        ingressId: "ing1",
        observedAt: FIXED_TS,
        outcome: "ACCEPTED",
      },
    ],
  });
  assert.equal(aggregated.ok, true);
  assert.equal(aggregated.value.total, 3);
  assert.equal(aggregated.value.bySourceKind.CONNECTOR, 1);
  assert.equal(aggregated.value.bySourceKind.PROVIDER_ADAPTER, 1);
  assert.equal(aggregated.value.bySourceKind.WEBHOOK_INGRESS, 1);
  assert.equal(aggregated.value.connectorObservationCounts.c1, 2);
  assert.equal(aggregated.value.providerAdapterObservationCounts.ad1, 1);
  assert.equal(aggregated.value.webhookIngressObservationCounts.ing1, 1);
  assert.ok(Object.isFrozen(aggregated.value));
});

test("aggregate health remains production-blocked and ready for empty inventories", () => {
  const empty = projectAggregateIntegrationHealth({
    projectedAt: FIXED_TS,
    productionBlocked: true,
    hasRealProviders: false,
    hasLiveCredentialResolver: false,
    hasProductionWebhooks: false,
  });
  assert.equal(empty.ok, true);
  assert.equal(empty.value.aggregateStatus, AGGREGATE_HEALTH_STATUS.READY);
  assert.equal(empty.value.productionBlocked, true);

  const blocked = projectAggregateIntegrationHealth({
    projectedAt: FIXED_TS,
    hasRealProviders: true,
    productionBlocked: true,
  });
  assert.equal(blocked.ok, true);
  assert.equal(
    blocked.value.aggregateStatus,
    AGGREGATE_HEALTH_STATUS.PRODUCTION_BLOCKED
  );
  assert.ok(blocked.value.blockedReasons.includes("real_providers_present"));

  const mixed = projectAggregateIntegrationHealth({
    projectedAt: FIXED_TS,
    connectorReadiness: [
      { operationalStatus: OPERATIONAL_STATUS.READY },
      { operationalStatus: OPERATIONAL_STATUS.NOT_READY },
    ],
    adapterReadiness: [{ readinessStatus: "OPERATIONALLY_READY" }],
    webhookRouteReadiness: [
      { enabled: true, lifecycleState: "ENABLED" },
      { enabled: false, lifecycleState: "DISABLED" },
    ],
  });
  assert.equal(mixed.ok, true);
  assert.equal(mixed.value.aggregateStatus, AGGREGATE_HEALTH_STATUS.NOT_READY);
  assert.equal(mixed.value.connectorSummary.ready, 1);
  assert.equal(mixed.value.connectorSummary.blocked, 1);
  assert.equal(mixed.value.adapterSummary.ready, 1);
  assert.equal(mixed.value.webhookSummary.ready, 1);
  assert.equal(mixed.value.webhookSummary.blocked, 1);
});

test("audit-safe evidence redacts payload and preserves taxonomy metadata", () => {
  const evidence = projectAuditSafeEvidence({
    evidenceId: "ev-1",
    eventType: "integration.delivery",
    occurredAt: FIXED_TS,
    subjectId: "eco.connector.test",
    sourceKind: OBSERVATION_SOURCE_KIND.WEBHOOK_INGRESS,
    outcome: "ACCEPTED",
    errorCode: INTEGRATION_ERROR_CODE.TRANSIENT_PROVIDER,
    retryable: true,
    idempotencyOutcome: IDEMPOTENCY_OUTCOME.DUPLICATE,
    payload: { signature: SENTINEL, bodyDigest: "abc" },
  });
  assert.equal(evidence.ok, true);
  assert.equal(evidence.value.auditSafe, true);
  assert.equal(evidence.value.retryable, true);
  assert.equal(evidence.value.payload.diagnostics.signature, REDACTED_MARKER);
  assert.equal(JSON.stringify(evidence.value).includes(SENTINEL), false);

  const fromObs = projectAuditSafeEvidenceFromObservation({
    observationId: "obs-ev",
    sourceKind: "PROVIDER_ADAPTER",
    subjectId: "ad1",
    eventType: "adapter.invocation",
    observedAt: FIXED_TS,
    outcome: "FAILED",
    attributes: { diagnostics: { privateKey: SENTINEL } },
    deliveryEvidence: { diagnostics: {} },
  });
  assert.equal(fromObs.ok, true);
  assert.equal(fromObs.value.evidenceId, "evidence:obs-ev");
  assert.equal(JSON.stringify(fromObs.value).includes(SENTINEL), false);
});

test("certification matrix PASSes defaults and FAILs on activation leaks", () => {
  const pass = projectCertificationMatrix({ projectedAt: FIXED_TS });
  assert.equal(pass.ok, true);
  assert.equal(pass.value.allPassed, true);
  assert.equal(pass.value.failedGates.length, 0);
  assert.equal(
    pass.value.gates.ECO_01_PRESENT.status,
    CERTIFICATION_GATE_STATUS.PASS
  );
  assert.equal(
    pass.value.gates.HAS_REAL_PROVIDERS_FALSE.status,
    CERTIFICATION_GATE_STATUS.PASS
  );
  assert.equal(
    pass.value.gates.PRODUCTION_BLOCKED_TRUE.status,
    CERTIFICATION_GATE_STATUS.PASS
  );

  const failMatrix = projectCertificationMatrix({
    projectedAt: FIXED_TS,
    eco04Present: false,
    hasRealProviders: true,
    productionBlocked: false,
  });
  assert.equal(failMatrix.ok, true);
  assert.equal(failMatrix.value.allPassed, false);
  assert.ok(failMatrix.value.failedGates.includes("ECO_04_PRESENT"));
  assert.ok(failMatrix.value.failedGates.includes("HAS_REAL_PROVIDERS_FALSE"));
  assert.ok(failMatrix.value.failedGates.includes("PRODUCTION_BLOCKED_TRUE"));
});

test("structural readiness complete only when all gates PASS", () => {
  const ready = projectStructuralFoundationReadiness({
    projectedAt: FIXED_TS,
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.value.structuralFoundationComplete, true);
  assert.equal(ready.value.productionBlocked, true);
  assert.equal(ready.value.hasRealProviders, false);
  assert.equal(ready.value.hasLiveCredentialResolver, false);
  assert.equal(ready.value.hasProductionWebhooks, false);
  assert.equal(ready.value.blockers.length, 0);

  const blocked = projectStructuralFoundationReadiness({
    projectedAt: FIXED_TS,
    matrixInput: { hasProductionWebhooks: true },
    observabilityReady: false,
  });
  assert.equal(blocked.ok, true);
  assert.equal(blocked.value.structuralFoundationComplete, false);
  assert.ok(blocked.value.blockers.includes("certification_matrix_incomplete"));
  assert.ok(blocked.value.blockers.includes("observability_not_ready"));
  assert.ok(blocked.value.blockers.includes("has_production_webhooks"));
});
