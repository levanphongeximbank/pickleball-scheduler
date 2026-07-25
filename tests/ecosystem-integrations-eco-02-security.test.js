/**
 * ECO-02 security boundary tests.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ENVIRONMENT_CLASS,
  createCredentialRequirementDescriptor,
  createNoOpTestCredentialResolver,
  createSecretReference,
  projectClientSafePublicConfig,
} from "../src/features/ecosystem-integrations/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ROOT = path.join(
  ROOT,
  "src",
  "features",
  "ecosystem-integrations"
);

const ECO_02_TEST_FILES = [
  "ecosystem-integrations-eco-02-foundation.test.js",
  "ecosystem-integrations-eco-02-architecture.test.js",
  "ecosystem-integrations-eco-02-security.test.js",
];

test("ECO-02 tests and module contain no credential-shaped literals", () => {
  const scanRoots = [
    MODULE_ROOT,
    ...ECO_02_TEST_FILES.map((name) => path.join(ROOT, "tests", name)),
  ];
  const credentialShape =
    /(sk_live_[A-Za-z0-9]+|sk_test_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;

  for (const target of scanRoots) {
    if (!fs.existsSync(target)) continue;
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

test("descriptor contracts reject secret value material", () => {
  for (const field of [
    "value",
    "secret",
    "password",
    "accessToken",
    "refreshToken",
    "privateKey",
    "webhookSecret",
  ]) {
    const ref = createSecretReference({
      referenceId: "eco.ref.x",
      referenceName: "INTEGRATION_X_SECRET",
      [field]: "material",
    });
    assert.equal(ref.ok, false, `secret reference must reject ${field}`);

    const req = createCredentialRequirementDescriptor({
      credentialId: "eco.cred.x",
      connectorId: "eco.x",
      [field]: "material",
    });
    assert.equal(req.ok, false, `credential requirement must reject ${field}`);
  }
});

test("public projection rejects nested secret-shaped keys", () => {
  const result = projectClientSafePublicConfig({
    providerKey: "payment.mock",
    environmentLabel: "TEST",
    readinessStatus: "NOT_READY",
    capabilities: [],
    nested: { apiSecret: "no" },
  });
  assert.equal(result.ok, false);
});

test("resolver fails closed for browser-exposed classification", () => {
  const resolver = createNoOpTestCredentialResolver({
    presenceByCredentialId: { "eco.cred.legacy": true },
  });
  const result = resolver.resolve({
    credentialId: "eco.cred.legacy",
    connectorId: "eco.legacy",
    requirement: "REQUIRED",
    classification: ENVIRONMENT_CLASS.BROWSER_EXPOSED_SECRET_RISK,
    eligibleEnvironments: ["TEST"],
  });
  assert.equal(result.ok, false);
});

test("resolver never serializes injected secret material", () => {
  const resolver = createNoOpTestCredentialResolver({
    presenceByCredentialId: { "eco.cred.ok": { present: true } },
  });
  const result = resolver.resolve({
    credentialId: "eco.cred.ok",
    connectorId: "eco.ok",
    requirement: "REQUIRED",
    classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
    eligibleEnvironments: ["TEST"],
  });
  assert.equal(result.ok, true);
  const serialized = JSON.stringify(result.value);
  assert.equal(/"(value|secret|password|token|apiKey)"\s*:/.test(serialized), false);
});
