/**
 * CRM Phase 1H staging migration manifest helpers (offline/static).
 *
 * Machine-readable manifest lives at:
 *   docs/crm/phase-1h/staging-migration-manifest.json
 *
 * Verification fails if files change after SHA pinning, are missing,
 * order differs, or unknown controlled migrations appear.
 *
 * Migration SHA pins are **LF-canonical**: CRLF and standalone CR are
 * normalized to LF before hashing so Windows / Linux / macOS agree.
 * Files on disk are never mutated.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/features/crm/staging → repo root (4 levels up)
const REPO_ROOT = path.resolve(__dirname, "../../../..");

export const CRM_PHASE_1H_MANIFEST_RELATIVE_PATH =
  "docs/crm/phase-1h/staging-migration-manifest.json";

export const CRM_PRODUCTION_PROJECT_REF_BLOCKLIST = Object.freeze([
  "expuvcohlcjzvrrauvud",
]);

export const CRM_STAGING_PROJECT_REF_ALLOWLIST = Object.freeze([
  "qyewbxjsiiyufanzcjcq",
]);

/**
 * Raw byte SHA-256 of a file. Does NOT normalize line endings.
 * Use for binary assets only — never for CRM migration text pins.
 * @param {string} absolutePath
 * @returns {string} lowercase hex
 */
export function sha256File(absolutePath) {
  const buf = readFileSync(absolutePath);
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Normalize text line endings to LF without changing any other content.
 * - CRLF (`\r\n`) → LF (`\n`)
 * - standalone CR (`\r`) → LF (`\n`)
 * Does not trim whitespace and does not add/remove a final newline.
 * @param {string} text
 * @returns {string}
 */
export function canonicalizeCrmMigrationText(text) {
  return String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * SHA-256 of UTF-8 text after LF line-ending canonicalization.
 * Does not write to disk. Does not use os.EOL.
 * @param {string} text
 * @returns {string} lowercase hex
 */
export function sha256CanonicalText(text) {
  const canonical = canonicalizeCrmMigrationText(text);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * LF-canonical SHA-256 of a UTF-8 text file (CRM migration SQL / manifest pins).
 * Read as Buffer → UTF-8 decode → LF normalize → UTF-8 encode → SHA-256.
 * Never mutates the file on disk.
 * @param {string} absolutePath
 * @returns {string} lowercase hex
 */
export function sha256CanonicalTextFile(absolutePath) {
  const buf = readFileSync(absolutePath);
  return sha256CanonicalText(buf.toString("utf8"));
}

/**
 * @param {string} [repoRoot]
 * @returns {object}
 */
export function loadCrmStagingMigrationManifest(repoRoot = REPO_ROOT) {
  const manifestPath = path.join(repoRoot, CRM_PHASE_1H_MANIFEST_RELATIVE_PATH);
  if (!existsSync(manifestPath)) {
    throw new Error(`CRM staging migration manifest missing: ${manifestPath}`);
  }
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

/**
 * Verify pinned SHA sequence against filesystem using LF-canonical hashes.
 * @param {object} [options]
 * @returns {{ ok: true, checked: number } | { ok: false, errors: string[] }}
 */
export function verifyCrmStagingMigrationManifest(options = {}) {
  const repoRoot = options.repoRoot || REPO_ROOT;
  const manifest = options.manifest || loadCrmStagingMigrationManifest(repoRoot);
  const manifestPath = CRM_PHASE_1H_MANIFEST_RELATIVE_PATH;
  /** @type {string[]} */
  const errors = [];

  if (!manifest || !Array.isArray(manifest.migrations)) {
    return {
      ok: false,
      errors: [
        `Manifest migrations array missing (manifest=${manifestPath}).`,
      ],
    };
  }

  const ordered = [...manifest.migrations].sort(
    (a, b) => Number(a.order) - Number(b.order)
  );

  for (let i = 0; i < ordered.length; i += 1) {
    const entry = ordered[i];
    const expectedOrder = i + 1;
    if (Number(entry.order) !== expectedOrder) {
      errors.push(
        `Order mismatch at index ${i}: expected ${expectedOrder}, got ${entry.order}`
      );
    }
    const abs = path.join(repoRoot, entry.path);
    if (!existsSync(abs)) {
      errors.push(
        `Missing migration file: ${entry.path} (manifest=${manifestPath})`
      );
      continue;
    }
    const expected = String(entry.sha256 || "").toLowerCase();
    const actual = sha256CanonicalTextFile(abs);
    if (expected !== actual) {
      errors.push(
        `SHA-256 mismatch (manifest=${manifestPath}, entry=${entry.path}): expectedCanonical=${expected} actualCanonical=${actual}`
      );
    }
  }

  // Detect unknown controlled SQL files under phase-1g / phase-1h numbered migrations.
  const controlledDirs = [
    path.join(repoRoot, "docs/crm/phase-1g"),
    path.join(repoRoot, "docs/crm/phase-1h"),
  ];
  const pinnedPaths = new Set(ordered.map((m) => m.path.replace(/\\/g, "/")));
  for (const dir of controlledDirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!/^\d+_CRM_PHASE_1[GH].*\.sql$/i.test(name)) continue;
      const rel = path
        .relative(repoRoot, path.join(dir, name))
        .replace(/\\/g, "/");
      if (!pinnedPaths.has(rel)) {
        errors.push(`Unknown controlled migration not in manifest: ${rel}`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, checked: ordered.length };
}

/**
 * Build a fresh manifest entry list from known ordered paths (authoring helper).
 * Pins use LF-canonical text hashes.
 * @param {Array<object>} definitions
 * @param {string} [repoRoot]
 */
export function buildCrmStagingMigrationEntries(definitions, repoRoot = REPO_ROOT) {
  return definitions.map((def, index) => {
    const abs = path.join(repoRoot, def.path);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      throw new Error(`Cannot pin missing migration: ${def.path}`);
    }
    return {
      order: index + 1,
      path: def.path.replace(/\\/g, "/"),
      sha256: sha256CanonicalTextFile(abs),
      purpose: def.purpose,
      expectedObjects: def.expectedObjects,
      rollbackClassification: def.rollbackClassification,
      precondition: def.precondition,
      postcondition: def.postcondition,
      transactionSafe: def.transactionSafe,
      manualReviewRequired: def.manualReviewRequired,
    };
  });
}

export function getCrmPhase1hRepoRoot() {
  return REPO_ROOT;
}
