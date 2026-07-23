/**
 * Phase 1H — Staging certification evidence (offline).
 * Does NOT connect to Supabase. Does NOT embed credentials.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stagingDir = path.join(root, "src/features/finance/persistence/staging");
const forwardSql = path.join(root, "docs/supabase-finance-phase1f.sql");
const rollbackSql = path.join(root, "docs/supabase-finance-phase1f-rollback.sql");

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const FORWARD_SHA256 =
  "0310905a5fba1ca2028d841c612f9cd7fcf22a5db96d7d9c4d81da3354050d00";
const ROLLBACK_SHA256 =
  "b86921d7571c6861c0ec3a5464d87af7fd8f740000e55bfe6785535b8c40ea95";

function sha256File(absPath) {
  return createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(stagingDir, name), "utf8"));
}

function assertNoSecrets(text) {
  // JWT-shaped tokens / assigned secret values — not role names or credential *kinds*.
  assert.doesNotMatch(text, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  assert.doesNotMatch(text, /SUPABASE_ACCESS_TOKEN\s*=\s*\S+/i);
  assert.doesNotMatch(text, /service_role['"]\s*:\s*['"][^"']{20,}/i);
  assert.doesNotMatch(text, /postgresql:\/\/[^:\s]+:[^@\s]+@/i);
}

test("1H evidence files exist and declare Staging-only certification", () => {
  const md = fs.readFileSync(
    path.join(stagingDir, "PHASE_1H_STAGING_CERTIFICATION.md"),
    "utf8"
  );
  assert.match(md, /qyewbxjsiiyufanzcjcq/);
  assert.match(md, /Production was not accessed for write/i);
  assert.match(md, /READY WITH CONDITIONS|STAGING/);
  assert.doesNotMatch(md, new RegExp(`apply.*${PRODUCTION_REF}`, "i"));
  assertNoSecrets(md);
});

test("1H SQL checksums match committed forward/rollback files", () => {
  assert.equal(sha256File(forwardSql).toLowerCase(), FORWARD_SHA256);
  assert.equal(sha256File(rollbackSql).toLowerCase(), ROLLBACK_SHA256);
  assert.notEqual(FORWARD_SHA256, ROLLBACK_SHA256);
});

test("1H APPLY_REPORT records Staging identity and no Production touch", () => {
  const report = readJson("APPLY_REPORT.json");
  assert.equal(report.stagingRef, STAGING_REF);
  assert.equal(report.productionTouched, false);
  assert.equal(report.projectIdentity?.ref, STAGING_REF);
  assert.match(String(report.projectIdentity?.name || ""), /stagin/i);
  assert.doesNotMatch(String(report.projectIdentity?.name || ""), /production/i);
  assert.equal(report.forwardSha256.toLowerCase(), FORWARD_SHA256);
  assert.equal(report.rollbackSha256.toLowerCase(), ROLLBACK_SHA256);
  assertNoSecrets(JSON.stringify(report));
});

test("1H schema inventory lists 11 finance tables with RLS + force RLS", () => {
  const summary = readJson("SCHEMA_INVENTORY_SUMMARY.json");
  assert.equal(summary.tables.length, 11);
  assert.equal((summary.anon_grants || []).length, 0);
  for (const table of summary.tables) {
    assert.equal(table.rls, true, table.name);
    assert.equal(table.force_rls, true, table.name);
    assert.equal(table.has_tenant_id, true, table.name);
    assert.ok(Array.isArray(table.pk) && table.pk.includes("id"), table.name);
  }
});

test("1H RLS/adapter report proves two tenants and adapter pass", () => {
  const rls = readJson("RLS_ADAPTER_QA_REPORT.json");
  assert.equal(rls.stagingRef, STAGING_REF);
  assert.equal(rls.productionTouched, false);
  assert.equal(rls.rlsTenantIsolationPass, true);
  assert.equal(rls.adapterCertification?.pass, true);
  assert.notEqual(rls.tenantContext?.venueA, rls.tenantContext?.venueB);
  assert.equal(rls.checks?.anonSelectDenied?.pass, true);
  assert.equal(rls.checks?.tenantACannotInsertForB?.pass, true);
  assertNoSecrets(JSON.stringify(rls));
});

test("1H supplemental integrity QA passed and cleaned mutable FINANCE_QA rows", () => {
  const qa = readJson("SUPPLEMENTAL_INTEGRITY_QA.json");
  assert.equal(qa.status, "PASS");
  assert.equal(qa.productionTouched, false);
  assert.equal(qa.qa?.receipt_update_policies, 0);
  assert.equal(qa.qa?.event_mut_policies, 0);
  assert.equal(qa.cleanup?.remaining_payments, 0);
  assert.equal(qa.cleanup?.remaining_receipts, 0);
  assert.ok(Array.isArray(qa.cleanup?.retained_events));
  assert.ok(qa.cleanup.retained_events.length >= 1);
});
