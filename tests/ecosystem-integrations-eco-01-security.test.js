/**
 * ECO-01 security boundary tests.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createIntegrationError,
  createInboundIntegrationEnvelope,
  createFakeWebhookVerifier,
  INTEGRATION_ERROR_CODE,
  verifyWebhookRequestFailClosed,
} from "../src/features/ecosystem-integrations/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ROOT = path.join(
  ROOT,
  "src",
  "features",
  "ecosystem-integrations"
);
const FIXED_TS = "2026-07-24T10:00:00.000Z";

test("ECO-01 tests and module contain no credential-shaped literals", () => {
  const scanRoots = [
    MODULE_ROOT,
    path.join(ROOT, "tests", "ecosystem-integrations-eco-01-foundation.test.js"),
    path.join(ROOT, "tests", "ecosystem-integrations-eco-01-architecture.test.js"),
    path.join(ROOT, "tests", "ecosystem-integrations-eco-01-security.test.js"),
  ];
  const credentialShape =
    /(sk_live_[A-Za-z0-9]+|sk_test_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;

  for (const target of scanRoots) {
    if (fs.statSync(target).isDirectory()) {
      for (const entry of fs.readdirSync(target, { recursive: true })) {
        const full = path.join(target, entry);
        if (!full.endsWith(".js") && !full.endsWith(".md")) continue;
        const text = fs.readFileSync(full, "utf8");
        assert.equal(
          credentialShape.test(text),
          false,
          `${full} must not contain credential-shaped literals`
        );
      }
    } else {
      const text = fs.readFileSync(target, "utf8");
      assert.equal(credentialShape.test(text), false);
    }
  }
});

test("error context never retains secret-like keys", () => {
  const err = createIntegrationError(
    INTEGRATION_ERROR_CODE.AUTHENTICATION,
    "denied",
    {
      apiKey: "x",
      webhookSecret: "y",
      signature: "z",
      safeCode: "A1",
    }
  );
  assert.equal(err.context.apiKey, undefined);
  assert.equal(err.context.webhookSecret, undefined);
  assert.equal(err.context.signature, undefined);
  assert.equal(err.context.safeCode, "A1");
});

test("webhook verification request does not echo raw signature values", () => {
  const result = verifyWebhookRequestFailClosed({
    connectorId: "eco.wh",
    signatureHeader: "raw-signature-value-should-not-echo",
    timestamp: FIXED_TS,
    bodyDigest: "digest",
    expectedBodyDigest: "digest",
    now: FIXED_TS,
  });
  assert.equal(result.value.accepted, true);
  const serialized = JSON.stringify(result.value);
  assert.equal(serialized.includes("raw-signature-value-should-not-echo"), false);
});

test("fake webhook verifier requires explicit digest config (no env secrets)", () => {
  assert.throws(() => createFakeWebhookVerifier({}));
  const verifier = createFakeWebhookVerifier({
    expectedBodyDigest: "fixed-digest",
  });
  const okResult = verifier.verify({
    connectorId: "eco.wh",
    signatureHeader: "present",
    timestamp: FIXED_TS,
    bodyDigest: "fixed-digest",
    now: FIXED_TS,
  });
  assert.equal(okResult.value.accepted, true);
});

test("inbound envelope rejects nested credential keys", () => {
  const result = createInboundIntegrationEnvelope({
    messageId: "m1",
    receivedAt: FIXED_TS,
    correlationId: "c1",
    connectorId: "eco.noop",
    providerKey: "noop.test",
    payloadType: "t",
    payload: { nested: { refreshToken: "no" } },
  });
  assert.equal(result.ok, false);
});
