/**
 * ECO-03 architecture / import-boundary tests.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ROOT = path.join(
  ROOT,
  "src",
  "features",
  "ecosystem-integrations"
);

const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+["'].*core\/platform\/(?!index\.js)[^"']+["']/,
  /from\s+["'].*features\/finance\//,
  /from\s+["'].*features\/crm\//,
  /from\s+["'].*features\/notifications\//,
  /from\s+["'].*features\/payments\//,
  /from\s+["'].*features\/billing\//,
  /from\s+["'].*features\/competition-engine\//,
  /from\s+["'].*features\/competition-core\//,
  /from\s+["'].*features\/integrations\//,
  /from\s+["'].*VNPay/,
  /from\s+["'].*MoMo/,
  /from\s+["'].*Stripe/,
  /from\s+["'].*ZaloOA/,
];

const FORBIDDEN_SOURCE_TOKENS = [
  "process.env",
  "import.meta.env",
  "fetch(",
  "axios",
  "createClient(",
  "XMLHttpRequest",
  "WebSocket(",
];

const ECO03_FILES = [
  "contracts/providerAdapterDescriptor.js",
  "contracts/connectorCapabilityBinding.js",
  "contracts/providerInvocationRequest.js",
  "contracts/providerInvocationResult.js",
  "contracts/providerAdapterReadiness.js",
  "contracts/providerAdapterObservation.js",
  "contracts/domainAdapterReadinessContracts.js",
  "registry/createProviderAdapterRegistry.js",
  "selection/selectProviderAdapter.js",
  "ports/providerAdapterPort.js",
  "errors/mapProviderFailureToIntegrationError.js",
  "providers/createNoOpProviderAdapter.js",
  "providers/createFakeProviderAdapter.js",
];

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

test("ECO-03 module files and docs exist", () => {
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "index.js")));
  for (const rel of ECO03_FILES) {
    assert.ok(
      fs.existsSync(path.join(MODULE_ROOT, rel)),
      `missing ${rel}`
    );
  }
  assert.ok(
    fs.existsSync(
      path.join(
        ROOT,
        "docs",
        "ecosystem-integrations",
        "eco-03",
        "01_PROVIDER_ADAPTER_FOUNDATION.md"
      )
    )
  );
});

test("ECO-03 has no Platform Core internal or Business Module imports", () => {
  const files = listJsFiles(MODULE_ROOT);
  assert.ok(files.length >= 20);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      assert.equal(
        pattern.test(text),
        false,
        `${rel} must not match forbidden import ${pattern}`
      );
    }
  }
});

test("ECO-03 source does not access env or open network primitives", () => {
  const files = listJsFiles(MODULE_ROOT);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    for (const token of FORBIDDEN_SOURCE_TOKENS) {
      assert.equal(
        text.includes(token),
        false,
        `${rel} must not contain ${token}`
      );
    }
  }
});

test("ECO-03 does not embed vendor SDK models or live clients", () => {
  const files = listJsFiles(MODULE_ROOT);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    assert.equal(/from\s+["']stripe["']/.test(text), false, rel);
    assert.equal(/require\(["']stripe["']\)/.test(text), false, rel);
    assert.equal(text.includes("new Stripe("), false, rel);
    assert.equal(text.includes("vnpay-sdk"), false, rel);
    assert.equal(text.includes("momo-sdk"), false, rel);
  }
});

test("ECO-03 does not edit Platform Core / Competition / Finance ledger / Notification worker", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "src", "core", "platform", "index.js")));
  const ecoSources = listJsFiles(MODULE_ROOT);
  for (const file of ecoSources) {
    const text = fs.readFileSync(file, "utf8");
    assert.equal(
      /from\s+["'].*features\/competition-/.test(text),
      false,
      path.relative(ROOT, file)
    );
    assert.equal(
      /from\s+["'].*features\/finance\//.test(text),
      false,
      path.relative(ROOT, file)
    );
    assert.equal(
      /from\s+["'].*features\/notifications\//.test(text),
      false,
      path.relative(ROOT, file)
    );
  }
});

test("ECO-03 facade exports adapter foundation without live resolver flags", async () => {
  const {
    ECOSYSTEM_INTEGRATIONS_PHASE,
    createProviderAdapterRegistry,
    createNoOpProviderAdapter,
  } = await import("../src/features/ecosystem-integrations/index.js");
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasProviderAdapterFoundation, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasLiveCredentialResolver, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasRealProviders, false);
  assert.equal(typeof createProviderAdapterRegistry, "function");
  assert.equal(createNoOpProviderAdapter().productionReady, false);
});
