/**
 * REPORTING-03 — Staging apply manifest static checks (never executes apply).
 */

import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(
  root,
  "docs",
  "reporting-analytics",
  "reporting-02",
  "05_STAGING_APPLY_MANIFEST.md"
);

test("REPORTING-03 staging apply manifest exists and targets Staging only", () => {
  assert.ok(statSync(manifestPath).isFile());
  const body = readFileSync(manifestPath, "utf8");
  assert.match(body, /qyewbxjsiiyufanzcjcq/);
  assert.match(body, /expuvcohlcjzvrrauvud/);
  assert.match(body, /Production.*prohibited|No Production/i);
  assert.match(body, /REPORTING_03_STAGING_APPLY_NOT_AUTHORIZED/);
  assert.match(body, /DO NOT EXECUTE|Not authorized to run/i);
});

test("REPORTING-03 manifest encodes correct SQL order and backup/hash prerequisites", () => {
  const body = readFileSync(manifestPath, "utf8");
  const order = [
    "10_REPORTING_02_TABLES.sql",
    "20_REPORTING_02_INDEXES.sql",
    "30_REPORTING_02_RLS.sql",
    "40_REPORTING_02_PERMISSION_SEED.sql",
    "50_REPORTING_02_GRANTS.sql",
    "99_REPORTING_02_VERIFICATION.sql",
  ];
  let last = -1;
  for (const file of order) {
    const idx = body.indexOf(file);
    assert.ok(idx > last, `missing or out of order: ${file}`);
    last = idx;
  }
  assert.match(body, /SHA256/i);
  assert.match(body, /logical backup/i);
  assert.match(body, /90_REPORTING_02_ROLLBACK\.sql/);
  assert.match(body, /91_REPORTING_02_PERMISSION_SEED_ROLLBACK\.sql/);
  assert.doesNotMatch(body, /eyJ[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(body, /SUPABASE_SERVICE_ROLE/i);
  assert.doesNotMatch(body, /\b(?:psql|supabase db push)\b/i);
  assert.doesNotMatch(body, /apply_migration/i);
});
