/**
 * BM-FINAL-SAFETY-01 — LF-canonical migration hash portability tests.
 *
 * Offline only. Does not connect to Staging or Production.
 * Does not mutate any database and does not rewrite migration SQL on disk.
 *
 * Run:
 *   node --test tests/crm-bm-final-safety-01-canonical-hash.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalizeCrmMigrationText,
  loadCrmStagingMigrationManifest,
  sha256CanonicalText,
  sha256CanonicalTextFile,
  sha256File,
  verifyCrmStagingMigrationManifest,
} from "../src/features/crm/staging/migrationManifest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SAMPLE_LF = "line-one\nline-two\n";
const SAMPLE_CRLF = "line-one\r\nline-two\r\n";
const SAMPLE_CR = "line-one\rline-two\r";

test("1. LF and CRLF logical content share the same canonical hash", () => {
  const lfHash = sha256CanonicalText(SAMPLE_LF);
  const crlfHash = sha256CanonicalText(SAMPLE_CRLF);
  assert.equal(lfHash, crlfHash);
  assert.equal(lfHash.length, 64);
});

test("2. standalone CR normalizes to LF before hashing", () => {
  assert.equal(
    canonicalizeCrmMigrationText(SAMPLE_CR),
    canonicalizeCrmMigrationText(SAMPLE_LF)
  );
  assert.equal(sha256CanonicalText(SAMPLE_CR), sha256CanonicalText(SAMPLE_LF));
});

test("3. whitespace differences still produce different hashes", () => {
  const a = sha256CanonicalText("alpha\n");
  const b = sha256CanonicalText("alpha \n");
  assert.notEqual(a, b);
});

test("4. final-newline differences still produce different hashes", () => {
  const withNewline = sha256CanonicalText("alpha\n");
  const withoutNewline = sha256CanonicalText("alpha");
  assert.notEqual(withNewline, withoutNewline);
});

test("5. raw binary hashing is unchanged by the canonical text helper", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bmfs01-bin-hash-"));
  try {
    const filePath = path.join(dir, "payload.bin");
    const bytes = Buffer.from([0x00, 0x0d, 0x0a, 0xff, 0xfe, 0x00]);
    writeFileSync(filePath, bytes);
    const raw = sha256File(filePath);
    const expectedRaw = createHash("sha256").update(bytes).digest("hex");
    assert.equal(raw, expectedRaw);
    // Canonical text hashing of the same bytes is a separate API and must not
    // replace raw binary hashing.
    const asText = bytes.toString("utf8");
    const canonical = sha256CanonicalText(asText);
    assert.notEqual(canonical, raw);
    assert.equal(sha256File(filePath), expectedRaw);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("6. migration manifest verification PASS with LF checkout (worktree)", () => {
  const manifest = loadCrmStagingMigrationManifest(root);
  const verified = verifyCrmStagingMigrationManifest({
    repoRoot: root,
    manifest,
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.checked, 8);
  for (const entry of manifest.migrations) {
    const abs = path.join(root, entry.path);
    assert.ok(existsSync(abs), entry.path);
    assert.equal(sha256CanonicalTextFile(abs), entry.sha256.toLowerCase());
  }
});

test("7. migration manifest verification PASS with simulated CRLF content", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bmfs01-crlf-manifest-"));
  try {
    const phase1g = path.join(dir, "docs/crm/phase-1g");
    const phase1h = path.join(dir, "docs/crm/phase-1h");
    mkdirSync(phase1g, { recursive: true });
    mkdirSync(phase1h, { recursive: true });

    const real = loadCrmStagingMigrationManifest(root);
    const simulated = structuredClone(real);
    for (const entry of simulated.migrations) {
      const original = readFileSync(path.join(root, entry.path), "utf8");
      const lf = canonicalizeCrmMigrationText(original);
      const crlf = lf.replace(/\n/g, "\r\n");
      assert.notEqual(crlf, lf);
      const dest = path.join(dir, entry.path);
      mkdirSync(path.dirname(dest), { recursive: true });
      writeFileSync(dest, crlf, "utf8");
      // Pin stays LF-canonical; simulated CRLF content must still match.
      assert.equal(sha256CanonicalTextFile(dest), entry.sha256.toLowerCase());
    }

    writeFileSync(
      path.join(dir, "docs/crm/phase-1h/staging-migration-manifest.json"),
      `${JSON.stringify(simulated, null, 2)}\n`,
      "utf8"
    );

    const verified = verifyCrmStagingMigrationManifest({
      repoRoot: dir,
      manifest: simulated,
    });
    assert.equal(verified.ok, true);
    assert.equal(verified.checked, 8);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("8. modified migration content still fails hash mismatch", () => {
  const manifest = structuredClone(loadCrmStagingMigrationManifest(root));
  const entry = manifest.migrations[0];
  const abs = path.join(root, entry.path);
  const originalCanonical = sha256CanonicalTextFile(abs);
  assert.equal(originalCanonical, entry.sha256.toLowerCase());

  const dir = mkdtempSync(path.join(os.tmpdir(), "bmfs01-modified-"));
  try {
    const destRoot = dir;
    for (const item of manifest.migrations) {
      const src = path.join(root, item.path);
      const dest = path.join(destRoot, item.path);
      mkdirSync(path.dirname(dest), { recursive: true });
      writeFileSync(dest, readFileSync(src));
    }
    const target = path.join(destRoot, entry.path);
    writeFileSync(
      target,
      `${canonicalizeCrmMigrationText(readFileSync(target, "utf8"))}\n-- drift\n`,
      "utf8"
    );
    const verified = verifyCrmStagingMigrationManifest({
      repoRoot: destRoot,
      manifest,
    });
    assert.equal(verified.ok, false);
    assert.ok(
      verified.errors.some(
        (err) =>
          err.includes("SHA-256 mismatch") &&
          err.includes(entry.path) &&
          err.includes("expectedCanonical=") &&
          err.includes("actualCanonical=")
      )
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("9. missing manifest entry still fails", () => {
  const manifest = structuredClone(loadCrmStagingMigrationManifest(root));
  manifest.migrations[0].path = "docs/crm/phase-1g/DOES_NOT_EXIST.sql";
  const verified = verifyCrmStagingMigrationManifest({
    repoRoot: root,
    manifest,
  });
  assert.equal(verified.ok, false);
  assert.ok(verified.errors.some((err) => /Missing migration/i.test(err)));
});

test("10. malformed manifest still fails closed", () => {
  const missingArray = verifyCrmStagingMigrationManifest({
    repoRoot: root,
    manifest: { migrations: null },
  });
  assert.equal(missingArray.ok, false);
  assert.ok(
    missingArray.errors.some((err) => /migrations array missing/i.test(err))
  );

  const empty = verifyCrmStagingMigrationManifest({
    repoRoot: root,
    manifest: {},
  });
  assert.equal(empty.ok, false);
});
