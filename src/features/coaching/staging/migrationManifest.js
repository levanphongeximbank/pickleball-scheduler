/**
 * COACHING-03 — Canonical SQL migration manifest verification.
 *
 * Pins exact COACHING-02 forward/rollback/verification files.
 * Rejects Phase 28, missing files, duplicates, and checksum drift.
 * Does not execute SQL.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  COACHING_03_FORWARD_SQL_ORDER,
  COACHING_03_MANIFEST_RELATIVE_PATH,
  COACHING_03_PHASE_28_SQL_BLOCKLIST,
  COACHING_03_PRODUCTION_PROJECT_REF_BLOCKLIST,
  COACHING_03_ROLLBACK_SQL_PATH,
  COACHING_03_STAGING_PROJECT_REF_ALLOWLIST,
  COACHING_03_VERIFICATION_SQL_PATH,
} from "./constants.js";
import { getCoaching03RepoRoot } from "./loadCoachingStagingEnv.js";
import {
  COACHING_03_MANIFEST_HASH_ALGORITHM,
  aggregateSha256ForEntries,
  sha256File,
} from "./sqlChecksum.js";

/**
 * @param {string} [repoRoot]
 * @returns {object}
 */
export function loadCoaching03MigrationManifest(repoRoot) {
  const root = repoRoot || getCoaching03RepoRoot();
  const manifestPath = path.join(root, COACHING_03_MANIFEST_RELATIVE_PATH);
  if (!existsSync(manifestPath)) {
    throw new Error(`COACHING-03 migration manifest missing: ${manifestPath}`);
  }
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

/**
 * @param {{ repoRoot?: string, manifest?: object }} [options]
 * @returns {{ ok: true, checked: number, aggregateSha256: string } | { ok: false, errors: string[] }}
 */
export function verifyCoaching03MigrationManifest(options = {}) {
  const repoRoot = options.repoRoot || getCoaching03RepoRoot();
  const manifest =
    options.manifest || loadCoaching03MigrationManifest(repoRoot);
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

  if (manifest.productionApplyApproved !== false) {
    errors.push("Manifest productionApplyApproved must be false.");
  }

  if (manifest.executeSql !== false) {
    errors.push("Manifest executeSql must be false (author-only pin).");
  }

  const hashAlgo = String(manifest.hashAlgorithm || "").trim();
  if (hashAlgo !== COACHING_03_MANIFEST_HASH_ALGORITHM) {
    errors.push(
      `Manifest hashAlgorithm must be ${COACHING_03_MANIFEST_HASH_ALGORITHM} (got ${hashAlgo || "(missing)"}).`
    );
  }

  const allow = new Set([
    ...(manifest.stagingProjectRefAllowlist || []),
    ...COACHING_03_STAGING_PROJECT_REF_ALLOWLIST,
  ]);
  const block = new Set([
    ...(manifest.productionProjectRefBlocklist || []),
    ...COACHING_03_PRODUCTION_PROJECT_REF_BLOCKLIST,
  ]);
  for (const ref of allow) {
    if (block.has(ref)) {
      errors.push(`Allowlist ref also on Production blocklist: ${ref}`);
    }
  }

  const classifications = ["forward", "rollback", "verification"];
  /** @type {Map<string, object>} */
  const byPath = new Map();
  for (const entry of manifest.migrations) {
    const rel = String(entry.path || "").replace(/\\/g, "/");
    if (!rel) {
      errors.push("Migration entry missing path.");
      continue;
    }
    if (byPath.has(rel)) {
      errors.push(`Duplicate migration entry: ${rel}`);
    }
    byPath.set(rel, entry);

    if (!classifications.includes(entry.classification)) {
      errors.push(
        `Invalid classification for ${rel}: ${entry.classification}`
      );
    }

    for (const blocked of COACHING_03_PHASE_28_SQL_BLOCKLIST) {
      if (rel.includes("PHASE_28") || rel.endsWith(blocked) || rel === blocked) {
        errors.push(`Phase 28 file rejected in manifest: ${rel}`);
      }
    }

    const abs = path.join(repoRoot, rel);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      errors.push(`Missing migration file: ${rel}`);
      continue;
    }
    const actual = sha256File(abs);
    if (String(entry.sha256).toLowerCase() !== actual.toLowerCase()) {
      errors.push(
        `SHA-256 mismatch for ${rel}: pinned=${entry.sha256} actual=${actual}`
      );
    }
  }

  const forward = [...manifest.migrations]
    .filter((m) => m.classification === "forward")
    .sort((a, b) => Number(a.order) - Number(b.order));

  if (forward.length !== COACHING_03_FORWARD_SQL_ORDER.length) {
    errors.push(
      `Forward migration count mismatch: expected ${COACHING_03_FORWARD_SQL_ORDER.length}, got ${forward.length}`
    );
  }

  for (let i = 0; i < COACHING_03_FORWARD_SQL_ORDER.length; i += 1) {
    const expectedPath = COACHING_03_FORWARD_SQL_ORDER[i];
    const entry = forward[i];
    if (!entry) {
      errors.push(`Missing forward entry at order ${i + 1}: ${expectedPath}`);
      continue;
    }
    if (Number(entry.order) !== i + 1) {
      errors.push(
        `Forward order mismatch at index ${i}: expected ${i + 1}, got ${entry.order}`
      );
    }
    const rel = String(entry.path).replace(/\\/g, "/");
    if (rel !== expectedPath) {
      errors.push(
        `Forward path mismatch at order ${i + 1}: expected ${expectedPath}, got ${rel}`
      );
    }
  }

  const rollback = manifest.migrations.filter(
    (m) => m.classification === "rollback"
  );
  if (rollback.length !== 1) {
    errors.push(`Expected exactly 1 rollback entry, got ${rollback.length}`);
  } else if (
    String(rollback[0].path).replace(/\\/g, "/") !==
    COACHING_03_ROLLBACK_SQL_PATH
  ) {
    errors.push(
      `Rollback path must be ${COACHING_03_ROLLBACK_SQL_PATH}`
    );
  }

  const verification = manifest.migrations.filter(
    (m) => m.classification === "verification"
  );
  if (verification.length !== 1) {
    errors.push(
      `Expected exactly 1 verification entry, got ${verification.length}`
    );
  } else if (
    String(verification[0].path).replace(/\\/g, "/") !==
    COACHING_03_VERIFICATION_SQL_PATH
  ) {
    errors.push(
      `Verification path must be ${COACHING_03_VERIFICATION_SQL_PATH}`
    );
  }

  // Reject any extra numbered COACHING_02 SQL under coaching-02 not pinned.
  const coaching02Dir = path.join(
    repoRoot,
    "docs/coaching-training/coaching-02"
  );
  if (existsSync(coaching02Dir)) {
    const pinned = new Set(
      manifest.migrations.map((m) => String(m.path).replace(/\\/g, "/"))
    );
    for (const name of readdirSync(coaching02Dir)) {
      if (!/^\d+_COACHING_02_.*\.sql$/i.test(name)) continue;
      const rel = `docs/coaching-training/coaching-02/${name}`;
      if (!pinned.has(rel)) {
        errors.push(`Unpinned COACHING-02 SQL file: ${rel}`);
      }
    }
  }

  // Reject Phase 28 path if present under docs/v5 as apply candidate listing.
  for (const blocked of COACHING_03_PHASE_28_SQL_BLOCKLIST) {
    for (const entry of manifest.migrations) {
      const blob = JSON.stringify(entry);
      if (blob.includes("PHASE_28_COACHING")) {
        errors.push(`Phase 28 reference in migration entry: ${entry.path}`);
      }
      if (blob.includes(blocked)) {
        errors.push(`Blocked Phase 28 path reference: ${blocked}`);
      }
    }
  }

  const aggregate = aggregateSha256ForEntries(forward);
  const pinnedAggregate = String(manifest.aggregateSha256Forward || "")
    .trim()
    .toLowerCase();
  if (!pinnedAggregate) {
    errors.push("Manifest aggregateSha256Forward missing.");
  } else if (pinnedAggregate !== aggregate) {
    errors.push(
      `Aggregate SHA-256 mismatch: pinned=${pinnedAggregate} actual=${aggregate}`
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    checked: manifest.migrations.length,
    aggregateSha256: aggregate,
  };
}

export {
  COACHING_03_MANIFEST_HASH_ALGORITHM,
  aggregateSha256ForEntries,
  sha256File,
};
