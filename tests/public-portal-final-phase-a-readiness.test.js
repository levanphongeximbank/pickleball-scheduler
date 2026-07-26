/**
 * PUBLIC-PORTAL-FINAL Phase A — Production readiness audit tests.
 * Deterministic / filesystem evidence only. No Production mutation.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PUBLIC_CLUBS_COURTS_SOURCE,
  resolvePublicClubsCourtsSource,
} from "../src/features/public-portal/services/publicClubsCourtsDataSource.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE = "docs/public-portal/public-portal-final/evidence";

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function sha256Lf(rel) {
  const text = readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

const REQUIRED_EVIDENCE = [
  "PRODUCTION_TARGET.json",
  "PRE_ROLLOUT_SNAPSHOT.json",
  "SQL_APPLY_RESULT.json",
  "RPC_VERIFICATION.json",
  "ANON_SECURITY_BOUNDARY.json",
  "PRIVACY_ALLOWLIST.json",
  "ENV_CUTOVER.json",
  "DEPLOYMENT_RESULT.json",
  "CLUBS_SMOKE.json",
  "COURTS_SMOKE.json",
  "ERROR_FAIL_CLOSED.json",
  "MOCK_FALLBACK_DISABLED.json",
  "ROLLBACK_READINESS.json",
  "PUBLICATION_COUNTS.json",
  "TEST_RESULTS.json",
  "FINAL_ROLLOUT_CERTIFICATION.json",
];

test("FINAL: required Phase A evidence files exist", () => {
  for (const name of REQUIRED_EVIDENCE) {
    assert.equal(existsSync(path.join(ROOT, EVIDENCE, name)), true, name);
  }
  assert.equal(existsSync(path.join(ROOT, "docs/public-portal/public-portal-final/01_PRODUCTION_READINESS.md")), true);
  assert.equal(existsSync(path.join(ROOT, "docs/public-portal/public-portal-final/sql/90_PUBLIC_PORTAL_FINAL_PRODUCTION_DB_ROLLBACK.sql")), true);
});

test("FINAL: Production target hard gate PASS and not Staging", () => {
  const target = readJson(`${EVIDENCE}/PRODUCTION_TARGET.json`);
  assert.equal(target.verdict, "PASS");
  assert.equal(target.productionProjectRef, "expuvcohlcjzvrrauvud");
  assert.equal(target.stagingBlocklistRef, "qyewbxjsiiyufanzcjcq");
  assert.equal(target.isStaging, false);
  assert.equal(target.targetAmbiguity, false);
  assert.equal(target.fingerprint.catalogRpcPresent, false);
  assert.equal(target.currentSourceMode, "local");
  assert.equal(target.canonicalDeploymentPlatform, "vercel");
  assert.match(target.canonicalDomain, /pickleball-scheduler-eight\.vercel\.app/);
});

test("FINAL: empty catalog hard gate blocks Production GO", () => {
  const counts = readJson(`${EVIDENCE}/PUBLICATION_COUNTS.json`);
  const final = readJson(`${EVIDENCE}/FINAL_ROLLOUT_CERTIFICATION.json`);
  assert.equal(counts.verdict, "FAIL_EMPTY_CATALOG");
  assert.equal(counts.counts.publicClubsEligible, 0);
  assert.equal(counts.counts.publicCourtsEligible, 0);
  assert.equal(counts.canonicalPublicationConfigPresent, false);
  assert.equal(counts.dataMutationAllowedInThisWorkstream, false);
  assert.equal(counts.blockerCode, "PUBLIC_PORTAL_FINAL_PRODUCTION_NO_GO_EMPTY_CATALOG");
  assert.equal(final.verdict, "PUBLIC_PORTAL_FINAL_PRODUCTION_NO_GO_EMPTY_CATALOG");
  assert.equal(final.awaitingProductionGo, false);
  assert.equal(final.sqlApplied, false);
  assert.equal(final.envCutover, false);
  assert.equal(final.productionUntouchedMutations, true);
  assert.equal(final.productionMutationCheck.sqlOrRlsApplied, false);
  assert.equal(final.productionMutationCheck.vitePublicClubsCourtsSourceChanged, false);
  assert.equal(final.productionMutationCheck.deployPerformed, false);
  assert.equal(final.productionMutationCheck.dataMutated, false);
  assert.equal(final.rootCause.publicClubsCountFail, true);
  assert.equal(final.rootCause.publicCourtsCountFail, true);
  assert.equal(final.rootCause.cutoverWouldEmptyProductionPortal, true);
  assert.equal(final.rootCause.failClosedMandatory, true);
  assert.equal(final.conditionsToReopenRollout.length >= 5, true);
  assert.match(final.conditionsToReopenRollout.join(" | "), /opt-in public/i);
  assert.match(final.conditionsToReopenRollout.join(" | "), /Privacy\/DTO allowlist/i);
  assert.match(final.conditionsToReopenRollout.join(" | "), /not synthetic/i);
  assert.match(final.conditionsToReopenRollout.join(" | "), /rollback/i);
  assert.equal(final.noGoCertification, "PUBLIC_PORTAL_FINAL_NO_GO_READY_FOR_OWNER_MERGE");
});

test("FINAL: TEST_RESULTS gate outputs are executed (no PENDING_EXECUTION)", () => {
  const results = readJson(`${EVIDENCE}/TEST_RESULTS.json`);
  const blob = JSON.stringify(results);
  assert.doesNotMatch(blob, /PENDING_EXECUTION/);
  assert.equal(results.verdict, "PASS_PHASE_A_GATES");
  assert.equal(results.fullUnit.fail, 0);
  assert.equal(results.fullUnit.exitCode, 0);
  assert.equal(results.lintNoNew.exitCode, 0);
  assert.equal(results.ciFoundationLock.exitCode, 0);
  assert.equal(results.build.exitCode, 0);
  assert.equal(results.hygieneHashes.unchangedBeforeAfterFullUnit, true);
});

test("FINAL: SQL not applied; rollback artifacts trusted", () => {
  const sql = readJson(`${EVIDENCE}/SQL_APPLY_RESULT.json`);
  const rb = readJson(`${EVIDENCE}/ROLLBACK_READINESS.json`);
  const rollbackSql = read("docs/public-portal/public-portal-final/sql/90_PUBLIC_PORTAL_FINAL_PRODUCTION_DB_ROLLBACK.sql");
  assert.equal(sql.applied, false);
  assert.equal(rb.verdict, "PASS");
  assert.equal(rb.databaseRollback.dropsBaseTables, false);
  assert.equal(rb.databaseRollback.deletesBusinessRows, false);
  assert.match(rollbackSql, /REVOKE ALL ON FUNCTION public\.public_catalog_list_clubs/);
  assert.match(rollbackSql, /DROP FUNCTION IF EXISTS public\.public_catalog_list_courts/);
  assert.match(rollbackSql, /DROP TABLE IF EXISTS public\.public_catalog_courts/);
  assert.doesNotMatch(rollbackSql, /DROP TABLE IF EXISTS public\.clubs/);
});

test("FINAL: package SQL security static contracts remain intact", () => {
  const sql = read("docs/public-catalog/pc-01/10_PUBLIC_CATALOG_01_PUBLIC_READ_RPC.sql");
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path = public, pg_temp/);
  assert.doesNotMatch(sql, /EXECUTE\s+format|EXECUTE\s+'/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.public_catalog_list_clubs/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.public_catalog_list_courts/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.public_catalog_courts FROM anon/);
  assert.match(sql, /is_publicly_listed = true/);
  assert.match(sql, /p_limit > 50/);
  assert.match(sql, /ORDER BY e\.display_name ASC, e\.id ASC/);
});

test("FINAL: Production selector default remains local", () => {
  const prev = process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE;
  delete process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE;
  try {
    assert.equal(resolvePublicClubsCourtsSource(), PUBLIC_CLUBS_COURTS_SOURCE.LOCAL);
  } finally {
    if (prev == null) delete process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE;
    else process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE = prev;
  }
});

test("FINAL: hygiene APPLY_REFUSED evidence hashes are stable fixtures", () => {
  assert.equal(
    sha256Lf("docs/coaching-training/coaching-03/evidence/APPLY_REFUSED.json"),
    "d3bf8d425fd85557c2e9289c93db211e4f1fdd1210341b8914301c243dcc802f"
  );
  assert.equal(
    sha256Lf("docs/player-management/pm-id-01/activation/evidence/APPLY_REFUSED_NO_GO.json"),
    "f1b6977c9bb5d0eb5a41593bc9a5049be1b65b71285d115880bb58d19bd4af3e"
  );
});

test("FINAL: no secrets in evidence payloads", () => {
  for (const name of REQUIRED_EVIDENCE) {
    const text = read(`${EVIDENCE}/${name}`);
    assert.doesNotMatch(text, /service_role|eyJhbGciOi|password\s*[:=]/i);
    const json = JSON.parse(text);
    assert.equal(json.secretsPrinted, false);
  }
});
