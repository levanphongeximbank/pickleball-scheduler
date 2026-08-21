import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const PKG = path.join(
  process.cwd(),
  "docs/platform-core-wave5-club-context-closure/security-remediation/club-truncate-acl"
);

function read(name) {
  return fs.readFileSync(path.join(PKG, name), "utf8");
}

function uncommented(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "");
}

const TABLES = [
  "clubs",
  "club_members",
  "club_governance_assignments",
  "club_membership_requests_v42",
];

test("TRUNCATE ACL package files exist outside migrations", () => {
  for (const name of [
    "00_README.md",
    "01_PRECHECK.sql",
    "02_APPLY.sql",
    "03_VERIFY.sql",
    "04_ROLLBACK.md",
  ]) {
    assert.equal(fs.existsSync(path.join(PKG, name)), true, name);
  }
  assert.equal(PKG.includes("supabase"), false);
  assert.equal(PKG.includes("migrations"), false);
});

test("security model docs deny PostgREST non-exposure as TRUNCATE authority", () => {
  const readme = read("00_README.md");
  assert.match(readme, /TRUNCATE_SECURITY_DEPENDS_ON_POSTGREST_NON_EXPOSURE=NO/);
  assert.match(readme, /ANON_TRUNCATE_TARGET=DENY/);
  assert.match(readme, /AUTHENTICATED_TRUNCATE_TARGET=DENY/);
  assert.match(readme, /BUSINESS_LOGIC_CHANGED_BY_ACL_PACKAGE=NO/);
  assert.match(readme, /AUTHORIZED_PRIVILEGE_EDGES=8/);
});

test("APPLY revokes only TRUNCATE for exactly 4 Club tables × 2 roles", () => {
  const applySrc = read("02_APPLY.sql");
  const apply = uncommented(applySrc);
  assert.match(apply, /REVOKE TRUNCATE ON TABLE/);
  assert.match(apply, /FROM anon, authenticated/);
  assert.equal((apply.match(/\bREVOKE\b/gi) || []).length, 1);
  assert.doesNotMatch(apply, /\bGRANT\b/);
  assert.doesNotMatch(apply, /service_role/);
  assert.doesNotMatch(apply, /ALTER DEFAULT PRIVILEGES/i);
  assert.doesNotMatch(apply, /CREATE POLICY/i);
  assert.doesNotMatch(apply, /DROP POLICY/i);
  assert.doesNotMatch(apply, /\bINSERT\s+INTO\b/i);
  assert.doesNotMatch(apply, /\bUPDATE\s+public\./i);
  assert.doesNotMatch(apply, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(apply, /\bTRUNCATE\s+(TABLE\s+)?(ONLY\s+)?public\./i);
  for (const t of TABLES) {
    assert.match(apply, new RegExp(`public\\.${t}`));
  }
  const tableMatches =
    apply.match(
      /public\.(club_membership_requests_v42|club_governance_assignments|club_members|clubs)\b/g
    ) || [];
  assert.equal(new Set(tableMatches).size, 4);
});

test("APPLY requires wave5.target_env wrapper; does not invent RPC EXECUTE changes", () => {
  const apply = uncommented(read("02_APPLY.sql"));
  assert.match(apply, /wave5\.target_env/);
  assert.match(apply, /staging',\s*'production'|staging\|production/);
  assert.doesNotMatch(apply, /REVOKE EXECUTE/i);
  assert.doesNotMatch(apply, /GRANT EXECUTE/i);
  assert.doesNotMatch(apply, /phase42_|club_create|club_review/i);
});

test("PRECHECK inspects 8 combinations, distinguishes granted vs denied, no mutation", () => {
  const src = read("01_PRECHECK.sql");
  const body = uncommented(src);
  assert.match(src, /wave5\.target_env/);
  assert.match(body, /has_table_privilege/);
  assert.match(body, /'TRUNCATE'/);
  assert.match(body, /\('anon'\),\s*\('authenticated'\)/);
  assert.match(body, /v_granted/);
  assert.match(body, /v_denied/);
  assert.match(body, /expected 8 combinations/);
  assert.doesNotMatch(body, /\bGRANT\b/i);
  assert.doesNotMatch(body, /\bREVOKE\b/i);
  assert.doesNotMatch(body, /\bINSERT\s+INTO\b/i);
  assert.doesNotMatch(body, /\bUPDATE\s+public\./i);
  assert.doesNotMatch(body, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(body, /service_role/);
});

test("VERIFY fails closed if any of 8 TRUNCATE privileges remains effective", () => {
  const src = read("03_VERIFY.sql");
  const body = uncommented(src);
  assert.match(src, /wave5\.target_env/);
  assert.match(body, /v_bad/);
  assert.match(body, /of 8 TRUNCATE privileges still effective/);
  assert.match(body, /has_table_privilege/);
  assert.doesNotMatch(body, /\bGRANT\b/i);
  assert.doesNotMatch(body, /\bREVOKE\b/i);
  assert.doesNotMatch(body, /service_role/);
  for (const t of TABLES) {
    assert.match(src, new RegExp(t));
  }
});

test("rollback design does not recommend restoring TRUNCATE grants", () => {
  const rollback = read("04_ROLLBACK.md");
  assert.match(rollback, /ROLLBACK_RECOMMENDED=NO/);
  assert.match(rollback, /AUTO_REGRANT_TRUNCATE_ON_VERIFY_FAILURE=NO|not.*restore/i);
});
