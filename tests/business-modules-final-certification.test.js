/**
 * BUSINESS-MODULES-FINAL-02 — Consolidated certification contracts.
 *
 * Offline only. Does not connect to Staging or Production.
 * Does not apply SQL. Does not mutate databases.
 *
 * Run:
 *   node --test tests/business-modules-final-certification.test.js
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACK = path.join(
  ROOT,
  "docs",
  "business-modules",
  "final-certification-closure"
);

const REQUIRED_DOCS = [
  "README.md",
  "13_MODULE_FINAL_STATUS.md",
  "CROSS_MODULE_INTEGRATION_MATRIX.md",
  "OWNERSHIP_BOUNDARY_CERTIFICATION.md",
  "PLAYER_RATING_SSOT_CERTIFICATION.md",
  "COURT_RUNTIME_AUTHORITY_CERTIFICATION.md",
  "CRM_SAFETY_CERTIFICATION.md",
  "MODULE_CLOSURE_RECONCILIATION_REFERENCE.md",
  "MOCK_LOCALSTORAGE_FALLBACK_AUDIT.md",
  "TEST_CERTIFICATION.md",
  "MERGE_POSTMERGE_CLEANUP_EVIDENCE.md",
  "DEFERRED_PRODUCTION_GATES.md",
  "FINAL_CLOSURE_MANIFEST.json",
];

const EXPECTED_MODULE_CLASSIFICATIONS = {
  venue: "FULLY_COMPLETED_CLOSED",
  courtOperations: "FULLY_COMPLETED_CLOSED",
  club: "STRUCTURAL_FOUNDATION_COMPLETE",
  customer: "FULLY_COMPLETED_CLOSED",
  player: "FULLY_COMPLETED_CLOSED",
  playerRating: "FULLY_COMPLETED_CLOSED",
  ranking: "FULLY_COMPLETED_CLOSED",
  finance: "STRUCTURAL_FOUNDATION_COMPLETE",
  crm: "STRUCTURAL_FOUNDATION_COMPLETE",
  reporting: "FULLY_COMPLETED_CLOSED",
  news: "FULLY_COMPLETED_CLOSED",
  coaching: "FULLY_COMPLETED_CLOSED",
  competition: "FULLY_COMPLETED_CLOSED",
};

const VALID_MARKERS = [
  "BUSINESS_MODULES_CONSOLIDATED_FINAL_INTEGRATION_CERTIFIED",
  "BUSINESS_MODULES_13_OF_13_IMPLEMENTATION_STRUCTURAL_SCOPE_CLOSED",
  "BUSINESS_MODULES_FINAL_IMPLEMENTATION_CLOSURE_COMPLETE",
];

const FORBIDDEN_MARKERS = [
  "BUSINESS_MODULES_13_OF_13_FULLY_COMPLETED_CLOSED",
  "BUSINESS_MODULES_13_OF_13_PRODUCTION_READY",
];

const PRIOR_EVIDENCE = [
  "docs/business-modules/module-closure-reconciliation/CLOSURE_RECONCILIATION_MANIFEST.json",
  "docs/business-modules/module-closure-reconciliation/MODULE_STATUS_MATRIX.md",
  "docs/business-modules/final-evidence/bm-final-evidence-01/01_NEWS_POST_MERGE_VERIFICATION.md",
  "docs/business-modules/final-evidence/bm-final-evidence-01/02_COACHING_POST_MERGE_VERIFICATION.md",
  "docs/business-modules/final-evidence/bm-final-evidence-01/03_REPORTING_EVIDENCE_NORMALIZATION.md",
  "docs/business-modules/final-evidence/bm-final-evidence-01/06_DEFERRED_GATE_REGISTER.json",
  "docs/court-operations/bm-final-court-01-runtime-persistence-authority/README.md",
  "docs/player-rating/bm-final-rating-01/01_CANONICAL_SSOT_DECISION.md",
  "docs/crm/bm-final-safety-01/README.md",
  "docs/coaching-training/module-closure/00_BUSINESS_MODULE_2_12_CLOSURE.md",
  "docs/reporting-analytics/reporting-05/02_BUSINESS_MODULE_2_10_CLOSURE.md",
  "docs/competition-engine/e2e-07/12_FINAL_CLOSURE_READINESS.md",
];

const CANONICAL_SOURCE_PATHS = [
  "src/features/venue-court/index.js",
  "src/features/court-engine/runtime/resolveCourtRuntimeAuthority.js",
  "src/features/club/index.js",
  "src/features/customer/index.js",
  "src/features/player/index.js",
  "src/features/player-rating/foundation/index.js",
  "src/features/vpr-ranking/index.js",
  "src/features/finance/index.js",
  "src/features/crm/index.js",
];

/**
 * LF-canonical pins for package/lock integrity.
 * Computed as SHA-256 of UTF-8 text after BOM strip and CRLF/CR → LF.
 * Matches fresh origin/main and Linux CI checkout; not Windows raw CRLF bytes.
 */
const EXPECTED_PACKAGE_JSON_SHA256_LF =
  "D9F756CC931E32B03E48DA0C70729F4D68D30022A8D1C1E4189E4D4962E7326B";
const EXPECTED_PACKAGE_LOCK_SHA256_LF =
  "D40DB46D2356A87F589DF86C8F9CC369A7F97A332DFCF3AEC8CA335EE07F2516";

/**
 * @param {string} filePath
 * @returns {string}
 */
function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

/**
 * @param {string} text
 * @returns {string}
 */
function canonicalizeText(text) {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

/**
 * @param {string} text
 * @returns {string}
 */
function sha256CanonicalText(text) {
  return crypto
    .createHash("sha256")
    .update(canonicalizeText(text), "utf8")
    .digest("hex")
    .toUpperCase();
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function sha256CanonicalTextFile(filePath) {
  return sha256CanonicalText(fs.readFileSync(filePath, "utf8"));
}

test("FINAL-02 closure pack documents are present", () => {
  for (const name of REQUIRED_DOCS) {
    const full = path.join(PACK, name);
    assert.ok(fs.existsSync(full), `missing pack file: ${name}`);
  }
});

test("FINAL_CLOSURE_MANIFEST counts and classification are exact", () => {
  const manifest = JSON.parse(read(path.join(PACK, "FINAL_CLOSURE_MANIFEST.json")));

  assert.equal(manifest.moduleCount, 13);
  assert.equal(manifest.fullyClosedCount, 10);
  assert.equal(manifest.structuralFoundationCompleteCount, 3);
  assert.equal(manifest.implementationStructuralScopeClosedCount, 13);
  assert.equal(manifest.activeImplementationGapCount, 0);
  assert.equal(manifest.evidenceGapCount, 0);
  assert.equal(manifest.ownershipDuplicationCount, 0);
  assert.equal(manifest.canonicalWriterConflictCount, 0);
  assert.equal(manifest.crossModuleBlockerCount, 0);
  assert.equal(manifest.productionReadyCount, null);
  assert.equal(manifest.productionReadyPercentageCertified, false);
  assert.equal(manifest.uiCompletePercentageCertified, false);
  assert.equal(manifest.productionRolloutDeferred, true);
  assert.equal(manifest.deferredGateCount, 36);
  assert.equal(manifest.deferredGates.length, 36);
  assert.equal(manifest.databaseMutationsDuringWorkstream, 0);
  assert.equal(manifest.stagingMutationsDuringWorkstream, 0);
  assert.equal(manifest.productionConnections, 0);
  assert.equal(manifest.productionMutations, 0);
  assert.equal(manifest.incidentEvidence.copied, false);
  assert.equal(
    manifest.incidentEvidence.expectedSha256,
    "AA68D276A2E357101AD164E3B6038F30ECEB7C24B46A4FF66A10026EB78767A5"
  );

  for (const [key, expected] of Object.entries(EXPECTED_MODULE_CLASSIFICATIONS)) {
    assert.equal(
      manifest.moduleClassifications[key],
      expected,
      `classification mismatch for ${key}`
    );
  }

  const fully = Object.values(manifest.moduleClassifications).filter(
    (v) => v === "FULLY_COMPLETED_CLOSED"
  ).length;
  const structural = Object.values(manifest.moduleClassifications).filter(
    (v) => v === "STRUCTURAL_FOUNDATION_COMPLETE"
  ).length;
  assert.equal(fully, 10);
  assert.equal(structural, 3);
  assert.equal(Object.keys(manifest.moduleClassifications).length, 13);
});

test("valid markers present and forbidden markers absent", () => {
  const manifest = JSON.parse(read(path.join(PACK, "FINAL_CLOSURE_MANIFEST.json")));
  assert.deepEqual(manifest.closureMarkers, VALID_MARKERS);
  assert.deepEqual(manifest.forbiddenMarkers, FORBIDDEN_MARKERS);

  const readme = read(path.join(PACK, "README.md"));
  for (const marker of VALID_MARKERS) {
    assert.match(readme, new RegExp(marker));
  }

  const allowedSection =
    readme.split("## Valid markers")[1]?.split("## Forbidden markers")[0] || "";
  const forbiddenSection = readme.split("## Forbidden markers")[1] || "";
  for (const marker of FORBIDDEN_MARKERS) {
    assert.equal(
      allowedSection.includes(marker),
      false,
      `forbidden marker in valid section: ${marker}`
    );
    assert.equal(
      forbiddenSection.includes(marker),
      true,
      `forbidden marker missing from forbidden section: ${marker}`
    );
    assert.equal(
      manifest.closureMarkers.includes(marker),
      false,
      `forbidden marker issued as closure marker: ${marker}`
    );
  }
});

test("13-module status and structural-only set are locked", () => {
  const status = read(path.join(PACK, "13_MODULE_FINAL_STATUS.md"));
  assert.match(status, /fullyClosedCount[\s`|]*10/);
  assert.match(status, /structuralFoundationCompleteCount[\s`|]*3/);
  assert.match(status, /implementationStructuralScopeClosedCount[\s`|]*13/);
  assert.match(status, /activeImplementationGapCount[\s`|]*0/);
  assert.match(status, /Club Management/);
  assert.match(status, /Finance/);
  assert.match(status, /\bCRM\b/);
  assert.match(status, /13\/13 = \*\*100%\*\*/);
  assert.match(status, /10\/13 = \*\*76\.9%\*\*/);
  assert.match(status, /3\/13 = \*\*23\.1%\*\*/);
  assert.match(status, /Production-ready percentage[\s\S]*not certified/i);
  assert.match(status, /UI-complete percentage[\s\S]*not certified/i);
  assert.doesNotMatch(status, /13\/13 FULLY_COMPLETED_CLOSED/);
});

test("ownership, court, rating, CRM safety docs certify integrity", () => {
  const ownership = read(path.join(PACK, "OWNERSHIP_BOUNDARY_CERTIFICATION.md"));
  assert.match(ownership, /\*\*ownershipDuplicationCount:\*\* `0`/);
  assert.match(ownership, /\*\*canonicalWriterConflictCount:\*\* `0`/);

  const court = read(path.join(PACK, "COURT_RUNTIME_AUTHORITY_CERTIFICATION.md"));
  assert.match(court, /a01f2640/);
  assert.match(court, /COURT_OPERATIONS_POST_MERGE_VERIFIED_CLOSED/);
  assert.match(court, /localStorage is \*\*not\*\* canonical/i);

  const rating = read(path.join(PACK, "PLAYER_RATING_SSOT_CERTIFICATION.md"));
  assert.match(rating, /2fbffcc8/);
  assert.match(rating, /PLAYER_RATING_POST_MERGE_VERIFIED_CLOSED/);
  assert.match(rating, /player-rating\/foundation/);

  const crm = read(path.join(PACK, "CRM_SAFETY_CERTIFICATION.md"));
  assert.match(crm, /BM_FINAL_SAFETY_01_STAGING_REMEDIATION_PASS/);
  assert.match(crm, /STRUCTURAL_FOUNDATION_COMPLETE/);
  assert.match(crm, /AA68D276A2E357101AD164E3B6038F30ECEB7C24B46A4FF66A10026EB78767A5/);
  assert.match(crm, /not\*\* copied|\*\*not\*\* copied/i);
});

test("cross-module matrix and mock/localStorage audit report zero blockers", () => {
  const matrix = read(path.join(PACK, "CROSS_MODULE_INTEGRATION_MATRIX.md"));
  assert.match(matrix, /\*\*Cross-module blockers:\*\* \*\*0\*\*/);
  assert.match(matrix, /Ownership duplication[\s\S]*0/);
  assert.match(matrix, /Canonical writer conflicts[\s\S]*0/);

  const audit = read(path.join(PACK, "MOCK_LOCALSTORAGE_FALLBACK_AUDIT.md"));
  assert.match(audit, /\*\*Canonical dual-write \/ silent-success conflicts:\*\* \*\*0\*\*/);
  assert.match(audit, /mock-only/i);
  assert.match(audit, /deferredGate != implementationGap/);
});

test("deferred gates register is complete and non-gap", () => {
  const gates = read(path.join(PACK, "DEFERRED_PRODUCTION_GATES.md"));
  assert.match(gates, /deferredGate != implementationGap/);
  assert.match(gates, /productionRolloutDeferred:\*\* `true`/);
  assert.match(gates, /FINANCE_LIVE_PAYMENT_PROVIDER/);
  assert.match(gates, /CRM_ROLE_MATRIX_ORDER_8_APPLY/);
  assert.match(gates, /PLAYER_RATING_PRODUCTION_CUTOVER/);
  assert.match(gates, /NEWS_PRODUCTION_ROLLOUT/);
  assert.match(gates, /CLUB_PHASE_2H_OWNER_GO/);

  const manifest = JSON.parse(read(path.join(PACK, "FINAL_CLOSURE_MANIFEST.json")));
  assert.equal(manifest.deferredGates.includes("FINANCE_LIVE_PAYMENT_PROVIDER"), true);
  assert.equal(manifest.deferredGates.includes("CRM_PRODUCTION_ROLLOUT"), true);
});

test("prior committed evidence remains present (no reopen)", () => {
  for (const rel of PRIOR_EVIDENCE) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `missing prior evidence: ${rel}`);
  }
});

test("canonical module source facades exist on disk", () => {
  for (const rel of CANONICAL_SOURCE_PATHS) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `missing source: ${rel}`);
  }
});

test("package and lock hashes match baseline; court authority fail-closed remains", () => {
  assert.equal(
    sha256CanonicalText("alpha\nbeta\n"),
    sha256CanonicalText("alpha\r\nbeta\r\n")
  );
  assert.equal(
    sha256CanonicalText("alpha\nbeta\n"),
    sha256CanonicalText("alpha\rbeta\r")
  );

  const pkgHash = sha256CanonicalTextFile(path.join(ROOT, "package.json"));
  const lockHash = sha256CanonicalTextFile(path.join(ROOT, "package-lock.json"));
  assert.equal(pkgHash, EXPECTED_PACKAGE_JSON_SHA256_LF);
  assert.equal(lockHash, EXPECTED_PACKAGE_LOCK_SHA256_LF);

  const src = read(
    path.join(
      ROOT,
      "src/features/court-engine/runtime/resolveCourtRuntimeAuthority.js"
    )
  );
  assert.match(src, /Never infer local mode from cloud \/ RPC failure/);
  assert.match(src, /isSecureDeployEnv/);
});

test("merge evidence pins BM-FINAL prerequisite merges", () => {
  const merge = read(path.join(PACK, "MERGE_POSTMERGE_CLEANUP_EVIDENCE.md"));
  assert.match(merge, /403462a1a2693c01c31702e84859cc83de0ee026/);
  assert.match(merge, /2fbffcc8/);
  assert.match(merge, /a01f2640/);
  assert.match(merge, /93191f61/);
  assert.match(merge, /7866e775/);
  assert.match(merge, /Residual cleanup executed in FINAL-02[\s\S]*\*\*NO\*\*/);
});
