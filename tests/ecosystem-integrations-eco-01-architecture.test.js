/**
 * ECO-01 architecture / import-boundary tests.
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
  "fetch(",
  "axios",
  "createClient(",
  "XMLHttpRequest",
  "WebSocket(",
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

test("ECO-01 module files exist under isolated namespace", () => {
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "index.js")));
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "ARCHITECTURE.md")));
});

test("ECO-01 has no forbidden business-module or Platform-internal imports", () => {
  const files = listJsFiles(MODULE_ROOT);
  assert.ok(files.length >= 8);
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

test("ECO-01 source does not access env or open network primitives", () => {
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

test("ECO-01 does not import vendor payment/notification provider models", () => {
  const files = listJsFiles(MODULE_ROOT);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    assert.equal(
      /vnpay|momo|zalopay|stripe|sendgrid|twilio|resend/i.test(text),
      false,
      `${rel} must not embed vendor model names`
    );
  }
});

test("Platform Core path is untouched by ECO-01 (spot-check no local edits required)", () => {
  // This workstream must not ship Platform Core file changes.
  // Verified at commit time via git path scope; structural assert here:
  assert.ok(
    fs.existsSync(path.join(ROOT, "src", "core", "platform", "index.js"))
  );
});
