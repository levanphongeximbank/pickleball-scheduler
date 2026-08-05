/**
 * Tournament Production Remediation — evidence package contracts
 * (commit-gate + runtime-authority counter reconciliation).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = join(root, "docs", "v5", "qa-evidence", "tournament-production-remediation");
const prelim = join(root, "docs", "tournament-production-remediation");

const REQUIRED_DOCS = [
  "00_BASELINE_AND_SAFETY.md",
  "01_OWNER_REPORTED_DEFECTS_2026-08-05.md",
  "TOURNAMENT_ROUTE_INVENTORY.md",
  "TOURNAMENT_RUNTIME_AUTHORITY_MATRIX.md",
  "TOURNAMENT_PRODUCTION_AUDIT_REPORT.md",
  "TOURNAMENT_REMEDIATION_PLAN.md",
  "TOURNAMENT_ROLLBACK_PLAN.md",
  "TOURNAMENT_TEST_PLAN.md",
  "TOURNAMENT_UI_DEFECT_LOG.md",
  "TOURNAMENT_PRODUCTION_READ_ONLY_QUERY_LOG.md",
];

const REQUIRED_JSON = [
  "TOURNAMENT_ROUTE_INVENTORY.json",
  "TOURNAMENT_RUNTIME_AUTHORITY_MATRIX.json",
  "TOURNAMENT_PRODUCTION_AUDIT_REPORT.json",
  "TOURNAMENT_UI_DEFECT_LOG.json",
  "TOURNAMENT_PRODUCTION_READ_ONLY_QUERY_LOG.json",
  "evidence/OWNER_REPORTED_DEFECTS_2026-08-05.json",
  "evidence/SCREENSHOT_MANIFEST_2026-08-05.json",
  "evidence/SCREENSHOT_INGEST_STATUS_2026-08-05.json",
  "evidence/STATIC_TENANT_SCOPE_CODE_AUDIT_2026-08-05.json",
  "evidence/PRODUCTION_MUTATION_LEDGER_2026-08-05.json",
  "evidence/RUNTIME_TRACE_2026-08-05.json",
  "evidence/RBAC_TENANT_ISOLATION_2026-08-05.json",
  "evidence/PRODUCTION_READ_ONLY_QUERY_RESULTS_2026-08-05.json",
  "evidence/INDEPENDENT_FINAL_REVIEW_2026-08-05.json",
  "evidence/COMMIT_GATE_CORRECTION_2026-08-05.json",
  "evidence/PRELIMINARY_EVIDENCE_RECONCILIATION_2026-08-05.json",
  "evidence/INDEPENDENT_REREVIEW_2026-08-05.json",
  "evidence/RUNTIME_AUTHORITY_COUNTER_RECONCILIATION_2026-08-05.json",
];

const EXPECTED_SHA256 = {
  "image(379).png": "55126ba868b23095ec604304043eaf255cf597338a8a83bc33d6c7572fd4320b",
  "image(380).png": "0a9b9ccab7507c175b4412439880c99097e65f7f6da66360cb5f3eaa515c5b86",
  "image(381).png": "3bcc2b7a9bef08b9381bdce8eb3d8e4be69beac995f6082c54fbfe172c9a9b7f",
  "image(382).png": "6014cdf4798f36e50d7fd692a978ee94e91b9c3d9ca38010f1c2c54e0491ac5b",
  "image(383).png": "7afead214366e97e1e2b8eb052689875b72a75b87ec8cc99b76966b5b9dd9bcc",
  "image(384).png": "38369a94f4dc182d4d64ecfa68795d1ca5f5c66531dedfd8fd57afad2935f1bf",
};

const PRIMARY = [
  "CANONICAL",
  "LEGACY",
  "DUPLICATE",
  "SHADOW",
  "DEAD",
  "UNRESOLVED",
];

const DW_REQUIRED = [
  "patternId",
  "businessObject",
  "writerAEntryPoint",
  "writerAService",
  "writerADurableTarget",
  "writerBEntryPoint",
  "writerBService",
  "writerBDurableTarget",
  "runtimeReachabilityA",
  "runtimeReachabilityB",
  "sameOrEquivalentBusinessObjectProof",
  "conflictDescription",
  "sourceEvidence",
  "classificationConfidence",
];

const LMF_REQUIRED = [
  "pathId",
  "mechanismType",
  "entryPoint",
  "sourceFile",
  "keyOrFallbackValue",
  "triggerCondition",
];

function sha256File(absPath) {
  return createHash("sha256").update(readFileSync(absPath)).digest("hex");
}

function listFilesRecursive(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...listFilesRecursive(abs));
    else out.push(abs);
  }
  return out;
}

describe("tournament-production-remediation evidence package (canonical)", () => {
  it("contains required documentation and JSON artifacts that parse", () => {
    for (const name of REQUIRED_DOCS) {
      assert.equal(existsSync(join(pkg, name)), true, `missing ${name}`);
    }
    for (const name of REQUIRED_JSON) {
      const abs = join(pkg, name);
      assert.equal(existsSync(abs), true, `missing ${name}`);
      assert.doesNotThrow(() => JSON.parse(readFileSync(abs, "utf8")));
    }
  });

  it("routes inventoried = 54 with primary classification sum 54 (8 canonical, 46 legacy, 0 primary duplicate)", () => {
    const inventory = JSON.parse(
      readFileSync(join(pkg, "TOURNAMENT_ROUTE_INVENTORY.json"), "utf8")
    );
    assert.equal(inventory.routes.length, 54);
    const counts = {
      CANONICAL: 0,
      LEGACY: 0,
      DUPLICATE: 0,
      SHADOW: 0,
      DEAD: 0,
      UNRESOLVED: 0,
    };
    for (const route of inventory.routes) {
      assert.ok(PRIMARY.includes(route.primaryClassification), route.path);
      counts[route.primaryClassification] += 1;
    }
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    assert.equal(sum, 54);
    assert.equal(counts.CANONICAL, 8);
    assert.equal(counts.LEGACY, 46);
    assert.equal(counts.DUPLICATE, 0);
    assert.equal(
      inventory.routeCounts.secondaryAttributes.duplicateConflictRouteCount,
      7
    );
  });

  it("audit report counters match inventory, production objects, and Production GO=NO mutations=0", () => {
    const report = JSON.parse(
      readFileSync(join(pkg, "TOURNAMENT_PRODUCTION_AUDIT_REPORT.json"), "utf8")
    );
    const md = readFileSync(join(pkg, "TOURNAMENT_PRODUCTION_AUDIT_REPORT.md"), "utf8");
    assert.equal(report.productionGo, "NO");
    assert.equal(report.productionMutations, 0);
    assert.equal(report.counters.routesInventoried, 54);
    assert.equal(report.counters.productionObjects.PRODUCTION_CONTAINER_ROWS_INSPECTED, 1);
    assert.equal(
      report.counters.productionObjects.PRODUCTION_DURABLE_TOURNAMENT_RECORDS_INSPECTED,
      0
    );
    assert.equal(report.counters.productionObjects.OWNER_TOURNAMENT_IDS_FOUND, 0);
    assert.match(md, /CANONICAL \| 8/);
    assert.match(md, /LEGACY \| 46/);
    assert.match(md, /DUPLICATE \| 0/);
    assert.match(md, /DUAL_WRITER_COUNT \| 3/);
    assert.match(md, /LOCALSTORAGE_MOCK_FALLBACK_COUNT \| 3/);
  });

  it("dual-writer count equals authoritative pattern array length with complete A/B evidence", () => {
    const matrix = JSON.parse(
      readFileSync(join(pkg, "TOURNAMENT_RUNTIME_AUTHORITY_MATRIX.json"), "utf8")
    );
    const report = JSON.parse(
      readFileSync(join(pkg, "TOURNAMENT_PRODUCTION_AUDIT_REPORT.json"), "utf8")
    );
    const trace = JSON.parse(
      readFileSync(join(pkg, "evidence/RUNTIME_TRACE_2026-08-05.json"), "utf8")
    );
    const patterns = matrix.dualWriterPatterns;
    assert.ok(Array.isArray(patterns));
    assert.equal(patterns.length, report.counters.dualWriterCount);
    assert.equal(patterns.length, matrix.liveProductionReconciliation.dualWriterCount);
    assert.equal(patterns.length, trace.counts.dualWriterPatterns);
    assert.deepEqual(
      patterns.map((p) => p.patternId),
      report.counters.dualWriterPatternIds
    );
    for (const pattern of patterns) {
      for (const key of DW_REQUIRED) {
        assert.ok(pattern[key], `${pattern.patternId} missing ${key}`);
      }
      assert.ok(Array.isArray(pattern.sourceEvidence));
      assert.ok(pattern.sourceEvidence.length >= 1);
    }
  });

  it("localStorage/mock/fallback count equals authoritative path array length with complete fields", () => {
    const matrix = JSON.parse(
      readFileSync(join(pkg, "TOURNAMENT_RUNTIME_AUTHORITY_MATRIX.json"), "utf8")
    );
    const report = JSON.parse(
      readFileSync(join(pkg, "TOURNAMENT_PRODUCTION_AUDIT_REPORT.json"), "utf8")
    );
    const trace = JSON.parse(
      readFileSync(join(pkg, "evidence/RUNTIME_TRACE_2026-08-05.json"), "utf8")
    );
    const paths = matrix.localStorageMockFallbackPaths;
    assert.ok(Array.isArray(paths));
    assert.equal(paths.length, report.counters.localStorageMockFallbackCount);
    assert.equal(
      paths.length,
      matrix.liveProductionReconciliation.localStorageMockFallbackCount
    );
    assert.equal(paths.length, trace.counts.localStorageMockFallbackPaths);
    assert.equal(paths.length, trace.localStorageMockFallbackPaths.length);
    assert.deepEqual(
      paths.map((p) => p.pathId),
      report.counters.localStorageMockFallbackPathIds
    );
    for (const path of paths) {
      for (const key of LMF_REQUIRED) {
        assert.ok(path[key], `${path.pathId} missing ${key}`);
      }
      assert.ok(["LOCALSTORAGE", "MOCK", "FALLBACK"].includes(path.mechanismType));
    }
  });

  it("all three owner root causes are LOCAL_BROWSER_ONLY_OBJECT with documented localStorage key", () => {
    const report = JSON.parse(
      readFileSync(join(pkg, "TOURNAMENT_PRODUCTION_AUDIT_REPORT.json"), "utf8")
    );
    const log = JSON.parse(readFileSync(join(pkg, "TOURNAMENT_UI_DEFECT_LOG.json"), "utf8"));
    for (const id of [
      "tournament-1785921300822",
      "tournament-1785921409840",
      "tournament-1785921550968",
    ]) {
      assert.equal(report.ownerRootCauses[id].classification, "LOCAL_BROWSER_ONLY_OBJECT");
    }
    assert.deepEqual(report.localStorageKeysConfirmed, [
      "pickleball-club-data-v3::{clubId}",
    ]);
    for (const defect of log.defects.filter((d) =>
      ["TP-UI-001", "TP-UI-002", "TP-UI-003"].includes(d.id)
    )) {
      assert.equal(defect.rootCauseClassification, "LOCAL_BROWSER_ONLY_OBJECT");
    }
  });

  it("all six original screenshots are local-only and commit-ineligible", () => {
    const manifest = JSON.parse(
      readFileSync(join(pkg, "evidence/SCREENSHOT_MANIFEST_2026-08-05.json"), "utf8")
    );
    assert.equal(manifest.entries.length, 6);
    assert.equal(manifest.counts.commitEligibleCount, 0);
    for (const entry of manifest.entries) {
      assert.equal(entry.evidenceClassification, "LOCAL_EVIDENCE_ONLY");
      assert.equal(entry.commitEligibility, "NO_PENDING_REDACTION");
      assert.equal(sha256File(join(root, entry.canonicalPath)), EXPECTED_SHA256[entry.ownerFilename]);
    }
  });

  it("preliminary directory is redirect-only and canonical evidence authority is unique", () => {
    const files = listFilesRecursive(prelim).map((abs) =>
      abs.slice(root.length + 1).replace(/\\/g, "/")
    );
    assert.deepEqual(files, [
      "docs/tournament-production-remediation/CANONICAL_REDIRECT.md",
    ]);
  });

  it("remediation plan begins with WP1 preservation/export then WP2 then WP3", () => {
    const plan = readFileSync(join(pkg, "TOURNAMENT_REMEDIATION_PLAN.md"), "utf8");
    const report = JSON.parse(
      readFileSync(join(pkg, "TOURNAMENT_PRODUCTION_AUDIT_REPORT.json"), "utf8")
    );
    assert.match(plan, /WP1 — PRESERVE AND EXPORT BROWSER-LOCAL TOURNAMENTS/);
    assert.match(plan, /WP2 — ESTABLISH CLOUD TOURNAMENT DURABLE AUTHORITY/);
    assert.match(plan, /WP3 — MIGRATE OR RECONCILE EXISTING LOCAL-ONLY TOURNAMENTS/);
    assert.equal(
      report.remediationPlanFirstWorkPackage,
      "WP1_PRESERVE_AND_EXPORT_BROWSER_LOCAL_TOURNAMENTS"
    );
  });

  it("historical FAIL records remain present and reconciliation documents IR-RR-001/002", () => {
    const review = JSON.parse(
      readFileSync(join(pkg, "evidence/INDEPENDENT_FINAL_REVIEW_2026-08-05.json"), "utf8")
    );
    const rereview = JSON.parse(
      readFileSync(join(pkg, "evidence/INDEPENDENT_REREVIEW_2026-08-05.json"), "utf8")
    );
    const correction = JSON.parse(
      readFileSync(join(pkg, "evidence/COMMIT_GATE_CORRECTION_2026-08-05.json"), "utf8")
    );
    const recon = JSON.parse(
      readFileSync(
        join(pkg, "evidence/RUNTIME_AUTHORITY_COUNTER_RECONCILIATION_2026-08-05.json"),
        "utf8"
      )
    );
    assert.equal(
      review.independentVerdict,
      "TOURNAMENT_PRODUCTION_AUDIT_INDEPENDENT_REVIEW_FAIL_NO_COMMIT"
    );
    assert.equal(review.historicalFailPreserved, true);
    assert.equal(
      rereview.independentVerdict,
      "TOURNAMENT_PRODUCTION_AUDIT_INDEPENDENT_REREVIEW_FAIL_NO_COMMIT"
    );
    assert.equal(correction.commitStillNotPerformed, true);
    assert.equal(recon["IR-RR-001"].finalAuthoritativeCounter, 3);
    assert.equal(recon["IR-RR-001"].correctionAction, "ADDED_MISSING_EVIDENCE");
    assert.equal(recon["IR-RR-002"].finalAuthoritativeCounter, 3);
    assert.equal(recon["IR-RR-002"].correctionAction, "REDUCED_UNSUPPORTED_COUNT");
    assert.equal(recon.productionMutations, 0);
    assert.equal(recon.productionGo, "NO");
    assert.equal(recon.reReviewRequired, true);
  });

  it("read-only query log records MCP transport, seven queries, and zero mutations", () => {
    const qlog = JSON.parse(
      readFileSync(join(pkg, "TOURNAMENT_PRODUCTION_READ_ONLY_QUERY_LOG.json"), "utf8")
    );
    assert.equal(qlog.queriesExecuted, 7);
    assert.equal(qlog.productionMutations, 0);
    assert.equal(
      qlog.authoritativeProductionQueryTransport.auditScriptCommitEligibility,
      "NO_LOCAL_AUDIT_HELPER"
    );
  });
});
