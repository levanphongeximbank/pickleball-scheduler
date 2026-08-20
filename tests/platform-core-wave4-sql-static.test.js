import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SQL_DIR = path.join(
  process.cwd(),
  "docs/platform-core-wave4-identity-authz-access-closure/staging-remediation"
);

const PACKAGE_FILES = [
  "00_README.md",
  "01_PRECHECK.sql",
  "02_APPLY_TENANT_MEMBERS_TENANT_FK.sql",
  "03_APPLY_TENANT_MEMBERS_RLS_AND_GRANTS.sql",
  "04_MEMBERSHIP_CANDIDATES_READONLY.sql",
  "05_VERIFY.sql",
  "99_ROLLBACK.md",
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

test("Wave4 SQL package files exist", () => {
  for (const name of PACKAGE_FILES) {
    assert.equal(fs.existsSync(path.join(SQL_DIR, name)), true, name);
  }
});

test("Wave4 SQL package is author-only and does not name Production", () => {
  const all = PACKAGE_FILES.map((name) => readPkg(name)).join("\n");
  assert.match(all, /SQL_EXECUTION_GO = NO/);
  assert.doesNotMatch(all, /expuvcohlcjzvrrauvud/i);
  assert.doesNotMatch(all, /PRODUCTION_ACCESS_GO = YES/);
});

test("Wave4 SQL package does not author membership DML or TRUNCATE execution", () => {
  const all = uncommented(PACKAGE_FILES.map((name) => readPkg(name)).join("\n"));
  assert.doesNotMatch(all, /\bINSERT\s+INTO\b/i);
  assert.doesNotMatch(all, /\bUPDATE\s+public\./i);
  assert.doesNotMatch(all, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(all, /\bUPSERT\b/i);
  assert.doesNotMatch(all, /\bTRUNCATE\s+TABLE\b/i);
  assert.doesNotMatch(all, /(?<!REVOKE\s)TRUNCATE\s+public\./i);
});

test("Wave4 SQL package does not derive membership from profile role", () => {
  const applyish = [
    readPkg("02_APPLY_TENANT_MEMBERS_TENANT_FK.sql"),
    readPkg("03_APPLY_TENANT_MEMBERS_RLS_AND_GRANTS.sql"),
    readPkg("04_MEMBERSHIP_CANDIDATES_READONLY.sql"),
  ].join("\n");
  assert.doesNotMatch(uncommented(applyish), /\bINSERT\s+INTO\s+public\.tenant_members\b/i);
  assert.match(readPkg("04_MEMBERSHIP_CANDIDATES_READONLY.sql"), /OWNER_APPROVED_MEMBERSHIP_MANIFEST_REQUIRED/);
  assert.match(readPkg("04_MEMBERSHIP_CANDIDATES_READONLY.sql"), /NON_TENANT_OPERATIONAL_ACTOR_NO_MEMBERSHIP_REQUIRED/);
  assert.match(readPkg("04_MEMBERSHIP_CANDIDATES_READONLY.sql"), /TENANT_OPERATOR_CANDIDATE_OWNER_DECISION_REQUIRED/);
  assert.match(readPkg("00_README.md"), /OWNER_APPROVED_MEMBERSHIP_MANIFEST_REQUIRED=YES/);
});

test("Wave4 PRECHECK is read-only fail-closed inventory", () => {
  const precheck = readPkg("01_PRECHECK.sql");
  const body = uncommented(precheck);
  assert.match(precheck, /READ-ONLY|read-only/i);
  assert.match(precheck, /WAVE4_PRECHECK_FAIL/);
  assert.match(precheck, /tenant_members/);
  assert.match(precheck, /platform_tenants/);
  assert.match(precheck, /venues/);
  assert.match(precheck, /phase42_is_tenant_member/);
  assert.match(precheck, /user_tenant_id/);
  assert.match(precheck, /TRUNCATE/);
  assert.match(precheck, /identity_list_users/);
  assert.doesNotMatch(body, /\bINSERT\s+INTO\b/i);
  assert.doesNotMatch(body, /\bALTER\s+TABLE\b/i);
  assert.doesNotMatch(body, /\bCREATE\s+POLICY\b/i);
});

test("Wave4 FK apply targets platform_tenants and introspects before drop", () => {
  const apply = readPkg("02_APPLY_TENANT_MEMBERS_TENANT_FK.sql");
  const body = uncommented(apply);
  assert.match(apply, /platform_tenants/);
  assert.match(apply, /WAVE4_FK_ABORT/);
  assert.match(apply, /pg_get_constraintdef/);
  assert.match(apply, /tenant_members_tenant_id_platform_tenants_fkey/);
  assert.match(body, /REFERENCES public\.platform_tenants\(id\)/);
  assert.doesNotMatch(body, /REFERENCES public\.venues\(id\)/);
  assert.doesNotMatch(body, /CREATE OR REPLACE FUNCTION public\.user_tenant_id/i);
  assert.doesNotMatch(body, /CREATE OR REPLACE FUNCTION public\.phase42_is_tenant_member/i);
});

test("Wave4 RLS apply revokes TRUNCATE and removes Venue-as-Tenant fallback", () => {
  const rls = readPkg("03_APPLY_TENANT_MEMBERS_RLS_AND_GRANTS.sql");
  const body = uncommented(rls);
  assert.match(body, /REVOKE TRUNCATE ON public\.tenant_members FROM anon,\s*authenticated/i);
  assert.match(body, /ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(body, /FORCE ROW LEVEL SECURITY/);
  assert.match(body, /phase42_is_platform_super_admin\(\)/);
  assert.match(body, /user_id = auth\.uid\(\)/);
  const policy = body.match(/CREATE POLICY tenant_members_select[\s\S]*?;/);
  assert.ok(policy, "canonical SELECT policy missing");
  assert.doesNotMatch(policy[0], /phase42_is_tenant_member/);
  assert.doesNotMatch(policy[0], /venue_id/);
  assert.doesNotMatch(body, /CREATE OR REPLACE FUNCTION public\.user_tenant_id/i);
  assert.doesNotMatch(body, /CREATE OR REPLACE FUNCTION public\.phase42_is_tenant_member/i);
});

test("Wave4 VERIFY checks amended invariants and does not require every player membership", () => {
  const verify = readPkg("05_VERIFY.sql");
  assert.match(verify, /TENANT_MEMBERS_TENANT_FK_TARGET/);
  assert.match(verify, /TENANT_MEMBERS_ORPHAN_TENANT/);
  assert.match(verify, /TENANT_MEMBERS_ORPHAN_USER/);
  assert.match(verify, /DUPLICATE_ACTIVE_MEMBERSHIPS/);
  assert.match(verify, /INVALID_ROLE_CODE/);
  assert.match(verify, /INVALID_STATUS/);
  assert.match(verify, /TENANT_MEMBERS_RLS_ENABLED/);
  assert.match(verify, /TENANT_MEMBERS_FORCE_RLS/);
  assert.match(verify, /CANONICAL_SELF_PLUS_SUPER_ADMIN/);
  assert.match(verify, /ANON_TRUNCATE_PRIVILEGE/);
  assert.match(verify, /AUTHENTICATED_TRUNCATE_PRIVILEGE/);
  assert.match(verify, /VENUE_AS_TENANT_POLICY_FALLBACK/);
  assert.match(verify, /USER_TENANT_ID_DB_COMPATIBILITY_FALLBACK/);
  assert.match(verify, /ACTIVE_EXPECTED/);
  assert.match(verify, /ACTIVE_TENANT_OPERATIONAL_ACTORS_WITHOUT_EXPLICIT_MEMBERSHIP/);
  assert.match(verify, /do not count Players as a failure|do not require every active profile/i);
  assert.doesNotMatch(uncommented(verify), /\bINSERT\s+INTO\b/i);
  assert.doesNotMatch(uncommented(verify), /\bALTER\s+TABLE\b/i);
});

test("Wave4 rollback docs distinguish FK / RLS / privilege and warn against silent widen", () => {
  const rollback = readPkg("99_ROLLBACK.md");
  assert.match(rollback, /FK rollback/i);
  assert.match(rollback, /RLS policy rollback/i);
  assert.match(rollback, /Privilege rollback/i);
  assert.match(rollback, /authorization debt/i);
  assert.match(rollback, /do not.*widen/i);
  assert.doesNotMatch(rollback, /DROP POLICY IF EXISTS tenant_members_select[\s\S]*phase42_is_tenant_member/);
});
