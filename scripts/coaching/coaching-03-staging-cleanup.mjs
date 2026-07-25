#!/usr/bin/env node
/**
 * COACHING-03 — Fixture cleanup plan / dry-run (Gate F).
 *
 * DEFAULT: refuse destructive cleanup.
 * Does not delete shared QA principals.
 * Does not run destructive SQL in this phase.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  COACHING_03_EVIDENCE_DIR,
  COACHING_03_TEST_PREFIX,
  getCoaching03RepoRoot,
} from "../../src/features/coaching/staging/index.js";

function writeEvidence(repoRoot, filename, payload) {
  const dir = path.join(repoRoot, COACHING_03_EVIDENCE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

function main() {
  const repoRoot = getCoaching03RepoRoot();
  const execute = process.argv.includes("--execute");

  const planPath = path.join(
    repoRoot,
    "docs/coaching-training/coaching-03/06_COACHING_03_RUNTIME_CERTIFICATION_PLAN.md"
  );
  const planDoc = readFileSync(planPath, "utf8");

  const cleanupPlan = {
    fixturePrefix: COACHING_03_TEST_PREFIX,
    creationOrder: [
      "programs",
      "curricula/lessons",
      "coaches/relationships",
      "enrollments",
      "packages/entitlements",
      "sessions",
      "attendance",
      "evaluations",
    ],
    cleanupOrder: [
      "evaluations (mutable)",
      "attendance mutable",
      "sessions",
      "usage/entitlements/packages (prefix-scoped mutable)",
      "enrollments",
      "relationships/coaches",
      "lessons/curricula",
      "programs",
      "verify residual prefix rows = 0",
      "verify no residual cert-only role grants",
    ],
    idempotent: true,
    preserveSharedQaPrincipals: true,
    noAuthUserDeletion: true,
  };

  if (execute) {
    const refused = {
      phase: "COACHING-03",
      script: "coaching-03-staging-cleanup",
      ok: false,
      APPLY_MODE: "REFUSED",
      message:
        "Cleanup --execute refused: no fixtures were created in this phase; Owner GO for Gate F not granted.",
      fixturesDeleted: 0,
      databaseWrites: 0,
      sqlApplied: false,
      secretsPrinted: false,
    };
    writeEvidence(repoRoot, "CLEANUP_REFUSED.json", refused);
    console.log(JSON.stringify(refused, null, 2));
    process.exit(1);
  }

  const report = {
    phase: "COACHING-03",
    script: "coaching-03-staging-cleanup",
    mode: "plan-only",
    ok: planDoc.includes(COACHING_03_TEST_PREFIX),
    cleanupPlan,
    fixturesCreated: false,
    fixturesDeleted: 0,
    residualExpected: 0,
    databaseWrites: 0,
    sqlApplied: false,
    secretsPrinted: false,
    finishedAt: new Date().toISOString(),
  };
  writeEvidence(repoRoot, "CLEANUP_PLAN.json", report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main();
