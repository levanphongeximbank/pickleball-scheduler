/**
 * PROD-OPS-30D-01 — evidence package presence + marker contracts.
 * Read-only assertions over committed docs (no network, no DB).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = join(root, "docs", "production-operations", "prod-ops-30d-01");
const prior7d = join(root, "docs", "production-operations", "prod-ops-7d-01");
const prior24h = join(root, "docs", "production-operations", "prod-ops-24h-01");

const REQUIRED = [
  "01_BASELINE_AND_SAFETY.md",
  "02_30_DAY_CONTINUITY_REGISTER.md",
  "03_PRODUCTION_DEPLOYMENT_PARITY.md",
  "04_MONITORING_EFFECTIVENESS.md",
  "05_AUTH_RBAC_TENANT_ISOLATION.md",
  "06_CLUBS_COURTS_PUBLIC_CATALOG.md",
  "07_BACKUP_AND_RECOVERY.md",
  "08_INCIDENT_AND_ANOMALY_REGISTER.md",
  "09_24H_7D_30D_TREND_ANALYSIS.md",
  "10_NEXT_SCOPE_DECISION.md",
  "11_FINAL_30_DAY_REPORT.md",
];

const EVIDENCE = [
  "evidence/BUNDLE_RBAC_SCAN.json",
  "evidence/PUBLIC_RPC_SMOKE.json",
  "evidence/FAILCLOSED_SMOKE.json",
  "evidence/ROUTE_CONTINUITY_CURRENT.json",
];

describe("PROD-OPS-30D-01 evidence package", () => {
  it("contains required documentation files", () => {
    for (const name of REQUIRED) {
      assert.equal(existsSync(join(pkg, name)), true, `missing ${name}`);
    }
  });

  it("contains evidence artifacts", () => {
    for (const name of EVIDENCE) {
      assert.equal(existsSync(join(pkg, name)), true, `missing ${name}`);
    }
  });

  it("records canonical completion marker and allowed verdicts", () => {
    const report = readFileSync(join(pkg, "11_FINAL_30_DAY_REPORT.md"), "utf8");
    assert.match(report, /PROD_OPS_30D_01_CONTROLLED_OPERATIONS_COMPLETE/);
    assert.match(
      report,
      /```text\s*\nPROD_OPS_30D_PASS_WITH_OBSERVATIONS\s*\n```/
    );
    assert.match(
      report,
      /```text\s*\nCONTINUE_CONSTRAINED_PRODUCTION\s*\n```/
    );
    assert.doesNotMatch(report, /```text\s*\nPROD_OPS_30D_PASS\s*\n```/);
    assert.doesNotMatch(
      report,
      /```text\s*\n(WHOLE_PLATFORM_GA|PRODUCTION_GA_APPROVED)\s*\n```/
    );
    assert.match(report, /Do \*\*not\*\* interpret as whole-platform GA approval/i);
  });

  it("records fresh origin/main PR #324 merge SHA", () => {
    const baseline = readFileSync(join(pkg, "01_BASELINE_AND_SAFETY.md"), "utf8");
    const report = readFileSync(join(pkg, "11_FINAL_30_DAY_REPORT.md"), "utf8");
    for (const doc of [baseline, report]) {
      assert.match(doc, /6eff4c61496734a418ce6a534fbdaf7bd3b10368/);
    }
  });

  it("preserves PROD-OPS-7D package and does not close A-CAL-01 early", () => {
    assert.equal(existsSync(join(prior7d, "10_FINAL_7_DAY_REPORT.md")), true);
    assert.equal(existsSync(join(prior24h, "10_FINAL_24H_REPORT.md")), true);
    const continuity = readFileSync(
      join(pkg, "02_30_DAY_CONTINUITY_REGISTER.md"),
      "utf8"
    );
    assert.match(continuity, /A-CAL-01=OPEN/);
    assert.match(continuity, /FABRICATED_DAYS=NONE/);
    assert.match(continuity, /NOT_VERIFIABLE/);
    assert.doesNotMatch(continuity, /A-CAL-01=CLOSED/);
  });

  it("records parity PASS and current deploy tip", () => {
    const parity = readFileSync(
      join(pkg, "03_PRODUCTION_DEPLOYMENT_PARITY.md"),
      "utf8"
    );
    assert.match(parity, /PARITY_PASS/);
    assert.match(parity, /5631492629/);
    assert.match(parity, /6eff4c61496734a418ce6a534fbdaf7bd3b10368/);
    assert.match(parity, /UNEXPECTED_DEPLOYMENT=NONE/);
  });

  it("classifies monitoring PARTIALLY_EFFECTIVE and RBAC VERIFIED_ENABLED", () => {
    const mon = readFileSync(join(pkg, "04_MONITORING_EFFECTIVENESS.md"), "utf8");
    const auth = readFileSync(
      join(pkg, "05_AUTH_RBAC_TENANT_ISOLATION.md"),
      "utf8"
    );
    const scan = JSON.parse(
      readFileSync(join(pkg, "evidence", "BUNDLE_RBAC_SCAN.json"), "utf8")
    );
    assert.match(
      mon,
      /```text\s*\nMONITORING_PARTIALLY_EFFECTIVE\s*\n```/
    );
    assert.doesNotMatch(
      mon,
      /```text\s*\nMONITORING_EFFECTIVE\s*\n```/
    );
    assert.match(auth, /VERIFIED_ENABLED/);
    assert.match(auth, /NOT_EXERCISED/);
    assert.equal(scan.viteRbacEnabledClassification, "VERIFIED_ENABLED");
    assert.equal(scan.valuePrinted, false);
  });

  it("preserves recovery exceptions and drill 02 not auto-authorized", () => {
    const backup = readFileSync(join(pkg, "07_BACKUP_AND_RECOVERY.md"), "utf8");
    assert.match(backup, /PITR=NOT_ENABLED/);
    assert.match(backup, /RESTORE_DRILL_02=DEFERRED/);
    assert.match(backup, /STORAGE_OBJECT_RECOVERY=NOT_COVERED/);
    assert.match(backup, /DRILL_02_READY_FOR_OWNER_AUTHORIZATION=NO/);
    assert.match(backup, /LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED/);
  });

  it("records Clubs/Courts LIVE and LIVE_EMPTY honesty", () => {
    const catalog = readFileSync(
      join(pkg, "06_CLUBS_COURTS_PUBLIC_CATALOG.md"),
      "utf8"
    );
    const rpc = JSON.parse(
      readFileSync(join(pkg, "evidence", "PUBLIC_RPC_SMOKE.json"), "utf8")
    );
    assert.match(catalog, /CLB ACCC/);
    assert.match(catalog, /LIVE_EMPTY/);
    assert.match(catalog, /NOT modified/i);
    assert.equal(rpc.clubsCount, 1);
    assert.equal(rpc.courtsCount, 4);
    assert.equal(rpc.anonKeyPrinted, false);
  });

  it("records next-scope decisions without activating new scopes", () => {
    const next = readFileSync(join(pkg, "10_NEXT_SCOPE_DECISION.md"), "utf8");
    assert.match(next, /This does not activate any new scope/i);
    assert.match(next, /READY_FOR_SEPARATE_PILOT_CERTIFICATION_COUNT=0/);
    assert.match(next, /WHOLE_PLATFORM_GA=NOT_APPROVED/);
    assert.match(next, /Competition Engine[\s\S]*NOT_READY/);
    assert.match(next, /KEEP_CONSTRAINED/);
  });

  it("records stable trend without claiming 30 calendar days complete", () => {
    const trend = readFileSync(
      join(pkg, "09_24H_7D_30D_TREND_ANALYSIS.md"),
      "utf8"
    );
    const report = readFileSync(join(pkg, "11_FINAL_30_DAY_REPORT.md"), "utf8");
    assert.match(trend, /STABLE_WITH_INSUFFICIENT_CALENDAR_DEPTH|INSUFFICIENT_DATA/);
    assert.match(report, /INCOMPLETE_AT_AUTHORSHIP|A-CAL-01=OPEN/);
    assert.doesNotMatch(report, /thirty calendar days complete|30 calendar days complete/i);
  });
});
