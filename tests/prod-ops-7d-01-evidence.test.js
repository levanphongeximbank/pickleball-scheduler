/**
 * PROD-OPS-7D-01 — evidence package presence + marker contracts.
 * Read-only assertions over committed docs (no network, no DB).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = join(root, "docs", "production-operations", "prod-ops-7d-01");
const prior24h = join(root, "docs", "production-operations", "prod-ops-24h-01");

const REQUIRED = [
  "01_BASELINE_AND_SAFETY.md",
  "02_ENVIRONMENT_AND_RBAC_EFFECTIVE_VALUE.md",
  "03_MONITORING_AND_LOGGING.md",
  "04_DAILY_CONTINUITY_CHECKS.md",
  "05_CLUBS_COURTS_PUBLIC_CATALOG.md",
  "06_AUTH_RBAC_TENANT_ISOLATION.md",
  "07_BACKUP_AND_RECOVERY_CONTROLS.md",
  "08_ANOMALY_AND_CONDITION_REGISTER.md",
  "09_30_DAY_OPERATIONS_HANDOFF.md",
  "10_FINAL_7_DAY_REPORT.md",
];

const EVIDENCE = [
  "evidence/BUNDLE_RBAC_SCAN.json",
  "evidence/PUBLIC_RPC_SMOKE.json",
  "evidence/FAILCLOSED_SMOKE.json",
  "evidence/ROUTE_CONTINUITY_CURRENT.json",
];

describe("PROD-OPS-7D-01 evidence package", () => {
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
    const report = readFileSync(join(pkg, "10_FINAL_7_DAY_REPORT.md"), "utf8");
    assert.match(report, /PROD_OPS_7D_01_OPERATIONAL_CONTROLS_COMPLETE/);
    assert.match(
      report,
      /```text\s*\nPROD_OPS_7D_PASS_WITH_OBSERVATIONS\s*\n```/
    );
    assert.match(
      report,
      /```text\s*\nCONTINUE_CONSTRAINED_PRODUCTION\s*\n```/
    );
    assert.doesNotMatch(report, /```text\s*\nPROD_OPS_7D_PASS\s*\n```/);
    assert.doesNotMatch(
      report,
      /```text\s*\n(WHOLE_PLATFORM_GA|PRODUCTION_GA_APPROVED)\s*\n```/
    );
    assert.match(report, /Do \*\*not\*\* interpret as whole-platform GA approval/i);
  });

  it("records fresh origin/main PR #323 merge SHA", () => {
    const baseline = readFileSync(join(pkg, "01_BASELINE_AND_SAFETY.md"), "utf8");
    const report = readFileSync(join(pkg, "10_FINAL_7_DAY_REPORT.md"), "utf8");
    for (const doc of [baseline, report]) {
      assert.match(doc, /f52cfbf8bdf2f84aaf2a1bc398f3c2f2f11a39e7/);
    }
  });

  it("verifies PROD-OPS-24H closed markers and prior package present", () => {
    const baseline = readFileSync(join(pkg, "01_BASELINE_AND_SAFETY.md"), "utf8");
    assert.match(baseline, /PROD_OPS_24H_01_POST_MERGE_VERIFIED/);
    assert.match(baseline, /PROD_OPS_24H_01_POST_MERGE_CLEANUP_VERIFIED/);
    assert.match(baseline, /PROD_OPS_24H_01_CLOSED/);
    assert.equal(existsSync(join(prior24h, "10_FINAL_24H_REPORT.md")), true);
  });

  it("classifies RBAC as VERIFIED_ENABLED without printing env value", () => {
    const envDoc = readFileSync(
      join(pkg, "02_ENVIRONMENT_AND_RBAC_EFFECTIVE_VALUE.md"),
      "utf8"
    );
    const scan = JSON.parse(
      readFileSync(join(pkg, "evidence", "BUNDLE_RBAC_SCAN.json"), "utf8")
    );
    assert.match(
      envDoc,
      /```text\s*\nVERIFIED_ENABLED\s*\n```/
    );
    assert.equal(scan.viteRbacEnabledClassification, "VERIFIED_ENABLED");
    assert.equal(scan.valuePrinted, false);
    assert.equal(scan.secretsPrinted, false);
    // Must not embed an assignment like VITE_RBAC_ENABLED=`true` in docs
    assert.doesNotMatch(envDoc, /VITE_RBAC_ENABLED\s*[:=]\s*[`'"]true[`'"]/);
    assert.doesNotMatch(envDoc, /VITE_RBAC_ENABLED\s*[:=]\s*[`'"]false[`'"]/);
  });

  it("records monitoring classification PARTIALLY_EFFECTIVE", () => {
    const mon = readFileSync(join(pkg, "03_MONITORING_AND_LOGGING.md"), "utf8");
    assert.match(
      mon,
      /```text\s*\nMONITORING_PARTIALLY_EFFECTIVE\s*\n```/
    );
    assert.doesNotMatch(
      mon,
      /```text\s*\nMONITORING_EFFECTIVE\s*\n```/
    );
  });

  it("preserves recovery exceptions and LIVE_EMPTY honesty", () => {
    const backup = readFileSync(
      join(pkg, "07_BACKUP_AND_RECOVERY_CONTROLS.md"),
      "utf8"
    );
    const catalog = readFileSync(
      join(pkg, "05_CLUBS_COURTS_PUBLIC_CATALOG.md"),
      "utf8"
    );
    const report = readFileSync(join(pkg, "10_FINAL_7_DAY_REPORT.md"), "utf8");
    for (const doc of [backup, report]) {
      assert.match(doc, /PITR=NOT_ENABLED/);
      assert.match(doc, /RESTORE_DRILL_02=DEFERRED/);
      assert.match(doc, /LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED/);
      assert.match(doc, /STORAGE_OBJECT_RECOVERY=NOT_COVERED|Storage recovery/);
    }
    assert.match(catalog, /LIVE_EMPTY/);
    assert.match(catalog, /CLB ACCC/);
    assert.match(catalog, /Sân 3/);
  });

  it("records Clubs/Courts continuity and no Production SQL writes claim", () => {
    const clubs = readFileSync(
      join(pkg, "05_CLUBS_COURTS_PUBLIC_CATALOG.md"),
      "utf8"
    );
    assert.match(clubs, /Production SQL writes:\*\* \*\*NONE\*\*|Production SQL writes:\s*\*\*NONE\*\*|Production SQL writes:\*\*\s*NONE/i);
    assert.match(clubs, /NOT modified/i);
    const rpc = JSON.parse(
      readFileSync(join(pkg, "evidence", "PUBLIC_RPC_SMOKE.json"), "utf8")
    );
    assert.equal(rpc.clubsCount, 1);
    assert.equal(rpc.courtsCount, 4);
    assert.equal(rpc.anonKeyPrinted, false);
  });

  it("records 30-day handoff and does not claim whole-platform GA", () => {
    const handoff = readFileSync(
      join(pkg, "09_30_DAY_OPERATIONS_HANDOFF.md"),
      "utf8"
    );
    assert.match(handoff, /PROD_OPS_7D_01_30_DAY_OPERATIONS_HANDOFF_RECORDED/);
    assert.match(handoff, /CONTINUE_CONSTRAINED_PRODUCTION/);
    assert.match(handoff, /whole-platform GA=NOT_APPROVED|Do not announce whole-platform GA/i);
  });
});
