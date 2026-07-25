/**
 * ECO-03 security certification — no secrets, no network, no live providers.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ECOSYSTEM_INTEGRATIONS_PHASE,
  REDACTED_MARKER,
  createFakeProviderAdapter,
  createNoOpProviderAdapter,
  createProviderAdapterDescriptor,
  createProviderAdapterRegistry,
  createProviderInvocationRequest,
  createProviderInvocationResult,
  createRedactedDiagnostics,
  diagnosticsContainRedactedMarker,
  mapProviderFailureToIntegrationError,
  projectProviderAdapterReadiness,
  selectProviderAdapter,
} from "../src/features/ecosystem-integrations/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ROOT = path.join(
  ROOT,
  "src",
  "features",
  "ecosystem-integrations"
);
const SENTINEL = "TEST_ONLY_SENTINEL_DO_NOT_USE_AS_CREDENTIAL";

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

test("phase certification: live resolver and production activation remain false", () => {
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasLiveCredentialResolver, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasRealProviders, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasNetworkClients, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasCredentialStorage, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasProductionWebhooks, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.productionBlocked, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.wiredToProductionRuntime, false);
});

test("no credential values in public adapter outputs", () => {
  const adapter = createNoOpProviderAdapter();
  const result = adapter.invoke({
    requestId: "sec-1",
    connectorId: "eco.noop.test",
    capabilityId: "eco.capability.noop.invoke",
    operation: "INVOKE",
    payload: { note: "safe" },
  });
  assert.equal(result.ok, true);
  const serialized = JSON.stringify(result.value);
  assert.equal(serialized.includes(SENTINEL), false);
  assert.equal(/"password"\s*:/.test(serialized), false);
  assert.equal(adapter.descriptor.credentialRequirement, "NONE");
  assert.equal("credentialValue" in adapter.descriptor, false);
});

test("request/result reject credential-shaped payloads; diagnostics redact", () => {
  const badRequest = createProviderInvocationRequest({
    requestId: "sec-bad",
    adapterId: "eco.adapter.sec",
    connectorId: "eco.connector.sec",
    capabilityId: "eco.capability.sec",
    operation: "INVOKE",
    payload: { accessToken: SENTINEL },
  });
  assert.equal(badRequest.ok, false);

  const result = createProviderInvocationResult({
    requestId: "sec-ok",
    resultStatus: "FAILED",
    adapterId: "eco.adapter.sec",
    providerKey: "sec.adapter",
    completedAt: "2026-07-25T12:00:00.000Z",
    diagnostics: {
      webhookSecret: SENTINEL,
      statusCode: 401,
    },
  });
  assert.equal(result.ok, true);
  assert.equal(
    result.value.diagnostics.diagnostics.webhookSecret,
    REDACTED_MARKER
  );
  assert.equal(JSON.stringify(result.value).includes(SENTINEL), false);

  const redacted = createRedactedDiagnostics({ apiKey: SENTINEL, ok: true });
  assert.equal(diagnosticsContainRedactedMarker(redacted.value), true);
});

test("credential-required absent remains fail-closed under selection", () => {
  const descriptor = createProviderAdapterDescriptor({
    adapterId: "eco.adapter.secure",
    providerKey: "secure.adapter",
    connectorKind: "PAYMENT",
    supportedCapabilityIds: ["eco.capability.payment.invoke"],
    supportedEnvironments: ["TEST"],
    lifecycleState: "ACTIVE",
    credentialRequirement: "REQUIRED",
    credentialRequirementRefs: ["INTEGRATION_PAYMENT_SECRET"],
    enabled: true,
    publicMetadata: { productionBlocked: true },
  }).value;

  const readiness = projectProviderAdapterReadiness({
    descriptor,
    environment: "TEST",
    capabilityId: "eco.capability.payment.invoke",
    credentialPresent: false,
  });
  assert.equal(readiness.value.operationallyReady, false);
  assert.equal(readiness.value.blockedReason, "credential_required_absent");

  const registry = createProviderAdapterRegistry({
    adapters: [descriptor],
  }).value;
  const selection = selectProviderAdapter({
    registry,
    capabilityId: "eco.capability.payment.invoke",
    environment: "TEST",
    credentialPresenceByAdapter: { "eco.adapter.secure": false },
  });
  assert.equal(selection.value.outcome, "CREDENTIAL_ABSENT");
  assert.equal(selection.value.selectedAdapterId, null);
});

test("no global mutable service locator and no initialized vendor client fields", () => {
  const a = createFakeProviderAdapter();
  const b = createFakeProviderAdapter({ adapterId: "eco.adapter.fake.2" });
  assert.notEqual(a, b);
  assert.equal("client" in a, false);
  assert.equal("sdk" in a, false);
  assert.equal("connection" in a.descriptor, false);
  assert.equal(a.productionReady, false);
  assert.equal(b.productionReady, false);
});

test("failure mapping never retries auth/validation/permanent classes", () => {
  for (const failureClass of [
    "authentication",
    "authorization",
    "validation",
    "permanent_rejection",
  ]) {
    const mapped = mapProviderFailureToIntegrationError({ failureClass });
    assert.equal(mapped.retryClassification.retryable, false, failureClass);
  }
  for (const failureClass of ["timeout", "network", "rate_limited", "transient"]) {
    const mapped = mapProviderFailureToIntegrationError({ failureClass });
    assert.equal(mapped.retryClassification.retryable, true, failureClass);
  }
});

test("ECO-03 sources contain no secret sentinel and no live network tokens", () => {
  const hits = [];
  for (const file of listJsFiles(MODULE_ROOT)) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    if (text.includes(SENTINEL)) hits.push(`${rel}: sentinel`);
    if (text.includes("sk_live_")) hits.push(`${rel}: sk_live_`);
    if (text.includes("process.env")) hits.push(`${rel}: process.env`);
    if (text.includes("import.meta.env")) hits.push(`${rel}: import.meta.env`);
    if (text.includes("fetch(")) hits.push(`${rel}: fetch(`);
  }
  assert.deepEqual(hits, [], hits.join("\n"));
});
