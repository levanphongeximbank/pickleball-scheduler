/**
 * PLATFORM-FINAL-AUDIT-01 Gate 10 — evidence package presence + marker contracts.
 * Read-only assertions over committed docs (no network, no DB).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const gate10 = join(
  root,
  "docs",
  "platform-final-audit-01",
  "gate-10-final-release-decision"
);
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
  "01_FINAL_BASELINE_AND_SAFETY.md",
  "02_GATE_1_TO_9_CONSOLIDATED_SUMMARY.md",
  "03_FINAL_PRODUCTION_READINESS_MATRIX.md",
  "04_FINAL_RELEASE_CONDITION_REGISTER.md",
  "05_PERMITTED_RELEASE_SCOPE.md",
  "06_FINAL_RELEASE_DECISION.md",
  "07_POST_RELEASE_CONTROL_PLAN.md",
  "08_PROGRAM_CLOSURE_DECISION.md",
  "09_FINAL_GATE_10_REPORT.md",
];

describe("PLATFORM-FINAL-AUDIT-01 Gate 10 evidence package", () => {
  it("contains required documentation files", () => {
    for (const name of REQUIRED) {
      assert.equal(existsSync(join(gate10, name)), true, `missing ${name}`);
    }
  });

  it("records canonical Gate 10 completion and conditional program closure markers", () => {
    const report = readFileSync(join(gate10, "09_FINAL_GATE_10_REPORT.md"), "utf8");
    const closure = readFileSync(join(gate10, "08_PROGRAM_CLOSURE_DECISION.md"), "utf8");
    assert.match(
      report,
      /PLATFORM_FINAL_AUDIT_01_GATE_10_FINAL_RELEASE_DECISION_COMPLETE/
    );
    assert.match(report, /PLATFORM_FINAL_AUDIT_01_CLOSED_WITH_CONDITIONS/);
    assert.match(
      closure,
      /```text\s*\nPLATFORM_FINAL_AUDIT_01_CLOSED_WITH_CONDITIONS\s*\n```/
    );
    assert.doesNotMatch(
      closure,
      /```text\s*\nPLATFORM_FINAL_AUDIT_01_CLOSED\s*\n```/
    );
    assert.doesNotMatch(
      closure,
      /```text\s*\nPLATFORM_FINAL_AUDIT_01_NOT_CLOSED\s*\n```/
    );
  });

  it("issues exactly GO_WITH_CONDITIONS as final release decision", () => {
    const decision = readFileSync(join(gate10, "06_FINAL_RELEASE_DECISION.md"), "utf8");
    const report = readFileSync(join(gate10, "09_FINAL_GATE_10_REPORT.md"), "utf8");
    assert.match(decision, /```text\s*\nGO_WITH_CONDITIONS\s*\n```/);
    assert.match(report, /```text\s*\nGO_WITH_CONDITIONS\s*\n```/);
    assert.doesNotMatch(decision, /```text\s*\nGO\s*\n```/);
    assert.doesNotMatch(decision, /```text\s*\nNO_GO\s*\n```/);
  });

  it("preserves B-AUDIT-TRACEABILITY-01 as PARTIALLY_RESOLVED", () => {
    const summary = readFileSync(
      join(gate10, "02_GATE_1_TO_9_CONSOLIDATED_SUMMARY.md"),
      "utf8"
    );
    const report = readFileSync(join(gate10, "09_FINAL_GATE_10_REPORT.md"), "utf8");
    assert.match(summary, /B-AUDIT-TRACEABILITY-01=PARTIALLY_RESOLVED/);
    assert.match(report, /B-AUDIT-TRACEABILITY-01=PARTIALLY_RESOLVED/);
    assert.match(summary, /NOT_RECORDED/);
  });

  it("preserves recovery accepted-exception markers", () => {
    const reg = readFileSync(
      join(gate10, "04_FINAL_RELEASE_CONDITION_REGISTER.md"),
      "utf8"
    );
    const report = readFileSync(join(gate10, "09_FINAL_GATE_10_REPORT.md"), "utf8");
    for (const doc of [reg, report]) {
      assert.match(doc, /RECOVERY_READINESS_DECISION_01=CLOSED_WITH_ACCEPTED_EXCEPTIONS/);
      assert.match(doc, /RECOVERY_READINESS=CERTIFIED_WITH_GAPS/);
      assert.match(doc, /PITR=NOT_ENABLED/);
      assert.match(doc, /STORAGE_OBJECT_RECOVERY=NOT_COVERED/);
      assert.match(doc, /RESTORE_DRILL_02=DEFERRED/);
      assert.match(doc, /LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED/);
    }
  });

  it("records Clubs RLS as RESOLVED and HARD_BLOCKERS=NONE", () => {
    const reg = readFileSync(
      join(gate10, "04_FINAL_RELEASE_CONDITION_REGISTER.md"),
      "utf8"
    );
    const decision = readFileSync(join(gate10, "06_FINAL_RELEASE_DECISION.md"), "utf8");
    assert.match(reg, /B-CLUBS-RLS-01/);
    assert.match(reg, /RESOLVED/);
    assert.match(reg, /HARD_BLOCKERS=NONE/);
    assert.match(decision, /HARD_BLOCKERS=NONE/);
  });

  it("classifies release scopes with required approval tokens", () => {
    const scope = readFileSync(join(gate10, "05_PERMITTED_RELEASE_SCOPE.md"), "utf8");
    assert.match(scope, /Existing web Production continuity \| APPROVED_WITH_CONDITIONS/);
    assert.match(scope, /Competition Engine \| NOT_APPROVED/);
    assert.match(scope, /Business Modules \| NOT_APPROVED/);
    assert.match(scope, /iOS App Store release \| NOT_APPROVED/);
    assert.match(scope, /Android Play Store release \| NOT_APPROVED/);
    assert.match(scope, /Ecosystem and Integrations \| NOT_APPROVED/);
  });

  it("keeps Gate 8 and Gate 9 packages intact", () => {
    assert.equal(existsSync(join(gate8, "09_GATE_8_FINAL_REPORT.md")), true);
    assert.equal(existsSync(join(gate9, "09_FINAL_GATE_9_REPORT.md")), true);
    const g8 = readFileSync(join(gate8, "09_GATE_8_FINAL_REPORT.md"), "utf8");
    const g9 = readFileSync(join(gate9, "09_FINAL_GATE_9_REPORT.md"), "utf8");
    assert.match(
      g8,
      /PLATFORM_FINAL_AUDIT_01_GATE_8_OPERATIONAL_RELEASE_EVIDENCE_COMPLETE/
    );
    assert.match(
      g9,
      /PLATFORM_FINAL_AUDIT_01_GATE_9_RELEASE_READINESS_TRACEABILITY_COMPLETE/
    );
    assert.match(g9, /GATE_10_READY_WITH_CONDITIONS/);
  });

  it("records Gate 9 merge SHA as fresh main baseline", () => {
    const baseline = readFileSync(
      join(gate10, "01_FINAL_BASELINE_AND_SAFETY.md"),
      "utf8"
    );
    assert.match(baseline, /e78bb8b6116049b58590e6243d89eb519ea71463/);
    assert.match(baseline, /976f5a2be0e0cac7eed32ec90f525e4939c11470/);
    assert.match(baseline, /SOURCE_TO_PRODUCTION_PARITY=PASS/);
  });
});
