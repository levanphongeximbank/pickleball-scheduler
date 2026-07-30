import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageDir = path.join(
  root,
  "docs/platform-hard-cutover-01/phase-04/sql/pairing-owner-same-tenant-view"
);
const legacyRbacOnlyDir = path.join(
  root,
  "docs/platform-hard-cutover-01/phase-04/sql/pairing-owner-view-rbac"
);

function readPackage(name) {
  return fs.readFileSync(path.join(packageDir, name), "utf8");
}

function stripSqlComments(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

/**
 * Detects the pre-remediation exclusive is_super_admin gates that blocked A-PAIR
 * even when role_permissions.view already existed.
 */
function hasExclusiveSuperAdminCanGate(sql) {
  const body = stripSqlComments(sql);
  const canMatch = body.match(
    /create\s+or\s+replace\s+function\s+public\.private_pairing_can[\s\S]*?as\s+\$\$([\s\S]*?)\$\$/i
  );
  if (!canMatch) return false;
  const canBody = canMatch[1];
  const hasSaAndPerm =
    /auth\.uid\(\)\s+is\s+not\s+null/i.test(canBody) &&
    /is_super_admin\s*\(/i.test(canBody) &&
    /user_has_permission\s*\(/i.test(canBody);
  const hasOwnerViewBranch =
    /private_pairing_actor_is_owner_like\s*\(/i.test(canBody) &&
    /pairing\.private_rules\.view/i.test(canBody);
  return hasSaAndPerm && !hasOwnerViewBranch;
}

function hasExclusiveSuperAdminTenantVisibleGate(sql) {
  const body = stripSqlComments(sql);
  const visMatch = body.match(
    /create\s+or\s+replace\s+function\s+public\.private_pairing_tenant_visible[\s\S]*?as\s+\$\$([\s\S]*?)\$\$/i
  );
  if (!visMatch) return false;
  const visBody = visMatch[1];
  const saOnly =
    /^\s*select\s+public\.is_super_admin\s*\(/im.test(visBody) ||
    (/is_super_admin\s*\(/i.test(visBody) &&
      !/private_pairing_actor_is_owner_like\s*\(/i.test(visBody));
  return saOnly && !/private_pairing_actor_is_owner_like\s*\(/i.test(visBody);
}

function assertRemediationFixesBothGates(sql) {
  assert.equal(
    hasExclusiveSuperAdminCanGate(sql),
    false,
    "private_pairing_can must not remain is_super_admin-only"
  );
  assert.equal(
    hasExclusiveSuperAdminTenantVisibleGate(sql),
    false,
    "private_pairing_tenant_visible must not remain is_super_admin-only"
  );
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.private_pairing_can/i);
  assert.match(
    sql,
    /create\s+or\s+replace\s+function\s+public\.private_pairing_tenant_visible/i
  );
  assert.match(sql, /private_pairing_actor_is_owner_like/i);
  assert.match(sql, /TENANT_OWNER/);
  assert.match(sql, /COURT_OWNER/);
  assert.match(sql, /VENUE_OWNER/);
  assert.match(sql, /private_pairing_current_tenant_id\(\)\s*=\s*p_tenant_id/);
}

test("pairing owner same-tenant view package files exist", () => {
  const files = fs.readdirSync(packageDir);
  assert.ok(files.includes("10_OWNER_SAME_TENANT_VIEW.sql"));
  assert.ok(files.includes("90_ROLLBACK.sql"));
  assert.ok(files.includes("99_VERIFY.sql"));
  assert.ok(files.includes("README.md"));
});

test("apply SQL remediates BOTH is_super_admin gates (can + tenant_visible)", () => {
  const sql = readPackage("10_OWNER_SAME_TENANT_VIEW.sql");
  const executable = stripSqlComments(sql);
  assertRemediationFixesBothGates(sql);
  assert.doesNotMatch(
    executable,
    /grant\s+(select|insert|update|delete|all)\b[\s\S]*\bto\s+authenticated/i
  );
  // owner elevated grants must not appear in role_permissions inserts
  const inserts = executable.match(
    /insert\s+into\s+public\.role_permissions[\s\S]*?on conflict do nothing;/gi
  );
  assert.ok(inserts && inserts.length >= 1);
  for (const block of inserts) {
    assert.doesNotMatch(block, /pairing\.private_rules\.(edit|manage|admin|audit|simulate)/i);
    assert.match(block, /pairing\.private_rules\.view/);
  }
  // Production ref may appear only as a forbidden comment marker, never executable
  assert.doesNotMatch(executable, /expuvcohlcjzvrrauvud/);
  assert.doesNotMatch(executable, /TRUNCATE|DROP TABLE|DELETE FROM public\.profiles/i);
});

test("role_permissions-only package is insufficient (catches both missed gates)", () => {
  const rbacOnly = fs.readFileSync(
    path.join(legacyRbacOnlyDir, "10_OWNER_PAIRING_VIEW_RBAC.sql"),
    "utf8"
  );
  assert.match(rbacOnly, /pairing\.private_rules\.view/);
  assert.doesNotMatch(rbacOnly, /create\s+or\s+replace\s+function\s+public\.private_pairing_can/i);
  assert.doesNotMatch(
    rbacOnly,
    /create\s+or\s+replace\s+function\s+public\.private_pairing_tenant_visible/i
  );
  // Synthetic insufficient patch: add mappings but leave both SA-only helpers
  const insufficient = `${rbacOnly}

create or replace function public.private_pairing_can(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and public.is_super_admin()
    and public.user_has_permission(p_permission);
$$;

create or replace function public.private_pairing_tenant_visible(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_super_admin()
    and (
      public.private_pairing_current_tenant_id() is null
      or public.private_pairing_current_tenant_id() = p_tenant_id
      or public.private_pairing_current_tenant_id() = ''
    );
$$;
`;
  assert.equal(hasExclusiveSuperAdminCanGate(insufficient), true);
  assert.equal(hasExclusiveSuperAdminTenantVisibleGate(insufficient), true);
  assert.throws(() => assertRemediationFixesBothGates(insufficient));
});

test("verify SQL asserts owner same-tenant PASS / cross-tenant FAIL contract and elevated FAIL", () => {
  const sql = readPackage("99_VERIFY.sql");
  assert.match(sql, /tenant_owner_view|TENANT_OWNER/);
  assert.match(sql, /can_not_sa_only_gate/);
  assert.match(sql, /vis_not_sa_only_gate/);
  assert.match(sql, /same-tenant PASS/i);
  assert.match(sql, /cross-tenant FAIL/i);
  assert.match(sql, /pairing\.private_rules\.manage/);
  assert.match(sql, /pairing\.private_rules\.simulate/);
  assert.match(sql, /owners_lack_elevated_pairing_perms/);
});

test("rollback restores SA-only helpers and only removes TENANT_OWNER view mapping", () => {
  const sql = readPackage("90_ROLLBACK.sql");
  const executable = stripSqlComments(sql);
  assert.match(executable, /delete from public\.role_permissions/i);
  assert.match(executable, /TENANT_OWNER/);
  assert.doesNotMatch(executable, /delete from public\.role_permissions[\s\S]*COURT_OWNER/i);
  assert.match(executable, /drop function if exists public\.private_pairing_actor_is_owner_like/i);
  assert.equal(hasExclusiveSuperAdminCanGate(sql), true);
  assert.equal(hasExclusiveSuperAdminTenantVisibleGate(sql), true);
});
