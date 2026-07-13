#!/usr/bin/env node
/**
 * V5-D.3 staging closure orchestrator.
 * Requires: SUPABASE_ACCESS_TOKEN (deploy), STAGING_SUPABASE_ANON_KEY (JWT tests)
 */
import { execSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";

loadProjectEnv();

const pat = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const service = String(process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "").trim();
const anon = String(process.env.STAGING_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();

console.log("=== Referee V5-D.3 Staging Closure ===");
console.log(`SUPABASE_ACCESS_TOKEN: ${pat ? "PRESENT" : "MISSING"}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${service ? "CONFIGURED" : "MISSING"}`);
console.log(`STAGING_SUPABASE_ANON_KEY: ${anon ? "PRESENT" : "MISSING"}\n`);

const steps = [
  { name: "seed", cmd: "node scripts/seed-referee-v5-test-staging.mjs", needsPat: true },
  { name: "bundle", cmd: "node scripts/bundle-referee-v5-edge-shared.mjs", needsPat: false },
  { name: "deploy", cmd: "node scripts/deploy-referee-v5-edge-staging.mjs", needsPat: true },
  { name: "http-verify", cmd: "node scripts/verify-referee-v5-http-concurrency-staging.mjs", needsPat: false },
  { name: "unit-tests", cmd: "node --test tests/referee-v5/*.test.js", needsPat: false },
];

for (const step of steps) {
  if (step.needsPat && !pat) {
    console.log(`SKIP ${step.name} — SUPABASE_ACCESS_TOKEN missing`);
    continue;
  }
  console.log(`\n--- ${step.name} ---`);
  execSync(step.cmd, { stdio: "inherit" });
}

console.log("\nDone. See docs/v5/referee-v5/V5-D3_FINAL_VERDICT.md");
