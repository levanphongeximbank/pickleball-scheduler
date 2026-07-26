/**
 * BM-FINAL-GAPS-02 — Module closure reconciliation evidence contracts.
 *
 * Offline only. Does not connect to Staging or Production.
 * Does not apply SQL. Does not mutate databases.
 *
 * Run:
 *   node --test tests/business-modules-gap-reconciliation.test.js
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACK = path.join(
  ROOT,
  "docs",
  "business-modules",
  "module-closure-reconciliation"
);

const REQUIRED_DOCS = [
  "README.md",
  "MODULE_STATUS_MATRIX.md",
  "VENUE_CLOSURE_EVIDENCE.md",
  "COURT_OPERATIONS_POST_MERGE_CLOSURE.md",
  "CLUB_CLOSURE_EVIDENCE.md",
  "CUSTOMER_CLOSURE_EVIDENCE.md",
  "PLAYER_CLOSURE_EVIDENCE.md",
  "PLAYER_RATING_POST_MERGE_CLOSURE.md",
  "RANKING_CLOSURE_EVIDENCE.md",
  "FINANCE_SCOPE_RECONCILIATION.md",
  "CRM_SCOPE_RECONCILIATION.md",
  "DEFERRED_GATES_REGISTER.md",
  "TEST_CERTIFICATION.md",
  "CLOSURE_RECONCILIATION_MANIFEST.json",
];

const ALLOWED_CLASSIFICATIONS = new Set([
  "FULLY_COMPLETED_CLOSED",
  "IMPLEMENTED_MISSING_CLOSURE_EVIDENCE",
  "STRUCTURAL_FOUNDATION_COMPLETE",
  "ACTIVE_IMPLEMENTATION_GAP",
  "BLOCKED_BY_DEPENDENCY",
  "OWNERSHIP_DUPLICATION",
]);

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
};

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

const PRIOR_CLOSURE_EVIDENCE = [
  "docs/business-modules/final-evidence/bm-final-evidence-01/01_NEWS_POST_MERGE_VERIFICATION.md",
  "docs/business-modules/final-evidence/bm-final-evidence-01/02_COACHING_POST_MERGE_VERIFICATION.md",
  "docs/business-modules/final-evidence/bm-final-evidence-01/03_REPORTING_EVIDENCE_NORMALIZATION.md",
  "docs/coaching-training/module-closure/00_BUSINESS_MODULE_2_12_CLOSURE.md",
  "docs/reporting-analytics/reporting-05/02_BUSINESS_MODULE_2_10_CLOSURE.md",
  "docs/competition-engine/e2e-07/12_FINAL_CLOSURE_READINESS.md",
  "docs/court-operations/bm-final-court-01-runtime-persistence-authority/README.md",
  "docs/player-rating/bm-final-rating-01/01_CANONICAL_SSOT_DECISION.md",
  "docs/crm/bm-final-safety-01/README.md",
];

/**
 * @param {string} filePath
 * @returns {string}
 */
function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("BM-FINAL-GAPS-02 closure pack documents are present", () => {
  for (const name of REQUIRED_DOCS) {
    const full = path.join(PACK, name);
    assert.ok(fs.existsSync(full), `missing pack file: ${name}`);
  }
});

test("manifest counts and markers are consistent", () => {
  const manifest = JSON.parse(
    read(path.join(PACK, "CLOSURE_RECONCILIATION_MANIFEST.json"))
  );

  assert.equal(manifest.auditedModuleCount, 9);
  assert.equal(manifest.fullyClosedCount, 6);
  assert.equal(manifest.evidenceGapCount, 0);
  assert.equal(manifest.structuralOnlyCount, 3);
  assert.equal(manifest.activeImplementationGapCount, 0);
  assert.equal(manifest.ownershipDuplicationCount, 0);
  assert.equal(manifest.deferredGateCount, 36);
  assert.equal(manifest.courtPostMergeClosed, true);
  assert.equal(manifest.ratingPostMergeClosed, true);
  assert.equal(manifest.crmSafetyClosed, true);
  assert.equal(
    manifest.financeClassification,
    "STRUCTURAL_FOUNDATION_COMPLETE"
  );
  assert.equal(manifest.crmClassification, "STRUCTURAL_FOUNDATION_COMPLETE");
  assert.equal(manifest.productionUntouched, true);
  assert.equal(manifest.stagingMutationsDuringWorkstream, 0);

  assert.equal(manifest.activeImplementationGapCount === 0, true);
  assert.deepEqual(manifest.closureMarkers, [
    "BM_FINAL_GAPS_02_MODULE_SCOPE_RECONCILED",
    "BM_FINAL_GAPS_02_CLOSURE_EVIDENCE_COMPLETE",
    "BUSINESS_MODULES_READY_FOR_FINAL_02_RERUN",
  ]);

  for (const [key, expected] of Object.entries(EXPECTED_MODULE_CLASSIFICATIONS)) {
    assert.equal(
      manifest.moduleClassifications[key],
      expected,
      `classification mismatch for ${key}`
    );
    assert.ok(
      ALLOWED_CLASSIFICATIONS.has(manifest.moduleClassifications[key]),
      `invalid classification for ${key}`
    );
  }

  const fully = Object.values(manifest.moduleClassifications).filter(
    (v) => v === "FULLY_COMPLETED_CLOSED"
  ).length;
  const structural = Object.values(manifest.moduleClassifications).filter(
    (v) => v === "STRUCTURAL_FOUNDATION_COMPLETE"
  ).length;
  assert.equal(fully, manifest.fullyClosedCount);
  assert.equal(structural, manifest.structuralOnlyCount);
});

test("matrix and module docs use exclusive classifications", () => {
  const matrix = read(path.join(PACK, "MODULE_STATUS_MATRIX.md"));
  assert.match(matrix, /FULLY_COMPLETED_CLOSED/);
  assert.match(matrix, /STRUCTURAL_FOUNDATION_COMPLETE/);
  assert.match(matrix, /activeImplementationGapCount[\s`|]*0/);
  assert.match(matrix, /evidenceGapCount[\s`|]*0/);

  const finance = read(path.join(PACK, "FINANCE_SCOPE_RECONCILIATION.md"));
  assert.match(finance, /A\/B verdict/);
  assert.match(finance, /\*\*A\*\*/);
  assert.match(finance, /Option A confirmed/);
  assert.match(finance, /STRUCTURAL_FOUNDATION_COMPLETE/);
  assert.match(finance, /Why not `FULLY_COMPLETED_CLOSED`/);

  const crm = read(path.join(PACK, "CRM_SCOPE_RECONCILIATION.md"));
  assert.match(crm, /BM_FINAL_SAFETY_01_STAGING_REMEDIATION_PASS/);
  assert.match(crm, /one-time authorization/i);
  assert.match(crm, /Replay protection/i);
  assert.match(crm, /Terminal Production block/i);
  assert.match(crm, /PR #308|#308/);
  assert.match(crm, /not\*\* copied|\*\*not\*\* copied|not copied/i);

  const court = read(path.join(PACK, "COURT_OPERATIONS_POST_MERGE_CLOSURE.md"));
  assert.match(court, /a01f2640d4cba8e182de15560d64cd418f6203e2/);
  assert.match(court, /COURT_OPERATIONS_POST_MERGE_VERIFIED_CLOSED/);
  assert.match(court, /No dual-write/i);

  const rating = read(path.join(PACK, "PLAYER_RATING_POST_MERGE_CLOSURE.md"));
  assert.match(rating, /2fbffcc8f4e33550c43e078e53d57aeb72f8355b/);
  assert.match(rating, /PLAYER_RATING_POST_MERGE_VERIFIED_CLOSED/);
  assert.match(rating, /Competition Elo internal-only/i);

  const customer = read(path.join(PACK, "CUSTOMER_CLOSURE_EVIDENCE.md"));
  assert.match(customer, /phase-8/i);
  assert.match(customer, /auto-block/i);

  const ranking = read(path.join(PACK, "RANKING_CLOSURE_EVIDENCE.md"));
  assert.match(ranking, /Flag OFF/i);
  assert.match(ranking, /auto-block/i);
});
test("canonical module source facades exist on disk", () => {
  for (const rel of CANONICAL_SOURCE_PATHS) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `missing source: ${rel}`);
  }
});

test("prior closed-module evidence remains present (regression, no reopen)", () => {
  for (const rel of PRIOR_CLOSURE_EVIDENCE) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `missing prior evidence: ${rel}`);
  }
});

test("deferred gates register keeps deferredGate != implementationGap rule", () => {
  const text = read(path.join(PACK, "DEFERRED_GATES_REGISTER.md"));
  assert.match(text, /deferredGate != implementationGap/);
  assert.match(text, /FINANCE_LIVE_PAYMENT_PROVIDER/);
  assert.match(text, /CRM_ROLE_MATRIX_ORDER_8_APPLY/);
  assert.match(text, /PLAYER_RATING_PRODUCTION_CUTOVER/);
  assert.match(text, /RANKING_PRODUCTION_FLAG_ENABLEMENT/);
  assert.match(text, /CLUB_PHASE_2H_OWNER_GO/);
});

test("pack forbids treating incident evidence as in-repo copy", () => {
  const readme = read(path.join(PACK, "README.md"));
  assert.match(readme, /AA68D276A2E357101AD164E3B6038F30ECEB7C24B46A4FF66A10026EB78767A5/);
  assert.match(readme, /does \*\*not\*\* copy/i);

  const crm = read(path.join(PACK, "CRM_SCOPE_RECONCILIATION.md"));
  assert.match(crm, /not\*\* copied|\*\*not\*\* copied|not copied/i);
});
test("Court durable authority helper remains present (no silent local flip API)", () => {
  const src = read(
    path.join(
      ROOT,
      "src/features/court-engine/runtime/resolveCourtRuntimeAuthority.js"
    )
  );
  assert.match(src, /Never infer local mode from cloud \/ RPC failure/);
  assert.match(src, /isSecureDeployEnv/);
});
