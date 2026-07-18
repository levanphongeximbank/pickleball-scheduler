#!/usr/bin/env node
/**
 * Phase 3A.3 — Validate phase sub-manifests against official unit-test-files.json.
 *
 * Usage:
 *   node scripts/ci/validate-phase-test-manifests.mjs
 *   node scripts/ci/validate-phase-test-manifests.mjs --phase=3a3
 *
 * Rules:
 * - Each scripts/ci/unit-test-files.phase-*.json must be a JSON string array
 * - Every entry must exist in scripts/ci/unit-test-files.json (Integrator merge)
 * - No duplicates inside a phase file
 * - Official manifest itself must have no duplicates
 *
 * Does NOT change the test runner. Option D contractual + Integrator merge.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CI_DIR = path.join(ROOT, "scripts", "ci");
const OFFICIAL = path.join(CI_DIR, "unit-test-files.json");

/**
 * @param {string} filePath
 * @returns {string[]}
 */
function loadArray(filePath) {
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error(`${path.relative(ROOT, filePath)} must be a JSON array`);
  }
  for (const item of raw) {
    if (typeof item !== "string") {
      throw new Error(`${path.relative(ROOT, filePath)} entries must be strings`);
    }
  }
  return raw;
}

/**
 * @param {string} [phaseFilter] e.g. "3a3"
 */
export function validatePhaseTestManifests(phaseFilter) {
  /** @type {string[]} */
  const errors = [];
  const official = loadArray(OFFICIAL);
  const officialSet = new Set(official);

  const officialDupes = official.filter((f, i) => official.indexOf(f) !== i);
  if (officialDupes.length > 0) {
    errors.push(`official manifest has duplicates: ${officialDupes.join(", ")}`);
  }

  const phaseFiles = readdirSync(CI_DIR)
    .filter((n) => /^unit-test-files\.phase-.+\.json$/.test(n))
    .filter((n) => {
      if (!phaseFilter) return true;
      return n === `unit-test-files.phase-${phaseFilter}.json`;
    })
    .sort();

  for (const name of phaseFiles) {
    const full = path.join(CI_DIR, name);
    const entries = loadArray(full);
    const dupes = entries.filter((f, i) => entries.indexOf(f) !== i);
    if (dupes.length > 0) {
      errors.push(`${name} has duplicates: ${dupes.join(", ")}`);
    }
    for (const entry of entries) {
      if (!officialSet.has(entry)) {
        errors.push(
          `${name} entry missing from official manifest (Integrator must merge): ${entry}`
        );
      }
      if (!existsSync(path.join(ROOT, entry))) {
        errors.push(`${name} references missing file: ${entry}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    officialCount: official.length,
    phaseFileCount: phaseFiles.length,
  };
}

function main() {
  let phaseFilter;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--phase=")) phaseFilter = arg.slice("--phase=".length);
  }
  const result = validatePhaseTestManifests(phaseFilter);
  if (!result.ok) {
    console.error("phase test manifest validation FAILED:");
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(
    `phase test manifest validation OK (official=${result.officialCount}, phaseFiles=${result.phaseFileCount})`
  );
  process.exit(0);
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main();
}
