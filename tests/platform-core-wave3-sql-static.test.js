import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SQL_DIR = path.join(
  process.cwd(),
  "docs/platform-core-wave3-tenant-venue-separation/sql"
);

function readSql(name) {
  return fs.readFileSync(path.join(SQL_DIR, name), "utf8");
}

test("Wave3 SQL static: RLS notes file is not executable policy SQL", () => {
  const notes = readSql("04_RLS_NOTES.sql");
  const uncommented = notes
    .split(/\r?\n/)
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
  assert.match(notes, /NOT EXECUTABLE|DO NOT RUN THIS FILE/);
  assert.doesNotMatch(uncommented, /CREATE OR REPLACE FUNCTION/);
  assert.doesNotMatch(uncommented, /CREATE POLICY/);
  assert.doesNotMatch(uncommented, /ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(uncommented, /ALTER TABLE/);
});

test("Wave3 SQL static: RLS policies are dual-gated and do not invent venue from tenant", () => {
  const policies = readSql("04_RLS_POLICIES.sql");
  assert.match(policies, /OWNER_RLS_DEPLOY_GO/);
  assert.match(policies, /app\.owner_rls_deploy_go/);
  assert.match(policies, /WAVE3_USER_TENANT_ID_VENUE_FALLBACK/);
  assert.match(policies, /CREATE POLICY platform_tenants_select/);
  assert.match(policies, /CREATE POLICY platform_tenants_insert/);
  assert.match(policies, /CREATE POLICY platform_tenants_update/);
  assert.match(policies, /CREATE POLICY platform_tenants_delete/);
  assert.match(policies, /ENABLE ROW LEVEL SECURITY/);

  const homeFn = policies.match(
    /CREATE OR REPLACE FUNCTION public\.user_home_venue_id\(\)[\s\S]*?\$\$;/
  );
  assert.ok(homeFn, "user_home_venue_id function missing");
  assert.doesNotMatch(homeFn[0], /COALESCE\s*\(/);
  assert.match(homeFn[0], /p\.venue_id/);
  assert.doesNotMatch(homeFn[0], /p\.tenant_id/);
});

test("Wave3 SQL static: apply does not enable RLS or grant authenticated", () => {
  const apply = readSql("02_APPLY_platform_tenants_and_venue_fk.sql");
  assert.doesNotMatch(apply, /ENABLE ROW LEVEL SECURITY/);
  assert.match(apply, /REVOKE ALL ON TABLE public\.platform_tenants FROM authenticated/);
  assert.match(apply, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.platform_tenants TO service_role/);
  assert.match(apply, /CREATE TABLE IF NOT EXISTS public\.platform_tenants/);
});

test("Wave3 SQL static: backfill fail-closes slug collision and adds profiles FK", () => {
  const backfill = readSql("03_BACKFILL.sql");
  assert.match(backfill, /WAVE3_SLUG_COLLISION/);
  assert.match(backfill, /WAVE3_SLUG_COLLISION_EXISTING/);
  assert.match(backfill, /ON CONFLICT \(id\) DO NOTHING/);
  assert.doesNotMatch(backfill, /ON CONFLICT \(id\) DO UPDATE/);
  assert.match(backfill, /profiles_tenant_id_fkey/);
  assert.match(backfill, /WAVE3_PROFILE_TENANT_ORPHAN/);
  assert.match(backfill, /ON DELETE SET NULL/);
});

test("Wave3 SQL static: precheck inventories slug collisions without mutating", () => {
  const precheck = readSql("01_PRECHECK.sql");
  assert.match(precheck, /does not mutate|READ-ONLY|read-only/i);
  assert.match(precheck, /normalized_tenant_slug|normalized tenant slug/);
  assert.match(precheck, /WAVE3_SLUG_COLLISION_EXISTING/);
  assert.doesNotMatch(precheck, /INSERT INTO/);
  assert.doesNotMatch(precheck, /UPDATE public\./);
  assert.doesNotMatch(precheck, /ALTER TABLE/);
});

test("Wave3 SQL static: verify covers slug, orphans, cardinality, cluster consistency, RLS readiness", () => {
  const verify = readSql("05_VERIFY.sql");
  assert.match(verify, /slug, count\(\*\)/);
  assert.match(verify, /profiles_orphan_tenant/);
  assert.match(verify, /venues_orphan_tenant/);
  assert.match(verify, /tenants_with_zero_venues/);
  assert.match(verify, /profiles_tenant_home_venue_mismatch/);
  assert.match(verify, /clusters_tenant_mismatch_parent_venue/);
  assert.match(verify, /relrowsecurity/);
});

test("Wave3 SQL static: default apply order excludes RLS deploy", () => {
  const owner = readSql("00_OWNER_README.md");
  assert.match(owner, /SQL_EXECUTION_GO = NO/);
  assert.match(owner, /OWNER_RLS_DEPLOY_GO = NO/);
  assert.match(owner, /Do not run `04_RLS_POLICIES\.sql`/);
});

test("Wave3 SQL static: platformTenantAuthority never queries public.tenants", () => {
  const authority = fs.readFileSync(
    path.join(process.cwd(), "src/core/platform/app/platformTenantAuthority.js"),
    "utf8"
  );
  assert.match(authority, /LEGACY_PUBLIC_TENANTS_VIEW/);
  assert.match(authority, /platform_tenants/);
  assert.doesNotMatch(authority, /\.from\(\s*["']tenants["']\s*\)/);
  assert.doesNotMatch(authority, /from\s+["']\.\.\/features\//);
});
