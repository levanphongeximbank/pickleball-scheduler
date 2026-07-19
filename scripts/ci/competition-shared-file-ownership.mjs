#!/usr/bin/env node
/**
 * Phase 3A.3 — Shared-file ownership guard (Integrator-owned protected files).
 *
 * Usage:
 *   node scripts/ci/competition-shared-file-ownership.mjs --phase=3b --files=file1,file2
 *   node scripts/ci/competition-shared-file-ownership.mjs --phase=3a3 --files=-   # read stdin lines
 *   node scripts/ci/competition-shared-file-ownership.mjs --list-protected
 *
 * Capability phases (3b–3l) may NOT touch Integrator-protected files.
 * Integrator / 3a3 / 3m / 3n / 3p may touch them.
 *
 * Exit 0 = ok; Exit 1 = violation; Exit 2 = usage error.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Integrator-only protected paths (forward-slash, repo-relative). */
export const COMPETITION_PROTECTED_FILES = Object.freeze([
  "src/features/competition-core/index.js",
  "src/features/competition-core/runtime-control/index.js",
  "src/features/competition-core/runtime-control/shadow/index.js",
  "src/features/competition-core/runtime-control/constants/runtimeScopes.js",
  "src/features/competition-core/runtime-control/resolvers/resolveRuntimeDecision.js",
  "src/features/competition-core/runtime-control/shadow/resolvers/resolveShadowEligibility.js",
  "src/features/competition-core/runtime-control/registries/index.js",
  "src/features/competition-core/runtime-control/shadow/registries/index.js",
  "src/features/competition-core/config/featureFlags.js",
  "src/features/competition-core/adapters/legacyAdapter.js",
  "src/features/competition-core/participants/index.js",
  "src/features/competition-core/participants/contracts/index.js",
  "src/features/competition-core/participants/validators/index.js",
  "src/features/competition-core/participants/mappings/index.js",
  "src/features/competition-core/participants/ports/index.js",
  "src/features/competition-core/participants/dto/index.js",
  "scripts/ci/unit-test-files.json",
  "scripts/ci/competition-architecture-lock.mjs",
  "scripts/ci/competition-architecture-lock-baseline.json",
  "scripts/ci/competition-shared-file-ownership.mjs",
  "package.json",
]);

/** Phases allowed to touch protected files. */
export const INTEGRATOR_ALLOWED_PHASES = Object.freeze([
  "3a3",
  "integrator",
  "i",
  "3m",
  "3n",
  "3p",
]);

/**
 * @param {string} phase
 * @returns {boolean}
 */
export function isIntegratorPhase(phase) {
  const p = String(phase || "")
    .trim()
    .toLowerCase()
    .replace(/^phase-?/, "");
  return INTEGRATOR_ALLOWED_PHASES.includes(p);
}

/**
 * @param {string} file
 * @returns {string}
 */
export function normalizeRepoPath(file) {
  return String(file || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .trim();
}

/**
 * @param {string[]} changedFiles
 * @param {string} phase
 * @returns {{ ok: boolean, violations: string[], protectedTouched: string[] }}
 */
export function validateSharedFileOwnership(changedFiles, phase) {
  const files = (changedFiles || []).map(normalizeRepoPath).filter(Boolean);
  const protectedTouched = files.filter((f) =>
    COMPETITION_PROTECTED_FILES.includes(f)
  );

  if (isIntegratorPhase(phase)) {
    return { ok: true, violations: [], protectedTouched };
  }

  return {
    ok: protectedTouched.length === 0,
    violations: protectedTouched,
    protectedTouched,
  };
}

function parseArgs(argv) {
  /** @type {{ phase: string|null, files: string[], listProtected: boolean }} */
  const out = { phase: null, files: [], listProtected: false };
  for (const arg of argv) {
    if (arg === "--list-protected") {
      out.listProtected = true;
    } else if (arg.startsWith("--phase=")) {
      out.phase = arg.slice("--phase=".length);
    } else if (arg.startsWith("--files=")) {
      const raw = arg.slice("--files=".length);
      if (raw === "-") {
        const stdin = readFileSync(0, "utf8");
        out.files = stdin
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
      } else if (raw) {
        out.files = raw.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.listProtected) {
    for (const f of COMPETITION_PROTECTED_FILES) {
      console.log(f);
    }
    process.exit(0);
  }

  if (!args.phase) {
    console.error(
      "usage: competition-shared-file-ownership.mjs --phase=<id> --files=a,b | --files=-"
    );
    process.exit(2);
  }

  const result = validateSharedFileOwnership(args.files, args.phase);
  if (!result.ok) {
    console.error(
      `shared-file ownership violation for phase=${args.phase}:`
    );
    for (const v of result.violations) {
      console.error(`  PROTECTED: ${v}`);
    }
    console.error(
      "Capability chats must not edit Integrator-protected files. Route via CHAT I."
    );
    process.exit(1);
  }

  console.log(
    `shared-file ownership OK (phase=${args.phase}, files=${args.files.length}, protectedTouched=${result.protectedTouched.length})`
  );
  process.exit(0);
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main();
}
