/**
 * PLATFORM-FINAL-AUDIT-01 Gate 9 — evidence package presence + marker contracts.
 * Read-only assertions over committed docs (no network, no DB).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const gate9 = join(
  root,
  "docs",
  "platform-final-audit-01",
  "gate-09-release-readiness-traceability"
);
const gate8 = join(
  root,
  "docs",
  "platform-final-audit-01",
  "gate-08-final-integration-operational-controls"
);

const REQUIRED = [
  "01_BASELINE_AND_SAFETY.md",
  "02_GATE_1_TO_8_LINEAGE_MATRIX.md",
  "03_TRACEABILITY_GAP_DECISION.md",
  "04_SOURCE_TO_PRODUCTION_TRACEABILITY.md",
  "05_PRODUCTION_READINESS_CLASSIFICATION.md",
  "06_RELEASE_CONDITION_REGISTER.md",
  "07_TEST_AND_QUALITY_EVIDENCE.md",
  "08_GATE_10_ENTRY_HANDOFF.md",
  "09_FINAL_GATE_9_REPORT.md",
];

describe("PLATFORM-FINAL-AUDIT-01 Gate 9 evidence package", () => {
  it("contains required documentation files", () => {
    for (const name of REQUIRED) {
      assert.equal(existsSync(join(gate9, name)), true, `missing ${name}`);
    }
  });

  it("records canonical Gate 9 completion marker and verdicts", () => {
    const report = readFileSync(join(gate9, "09_FINAL_GATE_9_REPORT.md"), "utf8");
    assert.match(
      report,
      /PLATFORM_FINAL_AUDIT_01_GATE_9_RELEASE_READINESS_TRACEABILITY_COMPLETE/
    );
    assert.match(report, /GATE_9_PASS_WITH_RELEASE_CONDITIONS/);
    assert.match(report, /GATE_10_READY_WITH_CONDITIONS/);
  });

  it("does not issue final GO / GO_WITH_CONDITIONS / NO_GO release verdict", () => {
    const report = readFileSync(join(gate9, "09_FINAL_GATE_9_REPORT.md"), "utf8");
    const handoff = readFileSync(join(gate9, "08_GATE_10_ENTRY_HANDOFF.md"), "utf8");
    assert.match(handoff, /does \*\*not\*\* issue/);
    assert.doesNotMatch(report, /^FINAL_RELEASE_DECISION=GO$/m);
    assert.doesNotMatch(report, /^FINAL_RELEASE_DECISION=NO_GO$/m);
    assert.doesNotMatch(report, /^FINAL_RELEASE_DECISION=GO_WITH_CONDITIONS$/m);
  });

  it("classifies B-AUDIT-TRACEABILITY-01 as PARTIALLY_RESOLVED", () => {
    const decision = readFileSync(join(gate9, "03_TRACEABILITY_GAP_DECISION.md"), "utf8");
    assert.match(decision, /B-AUDIT-TRACEABILITY-01=PARTIALLY_RESOLVED/);
    assert.doesNotMatch(decision, /B-AUDIT-TRACEABILITY-01=RESOLVED$/m);
  });

  it("preserves recovery accepted-exception markers", () => {
    const report = readFileSync(join(gate9, "09_FINAL_GATE_9_REPORT.md"), "utf8");
    assert.match(report, /RECOVERY_READINESS_DECISION_01=CLOSED_WITH_ACCEPTED_EXCEPTIONS/);
    assert.match(report, /PITR=NOT_ENABLED/);
    assert.match(report, /STORAGE_OBJECT_RECOVERY=NOT_COVERED/);
    assert.match(report, /RESTORE_DRILL_02=DEFERRED/);
    assert.match(report, /LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED/);
  });

  it("records Clubs RLS remediation as RESOLVED and Gate 8 merge SHA", () => {
    const report = readFileSync(join(gate9, "09_FINAL_GATE_9_REPORT.md"), "utf8");
    assert.match(report, /B-CLUBS-RLS-01/);
    assert.match(report, /RESOLVED/);
    assert.match(report, /4c72d4541c7fa111787caeca63d1bf25225a07b9/);
  });

  it("keeps Gate 8 package intact on main lineage", () => {
    assert.equal(existsSync(join(gate8, "09_GATE_8_FINAL_REPORT.md")), true);
    const g8 = readFileSync(join(gate8, "09_GATE_8_FINAL_REPORT.md"), "utf8");
    assert.match(g8, /PLATFORM_FINAL_AUDIT_01_GATE_8_OPERATIONAL_RELEASE_EVIDENCE_COMPLETE/);
  });

  it("lineage matrix marks Gate 1-7 packages as NOT_RECORDED where required", () => {
    const lineage = readFileSync(join(gate9, "02_GATE_1_TO_8_LINEAGE_MATRIX.md"), "utf8");
    assert.match(lineage, /NOT_RECORDED/);
    assert.match(lineage, /Gate 8/);
    assert.match(lineage, /#320/);
  });
});
