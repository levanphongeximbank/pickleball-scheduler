/**
 * PUBLIC-CATALOG-01S — Staging activation package locks.
 * Run: node --test tests/public-catalog-01s-staging-activation.test.js
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE = "docs/public-catalog/pc-01/staging-activation/evidence";

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function sha256Lf(rel) {
  const text = read(rel).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

const REQUIRED_EVIDENCE = [
  "ACTIVATION_MANIFEST.json",
  "PRECHECK.json",
  "APPLY_RESULT.json",
  "OBJECT_VERIFICATION.json",
  "ANON_RPC_VERIFICATION.json",
  "PRIVACY_BOUNDARY_VERIFICATION.json",
  "DIRECT_TABLE_ACCESS_DENIED.json",
  "MUTATION_DENIED.json",
  "ROLLBACK_READINESS.json",
  "TEST_RESULTS.json",
  "FINAL_CERTIFICATION.json",
];

test("01S: rollback package revokes EXECUTE and drops PC-01 objects only", () => {
  const sql = read("docs/public-catalog/pc-01/11_PUBLIC_CATALOG_01_STAGING_ROLLBACK.sql");
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.public_catalog_list_clubs/i);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.public_catalog_list_courts/i);
  assert.match(sql, /drop\s+function\s+if\s+exists\s+public\.public_catalog_list_clubs/i);
  assert.match(sql, /drop\s+function\s+if\s+exists\s+public\.public_catalog_list_courts/i);
  assert.match(sql, /drop\s+table\s+if\s+exists\s+public\.public_catalog_courts/i);
  assert.doesNotMatch(sql, /drop\s+table\s+if\s+exists\s+public\.clubs/i);
  assert.doesNotMatch(sql, /truncate/i);
  assert.doesNotMatch(sql, /expuvcohlcjzvrrauvud/i);
});

test("01S: evidence package complete and secret-free", () => {
  for (const file of REQUIRED_EVIDENCE) {
    const rel = `${EVIDENCE}/${file}`;
    assert.ok(fs.existsSync(path.join(ROOT, rel)), rel);
    const raw = read(rel);
    assert.doesNotMatch(raw, /service_role.*eyJ|password\s*[:=]\s*[^"*\s]{8,}/i);
    assert.doesNotMatch(raw, /sbp_[a-zA-Z0-9]+/);
  }
});

test("01S: FINAL_CERTIFICATION readiness flags are staging-only", () => {
  const cert = readJson(`${EVIDENCE}/FINAL_CERTIFICATION.json`);
  assert.equal(cert.verdict, "PASS");
  assert.equal(cert.readiness.STAGING_SQL_RLS_APPLIED, "YES");
  assert.equal(cert.readiness.PRODUCTION_SQL_RLS_APPLIED, "NO");
  assert.equal(cert.readiness.PUBLIC_PORTAL_LIVE_CUTOVER, "NO");
  assert.equal(cert.readiness.PRODUCTION_RUNTIME_READINESS, "NOT_ACHIEVED");
  assert.equal(cert.projectRef, "qyewbxjsiiyufanzcjcq");
  assert.equal(cert.productionTouched, false);
  assert.equal(cert.rollbackExecuted, false);
});

test("01S: SQL and rollback SHA256 match evidence", () => {
  const sqlHash = sha256Lf("docs/public-catalog/pc-01/10_PUBLIC_CATALOG_01_PUBLIC_READ_RPC.sql");
  const rbHash = sha256Lf("docs/public-catalog/pc-01/11_PUBLIC_CATALOG_01_STAGING_ROLLBACK.sql");
  const apply = readJson(`${EVIDENCE}/APPLY_RESULT.json`);
  const pre = readJson(`${EVIDENCE}/PRECHECK.json`);
  assert.equal(sqlHash, apply.sqlSha256Lf);
  assert.equal(rbHash, apply.rollbackSha256Lf);
  assert.equal(sqlHash, pre.safetyBaseline.sqlSha256Lf);
  assert.equal(rbHash, pre.safetyBaseline.rollbackSha256Lf);
});

test("01S: portal cutover not present in activation docs", () => {
  const readiness = read(
    "docs/public-catalog/pc-01/staging-activation/01_STAGING_ACTIVATION_READINESS.md"
  );
  assert.match(readiness, /PUBLIC_PORTAL_LIVE_CUTOVER=NO/);
  assert.match(readiness, /PRODUCTION_SQL_RLS_APPLIED=NO/);
  assert.doesNotMatch(readiness, /portal cutover activated/i);
});
