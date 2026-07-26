/**
 * ECO-04 architecture / import-boundary tests.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ECOSYSTEM_INTEGRATIONS_PHASE } from "../src/features/ecosystem-integrations/index.js";

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

const ECO04_FILES = [
  "contracts/webhookIngressEnvelope.js",
  "contracts/webhookTimestampTolerance.js",
  "contracts/webhookReplayProjection.js",
  "contracts/webhookRouteDescriptor.js",
  "contracts/webhookSubscriptionDescriptor.js",
  "contracts/webhookIngressReceipt.js",
  "contracts/webhookIngressObservation.js",
  "registry/createWebhookRouteRegistry.js",
  "routing/routeWebhookIngress.js",
  "errors/mapWebhookFailureToIntegrationError.js",
  "handlers/createFakeWebhookIngressHandler.js",
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

test("ECO-04 module files and docs exist", () => {
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "index.js")));
  for (const rel of ECO04_FILES) {
    assert.ok(fs.existsSync(path.join(MODULE_ROOT, rel)), `missing ${rel}`);
  }
  assert.ok(
    fs.existsSync(
      path.join(
        ROOT,
        "docs",
        "ecosystem-integrations",
        "eco-04",
        "01_WEBHOOK_INGRESS_FOUNDATION.md"
      )
    )
  );
});

test("ECO-04 has no Platform Core internal or Business Module imports", () => {
  const files = listJsFiles(MODULE_ROOT);
  assert.ok(files.length >= 25);
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

test("ECO-04 source does not access env or open network primitives", () => {
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

test("ECO-04 does not embed vendor SDK models or live clients", () => {
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

test("ECO-04 does not edit Platform Core / Competition / Finance ledger / Notification worker", () => {
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

test("ECO-04 phase flags remain production-blocked", () => {
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasWebhookIngressFoundation, true);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.hasProductionWebhooks, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.wiredToProductionRuntime, false);
  assert.equal(ECOSYSTEM_INTEGRATIONS_PHASE.productionBlocked, true);
});
