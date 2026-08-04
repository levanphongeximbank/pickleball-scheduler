import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../docs/v6/staging-advisor-warn-remediation-01/", import.meta.url);
const applySql = fs.readFileSync(new URL("01_APPLY.sql", root), "utf8");
const verifySql = fs.readFileSync(new URL("02_VERIFY.sql", root), "utf8");
const rollbackSql = fs.readFileSync(new URL("03_ROLLBACK.sql", root), "utf8");

test("apply hardens exactly 22 Advisor-listed function signatures", () => {
  const alters = applySql.match(/alter function public\.[^;]+ set search_path = pg_catalog, public;/gi) ?? [];
  assert.equal(alters.length, 22);
  assert.equal(new Set(alters.map((line) => line.toLowerCase())).size, 22);
});

test("three target policies are explicit fail-closed policies", () => {
  for (const policy of [
    "club_membership_requests_update",
    "court_claim_requests_update",
    "rating_v5_review_no_client_write",
  ]) {
    const start = applySql.indexOf(`create policy ${policy}`);
    assert.notEqual(start, -1, `${policy} is missing`);
    const block = applySql.slice(start, applySql.indexOf(";", start) + 1);
    assert.match(block, /using \(false\)/i);
    assert.match(block, /with check \(false\)/i);
  }
});

test("verification and rollback are present and symmetric", () => {
  assert.match(verifySql, /hardened_functions/i);
  assert.match(verifySql, /broad_target_policy_count/i);
  const resets = rollbackSql.match(/alter function public\.[^;]+ reset search_path;/gi) ?? [];
  assert.equal(resets.length, 22);
  assert.match(rollbackSql, /with check \(true\)/i);
});

