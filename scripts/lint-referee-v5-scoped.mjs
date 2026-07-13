#!/usr/bin/env node
/**
 * Referee V5 scoped ESLint — excludes legacy repo errors.
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, "..");

const targets = [
  "src/features/referee-v5",
  "tests/referee-v5",
  "tests/ui/referee-v5-c.test.jsx",
  "scripts/referee-v5-staging-harness.mjs",
  "scripts/reset-staging-browser-e2e-passwords.mjs",
  "scripts/verify-referee-v5-atomic-rollback-staging.mjs",
  "scripts/verify-referee-v5-fault-security-staging.mjs",
  "scripts/verify-referee-v5-multi-device-staging.mjs",
  "scripts/verify-referee-v5-replay-staging.mjs",
  "scripts/verify-referee-v5-browser-e2e-staging.mjs",
  "scripts/verify-referee-v5-d41-browser-e2e-staging.mjs",
  "scripts/verify-referee-v5-rollback-rehearsal-staging.mjs",
  "scripts/verify-referee-v5-d4-staging-closure.mjs",
  "scripts/verify-referee-v5-d41-staging-closure.mjs",
  "scripts/apply-phase-v5d4-staging.mjs",
  "scripts/deploy-referee-v5-preview-staging.mjs",
  "scripts/ensure-staging-qa-password-env.mjs",
  "scripts/apply-phase-v5e1-staging.mjs",
  "scripts/verify-referee-v5-e1-realtime-browser-staging.mjs",
  "scripts/verify-referee-v5-e1-staging-closure.mjs",
  "src/features/referee-v5/realtime",
  "src/features/referee-v5/hooks/useRefereeRealtimeSync.js",
  "src/features/referee-v5/constants/realtimeConnectionStates.js",
  "tests/referee-v5/referee-v5-e1-realtime.test.js",
  "scripts/lint-referee-v5-scoped.mjs",
].join(" ");

let errors = 0;
try {
  execSync(`npx eslint ${targets}`, { cwd: projectRoot, stdio: "inherit" });
} catch {
  errors = 1;
}

console.log(`\nReferee V5 scoped lint: ${errors === 0 ? "PASS" : "FAIL"}`);
process.exit(errors);
