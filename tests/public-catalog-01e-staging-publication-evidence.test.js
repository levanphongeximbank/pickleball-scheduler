/**
 * PUBLIC-CATALOG-01E — Staging publication evidence package locks.
 * Run: node --test tests/public-catalog-01e-staging-publication-evidence.test.js
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG = "docs/public-catalog/pc-01/staging-publication-evidence";
const EVIDENCE = `${PKG}/evidence`;

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

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

const REQUIRED_EVIDENCE = [
  "PRECHECK.json",
  "BASELINE_SNAPSHOT.json",
  "SEED_MANIFEST.json",
  "SEED_APPLY_RESULT.json",
  "PUBLIC_CLUB_RPC_RESULT.json",
  "PUBLIC_COURT_RPC_RESULT.json",
  "PRIVATE_CONTROL_EXCLUSION.json",
  "FIELD_ALLOWLIST_VERIFICATION.json",
  "PAGINATION_ORDER_VERIFICATION.json",
  "SECURITY_BOUNDARY_VERIFICATION.json",
  "ROLLBACK_RESULT.json",
  "POST_ROLLBACK_SNAPSHOT.json",
  "TEST_RESULTS.json",
  "FINAL_CERTIFICATION.json",
];

test("01E: seed package is fail-safe exact-ID insert only", () => {
  const sql = stripSqlComments(read(`${PKG}/10_PC01E_STAGING_SEED.sql`));
  assert.match(sql, /PICKVN_PC01E_PUBLIC_CLUB/);
  assert.match(sql, /PICKVN_PC01E_PRIVATE_CLUB/);
  assert.match(sql, /PICKVN_PC01E_PUBLIC_COURT/);
  assert.match(sql, /PICKVN_PC01E_PRIVATE_COURT/);
  assert.match(sql, /PC01E_SEED_CONFLICT/);
  assert.match(sql, /is_publicly_listed[\s\S]*true/);
  assert.match(sql, /is_publicly_listed[\s\S]*false/);
  assert.doesNotMatch(sql, /grant\s+|revoke\s+|alter\s+function|create\s+or\s+replace\s+function/i);
  assert.doesNotMatch(sql, /update\s+public\.(clubs|venues|public_catalog_courts)/i);
  assert.doesNotMatch(sql, /expuvcohlcjzvrrauvud/);
});

test("01E: rollback deletes exact seed IDs only and keeps 01S objects", () => {
  const sql = stripSqlComments(read(`${PKG}/90_PC01E_STAGING_SEED_ROLLBACK.sql`));
  assert.match(sql, /delete\s+from\s+public\.public_catalog_courts[\s\S]*PICKVN_PC01E_PUBLIC_COURT/i);
  assert.match(sql, /delete\s+from\s+public\.clubs[\s\S]*PICKVN_PC01E_PUBLIC_CLUB/i);
  assert.match(sql, /delete\s+from\s+public\.venues[\s\S]*PICKVN_PC01E_VENUE/i);
  assert.match(sql, /PC01E_ROLLBACK_INCOMPLETE/);
  assert.doesNotMatch(sql, /drop\s+(table|function)/i);
  assert.doesNotMatch(sql, /truncate/i);
  assert.doesNotMatch(sql, /where\s+is_publicly_listed/i);
  assert.doesNotMatch(sql, /expuvcohlcjzvrrauvud/);
});

test("01E: evidence package complete and secret-free", () => {
  for (const file of REQUIRED_EVIDENCE) {
    const rel = `${EVIDENCE}/${file}`;
    assert.ok(fs.existsSync(path.join(ROOT, rel)), rel);
    const raw = read(rel);
    assert.doesNotMatch(raw, /service_role.*eyJ|password\s*[:=]\s*[^"*\s]{8,}/i);
    assert.doesNotMatch(raw, /sbp_[a-zA-Z0-9]+/);
  }
});

test("01E: seed/rollback SHA256 match evidence", () => {
  const seedHash = sha256Lf(`${PKG}/10_PC01E_STAGING_SEED.sql`);
  const rbHash = sha256Lf(`${PKG}/90_PC01E_STAGING_SEED_ROLLBACK.sql`);
  const manifest = readJson(`${EVIDENCE}/SEED_MANIFEST.json`);
  const apply = readJson(`${EVIDENCE}/SEED_APPLY_RESULT.json`);
  const rollback = readJson(`${EVIDENCE}/ROLLBACK_RESULT.json`);
  const pre = readJson(`${EVIDENCE}/PRECHECK.json`);
  assert.equal(seedHash, manifest.seedSha256Lf);
  assert.equal(rbHash, manifest.rollbackSha256Lf);
  assert.equal(seedHash, apply.seedSha256Lf);
  assert.equal(rbHash, rollback.rollbackSha256Lf);
  assert.equal(seedHash, pre.safetyBaseline.seedSha256Lf);
  assert.equal(rbHash, pre.safetyBaseline.rollbackSha256Lf);
});

test("01E: FINAL_CERTIFICATION requires rollback complete and staging-only readiness", () => {
  const cert = readJson(`${EVIDENCE}/FINAL_CERTIFICATION.json`);
  assert.equal(cert.verdict, "PASS");
  assert.equal(cert.projectRef, "qyewbxjsiiyufanzcjcq");
  assert.equal(cert.productionTouched, false);
  assert.equal(cert.publicPortalCutover, false);
  assert.equal(cert.readiness.CLUBS_PUBLICATION_PATH, "STAGING_VERIFIED");
  assert.equal(cert.readiness.COURTS_PUBLICATION_PATH, "STAGING_VERIFIED");
  assert.equal(cert.readiness.PUBLIC_DTO_ALLOWLIST, "VERIFIED");
  assert.equal(cert.readiness.PRIVATE_CONTROL_EXCLUSION, "VERIFIED");
  assert.equal(cert.readiness.STAGING_SEED_APPLIED, "YES");
  assert.equal(cert.readiness.STAGING_SEED_ROLLED_BACK, "YES");
  assert.equal(cert.readiness.STAGING_TEST_DATA_REMAINING, 0);
  assert.equal(cert.readiness.STAGING_RPC_STATUS, "ACTIVE_VERIFIED");
  assert.equal(cert.readiness.PRODUCTION_SQL_RLS_APPLIED, "NO");
  assert.equal(cert.readiness.PUBLIC_PORTAL_LIVE_CUTOVER, "NO");
  assert.equal(cert.readiness.PRODUCTION_RUNTIME_READINESS, "NOT_ACHIEVED");
  const post = readJson(`${EVIDENCE}/POST_ROLLBACK_SNAPSHOT.json`);
  assert.equal(post.pc01eNamespaceRemaining, 0);
  assert.equal(post.rowCountsMatchBaseline, true);
});

test("01E: publication evidence proves public visible and private excluded", () => {
  const clubs = readJson(`${EVIDENCE}/PUBLIC_CLUB_RPC_RESULT.json`);
  const courts = readJson(`${EVIDENCE}/PUBLIC_COURT_RPC_RESULT.json`);
  const exclusion = readJson(`${EVIDENCE}/PRIVATE_CONTROL_EXCLUSION.json`);
  assert.equal(clubs.verdict, "PASS");
  assert.equal(courts.verdict, "PASS");
  assert.equal(exclusion.verdict, "PASS");
  assert.ok(clubs.publicClubAppeared);
  assert.ok(courts.publicCourtAppeared);
  assert.equal(exclusion.privateClubAppearedInRpc, false);
  assert.equal(exclusion.privateCourtAppearedInRpc, false);
});

test("01E: security boundary + allowlist + pagination evidence PASS", () => {
  assert.equal(readJson(`${EVIDENCE}/SECURITY_BOUNDARY_VERIFICATION.json`).verdict, "PASS");
  assert.equal(readJson(`${EVIDENCE}/FIELD_ALLOWLIST_VERIFICATION.json`).verdict, "PASS");
  assert.equal(readJson(`${EVIDENCE}/PAGINATION_ORDER_VERIFICATION.json`).verdict, "PASS");
});
