import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const packageRoot = path.resolve("docs/v7/production-execution");
const files = [
  "00_PRODUCTION_EXECUTION_AUTHORITY.md",
  "01_TARGET_AND_BASELINE_GUARD.md",
  "02_ORDERED_EXECUTION_LEDGER.json",
  "03_PREFLIGHT_CHECKLIST.md",
  "04_EXECUTION_RUNBOOK.md",
  "05_CANARY_AND_TRAFFIC_PLAN.md",
  "06_ROLLBACK_AND_RECOVERY_MATRIX.json",
  "07_POST_DEPLOY_VERIFICATION.md",
  "08_EXECUTION_EVIDENCE.template.json",
  "09_OWNER_GO_CHECKPOINT.md",
  "10_EXECUTION_AUTHORITY_INPUT.template.json",
  "MANIFEST.sha256",
  "PACKAGE_VALIDATION.json",
];

function gitBlobSha256(repoRelPath) {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const blob = execFileSync("git", ["cat-file", "blob", `${head}:${repoRelPath}`], { encoding: null });
  return crypto.createHash("sha256").update(blob).digest("hex").toUpperCase();
}

test("canonical production execution package is fully tracked and parseable", () => {
  for (const fileName of files) {
    assert.ok(fs.existsSync(path.join(packageRoot, fileName)), `${fileName} exists`);
  }

  const validation = JSON.parse(fs.readFileSync(path.join(packageRoot, "PACKAGE_VALIDATION.json"), "utf8"));
  assert.equal(validation.authoritySchemaVersion, 2);
  assert.equal(validation.fileCount, 13);
  assert.equal(validation.ledgerStepCount, 11);
  assert.equal(validation.manifestGitBlobDigestAuthority, "derive_from_approvedExecutionHead_git_blob");
  assert.ok(/^[A-F0-9]{64}$/.test(validation.preRemediationMainManifestGitBlobDigest));
  assert.ok(/^[A-F0-9]{64}$/.test(validation.stalePriorManifestAuthorityDigest));
  assert.ok(/^[A-F0-9]{64}$/.test(validation.checkoutDependentWorkingTreeDigestExample));
  assert.equal(validation.oldAuthoritySchemaAccepted, "NO");
  assert.equal(validation.checkoutDependentActiveDigestComparisons, 0);
  assert.equal(validation.staleActiveCd19AuthorityOccurrences, 0);
  assert.equal(validation.ed017ActiveAuthorityOccurrences, 0);
  assert.equal(validation.unresolvedDependencies, 0);
  assert.equal(validation.cycles, 0);
  assert.equal(validation.duplicateStepIds, 0);
  assert.equal(validation.missingArtifacts, 0);
  assert.equal(validation.untrackedArtifacts, 0);
  assert.equal(validation.checksumMismatches, 0);
  assert.equal(validation.hiddenManualSteps, 0);
  assert.equal(validation.undefinedAbortConditions, 0);
  assert.equal(validation.undefinedRollbackPoints, 0);
  assert.equal(validation.embeddedSecretFindings, 0);
  assert.equal(validation.staleActiveShaGuards, 0);
  assert.equal(validation.ambiguousShaAuthorities, 0);
  assert.ok(!Object.prototype.hasOwnProperty.call(validation, "packageManifestDigest"));
});

test("manifest lines match actual package file hashes", () => {
  const manifestLines = fs.readFileSync(path.join(packageRoot, "MANIFEST.sha256"), "utf8").trim().split(/\r?\n/);
  const actual = files
    .filter(fileName => fileName !== "MANIFEST.sha256")
    .map(fileName => {
      const repoRel = `docs/v7/production-execution/${fileName}`;
      return `${gitBlobSha256(repoRel)}  ${repoRel}`;
    });
  assert.deepEqual(manifestLines, actual);
});
