/**
 * CUSTOMER-07 — Staging migration manifest helpers.
 *
 * SHA pins are cross-platform: CRLF/CR are normalized to LF before hashing so
 * Windows working trees and Linux CI produce the same canonical digest.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  CUSTOMER_07_MANIFEST_RELATIVE_PATH,
  CUSTOMER_07_PRODUCTION_PROJECT_REF_BLOCKLIST,
  CUSTOMER_07_STAGING_PROJECT_REF_ALLOWLIST,
} from "./constants.js";
import { getCustomer07RepoRoot } from "./loadCustomerStagingEnv.js";

/** Manifest hash algorithm id (pinned in staging-migration-manifest.json). */
export const CUSTOMER_07_MANIFEST_HASH_ALGORITHM = "sha256-lf-normalized";

/**
 * Normalize text to LF line endings for cross-platform SHA pinning.
 * @param {string|Buffer|Uint8Array} input
 * @returns {string}
 */
export function canonicalizeCustomer07MigrationText(input) {
  let text;
  if (typeof input === "string") {
    text = input;
  } else if (input instanceof Uint8Array) {
    text = new TextDecoder("utf8").decode(input);
  } else {
    text = String(input ?? "");
  }
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * SHA-256 of LF-normalized content (hex lowercase).
 * @param {string|Buffer|Uint8Array} input
 * @returns {string}
 */
export function sha256CanonicalContent(input) {
  const canonical = canonicalizeCustomer07MigrationText(input);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * @param {string} absolutePath
 * @returns {string}
 */
export function sha256File(absolutePath) {
  return sha256CanonicalContent(readFileSync(absolutePath));
}

/**
 * @param {string} [repoRoot]
 * @returns {object}
 */
export function loadCustomer07MigrationManifest(repoRoot) {
  const root = repoRoot || getCustomer07RepoRoot();
  const manifestPath = path.join(root, CUSTOMER_07_MANIFEST_RELATIVE_PATH);
  if (!existsSync(manifestPath)) {
    throw new Error(`CUSTOMER-07 migration manifest missing: ${manifestPath}`);
  }
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

/**
 * @param {{ repoRoot?: string, manifest?: object }} [options]
 * @returns {{ ok: true, checked: number } | { ok: false, errors: string[] }}
 */
export function verifyCustomer07MigrationManifest(options = {}) {
  const repoRoot = options.repoRoot || getCustomer07RepoRoot();
  const manifest =
    options.manifest || loadCustomer07MigrationManifest(repoRoot);
  /** @type {string[]} */
  const errors = [];

  if (!manifest || !Array.isArray(manifest.migrations)) {
    return { ok: false, errors: ["Manifest migrations array missing."] };
  }

  if (manifest.environmentTarget !== "staging") {
    errors.push(
      `Manifest environmentTarget must be staging (got ${manifest.environmentTarget}).`
    );
  }

  const hashAlgo = String(manifest.hashAlgorithm || "").trim();
  if (hashAlgo !== CUSTOMER_07_MANIFEST_HASH_ALGORITHM) {
    errors.push(
      `Manifest hashAlgorithm must be ${CUSTOMER_07_MANIFEST_HASH_ALGORITHM} (got ${hashAlgo || "(missing)"}).`
    );
  }

  const allow = new Set([
    ...(manifest.stagingProjectRefAllowlist || []),
    ...CUSTOMER_07_STAGING_PROJECT_REF_ALLOWLIST,
  ]);
  const block = new Set([
    ...(manifest.productionProjectRefBlocklist || []),
    ...CUSTOMER_07_PRODUCTION_PROJECT_REF_BLOCKLIST,
  ]);

  for (const ref of allow) {
    if (block.has(ref)) {
      errors.push(`Allowlist ref also on Production blocklist: ${ref}`);
    }
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
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      errors.push(`Missing migration file: ${entry.path}`);
      continue;
    }
    const actual = sha256File(abs);
    if (String(entry.sha256).toLowerCase() !== actual.toLowerCase()) {
      errors.push(
        `SHA-256 mismatch for ${entry.path}: pinned=${entry.sha256} actual=${actual}`
      );
    }
    const blob = JSON.stringify(entry);
    for (const prodRef of block) {
      if (blob.includes(prodRef)) {
        errors.push(
          `Production project ref in migration entry ${entry.path}: ${prodRef}`
        );
      }
    }
  }

  // Detect unknown controlled numbered apply SQL under phase-3..7.
  const controlledDirs = [3, 4, 5, 6, 7].map((n) =>
    path.join(repoRoot, `docs/customer-management/phase-${n}`)
  );
  const pinnedPaths = new Set(ordered.map((m) => m.path.replace(/\\/g, "/")));
  for (const dir of controlledDirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!/^\d+_CUSTOMER_(PHASE_[3-6]|07).*\.sql$/i.test(name)) continue;
      if (/90_CUSTOMER_|99_CUSTOMER_|15_PRE_APPLY/.test(name)) continue;
      const rel = path
        .relative(repoRoot, path.join(dir, name))
        .replace(/\\/g, "/");
      if (!pinnedPaths.has(rel)) {
        errors.push(`Unknown controlled migration not in manifest: ${rel}`);
      }
    }
  }

  // Chain phase ordering: phase-3 files before phase-4 before phase-5 before phase-6 before phase-7.
  let lastPhase = 2;
  for (const entry of ordered) {
    const m = String(entry.path).match(/phase-([3-7])/);
    const phase = m ? Number(m[1]) : null;
    if (phase == null) {
      errors.push(`Migration path missing phase folder: ${entry.path}`);
      continue;
    }
    if (phase < lastPhase) {
      errors.push(
        `Phase order regression: ${entry.path} (phase ${phase}) after phase ${lastPhase}`
      );
    }
    lastPhase = Math.max(lastPhase, phase);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, checked: ordered.length };
}

export {
  CUSTOMER_07_PRODUCTION_PROJECT_REF_BLOCKLIST,
  CUSTOMER_07_STAGING_PROJECT_REF_ALLOWLIST,
};
