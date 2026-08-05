/**
 * Static validation — Operation A hardened gender package (no Production SQL).
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = path.join(
  root,
  "docs/v5/migrations/production-player-gender-operation-a"
);

const FILES = {
  readme: "00_README.md",
  precheck: "01_PRECHECK_SELECT_ONLY.sql",
  forward: "02_FORWARD_DATA_ONLY.sql",
  postcheck: "03_POSTCHECK_SELECT_ONLY.sql",
  rollback: "04_ROLLBACK_BY_BATCH.sql",
  runbook: "05_OPERATOR_RUNBOOK.md",
  owner: "06_OWNER_DECISION_PACKAGE.md",
  manifest: "07_PACKAGE_MANIFEST.json",
};

function read(name) {
  return fs.readFileSync(path.join(pkgDir, name), "utf8");
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "");
}

test("Operation A package files exist", () => {
  for (const name of Object.values(FILES)) {
    assert.ok(fs.existsSync(path.join(pkgDir, name)), `missing ${name}`);
  }
});

test("forward package contains no CHECK installation on profiles", () => {
  const forward = stripSqlComments(read(FILES.forward));
  assert.equal(/profiles_gender_canonical_chk/i.test(forward), false);
  assert.equal(/\badd\s+constraint\b/i.test(forward), false);
  assert.equal(/\bvalidate\s+constraint\b/i.test(forward), false);
  assert.equal(/\bcheck\s*\(/i.test(forward), false);
});

test("forward package contains no ALTER TABLE on profiles", () => {
  const forward = stripSqlComments(read(FILES.forward));
  assert.equal(/alter\s+table\s+public\.profiles/i.test(forward), false);
  assert.equal(/alter\s+table\s+profiles/i.test(forward), false);
});

test("forward targets exact Nam -> male with ledger join", () => {
  const forward = stripSqlComments(read(FILES.forward));
  assert.match(forward, /gender\s*=\s*'Nam'/);
  assert.match(forward, /gender\s*=\s*'male'/);
  assert.match(forward, /_ppdr_op_a_ledger/);
  assert.match(forward, /from\s+public\._ppdr_op_a_ledger/i);
  assert.match(forward, /l\.profile_id\s*=\s*p\.id/i);
});

test("forward asserts exact captured and updated counts of 4", () => {
  const forward = stripSqlComments(read(FILES.forward));
  assert.match(forward, /v_expected\s+int\s*:=\s*4/);
  assert.match(forward, /v_captured\s*<>\s*v_expected/);
  assert.match(forward, /v_updated\s*<>\s*v_expected/);
});

test("forward has updated_at drift guard", () => {
  const forward = stripSqlComments(read(FILES.forward));
  assert.match(
    forward,
    /p\.updated_at\s+is\s+not\s+distinct\s+from\s+l\.original_updated_at/i
  );
});

test("forward is transactional with concurrency guard", () => {
  const forward = read(FILES.forward);
  const body = stripSqlComments(forward);
  assert.match(body, /\bbegin\s*;/i);
  assert.match(body, /\bcommit\s*;/i);
  assert.match(body, /pg_advisory_xact_lock/);
});

test("rollback is batch-specific and refuses post-operation drift", () => {
  const rollback = stripSqlComments(read(FILES.rollback));
  assert.match(rollback, /__OPERATOR_BATCH_ID__/);
  assert.match(rollback, /op_a_rollback_blocked:\s*post-operation drift/i);
  assert.match(rollback, /p\.updated_at\s+is\s+distinct\s+from\s+b\.applied_at/i);
  assert.match(rollback, /original_gender/);
  assert.match(rollback, /original_updated_at/);
  assert.match(rollback, /status\s*=\s*'rolled_back'/);
});

test("package excludes QA / Auth mutation / hard delete", () => {
  const forward = stripSqlComments(read(FILES.forward));
  const rollback = stripSqlComments(read(FILES.rollback));
  const joined = `${forward}\n${rollback}`;
  assert.equal(/\bban_duration\b/i.test(joined), false);
  assert.equal(/auth\.users/i.test(joined), false);
  assert.equal(/quarantine/i.test(joined), false);
  assert.equal(/\bdelete\s+from\s+public\.profiles\b/i.test(joined), false);
  assert.equal(/\btruncate\b/i.test(joined), false);
});

test("precheck is SELECT-oriented and expects count gate of 4", () => {
  const precheck = read(FILES.precheck);
  const active = stripSqlComments(precheck);
  assert.match(active, /expected_target_count/);
  assert.match(active, /STOP_COUNT_DRIFT|PASS_COUNT/);
  assert.equal(/\bupdate\s+public\.profiles\b/i.test(active), false);
  assert.equal(/\binsert\s+into\s+public\.profiles\b/i.test(active), false);
  assert.equal(/\bdelete\s+from\b/i.test(active), false);
});

test("docs do not claim applied or Production GO", () => {
  const texts = [
    read(FILES.readme),
    read(FILES.runbook),
    read(FILES.owner),
    read(FILES.manifest),
    read(FILES.forward),
  ].join("\n");
  assert.match(texts, /Production GO.*NO|productionGo": "NO"/i);
  assert.match(texts, /NOT APPLIED|PACKAGE_NOT_APPLIED|not applied/i);
  assert.equal(/Production execution is approved/i.test(texts), false);
  assert.equal(/PRODUCTION_GO\s*=\s*YES/i.test(texts), false);
});

test("owner package requires explicit PITR choice without choosing", () => {
  const owner = read(FILES.owner);
  assert.match(owner, /NOT_PROVEN/);
  assert.match(owner, /BLOCK/);
  assert.match(owner, /ACCEPT limited no-PITR risk/i);
  assert.match(owner, /does not choose A or B/i);
});

test("manifest marks data-only and Operation B excluded", () => {
  const manifest = JSON.parse(read(FILES.manifest));
  assert.equal(manifest.dataOnly, true);
  assert.equal(manifest.profilesCheckConstraintExcluded, true);
  assert.equal(manifest.operationBExcluded, true);
  assert.equal(manifest.applied, false);
  assert.equal(manifest.expectedTargetCount, 4);
  assert.equal(manifest.sqlExecutedDuringPackageDevelopment, false);
});

test("package SQL files are offline artifacts (no live connection settings)", () => {
  const forward = read(FILES.forward);
  const precheck = read(FILES.precheck);
  const rollback = read(FILES.rollback);
  const joined = `${forward}\n${precheck}\n${rollback}`;
  assert.equal(/service_role|eyJ[A-Za-z0-9_-]{20,}\./i.test(joined), false);
  assert.equal(/postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i.test(joined), false);
});
