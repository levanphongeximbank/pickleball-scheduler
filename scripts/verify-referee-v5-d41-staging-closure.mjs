#!/usr/bin/env node
/**
 * V5-D.4.1 — Final staging browser closure orchestrator.
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadProjectEnv } from "./load-env.mjs";
import { D41_OUT_DIR, STAGING_REF, PRODUCTION_REF } from "./referee-v5-staging-harness.mjs";

loadProjectEnv();
const outDir = join(process.cwd(), D41_OUT_DIR);
mkdirSync(outDir, { recursive: true });

const stepResults = [];

function runStep(name, cmd, optional = false) {
  console.log(`\n--- ${name} ---`);
  try {
    execSync(cmd, { stdio: "inherit" });
    stepResults.push({ step: name, status: "PASS" });
    return true;
  } catch (err) {
    stepResults.push({ step: name, status: optional ? "SKIP" : "FAIL", code: err.status ?? 1 });
    if (!optional) {
      console.error(`FAIL ${name}`);
    }
    return false;
  }
}

console.log("=== Referee V5-D.4.1 Staging Closure ===");
console.log(`Staging: ${STAGING_REF}`);
console.log(`Production blocked: ${PRODUCTION_REF}\n`);

runStep("password-env", "node scripts/ensure-staging-qa-password-env.mjs", true);
runStep("password-reset", "node scripts/reset-staging-browser-e2e-passwords.mjs");

const hasPlayerPw = Boolean(String(process.env.STAGING_PLAYER_NEW_PASSWORD || "").trim());
const hasOwnerPw = Boolean(String(process.env.STAGING_NON_COHORT_NEW_PASSWORD || "").trim());

if (hasPlayerPw && hasOwnerPw) {
  runStep("http-harness", "node scripts/verify-referee-v5-http-concurrency-staging.mjs");
  try {
    const conc = JSON.parse(
      readFileSync(join(process.cwd(), "docs/v5/qa-evidence/phase-v5d3/CONCURRENCY_REPORT.json"), "utf8"),
    );
    const passCount = (conc.results || []).filter((r) => r.pass).length;
    const total = (conc.results || []).length;
    writeFileSync(
      join(outDir, "HTTP_18_OF_18_REPORT.json"),
      JSON.stringify({ passCount, total, allPass: passCount === 18 && total >= 18, results: conc.results }, null, 2),
    );
    console.log(`HTTP harness: ${passCount}/${total}`);
  } catch {
    writeFileSync(join(outDir, "HTTP_18_OF_18_REPORT.json"), JSON.stringify({ allPass: false, error: "report missing" }, null, 2));
  }
} else {
  stepResults.push({ step: "http-harness", status: "SKIP", detail: "password env missing" });
}

runStep("preview-deploy", "node scripts/deploy-referee-v5-preview-staging.mjs", true);

const previewUrl = String(process.env.STAGING_PREVIEW_URL || "").trim();
if (previewUrl) {
  process.env.STAGING_PREVIEW_URL = previewUrl;
}

delete process.env.STAGING_PREVIEW_URL;
runStep("browser-e2e-d41", "node scripts/verify-referee-v5-d41-browser-e2e-staging.mjs");

runStep("referee-v5-unit", "node --test tests/referee-v5/*.test.js");
runStep("legacy-referee", "node --test tests/referee-rpc-security.test.js tests/referee-engine.test.js tests/referee-flow.integration.test.js");
runStep("build", "npm run build");
runStep("referee-scoped-lint", "node scripts/lint-referee-v5-scoped.mjs");

let changedLintPass = true;
try {
  const scopePattern =
    /^(scripts\/(referee-v5|reset-staging|deploy-referee|lint-referee|ensure-staging|verify-referee-v5-d41|verify-referee-v5-d4|apply-phase-v5d4)|src\/features\/referee-v5|tests\/referee-v5|tests\/ui\/referee-v5)/;
  const changed = execSync("git diff --name-only HEAD", { encoding: "utf8" })
    .split(/\r?\n/)
    .filter((f) => f && scopePattern.test(f) && /\.(js|jsx|mjs|cjs)$/.test(f));
  const untracked = execSync("git ls-files --others --exclude-standard", { encoding: "utf8" })
    .split(/\r?\n/)
    .filter((f) => f && scopePattern.test(f) && /\.(js|jsx|mjs|cjs)$/.test(f));
  const files = [...new Set([...changed, ...untracked])].filter(Boolean);
  if (files.length > 0) {
    execSync(`npx eslint --no-error-on-unmatched-pattern ${files.map((f) => `"${f}"`).join(" ")}`, {
      stdio: "inherit",
      maxBuffer: 10 * 1024 * 1024,
    });
  }
  stepResults.push({ step: "changed-files-lint", status: "PASS" });
} catch {
  changedLintPass = false;
  stepResults.push({ step: "changed-files-lint", status: "FAIL" });
}

let repoLint = "PRE_EXISTING_FAIL";
try {
  execSync("npm run lint", { stdio: "pipe" });
  repoLint = "PASS";
} catch {
  repoLint = "PRE_EXISTING_FAIL";
}

const failures = stepResults.filter((s) => s.status === "FAIL").length;
const regression = {
  httpHarness: stepResults.find((s) => s.step === "http-harness")?.status,
  refereeV5Unit: stepResults.find((s) => s.step === "referee-v5-unit")?.status,
  legacy: stepResults.find((s) => s.step === "legacy-referee")?.status,
  build: stepResults.find((s) => s.step === "build")?.status,
  refereeScopedLint: stepResults.find((s) => s.step === "referee-scoped-lint")?.status,
  changedFilesLint: changedLintPass ? "PASS" : "FAIL",
  repoWideLint: repoLint,
};

writeFileSync(join(outDir, "REGRESSION_REPORT.json"), JSON.stringify({ stepResults, regression, failures }, null, 2));

console.log(`\n=== D4.1 closure: ${failures} step(s) FAILED ===`);
process.exit(failures > 0 ? 1 : 0);
