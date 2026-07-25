/**
 * ECO-02b security scan — pattern-based legacy VITE credential exposure.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  LEGACY_VITE_CREDENTIAL_ENV_NAME_PATTERN,
  createNoOpTestCredentialResolver,
  isLegacyViteCredentialEnvName,
  projectClientSafePublicConfig,
} from "../src/features/ecosystem-integrations/index.js";
import {
  LEGACY_VITE_SECRET_ENV_NAMES,
  assertClientSafeIntegrationConfig,
} from "../src/features/integrations/config/legacyViteSecretCutover.js";
import { getIntegrationEnvConfig } from "../src/features/integrations/config/integrationFlags.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SENTINEL = "TEST_ONLY_SENTINEL_DO_NOT_USE";

const BROWSER_EXECUTABLE_ROOTS = [
  path.join(ROOT, "src", "features", "integrations", "config"),
  path.join(ROOT, "src", "features", "payments", "providers"),
  path.join(ROOT, "src", "features", "notifications", "providers"),
  path.join(ROOT, "src", "features", "ecosystem-integrations"),
];

/**
 * Credential-shaped Vite env name usage as a *read* (string literal argument).
 * Detects reintroduction beyond a fixed allow/deny list.
 */
const VITE_CREDENTIAL_READ_PATTERN =
  /readEnv\(\s*["'](VITE_[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|API_SECRET|HASH_SECRET|WEBHOOK_SECRET|ACCESS_TOKEN|REFRESH_TOKEN|ACCESS_KEY|PASS|SMTP_USER))["']/g;

const IMPORT_META_CREDENTIAL_PATTERN =
  /import\.meta\.env\.(VITE_[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|API_SECRET|HASH_SECRET|WEBHOOK_SECRET|ACCESS_TOKEN|REFRESH_TOKEN|ACCESS_KEY|PASS)|VITE_SMTP_USER)\b/g;

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

test("pattern classifier catches credential-shaped Vite names beyond fixed list", () => {
  assert.equal(isLegacyViteCredentialEnvName("VITE_NEW_PROVIDER_HASH_SECRET"), true);
  assert.equal(isLegacyViteCredentialEnvName("VITE_VENDOR_ACCESS_KEY"), true);
  assert.equal(isLegacyViteCredentialEnvName("VITE_VENDOR_REFRESH_TOKEN"), true);
  assert.equal(isLegacyViteCredentialEnvName("VITE_SMTP_USER"), true);
  assert.equal(LEGACY_VITE_CREDENTIAL_ENV_NAME_PATTERN.test("VITE_X_PRIVATE_KEY"), true);
  assert.equal(isLegacyViteCredentialEnvName("VITE_PUBLIC_RETURN_URL"), false);
  assert.equal(isLegacyViteCredentialEnvName("VITE_FEATURE_FLAG"), false);
});

test("browser executable sources do not read credential-shaped VITE env vars", () => {
  const hits = [];
  for (const root of BROWSER_EXECUTABLE_ROOTS) {
    for (const file of listJsFiles(root)) {
      const text = fs.readFileSync(file, "utf8");
      const rel = path.relative(ROOT, file);

      // Catalog / deny-list mention of names (in comments or arrays) is allowed
      // only outside integrationFlags.js live readEnv calls — scan read patterns.
      for (const match of text.matchAll(VITE_CREDENTIAL_READ_PATTERN)) {
        hits.push(`${rel}: readEnv(${match[1]})`);
      }
      for (const match of text.matchAll(IMPORT_META_CREDENTIAL_PATTERN)) {
        hits.push(`${rel}: import.meta.env.${match[1]}`);
      }
    }
  }
  assert.deepEqual(hits, [], hits.join("\n"));
});

test("integrationFlags source text contains no legacy secret env names", () => {
  const flags = fs.readFileSync(
    path.join(
      ROOT,
      "src",
      "features",
      "integrations",
      "config",
      "integrationFlags.js"
    ),
    "utf8"
  );
  for (const name of LEGACY_VITE_SECRET_ENV_NAMES) {
    assert.equal(flags.includes(name), false, name);
  }
});

test("public config projection and runtime config reject sentinel leakage", () => {
  process.env.VITE_VNPAY_HASH_SECRET = SENTINEL;
  process.env.VITE_STRIPE_WEBHOOK_SECRET = SENTINEL;
  try {
    const cfg = getIntegrationEnvConfig();
    const safe = assertClientSafeIntegrationConfig(cfg, SENTINEL);
    assert.equal(safe.ok, true, safe.reason);

    const projection = projectClientSafePublicConfig({
      providerKey: "payment.mock",
      environmentLabel: "SANDBOX",
      readinessStatus: "NOT_READY",
      capabilities: [],
    });
    assert.equal(projection.ok, true);
    assert.equal(JSON.stringify(projection.value).includes(SENTINEL), false);
  } finally {
    delete process.env.VITE_VNPAY_HASH_SECRET;
    delete process.env.VITE_STRIPE_WEBHOOK_SECRET;
  }
});

test("no-op resolver never returns secret values for legacy requirements", () => {
  const resolver = createNoOpTestCredentialResolver({
    presenceByCredentialId: {
      "eco.cred.payment.vnpay.hash": { present: true },
    },
  });
  const result = resolver.resolve({
    credentialId: "eco.cred.payment.vnpay.hash",
    connectorId: "eco.payment.vnpay",
    requirement: "REQUIRED",
    classification: "SERVER_ONLY_SECRET",
    eligibleEnvironments: ["TEST", "SANDBOX", "STAGING"],
    secretReference: {
      referenceId: "eco.ref.payment.vnpay.hash",
      referenceName: "INTEGRATION_VNPAY_HASH_SECRET",
      classification: "SERVER_ONLY_SECRET",
      eligibleEnvironments: ["TEST", "SANDBOX", "STAGING"],
    },
  });
  assert.equal(result.ok, true);
  assert.equal("value" in result.value, false);
  assert.equal("secret" in result.value, false);
  assert.equal(result.value.presence, "REDACTED");
  assert.equal(JSON.stringify(result.value).includes(SENTINEL), false);
});
