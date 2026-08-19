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
  "05_CLUB_TENANT_TABLE_INVENTORY.md",
  "06_CLUB_MUTATION_RPC_INVENTORY.md",
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
  assert.match(rollback, /club_members\.tenant_id/);
  assert.match(rollback, /1:N Venue/);
  assert.match(rollback, /Do \*\*not\*\* claim that canonical Tenant → legacy Venue rollback is deterministic under Tenant 1:N Venue/);
});

test("A. CANONICAL_STATE_CANNOT_EXECUTE_LEGACY_TRANSLATION", () => {
  const apply = readPkg("02_APPLY_DESIGN.sql");
  const body = uncommented(apply);
  const doMatch = body.match(/DO\s+\$\$[\s\S]*?END\s+\$\$;/i);
  assert.ok(doMatch, "state-machine DO block required");
  const firstDo = doMatch[0];
  assert.match(firstDo, /v_state := 'CANONICAL'/);
  assert.match(firstDo, /v_state := 'LEGACY'/);
  const canonicalIdx = firstDo.search(/IF v_state = 'CANONICAL'/);
  const updateIdx = firstDo.search(/UPDATE public\.clubs/);
  const mapJoinIdx = firstDo.search(/JOIN public\.venues v ON v\.id = c\.tenant_id/);
  assert.ok(canonicalIdx >= 0, "canonical branch required");
  assert.ok(updateIdx > canonicalIdx, "clubs UPDATE must be after canonical skip");
  assert.ok(mapJoinIdx > canonicalIdx, "legacy Venue map must be after canonical skip");
  const afterDo = body.slice(body.indexOf(firstDo) + firstDo.length);
  assert.doesNotMatch(afterDo, /UPDATE\s+public\.clubs/i);
  assert.doesNotMatch(afterDo, /JOIN public\.venues v ON v\.id = c\.tenant_id/);
  assert.match(apply, /CANONICAL_STATE_CANNOT_EXECUTE_LEGACY_TRANSLATION=YES/);
  assert.doesNotMatch(uncommented(apply), /venues\.id\s*=\s*platform_tenants\.id/);
});

test("B. mixed or unexpected FK state aborts", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const precheck = uncommented(readPkg("01_PRECHECK.sql"));
  assert.match(apply, /STATE_UNKNOWN mixed Club tenant FKs/);
  assert.match(precheck, /STATE_UNKNOWN mixed Club tenant FKs/);
  assert.match(apply, /WAVE5_APPLY_ABORT: STATE_UNKNOWN/);
});

test("C/D. club_create canonical Tenant does not validate via venues.id", () => {
  const apply = readPkg("02_APPLY_DESIGN.sql");
  const createStart = apply.indexOf("CREATE OR REPLACE FUNCTION public.club_create");
  assert.ok(createStart >= 0);
  const createBody = uncommented(apply.slice(createStart, apply.indexOf("CREATE OR REPLACE FUNCTION public.club_list_registry")));
  assert.match(createBody, /FROM public\.platform_tenants pt WHERE pt\.id = v_tenant/);
  assert.doesNotMatch(createBody, /from public\.venues v where v\.id = v_tenant/i);
  assert.doesNotMatch(createBody, /v\.id = v_tenant/);
  assert.match(createBody, /court_clusters/);
  assert.match(createBody, /CLUSTER_TENANT_MISMATCH/);
});

test("E. Club child tables migrate with Club and stay consistent", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const precheck = uncommented(readPkg("01_PRECHECK.sql"));
  const verify = uncommented(readPkg("03_VERIFY.sql"));
  for (const table of [
    "club_members",
    "club_governance_assignments",
    "club_membership_requests_v42",
  ]) {
    assert.match(apply, new RegExp(`UPDATE public\\.${table}`));
    assert.match(apply, new RegExp(`${table}_tenant_id_platform_tenants_fkey`));
    assert.match(precheck, new RegExp(table));
    assert.match(verify, new RegExp(table));
  }
  assert.match(verify, /disagree with Club/);
  assert.match(apply, /cm\.tenant_id IS DISTINCT FROM c\.tenant_id/);
});

test("H. Wave 4 tenant_members canonical FK is expected, not re-executed", () => {
  const readme = readPkg("00_README.md");
  const precheck = readPkg("01_PRECHECK.sql");
  assert.match(readme, /TENANT_MEMBERS_WAVE4_CANONICAL_FK_EXPECTED=YES/);
  assert.match(readme, /WAVE4_SQL_REEXECUTION_REQUIRED=NO/);
  assert.match(precheck, /TENANT_MEMBERS_WAVE4_CANONICAL_FK_EXPECTED=YES/);
  assert.match(precheck, /tenant_members\.tenant_id FK is %, expected platform_tenants/);
  assert.doesNotMatch(uncommented(readPkg("02_APPLY_DESIGN.sql")), /ALTER TABLE public\.tenant_members/);
});

test("I. no global phase42 helper retirement", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const verify = uncommented(readPkg("03_VERIFY.sql"));
  assert.doesNotMatch(apply, /DROP FUNCTION[\s\S]*phase42_is_tenant_member/i);
  assert.match(verify, /phase42_is_tenant_member missing — Wave 5 must not globally retire it/);
});

test("Wave5 APPLY does not invent clubs.venue_id and keeps athlete compat honest", () => {
  const apply = readPkg("02_APPLY_DESIGN.sql");
  assert.match(apply, /WAVE5_ATHLETE_COMPAT_REQUIRED/);
  assert.match(apply, /wave5_ensure_athlete_for_club_member/);
  assert.doesNotMatch(uncommented(apply), /ADD COLUMN[\s\S]*venue_id/i);
});
