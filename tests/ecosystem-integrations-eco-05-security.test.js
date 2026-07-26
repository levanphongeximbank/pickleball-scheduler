/**
 * ECO-05 security certification — redacted diagnostics, no live activation.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ECOSYSTEM_INTEGRATIONS_PHASE,
  REDACTED_MARKER,
  aggregateIntegrationObservations,
  createIntegrationObservation,
  createRedactedDiagnostics,
  diagnosticsContainRedactedMarker,
  projectAggregateIntegrationHealth,
  projectAuditSafeEvidence,
  projectCertificationMatrix,
  projectStructuralFoundationReadiness,
} from "../src/features/ecosystem-integrations/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ROOT = path.join(
  ROOT,
  "src",
  "features",
  "ecosystem-integrations"
);
const SENTINEL = "TEST_ONLY_SENTINEL_DO_NOT_USE_AS_CREDENTIAL";
const FIXED_TS = "2026-07-26T04:00:00.000Z";

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

test("phase certification: live activation invariants remain false", () => {
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasLiveCredentialResolver, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasRealProviders, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasNetworkClients, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasCredentialStorage, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasProductionWebhooks, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasObservabilityFoundation, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.structuralFoundationComplete, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.productionBlocked, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.wiredToProductionRuntime, false);
});

test("canonical observation + audit evidence never leak sentinel credentials", () => {
  const observation = createIntegrationObservation({
    observationId: "sec-obs",
    sourceKind: "HEALTH",
    subjectId: "eco.health",
    observedAt: FIXED_TS,
    attributes: {
      apiKey: SENTINEL,
      authorization: SENTINEL,
      password: SENTINEL,
      note: "safe",
    },
    deliveryEvidence: { webhookSecret: SENTINEL, digest: "d1" },
  });
  assert.equal(observation.ok, true);
  const serialized = JSON.stringify(observation.value);
  assert.equal(serialized.includes(SENTINEL), false);
  assert.equal(
    observation.value.attributes.diagnostics.apiKey,
    REDACTED_MARKER
  );

  const evidence = projectAuditSafeEvidence({
    evidenceId: "sec-ev",
    eventType: "security.probe",
    occurredAt: FIXED_TS,
    subjectId: "eco.health",
    sourceKind: "CERTIFICATION",
    payload: { privateKey: SENTINEL, ok: true },
  });
  assert.equal(evidence.ok, true);
  assert.equal(JSON.stringify(evidence.value).includes(SENTINEL), false);
  assert.equal(evidence.value.payload.diagnostics.privateKey, REDACTED_MARKER);

  const redacted = createRedactedDiagnostics({ token: SENTINEL });
  assert.equal(diagnosticsContainRedactedMarker(redacted.value), true);
});

test("aggregation and health projections reject activation leaks", () => {
  const aggregated = aggregateIntegrationObservations({
    aggregatedAt: FIXED_TS,
    observations: [
      {
        observationId: "agg-1",
        sourceKind: "CONNECTOR",
        subjectId: "c1",
        observedAt: FIXED_TS,
        attributes: { secret: SENTINEL },
      },
    ],
  });
  assert.equal(aggregated.ok, true);
  assert.equal(JSON.stringify(aggregated.value).includes(SENTINEL), false);

  const health = projectAggregateIntegrationHealth({
    projectedAt: FIXED_TS,
    hasLiveCredentialResolver: true,
    hasProductionWebhooks: true,
  });
  assert.equal(health.ok, true);
  assert.equal(health.value.aggregateStatus, "PRODUCTION_BLOCKED");
  assert.ok(
    health.value.blockedReasons.includes("live_credential_resolver_present")
  );
  assert.ok(
    health.value.blockedReasons.includes("production_webhooks_present")
  );
});

test("structuralFoundationComplete is false when any invariant fails", () => {
  const matrix = projectCertificationMatrix({
    projectedAt: FIXED_TS,
    hasRealProviders: true,
  });
  assert.equal(matrix.ok, true);
  assert.equal(matrix.value.allPassed, false);

  const readiness = projectStructuralFoundationReadiness({
    projectedAt: FIXED_TS,
    certificationMatrix: matrix.value,
  });
  assert.equal(readiness.ok, true);
  assert.equal(readiness.value.structuralFoundationComplete, false);
  assert.ok(readiness.value.blockers.includes("certification_matrix_incomplete"));
});

test("no global mutable service locator and no HTTP listener tokens", () => {
  const files = listJsFiles(MODULE_ROOT);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    assert.equal(text.includes("app.listen("), false, rel);
    assert.equal(text.includes("createServer("), false, rel);
    assert.equal(text.includes("globalThis.ecoObservability"), false, rel);
    assert.equal(text.includes("window.__ECO_OBS__"), false, rel);
    assert.equal(text.includes("globalThis.ecoWebhook"), false, rel);
  }
});

test("ECO-05 source tree contains no credential-shaped literal sentinels as values", () => {
  const files = [
    ...listJsFiles(MODULE_ROOT),
    path.join(ROOT, "tests", "ecosystem-integrations-eco-05-foundation.test.js"),
    path.join(ROOT, "tests", "ecosystem-integrations-eco-05-architecture.test.js"),
    path.join(ROOT, "tests", "ecosystem-integrations-eco-05-security.test.js"),
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    assert.equal(
      /sk_live_[A-Za-z0-9]+/.test(text),
      false,
      path.relative(ROOT, file)
    );
    assert.equal(
      /AKIA[0-9A-Z]{16}/.test(text),
      false,
      path.relative(ROOT, file)
    );
  }
});
