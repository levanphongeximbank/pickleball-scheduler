import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../docs/v6/staging-anon-rpc-allowlist-remediation-01/", import.meta.url);
const applySql = fs.readFileSync(new URL("01_APPLY.sql", root), "utf8");
const verifySql = fs.readFileSync(new URL("02_VERIFY.sql", root), "utf8");
const rollbackSql = fs.readFileSync(new URL("03_ROLLBACK.sql", root), "utf8");
const certification = JSON.parse(
  fs.readFileSync(new URL("POST_APPLY_CERTIFICATION.json", root), "utf8"),
);

test("anonymous allowlist contains exactly seven exact overloads", () => {
  const entries = applySql.match(/'public\.[^']+'::regprocedure/g) ?? [];
  assert.equal(entries.length, 7);
  assert.equal(new Set(entries).size, 7);
});

test("apply snapshots ACL, revokes PUBLIC and anon, and hardens defaults", () => {
  assert.match(applySql, /security_definer_acl_snapshot_01/i);
  assert.match(applySql, /revoke execute on functions from anon/i);
  assert.match(applySql, /revoke execute on function %s from public, anon/i);
  assert.match(applySql, /grant execute on function %s to anon/i);
  assert.doesNotMatch(applySql, /revoke execute on function %s from authenticated/i);
});

test("verification is exact and rollback consumes the snapshot", () => {
  assert.match(verifySql, /anon_callable/i);
  assert.match(verifySql, /pseudo_public_callable/i);
  assert.match(verifySql, /default_anon_execute/i);
  assert.match(rollbackSql, /had_pseudo_public_execute/i);
  assert.match(rollbackSql, /had_anon_execute/i);
  assert.match(rollbackSql, /grant execute on functions to anon/i);
});

test("post-apply evidence binds catalog and runtime outcomes", () => {
  assert.equal(certification.migration.version, "20260804082418");
  assert.equal(certification.catalog.anonCallableAfter, 7);
  assert.equal(certification.catalog.pseudoPublicCallableAfter, 0);
  assert.equal(certification.catalog.defaultAnonExecuteAfter, false);
  assert.equal(certification.runtime.anonymousAllowlistPositive.passed, 7);
  assert.equal(certification.runtime.anonymousPrivilegedNegative.passed, 3);
  assert.equal(certification.runtime.crossTenantLeak, false);
  assert.equal(certification.productionGo, false);
});
