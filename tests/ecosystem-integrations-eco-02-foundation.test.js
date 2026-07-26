/**
 * ECO-02 — Secret & Environment Boundary foundation suite.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CLIENT_SAFE_PUBLIC_CONFIG_ERROR,
  CREDENTIAL_PRESENCE,
  CREDENTIAL_REQUIREMENT_DESCRIPTOR_ERROR,
  ECOSYSTEM_INTEGRATIONS_PHASE,
  ENDPOINT_CLASS,
  ENVIRONMENT_CLASS,
  SECRET_BOUNDARY_READINESS,
  SECRET_REFERENCE_ERROR,
  createCredentialRequirementDescriptor,
  createEndpointClassification,
  createEnvironmentClassification,
  createNoOpTestCredentialResolver,
  createRedactedDiagnostics,
  createSecretReference,
  createServerOnlyCredentialBoundary,
  evaluateEnvironmentEligibility,
  isBrowserExposedSecretName,
  projectClientSafePublicConfig,
  projectSecretBoundaryReadiness,
} from "../src/features/ecosystem-integrations/index.js";

test("ECO-02 phase metadata declares secret boundary without live resolver", () => {
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.id, "ECO-04");
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasSecretBoundary, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasLiveCredentialResolver, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasCredentialStorage, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasLegacySecretCutover, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasProviderAdapterFoundation, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasWebhookIngressFoundation, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.productionBlocked, true);
});

test("secret reference is immutable and rejects secret value fields", () => {
  const okResult = createSecretReference({
    referenceId: "eco.ref.payment.hash",
    sourceKind: "ENV_NAME",
    referenceName: "INTEGRATION_PAYMENT_HASH_SECRET",
    classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
    eligibleEnvironments: ["TEST", "SANDBOX"],
  });
  assert.equal(okResult.ok, true);
  assert.ok(Object.isFrozen(okResult.value));
  assert.equal("value" in okResult.value, false);

  const withValue = createSecretReference({
    referenceId: "eco.ref.bad",
    referenceName: "INTEGRATION_PAYMENT_HASH_SECRET",
    value: "should-never-be-accepted",
  });
  assert.equal(withValue.ok, false);
  assert.equal(withValue.error.code, SECRET_REFERENCE_ERROR.VALUE_FORBIDDEN);
});

test("secret reference rejects browser-exposed VITE_* secret-shaped names for SERVER_ONLY", () => {
  assert.equal(isBrowserExposedSecretName("VITE_PAYMENT_HASH_SECRET"), true);
  const result = createSecretReference({
    referenceId: "eco.ref.vite",
    referenceName: "VITE_PAYMENT_HASH_SECRET",
    classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, SECRET_REFERENCE_ERROR.BROWSER_EXPOSED);
});

test("credential requirement descriptor cannot carry secret values", () => {
  const okResult = createCredentialRequirementDescriptor({
    credentialId: "eco.cred.payment.hash",
    connectorId: "eco.payment.mock",
    requirement: "REQUIRED",
    classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
    eligibleEnvironments: ["TEST", "SANDBOX"],
    secretReference: {
      referenceId: "eco.ref.payment.hash",
      referenceName: "INTEGRATION_PAYMENT_HASH_SECRET",
      classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
      eligibleEnvironments: ["TEST", "SANDBOX"],
    },
  });
  assert.equal(okResult.ok, true);
  assert.ok(Object.isFrozen(okResult.value));

  const bad = createCredentialRequirementDescriptor({
    credentialId: "eco.cred.bad",
    connectorId: "eco.payment.mock",
    secret: "nope",
  });
  assert.equal(bad.ok, false);
  assert.equal(
    bad.error.code,
    CREDENTIAL_REQUIREMENT_DESCRIPTOR_ERROR.VALUE_FORBIDDEN
  );
});

test("environment eligibility blocks Production credentials in Sandbox and reverse", () => {
  const prodInSandbox = evaluateEnvironmentEligibility(
    "SANDBOX",
    "PRODUCTION",
    ["SANDBOX", "PRODUCTION"]
  );
  assert.equal(prodInSandbox.eligible, false);
  assert.equal(
    prodInSandbox.mismatchReason,
    "production_credential_outside_production"
  );

  const sandboxInProd = evaluateEnvironmentEligibility(
    "PRODUCTION",
    "SANDBOX",
    ["SANDBOX", "PRODUCTION"]
  );
  assert.equal(sandboxInProd.eligible, false);

  const matched = createEnvironmentClassification({
    deploymentEnvironment: "SANDBOX",
    credentialEnvironment: "SANDBOX",
    eligibleEnvironments: ["SANDBOX"],
  });
  assert.equal(matched.ok, true);
  assert.equal(matched.value.eligible, true);
});

test("endpoint classification forbids public projection of PRODUCTION endpoints", () => {
  const prod = createEndpointClassification({
    endpointId: "eco.ep.prod",
    endpointClass: ENDPOINT_CLASS.PRODUCTION,
    allowInPublicProjection: true,
  });
  assert.equal(prod.ok, false);

  const mock = createEndpointClassification({
    endpointId: "eco.ep.mock",
    endpointClass: ENDPOINT_CLASS.MOCK,
  });
  assert.equal(mock.ok, true);
  assert.equal(mock.value.allowInPublicProjection, true);
});

test("client-safe public projection rejects secret-shaped keys", () => {
  const okResult = projectClientSafePublicConfig({
    providerKey: "payment.mock",
    environmentLabel: "SANDBOX",
    readinessStatus: "NOT_READY",
    capabilities: ["eco.capability.payment.initiate"],
    featureAvailability: { initiate: false },
  });
  assert.equal(okResult.ok, true);
  assert.equal(okResult.value.containsSecrets, false);

  const secretKey = projectClientSafePublicConfig({
    providerKey: "payment.mock",
    environmentLabel: "SANDBOX",
    readinessStatus: "NOT_READY",
    signingKey: "x",
  });
  assert.equal(secretKey.ok, false);
  assert.equal(secretKey.error.code, CLIENT_SAFE_PUBLIC_CONFIG_ERROR.SECRET_KEY);
});

test("server-only credential boundary forbids browser export and VITE secret names", () => {
  const okResult = createServerOnlyCredentialBoundary({
    boundaryId: "eco.boundary.payment",
    credentialIds: ["eco.cred.payment.hash"],
    referenceNames: ["INTEGRATION_PAYMENT_HASH_SECRET"],
  });
  assert.equal(okResult.ok, true);
  assert.equal(okResult.value.browserExportForbidden, true);
  assert.equal(okResult.value.surface, "server-only");

  const vite = createServerOnlyCredentialBoundary({
    boundaryId: "eco.boundary.bad",
    referenceNames: ["VITE_PAYMENT_HASH_SECRET"],
  });
  assert.equal(vite.ok, false);
});

test("secret-boundary readiness is deterministic for missing and unsafe cases", () => {
  const missing = projectSecretBoundaryReadiness({
    connectorId: "eco.payment.mock",
    requirement: "REQUIRED",
    classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
    presence: CREDENTIAL_PRESENCE.ABSENT,
    deploymentEnvironment: "SANDBOX",
    credentialEnvironment: "SANDBOX",
    eligibleEnvironments: ["SANDBOX"],
  });
  assert.equal(missing.ok, true);
  assert.equal(
    missing.value.readinessStatus,
    SECRET_BOUNDARY_READINESS.MISSING_CREDENTIAL
  );

  const unsafe = projectSecretBoundaryReadiness({
    connectorId: "eco.payment.legacy",
    requirement: "REQUIRED",
    classification: ENVIRONMENT_CLASS.BROWSER_EXPOSED_SECRET_RISK,
    presence: CREDENTIAL_PRESENCE.PRESENT,
    deploymentEnvironment: "SANDBOX",
    credentialEnvironment: "SANDBOX",
    eligibleEnvironments: ["SANDBOX"],
  });
  assert.equal(unsafe.ok, true);
  assert.equal(
    unsafe.value.readinessStatus,
    SECRET_BOUNDARY_READINESS.CLASSIFICATION_UNSAFE
  );

  const envBlocked = projectSecretBoundaryReadiness({
    connectorId: "eco.payment.mock",
    requirement: "REQUIRED",
    classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
    presence: CREDENTIAL_PRESENCE.REDACTED,
    deploymentEnvironment: "SANDBOX",
    credentialEnvironment: "PRODUCTION",
    eligibleEnvironments: ["SANDBOX", "PRODUCTION"],
  });
  assert.equal(envBlocked.ok, true);
  assert.equal(
    envBlocked.value.readinessStatus,
    SECRET_BOUNDARY_READINESS.BLOCKED_ENVIRONMENT
  );
});

test("no-op credential resolver is fail-closed and never returns secret values", () => {
  const resolver = createNoOpTestCredentialResolver({
    deploymentEnvironment: "TEST",
    presenceByCredentialId: {
      "eco.cred.payment.hash": true,
    },
  });
  assert.equal(resolver.readsEnvironment, false);
  assert.equal(resolver.returnsSecretValues, false);

  const okResolve = resolver.resolve({
    credentialId: "eco.cred.payment.hash",
    connectorId: "eco.payment.mock",
    requirement: "REQUIRED",
    classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
    eligibleEnvironments: ["TEST", "SANDBOX"],
  });
  assert.equal(okResolve.ok, true);
  assert.equal(okResolve.value.presence, CREDENTIAL_PRESENCE.REDACTED);
  assert.equal("value" in okResolve.value, false);
  assert.equal("secret" in okResolve.value, false);

  const missing = resolver.resolve({
    credentialId: "eco.cred.missing",
    connectorId: "eco.payment.mock",
    requirement: "REQUIRED",
    classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
    eligibleEnvironments: ["TEST"],
  });
  assert.equal(missing.ok, false);

  assert.throws(() =>
    createNoOpTestCredentialResolver({
      presenceByCredentialId: {
        "eco.cred.bad": { present: true, secret: "leak" },
      },
    })
  );
});

test("redacted diagnostics replace secret-shaped keys", () => {
  const result = createRedactedDiagnostics({
    safeCode: "A1",
    apiKey: "should-not-appear",
    nested: { webhookSecret: "also-no" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.redacted, true);
  assert.equal(result.value.diagnostics.safeCode, "A1");
  assert.equal(result.value.diagnostics.apiKey, "[REDACTED]");
  assert.equal(result.value.diagnostics.nested.webhookSecret, "[REDACTED]");
  const serialized = JSON.stringify(result.value);
  assert.equal(serialized.includes("should-not-appear"), false);
  assert.equal(serialized.includes("also-no"), false);
});
