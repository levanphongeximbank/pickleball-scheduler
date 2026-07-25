/**
 * ECO-02b architecture / path-boundary tests.
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
const CUTOVER_POLICY = path.join(
  MODULE_ROOT,
  "cutover",
  "browserSecretCutoverPolicy.js"
);
const FLAGS = path.join(
  ROOT,
  "src",
  "features",
  "integrations",
  "config",
  "integrationFlags.js"
);
const LEGACY_CUTOVER = path.join(
  ROOT,
  "src",
  "features",
  "integrations",
  "config",
  "legacyViteSecretCutover.js"
);
const PROVIDER_FILES = [
  "src/features/payments/providers/VNPayProvider.js",
  "src/features/payments/providers/MoMoProvider.js",
  "src/features/payments/providers/StripeProvider.js",
  "src/features/notifications/providers/EmailProvider.js",
  "src/features/notifications/providers/SmsProvider.js",
];

const FORBIDDEN_PLATFORM_INTERNAL =
  /from\s+["'].*core\/platform\/(?!index\.js)[^"']+["']/;

test("ECO-02b cutover policy and docs exist", () => {
  assert.ok(fs.existsSync(CUTOVER_POLICY));
  assert.ok(fs.existsSync(LEGACY_CUTOVER));
  assert.ok(
    fs.existsSync(
      path.join(
        ROOT,
        "docs",
        "ecosystem-integrations",
        "eco-02b",
        "01_LEGACY_VITE_SECRET_CUTOVER.md"
      )
    )
  );
});

test("canonical cutover policy has no env/network/business-module coupling", () => {
  const text = fs.readFileSync(CUTOVER_POLICY, "utf8");
  assert.equal(text.includes("process.env"), false);
  assert.equal(text.includes("import.meta.env"), false);
  assert.equal(text.includes("fetch("), false);
  assert.equal(/features\/(finance|payments|notifications|billing|competition)/.test(text), false);
  assert.equal(FORBIDDEN_PLATFORM_INTERNAL.test(text), false);
  assert.equal(/vnpay|momo|stripe|zalo|twilio|sendgrid/i.test(text), false);
});

test("integrationFlags does not read legacy VITE credential env names", () => {
  const text = fs.readFileSync(FLAGS, "utf8");
  const forbiddenReads = [
    "VITE_VNPAY_HASH_SECRET",
    "VITE_MOMO_ACCESS_KEY",
    "VITE_MOMO_SECRET_KEY",
    "VITE_STRIPE_SECRET_KEY",
    "VITE_STRIPE_WEBHOOK_SECRET",
    "VITE_ZALO_OA_SECRET",
    "VITE_ZALO_OA_ACCESS_TOKEN",
    "VITE_ZALO_OA_REFRESH_TOKEN",
    "VITE_SMTP_PASS",
    "VITE_SMTP_USER",
    "VITE_SMS_API_KEY",
    "VITE_SMS_API_SECRET",
  ];
  for (const name of forbiddenReads) {
    assert.equal(
      text.includes(name),
      false,
      `integrationFlags must not reference ${name}`
    );
  }
  assert.match(text, /withServerCredentialCutover/);
  assert.equal(FORBIDDEN_PLATFORM_INTERNAL.test(text), false);
});

test("affected providers do not read import.meta.env secrets or init live clients", () => {
  for (const rel of PROVIDER_FILES) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.equal(text.includes("import.meta.env"), false, rel);
    assert.equal(/process\.env/.test(text), false, rel);
    assert.equal(text.includes("fetch("), false, rel);
    assert.equal(text.includes("axios"), false, rel);
    assert.equal(text.includes("createClient("), false, rel);
    assert.equal(FORBIDDEN_PLATFORM_INTERNAL.test(text), false, rel);
    assert.match(text, /isBrowserProviderCredentialResolved/, rel);
  }
});

test("ECO-02b does not edit Platform Core / Competition / Finance ledger / Notification worker paths", () => {
  // Structural scope check — files exist and ECO-02b sources do not import them deeply.
  assert.ok(fs.existsSync(path.join(ROOT, "src", "core", "platform", "index.js")));
  const ecoSources = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) ecoSources.push(full);
    }
  }
  walk(MODULE_ROOT);
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
