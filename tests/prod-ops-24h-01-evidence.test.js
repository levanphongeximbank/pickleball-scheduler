/**
 * PROD-OPS-24H-01 — evidence package presence + marker contracts.
 * Read-only assertions over committed docs (no network, no DB).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = join(root, "docs", "production-operations", "prod-ops-24h-01");
const gate10 = join(
  root,
  "docs",
  "platform-final-audit-01",
  "gate-10-final-release-decision"
);

const REQUIRED = [
  "01_BASELINE_AND_SAFETY.md",
  "02_PRODUCTION_DEPLOYMENT_PARITY.md",
  "03_PUBLIC_ROUTE_CONTINUITY.md",
  "04_CLUBS_COURTS_VERIFICATION.md",
  "05_AUTH_RBAC_TENANT_ISOLATION.md",
  "06_PUBLIC_CATALOG_AND_PWA.md",
  "07_BACKUP_MONITORING_AND_OPERATIONS.md",
  "08_ANOMALY_REGISTER.md",
  "09_7_DAY_CONTROL_HANDOFF.md",
  "10_FINAL_24H_REPORT.md",
];

describe("PROD-OPS-24H-01 evidence package", () => {
  it("contains required documentation files", () => {
    for (const name of REQUIRED) {
      assert.equal(existsSync(join(pkg, name)), true, `missing ${name}`);
    }
  });

  it("records canonical completion marker and allowed verdicts", () => {
    const report = readFileSync(join(pkg, "10_FINAL_24H_REPORT.md"), "utf8");
    assert.match(report, /PROD_OPS_24H_01_OPERATIONAL_VERIFICATION_COMPLETE/);
    assert.match(
      report,
      /```text\s*\nPROD_OPS_24H_PASS_WITH_OBSERVATIONS\s*\n```/
    );
    assert.match(
      report,
      /```text\s*\nCONTINUE_CONSTRAINED_PRODUCTION\s*\n```/
    );
    assert.doesNotMatch(report, /```text\s*\nPROD_OPS_24H_PASS\s*\n```/);
    assert.doesNotMatch(
      report,
      /```text\s*\n(WHOLE_PLATFORM_GA|PRODUCTION_GA_APPROVED)\s*\n```/
    );
    assert.match(report, /Do \*\*not\*\* interpret as whole-platform GA approval/i);
  });

  it("records fresh origin/main Gate 10 merge SHA", () => {
    const baseline = readFileSync(join(pkg, "01_BASELINE_AND_SAFETY.md"), "utf8");
    const report = readFileSync(join(pkg, "10_FINAL_24H_REPORT.md"), "utf8");
    for (const doc of [baseline, report]) {
      assert.match(doc, /edca457748be3ef3a160b68076a69535b2ab6e3f/);
    }
  });

  it("records Production deploy parity PASS for Gate 10 tip", () => {
    const parity = readFileSync(
      join(pkg, "02_PRODUCTION_DEPLOYMENT_PARITY.md"),
      "utf8"
    );
    assert.match(parity, /SOURCE_TO_PRODUCTION_PARITY=PASS/);
    assert.match(parity, /5625433697/);
    assert.match(parity, /edca457748be3ef3a160b68076a69535b2ab6e3f/);
  });

  it("preserves known release conditions and recovery exceptions", () => {
    const baseline = readFileSync(join(pkg, "01_BASELINE_AND_SAFETY.md"), "utf8");
    const ops = readFileSync(
      join(pkg, "07_BACKUP_MONITORING_AND_OPERATIONS.md"),
      "utf8"
    );
    const report = readFileSync(join(pkg, "10_FINAL_24H_REPORT.md"), "utf8");
    for (const doc of [baseline, report]) {
      assert.match(doc, /B-AUDIT-TRACEABILITY-01=PARTIALLY_RESOLVED/);
      assert.match(doc, /VITE_RBAC_ENABLED=NOT_VERIFIED|NOT_VERIFIED/);
      assert.match(doc, /MONITORING.*NOT_VERIFIED|monitoring operational effectiveness=NOT_VERIFIED/i);
    }
    assert.match(ops, /PITR=NOT_ENABLED/);
    assert.match(ops, /STORAGE_OBJECT_RECOVERY=NOT_COVERED/);
    assert.match(ops, /RESTORE_DRILL_02=DEFERRED/);
    assert.match(ops, /LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED/);
    assert.match(ops, /MONITORING_EFFECTIVENESS=NOT_VERIFIED/);
  });

  it("records Clubs/Courts continuity and does not claim Production SQL", () => {
    const clubs = readFileSync(join(pkg, "04_CLUBS_COURTS_VERIFICATION.md"), "utf8");
    assert.match(clubs, /CLB ACCC/);
    assert.match(clubs, /Sân 3/);
    assert.match(clubs, /Production SQL:\*\* \*\*NOT run\*\*|Production SQL:\s*\*\*NOT run\*\*/i);
    assert.match(clubs, /clubs \*\*1\*\*|count \*\*1\*\*|LIVE count \*\*1\*\*/i);
    assert.match(clubs, /courts \*\*4\*\*|count \*\*4\*\*|LIVE count \*\*4\*\*/i);
  });

  it("keeps Gate 10 historical verdicts intact", () => {
    assert.equal(existsSync(join(gate10, "09_FINAL_GATE_10_REPORT.md")), true);
    const g10 = readFileSync(join(gate10, "09_FINAL_GATE_10_REPORT.md"), "utf8");
    assert.match(g10, /GO_WITH_CONDITIONS/);
    assert.match(g10, /PLATFORM_FINAL_AUDIT_01_CLOSED_WITH_CONDITIONS/);
    assert.match(g10, /B-AUDIT-TRACEABILITY-01=PARTIALLY_RESOLVED/);
  });

  it("includes anomaly register with no fabricated NEW_CRITICAL", () => {
    const reg = readFileSync(join(pkg, "08_ANOMALY_REGISTER.md"), "utf8");
    assert.match(reg, /NEW_CRITICAL=NONE/);
    assert.match(reg, /A-RBAC-01/);
    assert.match(reg, /A-MONITOR-01/);
    assert.match(reg, /A-TRACE-01/);
  });

  it("ships 7-day handoff and evidence smoke artifacts", () => {
    const handoff = readFileSync(join(pkg, "09_7_DAY_CONTROL_HANDOFF.md"), "utf8");
    assert.match(handoff, /CONTINUE_CONSTRAINED_PRODUCTION/);
    assert.match(handoff, /RC-ENV-01/);
    assert.match(handoff, /RC-RBAC-01/);
    assert.equal(
      existsSync(join(pkg, "evidence", "PUBLIC_RPC_SMOKE.json")),
      true
    );
    assert.equal(
      existsSync(join(pkg, "evidence", "FAILCLOSED_SMOKE.json")),
      true
    );
    const smoke = readFileSync(
      join(pkg, "evidence", "PUBLIC_RPC_SMOKE.json"),
      "utf8"
    );
    assert.match(smoke, /"clubsCount": 1/);
    assert.match(smoke, /"courtsCount": 4/);
    assert.doesNotMatch(smoke, /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./);
  });
});
