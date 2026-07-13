#!/usr/bin/env node
/**
 * Compute SHA256 checksums for V5-P1 Production migration bundle.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-p1a-preflight");

const FILES = [
  "docs/v5/rating-v5/PHASE_V5A_RATING_FOUNDATION.sql",
  "docs/v5/rating-v5/PHASE_V5B1_COMPLETE_ASSESSMENT.sql",
  "docs/v5/rating-v5/PHASE_V5B1P_PERSISTENCE_AND_EDGE.sql",
  "docs/v5/rating-v5/PHASE_V5C1_PILOT_ENROLLMENT_AND_POLICY.sql",
];

const EDGE_FILES = [
  "src/features/pick-vn-rating-v5/server/edgeEntry.js",
  "src/features/pick-vn-rating-v5/server/edgeHttpHelpers.js",
];

function sha256(rel) {
  const abs = path.join(rootDir, rel);
  return createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

function gitSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

fs.mkdirSync(outDir, { recursive: true });

const manifest = {
  generated_at: new Date().toISOString(),
  git_sha: gitSha(),
  migrations: Object.fromEntries(
    FILES.map((f) => [f, { sha256: sha256(f), bytes: fs.statSync(path.join(rootDir, f)).size }]),
  ),
  edge: Object.fromEntries(
    EDGE_FILES.map((f) => [f, { sha256: sha256(f), bytes: fs.statSync(path.join(rootDir, f)).size }]),
  ),
};

fs.writeFileSync(path.join(outDir, "MIGRATION_CHECKSUMS.json"), `${JSON.stringify(manifest, null, 2)}\n`);

for (const [f, meta] of Object.entries(manifest.migrations)) {
  console.log(`${meta.sha256.slice(0, 16)}… ${meta.bytes}B ${f}`);
}
console.log(`Wrote ${path.join(outDir, "MIGRATION_CHECKSUMS.json")}`);
