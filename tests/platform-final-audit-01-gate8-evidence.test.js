/**
 * PLATFORM-FINAL-AUDIT-01 Gate 8 — evidence package presence + marker contracts.
 * Read-only assertions over committed docs (no network, no DB).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const gate8 = join(
  root,
  "docs",
  "platform-final-audit-01",
  "gate-08-final-integration-operational-controls"
);

const REQUIRED = [
  "01_BASELINE_AND_TRACEABILITY.md",
  "02_FINAL_INTEGRATION_MATRIX.md",
  "03_OPERATIONAL_CONTROLS_MATRIX.md",
  "04_RECOVERY_EXCEPTION_REGISTER.md",
  "05_PRODUCTION_CHANGE_LEDGER.md",
  "06_RELEASE_EVIDENCE_MATRIX.md",
  "07_BLOCKER_GAP_REGISTER.md",
  "08_GATE_9_HANDOFF.md",
  "09_GATE_8_FINAL_REPORT.md",
];

describe("PLATFORM-FINAL-AUDIT-01 Gate 8 evidence package", () => {
  it("contains required documentation files", () => {
    for (const name of REQUIRED) {
      assert.equal(existsSync(join(gate8, name)), true, `missing ${name}`);
    }
  });

  it("records canonical Gate 8 completion marker", () => {
    const report = readFileSync(join(gate8, "09_GATE_8_FINAL_REPORT.md"), "utf8");
    assert.match(
      report,
      /PLATFORM_FINAL_AUDIT_01_GATE_8_OPERATIONAL_RELEASE_EVIDENCE_COMPLETE/
    );
    assert.match(report, /GATE_8_PASS_WITH_OPERATIONAL_GAPS/);
  });

  it("preserves recovery accepted-exception markers", () => {
    const reg = readFileSync(join(gate8, "04_RECOVERY_EXCEPTION_REGISTER.md"), "utf8");
    assert.match(reg, /RECOVERY_READINESS_DECISION_01=CLOSED_WITH_ACCEPTED_EXCEPTIONS/);
    assert.match(reg, /PITR=NOT_ENABLED/);
    assert.match(reg, /LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED/);
    assert.match(reg, /STORAGE_OBJECT_RECOVERY=NOT_COVERED/);
    assert.match(reg, /RESTORE_DRILL_02=DEFERRED/);
  });

  it("records Clubs RLS remediation as RESOLVED and does not mutate claim", () => {
    const report = readFileSync(join(gate8, "09_GATE_8_FINAL_REPORT.md"), "utf8");
    assert.match(report, /B-CLUBS-RLS-01/);
    assert.match(report, /RESOLVED/);
    assert.match(report, /1c595fc73ee405e626f46373fe465c8bed338314/);
  });

  it("does not issue final GO / NO_GO from Gate 8", () => {
    const handoff = readFileSync(join(gate8, "08_GATE_9_HANDOFF.md"), "utf8");
    assert.match(handoff, /does \*\*not\*\* issue/);
    assert.doesNotMatch(handoff, /^FINAL_RELEASE_DECISION=GO$/m);
  });
});
