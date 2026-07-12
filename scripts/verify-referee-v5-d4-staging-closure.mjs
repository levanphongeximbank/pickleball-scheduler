#!/usr/bin/env node
/**
 * V5-D.4 staging operational closure orchestrator.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadProjectEnv } from "./load-env.mjs";
import { D4_OUT_DIR } from "./referee-v5-staging-harness.mjs";

loadProjectEnv();
mkdirSync(join(process.cwd(), D4_OUT_DIR), { recursive: true });

const pat = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const steps = [
  { name: "apply-v5d4-sql", cmd: "node scripts/apply-phase-v5d4-staging.mjs", needsPat: true },
  { name: "seed", cmd: "node scripts/seed-referee-v5-test-staging.mjs", needsPat: true },
  { name: "atomic-rollback", cmd: "node scripts/verify-referee-v5-atomic-rollback-staging.mjs" },
  { name: "fault-security", cmd: "node scripts/verify-referee-v5-fault-security-staging.mjs" },
  { name: "multi-device", cmd: "node scripts/verify-referee-v5-multi-device-staging.mjs" },
  { name: "replay", cmd: "node scripts/verify-referee-v5-replay-staging.mjs" },
  { name: "browser-e2e", cmd: "node scripts/verify-referee-v5-browser-e2e-staging.mjs" },
  { name: "rollback-rehearsal", cmd: "node scripts/verify-referee-v5-rollback-rehearsal-staging.mjs" },
  { name: "http-harness", cmd: "node scripts/verify-referee-v5-http-concurrency-staging.mjs" },
  { name: "unit-tests", cmd: "node --test tests/referee-v5/*.test.js" },
  { name: "legacy-tests", cmd: "node --test tests/referee-rpc-security.test.js tests/referee-engine.test.js tests/referee-flow.integration.test.js" },
  { name: "build", cmd: "npm run build" },
  { name: "lint", cmd: "npm run lint" },
];

const stepResults = [];

console.log("=== Referee V5-D.4 Staging Closure ===\n");

for (const step of steps) {
  if (step.needsPat && !pat) {
    console.log(`SKIP ${step.name} — SUPABASE_ACCESS_TOKEN missing`);
    stepResults.push({ step: step.name, status: "SKIP" });
    continue;
  }
  console.log(`\n--- ${step.name} ---`);
  try {
    execSync(step.cmd, { stdio: "inherit" });
    stepResults.push({ step: step.name, status: "PASS" });
  } catch (err) {
    stepResults.push({ step: step.name, status: "FAIL", code: err.status ?? 1 });
    console.error(`FAIL ${step.name}`);
  }
}

const regression = {
  httpHarness: stepResults.find((s) => s.step === "http-harness")?.status,
  refereeV5Unit: stepResults.find((s) => s.step === "unit-tests")?.status,
  legacy: stepResults.find((s) => s.step === "legacy-tests")?.status,
  build: stepResults.find((s) => s.step === "build")?.status,
  lint: stepResults.find((s) => s.step === "lint")?.status,
};

writeFileSync(
  join(process.cwd(), D4_OUT_DIR, "REGRESSION_REPORT.json"),
  JSON.stringify({ stepResults, regression }, null, 2),
);

const failures = stepResults.filter((s) => s.status === "FAIL").length;
console.log(`\n=== D.4 closure: ${failures} step(s) FAILED ===`);
process.exit(failures > 0 ? 1 : 0);
