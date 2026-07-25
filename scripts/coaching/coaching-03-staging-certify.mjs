#!/usr/bin/env node
/**
 * COACHING-03 — Staging certification checklist (plan / dry by default).
 * Does not create fixtures. Does not mutate database in this phase.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  COACHING_03_CANONICAL_TABLES,
  COACHING_03_EVIDENCE_DIR,
  COACHING_03_TEST_PREFIX,
  getCoaching03RepoRoot,
  verifyCoaching03MigrationManifest,
  verifyCoaching03RoleMatrixCompleteness,
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

  if (execute) {
    const refused = {
      phase: "COACHING-03",
      script: "coaching-03-staging-certify",
      ok: false,
      message:
        "Certify --execute refused until Gate D apply complete and Owner authorizes Gate E.",
      sqlApplied: false,
      fixturesCreated: false,
      databaseWrites: 0,
      secretsPrinted: false,
    };
    writeEvidence(repoRoot, "CERTIFY_REFUSED.json", refused);
    console.log(JSON.stringify(refused, null, 2));
    process.exit(1);
  }

  const matrixPath = path.join(
    repoRoot,
    "docs/coaching-training/coaching-03/04_COACHING_03_CERTIFICATION_MATRIX.md"
  );
  const matrixDoc = readFileSync(matrixPath, "utf8");
  const requiredSections = [
    "## A. Schema",
    "## B. Authorization",
    "## C. Atomic attendance correction",
    "## D. Atomic entitlement consumption",
    "## E. Append-only protection",
    "## F. Runtime adapter",
  ];
  const missing = requiredSections.filter((s) => !matrixDoc.includes(s));

  const report = {
    phase: "COACHING-03",
    script: "coaching-03-staging-certify",
    mode: "plan-only",
    ok: missing.length === 0,
    canonicalTableCount: COACHING_03_CANONICAL_TABLES.length,
    canonicalTables: COACHING_03_CANONICAL_TABLES,
    fixturePrefix: COACHING_03_TEST_PREFIX,
    certificationSectionsPresent: requiredSections.filter((s) =>
      matrixDoc.includes(s)
    ),
    missingSections: missing,
    manifest: verifyCoaching03MigrationManifest({ repoRoot }),
    roleMatrix: verifyCoaching03RoleMatrixCompleteness(),
    fixturesCreated: false,
    sqlApplied: false,
    databaseWrites: 0,
    runtimeCutover: false,
    secretsPrinted: false,
    finishedAt: new Date().toISOString(),
  };
  writeEvidence(repoRoot, "CERTIFY_PLAN.json", report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main();
