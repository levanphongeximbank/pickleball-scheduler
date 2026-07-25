/**
 * REPORTING-03 — permission seed package static tests (no remote apply).
 */

import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { REPORTING_PERMISSION_VALUES } from "../src/features/reporting-analytics/constants/permissions.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlDir = path.join(root, "docs", "reporting-analytics", "reporting-02");

const seedPath = path.join(sqlDir, "40_REPORTING_02_PERMISSION_SEED.sql");
const seedRollbackPath = path.join(
  sqlDir,
  "91_REPORTING_02_PERMISSION_SEED_ROLLBACK.sql"
);
const handoffPath = path.join(sqlDir, "04_IDENTITY_PERMISSION_HANDOFF.md");
const verificationPath = path.join(sqlDir, "99_REPORTING_02_VERIFICATION.sql");
const readmePath = path.join(sqlDir, "README.md");

const seed = () => readFileSync(seedPath, "utf8");
const seedRollback = () => readFileSync(seedRollbackPath, "utf8");
const verification = () => readFileSync(verificationPath, "utf8");
const readme = () => readFileSync(readmePath, "utf8");
const handoff = () => readFileSync(handoffPath, "utf8");

test("REPORTING-03 permission seed files exist", () => {
  assert.ok(statSync(seedPath).isFile());
  assert.ok(statSync(seedRollbackPath).isFile());
  assert.ok(statSync(handoffPath).isFile());
});

test("REPORTING-03 seed registers exact REPORTING-01 permission ids", () => {
  assert.equal(REPORTING_PERMISSION_VALUES.length, 10);
  const body = seed();
  for (const id of REPORTING_PERMISSION_VALUES) {
    assert.match(body, new RegExp(`'${id.replace(/\./g, "\\.")}'`));
    assert.match(
      body,
      new RegExp(
        `WHERE NOT EXISTS \\([\\s\\S]*?p\\.id = '${id.replace(/\./g, "\\.")}'`
      )
    );
    assert.match(handoff(), new RegExp(id.replace(/\./g, "\\.")));
    assert.match(verification(), new RegExp(`'${id.replace(/\./g, "\\.")}'`));
  }
});

test("REPORTING-03 seed is catalog-only and fail-closed on role grants", () => {
  const body = seed();
  assert.doesNotMatch(body, /INSERT\s+INTO\s+public\.role_permissions/i);
  assert.doesNotMatch(body, /^\s*GRANT\b/im);
  assert.match(body, /Role grants are INTENTIONALLY ABSENT/i);
  assert.match(body, /WHERE NOT EXISTS/i);
  assert.doesNotMatch(body, /^\s*\\?\s*psql\b/im);
  assert.doesNotMatch(body, /^\s*supabase\s+db\s+push\b/im);
  assert.doesNotMatch(body, /apply_migration/i);
});

test("REPORTING-03 seed does not broadly invent privileged grants in SQL text", () => {
  const body = seed();
  assert.doesNotMatch(body, /INSERT\s+INTO\s+public\.role_permissions/i);
  assert.doesNotMatch(body, /INSERT\s+INTO\s+public\.roles\b/i);
  assert.match(handoff(), /Does \*\*not\*\* assign roles/i);
  assert.match(handoff(), /fail-closed/i);
});

test("REPORTING-03 permission seed rollback is scoped and refuses referenced rows", () => {
  const body = seedRollback();
  for (const id of REPORTING_PERMISSION_VALUES) {
    assert.match(body, new RegExp(`'${id.replace(/\./g, "\\.")}'`));
  }
  assert.match(body, /role_permissions/);
  assert.match(body, /REPORTING_02_PERMISSION_SEED_ROLLBACK_REFUSED/);
  assert.match(body, /DELETE FROM public\.permissions/);
  assert.doesNotMatch(body, /DELETE FROM public\.role_permissions/i);
  assert.doesNotMatch(body, /DELETE FROM public\.permissions\s*;/i);
});

test("REPORTING-03 README apply order places seed before grants", () => {
  const body = readme();
  assert.match(body, /40_REPORTING_02_PERMISSION_SEED\.sql/);
  assert.match(body, /91_REPORTING_02_PERMISSION_SEED_ROLLBACK\.sql/);
  const seedIdx = body.indexOf("40_REPORTING_02_PERMISSION_SEED.sql");
  const grantsIdx = body.indexOf("50_REPORTING_02_GRANTS.sql");
  assert.ok(seedIdx > 0 && grantsIdx > seedIdx);
});
