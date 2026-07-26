/**
 * ECO-04 security certification — no secrets, no network, no Production webhooks.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ECOSYSTEM_INTEGRATIONS_PHASE,
  REDACTED_MARKER,
  WEBHOOK_INGRESS_OUTCOME,
  createFakeWebhookIngressHandler,
  createFakeWebhookVerifier,
  createWebhookIngressEnvelope,
  createWebhookIngressObservation,
  createWebhookIngressReceipt,
  createWebhookRouteDescriptor,
  createWebhookRouteRegistry,
  createRedactedDiagnostics,
  diagnosticsContainRedactedMarker,
  mapWebhookFailureToIntegrationError,
  routeWebhookIngress,
} from "../src/features/ecosystem-integrations/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ROOT = path.join(
  ROOT,
  "src",
  "features",
  "ecosystem-integrations"
);
const SENTINEL = "TEST_ONLY_SENTINEL_DO_NOT_USE_AS_CREDENTIAL";
const FIXED_TS = "2026-07-26T02:00:00.000Z";
const DIGEST = "digest-sec-001";

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

test("phase certification: Production webhooks and live network remain false", () => {
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasLiveCredentialResolver, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasRealProviders, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasNetworkClients, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasCredentialStorage, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasProductionWebhooks, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasWebhookIngressFoundation, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.productionBlocked, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.wiredToProductionRuntime, false);
});

test("canonical envelope never retains raw signature or secret-looking fields", () => {
  const envelope = createWebhookIngressEnvelope({
    ingressId: "sec-ingress",
    routeKey: "sec.route",
    connectorId: "eco.connector.sec",
    receivedAt: FIXED_TS,
    environment: "TEST",
    endpointClass: "MOCK",
    bodyDigest: DIGEST,
    signatureHeader: SENTINEL,
    providerTimestamp: FIXED_TS,
  });
  assert.equal(envelope.ok, true);
  const serialized = JSON.stringify(envelope.value);
  assert.equal(serialized.includes(SENTINEL), false);
  assert.equal("signatureHeader" in envelope.value, false);
  assert.equal(envelope.value.signaturePresent, true);
});

test("receipt/observation redact credential-shaped diagnostics", () => {
  const receipt = createWebhookIngressReceipt({
    ingressId: "sec-receipt",
    outcome: WEBHOOK_INGRESS_OUTCOME.FAILED,
    accepted: false,
    completedAt: FIXED_TS,
    diagnostics: {
      webhookSecret: SENTINEL,
      authorization: SENTINEL,
      statusCode: 401,
    },
  });
  assert.equal(receipt.ok, true);
  assert.equal(
    receipt.value.diagnostics.diagnostics.webhookSecret,
    REDACTED_MARKER
  );
  assert.equal(JSON.stringify(receipt.value).includes(SENTINEL), false);

  const observation = createWebhookIngressObservation({
    observationId: "sec-obs",
    ingressId: "sec-receipt",
    observedAt: FIXED_TS,
    attributes: { apiKey: SENTINEL, routeKey: "sec.route" },
  });
  assert.equal(observation.ok, true);
  assert.equal(JSON.stringify(observation.value).includes(SENTINEL), false);

  const redacted = createRedactedDiagnostics({ signature: SENTINEL, ok: true });
  assert.equal(diagnosticsContainRedactedMarker(redacted.value), true);
});

test("Production route descriptors and Production routing are fail-closed", () => {
  const blockedRoute = createWebhookRouteDescriptor({
    routeId: "eco.webhook.prod",
    routeKey: "payments.prod",
    connectorId: "eco.connector.prod",
    endpointClass: "PRODUCTION",
    supportedEnvironments: ["TEST"],
  });
  assert.equal(blockedRoute.ok, false);

  const registry = createWebhookRouteRegistry({
    routes: [
      {
        routeId: "eco.webhook.sec",
        routeKey: "payments.sec",
        connectorId: "eco.connector.sec",
        endpointClass: "MOCK",
        supportedEnvironments: ["TEST"],
        lifecycleState: "ENABLED",
        enabled: true,
      },
    ],
  }).value;

  const productionEnv = routeWebhookIngress({
    registry,
    routeKey: "payments.sec",
    environment: "PRODUCTION",
  });
  assert.equal(productionEnv.value.outcome, "PRODUCTION_BLOCKED");
  assert.equal(productionEnv.value.selectedRouteId, null);
});

test("fake handler does not leak credentials and rejects Production", () => {
  const registry = createWebhookRouteRegistry({
    routes: [
      {
        routeId: "eco.webhook.sec",
        routeKey: "payments.sec",
        connectorId: "eco.connector.sec",
        endpointClass: "MOCK",
        supportedEnvironments: ["TEST"],
        lifecycleState: "ENABLED",
        enabled: true,
        eventTypes: [],
      },
    ],
    subscriptions: [
      {
        routeId: "eco.webhook.sec",
        handlerKey: "eco.webhook.handle.sec",
      },
    ],
  }).value;

  const handler = createFakeWebhookIngressHandler({
    expectedBodyDigest: DIGEST,
    registry,
  });

  const result = handler.handle({
    ingressId: "sec-ok",
    routeKey: "payments.sec",
    connectorId: "eco.connector.sec",
    receivedAt: FIXED_TS,
    environment: "TEST",
    endpointClass: "MOCK",
    bodyDigest: DIGEST,
    signatureHeader: "present",
    providerTimestamp: FIXED_TS,
    providerEventId: "evt-sec-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.outcome, WEBHOOK_INGRESS_OUTCOME.ACCEPTED);
  assert.equal(JSON.stringify(result.value).includes(SENTINEL), false);

  const prod = handler.handle({
    ingressId: "sec-prod",
    routeKey: "payments.sec",
    connectorId: "eco.connector.sec",
    receivedAt: FIXED_TS,
    environment: "PRODUCTION",
    endpointClass: "MOCK",
    bodyDigest: DIGEST,
    signatureHeader: "present",
    providerTimestamp: FIXED_TS,
  });
  assert.equal(prod.value.outcome, WEBHOOK_INGRESS_OUTCOME.PRODUCTION_BLOCKED);

  const verifier = createFakeWebhookVerifier({ expectedBodyDigest: DIGEST });
  const verified = verifier.verify({
    connectorId: "eco.connector.sec",
    signatureHeader: "x",
    bodyDigest: DIGEST,
    timestamp: FIXED_TS,
    now: FIXED_TS,
  });
  assert.equal(verified.value.accepted, true);

  const mapped = mapWebhookFailureToIntegrationError({
    outcome: WEBHOOK_INGRESS_OUTCOME.PRODUCTION_BLOCKED,
  });
  assert.equal(mapped.retryClassification.retryable, false);
});

test("no global mutable service locator and no HTTP listener tokens", () => {
  const a = createFakeWebhookIngressHandler({ expectedBodyDigest: DIGEST });
  const b = createFakeWebhookIngressHandler({ expectedBodyDigest: DIGEST });
  assert.notEqual(a, b);

  const files = listJsFiles(MODULE_ROOT);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    assert.equal(text.includes("app.listen("), false, rel);
    assert.equal(text.includes("createServer("), false, rel);
    assert.equal(text.includes("globalThis.ecoWebhook"), false, rel);
    assert.equal(text.includes("window.__ECO_WEBHOOK__"), false, rel);
  }
});
