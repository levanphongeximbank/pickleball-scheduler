/**
 * ECO-02b — Legacy Vite browser-secret cutover (foundation).
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CREDENTIAL_PRESENCE,
  ECOSYSTEM_INTEGRATIONS_PHASE,
  createNoOpTestCredentialResolver,
  createRedactedDiagnostics,
  evaluateEnvironmentEligibility,
  isBrowserForbiddenSecretFieldName,
  isBrowserProviderCredentialResolved,
  isLegacyViteCredentialEnvName,
  projectClientSafePublicConfig,
} from "../src/features/ecosystem-integrations/index.js";
import {
  LEGACY_PROVIDER_CREDENTIAL_REQUIREMENTS,
  LEGACY_VITE_SECRET_ENV_NAMES,
  REMOVED_BROWSER_SECRET_FIELDS,
  RETAINED_CLIENT_SAFE_VITE_ENV_NAMES,
  assertClientSafeIntegrationConfig,
  withServerCredentialCutover,
} from "../src/features/integrations/config/legacyViteSecretCutover.js";
import {
  getIntegrationEnvConfig,
  getProviderStatus,
} from "../src/features/integrations/config/integrationFlags.js";
import { VNPayProvider } from "../src/features/payments/providers/VNPayProvider.js";
import { MoMoProvider } from "../src/features/payments/providers/MoMoProvider.js";
import { StripeProvider } from "../src/features/payments/providers/StripeProvider.js";
import { EmailProvider } from "../src/features/notifications/providers/EmailProvider.js";
import { SmsProvider } from "../src/features/notifications/providers/SmsProvider.js";

const SENTINEL = "TEST_ONLY_SENTINEL_DO_NOT_USE";

test("ECO-02b phase metadata records legacy secret cutover", () => {
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.id, "ECO-05");
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasLegacySecretCutover, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasProviderAdapterFoundation, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasWebhookIngressFoundation, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasObservabilityFoundation, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasLiveCredentialResolver, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.productionBlocked, true);
});

test("legacy Vite credential env names are classified", () => {
  for (const name of LEGACY_VITE_SECRET_ENV_NAMES) {
    assert.equal(
      isLegacyViteCredentialEnvName(name),
      true,
      `${name} must be classified as credential-shaped`
    );
  }
  assert.equal(isLegacyViteCredentialEnvName("VITE_VNPAY_ENABLED"), false);
  assert.equal(isLegacyViteCredentialEnvName("VITE_VNPAY_TMN_CODE"), false);
  assert.equal(isLegacyViteCredentialEnvName("VITE_SMTP_HOST"), false);
  assert.equal(isLegacyViteCredentialEnvName("VITE_STRIPE_SUCCESS_URL"), false);
});

test("getIntegrationEnvConfig is client-safe and omits removed secret fields", () => {
  process.env.VITE_VNPAY_ENABLED = "true";
  process.env.VITE_VNPAY_TMN_CODE = "PUBLIC_TMN";
  process.env.VITE_VNPAY_HASH_SECRET = SENTINEL;
  process.env.VITE_MOMO_SECRET_KEY = SENTINEL;
  process.env.VITE_STRIPE_SECRET_KEY = SENTINEL;
  process.env.VITE_ZALO_OA_ACCESS_TOKEN = SENTINEL;
  process.env.VITE_SMTP_PASS = SENTINEL;
  process.env.VITE_SMTP_USER = SENTINEL;
  process.env.VITE_SMS_API_KEY = SENTINEL;
  process.env.VITE_SMS_API_SECRET = SENTINEL;

  try {
    const cfg = getIntegrationEnvConfig();
    const safe = assertClientSafeIntegrationConfig(cfg, SENTINEL);
    assert.equal(safe.ok, true, safe.reason);

    for (const field of REMOVED_BROWSER_SECRET_FIELDS) {
      assert.equal(field in cfg.vnpay, false, `vnpay.${field}`);
      assert.equal(field in cfg.momo, false, `momo.${field}`);
      assert.equal(field in cfg.stripe, false, `stripe.${field}`);
      assert.equal(field in cfg.zalo, false, `zalo.${field}`);
      assert.equal(field in cfg.email, false, `email.${field}`);
      assert.equal(field in cfg.sms, false, `sms.${field}`);
    }

    assert.equal(cfg.vnpay.tmnCode, "PUBLIC_TMN");
    assert.equal(cfg.vnpay.enabled, true);
    assert.equal(cfg.vnpay.serverCredentialRequired, true);
    assert.equal(cfg.vnpay.credentialPresence, CREDENTIAL_PRESENCE.ABSENT);
    assert.equal(cfg.vnpay.productionReady, false);
    assert.equal(JSON.stringify(cfg).includes(SENTINEL), false);
  } finally {
    for (const key of [
      "VITE_VNPAY_ENABLED",
      "VITE_VNPAY_TMN_CODE",
      "VITE_VNPAY_HASH_SECRET",
      "VITE_MOMO_SECRET_KEY",
      "VITE_STRIPE_SECRET_KEY",
      "VITE_ZALO_OA_ACCESS_TOKEN",
      "VITE_SMTP_PASS",
      "VITE_SMTP_USER",
      "VITE_SMS_API_KEY",
      "VITE_SMS_API_SECRET",
    ]) {
      delete process.env[key];
    }
  }
});

test("enabled flag with public IDs does not imply production ready", () => {
  const slice = withServerCredentialCutover("vnpay", {
    enabled: true,
    tmnCode: "PUBLIC_TMN",
    returnUrl: "https://example.test/return",
  });
  assert.equal(getProviderStatus(slice), "error");
  assert.equal(isBrowserProviderCredentialResolved(slice), false);
  assert.equal(slice.productionReady, false);
});

test("legacy providers fail closed without server credential resolution", async () => {
  process.env.VITE_VNPAY_ENABLED = "true";
  process.env.VITE_VNPAY_TMN_CODE = "PUBLIC_TMN";
  process.env.VITE_VNPAY_HASH_SECRET = SENTINEL;
  process.env.VITE_MOMO_ENABLED = "true";
  process.env.VITE_MOMO_PARTNER_CODE = "PARTNER";
  process.env.VITE_MOMO_SECRET_KEY = SENTINEL;
  process.env.VITE_STRIPE_ENABLED = "true";
  process.env.VITE_STRIPE_SECRET_KEY = SENTINEL;
  process.env.VITE_EMAIL_ENABLED = "true";
  process.env.VITE_SMTP_HOST = "smtp.example.test";
  process.env.VITE_SMTP_FROM = "noreply@example.test";
  process.env.VITE_SMTP_PASS = SENTINEL;
  process.env.VITE_SMS_ENABLED = "true";
  process.env.VITE_SMS_API_KEY = SENTINEL;

  try {
    const vnpay = new VNPayProvider();
    const momo = new MoMoProvider();
    const stripe = new StripeProvider();
    const email = new EmailProvider();
    const sms = new SmsProvider();

    assert.equal(vnpay.isConfigured(), false);
    assert.equal(momo.isConfigured(), false);
    assert.equal(stripe.isConfigured(), false);
    assert.equal(email.isConfigured(), false);
    assert.equal(sms.isConfigured(), false);

    const pay = await vnpay.createPayment({ orderId: "o1", amount: 1000 });
    assert.equal(pay.ok, false);

    const emailSend = await email.send({
      to: "a@example.test",
      subject: "t",
      body: "b",
    });
    assert.equal(emailSend.ok, true);
    assert.match(String(emailSend.providerMessageId || ""), /^mock_email_/);
    assert.equal(JSON.stringify(emailSend).includes(SENTINEL), false);
  } finally {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("VITE_VNPAY_") ||
          key.startsWith("VITE_MOMO_") ||
          key.startsWith("VITE_STRIPE_") ||
          key.startsWith("VITE_SMTP_") ||
          key.startsWith("VITE_SMS_") ||
          key === "VITE_EMAIL_ENABLED") {
        delete process.env[key];
      }
    }
  }
});

test("canonical credential requirements exist without secret values", () => {
  for (const [provider, list] of Object.entries(
    LEGACY_PROVIDER_CREDENTIAL_REQUIREMENTS
  )) {
    assert.ok(list.length >= 1, provider);
    for (const req of list) {
      assert.equal("value" in req, false);
      assert.equal("secret" in req, false);
      assert.ok(req.secretReference?.referenceName);
      assert.equal(
        String(req.secretReference.referenceName).startsWith("VITE_"),
        false
      );
      assert.equal(JSON.stringify(req).includes(SENTINEL), false);
    }
  }
});

test("client-safe Vite names retained; secret-shaped fields rejected by helpers", () => {
  for (const name of RETAINED_CLIENT_SAFE_VITE_ENV_NAMES) {
    assert.equal(isLegacyViteCredentialEnvName(name), false, name);
  }
  for (const field of REMOVED_BROWSER_SECRET_FIELDS) {
    assert.equal(isBrowserForbiddenSecretFieldName(field), true, field);
  }

  const projection = projectClientSafePublicConfig({
    providerKey: "payment.mock",
    environmentLabel: "TEST",
    readinessStatus: "NOT_READY",
    capabilities: [],
    featureAvailability: { paymentsEnabled: false },
  });
  assert.equal(projection.ok, true);
  assert.equal(projection.value.containsSecrets, false);
});

test("sandbox/production eligibility preserved via canonical evaluator", () => {
  const blocked = evaluateEnvironmentEligibility(
    "SANDBOX",
    "PRODUCTION",
    ["SANDBOX", "PRODUCTION"]
  );
  assert.equal(blocked.eligible, false);

  const ok = evaluateEnvironmentEligibility("SANDBOX", "SANDBOX", ["SANDBOX"]);
  assert.equal(ok.eligible, true);
});

test("missing server credential resolver remains fail-closed", () => {
  const resolver = createNoOpTestCredentialResolver({ failClosed: true });
  const req = LEGACY_PROVIDER_CREDENTIAL_REQUIREMENTS.vnpay[0];
  const result = resolver.resolve({
    credentialId: req.credentialId,
    connectorId: req.connectorId,
    requirement: req.requirement,
    classification: req.classification,
    eligibleEnvironments: req.eligibleEnvironments,
    secretReference: {
      referenceId: req.secretReference.referenceId,
      referenceName: req.secretReference.referenceName,
      classification: req.secretReference.classification,
      eligibleEnvironments: req.secretReference.eligibleEnvironments,
    },
  });
  assert.equal(result.ok, false);

  const diagnostics = createRedactedDiagnostics({
    credentialId: req.credentialId,
    presence: CREDENTIAL_PRESENCE.ABSENT,
    nested: { hashSecret: SENTINEL },
  });
  assert.equal(diagnostics.ok, true);
  assert.equal(diagnostics.value.diagnostics.nested.hashSecret, "[REDACTED]");
  assert.equal(JSON.stringify(diagnostics.value).includes(SENTINEL), false);
});
