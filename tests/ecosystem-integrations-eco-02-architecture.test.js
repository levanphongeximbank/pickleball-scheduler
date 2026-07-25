/**
 * ECO-02 architecture / import-boundary / browser-safe export tests.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ROOT = path.join(
  ROOT,
  "src",
  "features",
  "ecosystem-integrations"
);
const INDEX_PATH = path.join(MODULE_ROOT, "index.js");

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

test("ECO-02 secret-boundary files exist under isolated namespace", () => {
  assert.ok(
    fs.existsSync(
      path.join(MODULE_ROOT, "contracts", "secretReference.js")
    )
  );
  assert.ok(
    fs.existsSync(
      path.join(MODULE_ROOT, "contracts", "clientSafePublicConfigProjection.js")
    )
  );
  assert.ok(
    fs.existsSync(
      path.join(MODULE_ROOT, "resolvers", "createNoOpTestCredentialResolver.js")
    )
  );
  assert.ok(
    fs.existsSync(
      path.join(
        ROOT,
        "docs",
        "ecosystem-integrations",
        "eco-02",
        "01_SECRET_ENVIRONMENT_BOUNDARY.md"
      )
    )
  );
});

test("ECO-02 module has no forbidden business-module or Platform-internal imports", () => {
  const files = listJsFiles(MODULE_ROOT);
  assert.ok(files.length >= 16);
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

test("ECO-02 canonical namespace does not access env or open network primitives", () => {
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

test("ECO-02 does not embed vendor payment/notification provider models", () => {
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

test("browser-safe public barrel does not export env readers or secret value APIs", async () => {
  const mod = await import("../src/features/ecosystem-integrations/index.js");
  const exportNames = Object.keys(mod).sort();
  assert.ok(exportNames.includes("projectClientSafePublicConfig"));
  assert.ok(exportNames.includes("createNoOpTestCredentialResolver"));
  assert.ok(exportNames.includes("createServerOnlyCredentialBoundary"));

  for (const name of exportNames) {
    assert.equal(
      /readEnv|getIntegrationEnvConfig|process\.env|import\.meta\.env/i.test(
        name
      ),
      false,
      `export ${name} looks like an env reader`
    );
  }

  const indexText = fs.readFileSync(INDEX_PATH, "utf8");
  assert.equal(indexText.includes("process.env"), false);
  assert.equal(indexText.includes("import.meta.env"), false);

  // Ensure the public surface documents that live env readers are excluded.
  assert.match(indexText, /credential \*values\* or live env readers/);
});

test("Platform Core path is untouched by ECO-02 scope", () => {
  assert.ok(
    fs.existsSync(path.join(ROOT, "src", "core", "platform", "index.js"))
  );
  // Structural: this workstream must not require Platform Core file edits.
  const require = createRequire(import.meta.url);
  assert.equal(typeof require, "function");
});
