import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SQL_DIR = path.join(
  process.cwd(),
  "docs/platform-core-wave5-club-context-closure/sql-design"
);

const PACKAGE_FILES = [
  "00_README.md",
  "01_PRECHECK.sql",
  "02_APPLY_DESIGN.sql",
  "03_VERIFY.sql",
  "04_ROLLBACK_DESIGN.md",
];

function readPkg(name) {
  return fs.readFileSync(path.join(SQL_DIR, name), "utf8");
}

function uncommented(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

test("Wave5 SQL design files exist", () => {
  for (const name of PACKAGE_FILES) {
    assert.equal(fs.existsSync(path.join(SQL_DIR, name)), true, name);
  }
});

test("Wave5 SQL package is design-only and forbids live execution", () => {
  const all = PACKAGE_FILES.map((name) => readPkg(name)).join("\n");
  assert.match(all, /WAVE5_SQL_DESIGN_ONLY/);
  assert.match(all, /OWNER_SQL_EXECUTION_GO=NO/);
  assert.match(all, /DO_NOT_RUN_ON_STAGING/);
  assert.match(all, /DO_NOT_RUN_ON_PRODUCTION/);
  assert.doesNotMatch(all, /SQL_EXECUTED=YES/);
  assert.doesNotMatch(all, /PRODUCTION_ACCESS_GO = YES/);
});

test("Wave5 PRECHECK is fail-closed inventory", () => {
  const precheck = readPkg("01_PRECHECK.sql");
  const body = uncommented(precheck);
  assert.match(precheck, /WAVE5_PRECHECK_FAIL/);
  assert.match(precheck, /clubs/);
  assert.match(precheck, /platform_tenants/);
  assert.match(precheck, /venues/);
  assert.match(body, /tenant_id/);
  assert.doesNotMatch(body, /\bINSERT\s+INTO\b/i);
  assert.doesNotMatch(body, /\bUPDATE\s+public\./i);
  assert.doesNotMatch(body, /\bDELETE\s+FROM\b/i);
});

test("Wave5 APPLY design targets platform_tenants and does not add clubs.venue_id", () => {
  const apply = readPkg("02_APPLY_DESIGN.sql");
  assert.match(apply, /clubs_tenant_id_platform_tenants_fkey/);
  assert.match(apply, /platform_is_canonical_tenant_entitled/);
  assert.match(apply, /scope_semantics/);
  assert.match(apply, /canonical_tenant_id/);
  assert.match(apply, /ON DELETE RESTRICT/);
  assert.doesNotMatch(apply, /ADD COLUMN[\s\S]*venue_id/i);
  assert.doesNotMatch(uncommented(apply), /DROP FUNCTION[\s\S]*phase42_is_tenant_member/i);
});

test("Wave5 APPLY Club RPC/RLS do not globally retire phase42 helper", () => {
  const apply = readPkg("02_APPLY_DESIGN.sql");
  assert.match(apply, /PHASE42_GLOBAL_HELPER_RETIREMENT|not dropped|Does NOT globally retire/i);
  assert.doesNotMatch(uncommented(apply), /DROP FUNCTION IF EXISTS public\.phase42_is_tenant_member/i);
  assert.match(apply, /clubs_select/);
  assert.doesNotMatch(apply, /identity_list_users/);
  assert.doesNotMatch(apply, /DROP POLICY IF EXISTS tenant_members_select/);
});

test("Wave5 VERIFY requires canonical FK and RPC marker", () => {
  const verify = readPkg("03_VERIFY.sql");
  assert.match(verify, /WAVE5_VERIFY_FAIL/);
  assert.match(verify, /platform_tenants/);
  assert.match(verify, /scope_semantics/);
  assert.doesNotMatch(uncommented(verify), /\bUPDATE\s+public\./i);
});

test("Wave5 rollback prefers APP_ROLLBACK_KEEP_CANONICAL_DB", () => {
  const rollback = readPkg("04_ROLLBACK_DESIGN.md");
  assert.match(rollback, /APP_ROLLBACK_KEEP_CANONICAL_DB/);
  assert.match(rollback, /not generally safe/i);
});
