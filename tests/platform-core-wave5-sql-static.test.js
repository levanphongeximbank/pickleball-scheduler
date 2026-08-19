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

test("DYNAMIC_RPC_TEXT_REWRITE_PRESENT=NO", () => {
  const src = readPkg("02_APPLY_DESIGN.sql");
  const apply = uncommented(src);
  assert.match(src, /DYNAMIC_RPC_TEXT_REWRITE_PRESENT=NO/);
  assert.doesNotMatch(apply, /pg_get_functiondef\s*\(/);
  assert.doesNotMatch(apply, /EXECUTE\s+v_next/);
  assert.doesNotMatch(apply, /regexp_replace\s*\(\s*v_def/);
});

test("explicit reviewed CREATE OR REPLACE for affected Club member RPCs", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  assert.match(
    apply,
    /CREATE OR REPLACE FUNCTION public\.club_add_member\s*\(\s*p_request_id uuid/
  );
  assert.match(
    apply,
    /CREATE OR REPLACE FUNCTION public\.club_restore_member\s*\(\s*p_request_id uuid/
  );
  assert.match(
    apply,
    /CREATE OR REPLACE FUNCTION public\.club_review_membership_request\s*\(\s*p_request_id uuid/
  );
  assert.match(apply, /GRANT EXECUTE ON FUNCTION public\.club_add_member\(uuid, text, uuid, text, integer\)/);
  assert.match(apply, /GRANT EXECUTE ON FUNCTION public\.club_restore_member\(uuid, text, uuid, integer\)/);
  assert.match(
    apply,
    /GRANT EXECUTE ON FUNCTION public\.club_review_membership_request\(uuid, uuid, text, text, integer\)/
  );
  const addStart = apply.indexOf("CREATE OR REPLACE FUNCTION public.club_add_member");
  const restoreStart = apply.indexOf("CREATE OR REPLACE FUNCTION public.club_restore_member");
  const addBody = apply.slice(addStart, restoreStart);
  assert.match(addBody, /wave5_ensure_athlete_for_club_member/);
  assert.doesNotMatch(
    addBody,
    /phase42n_ensure_athlete_for_user\s*\(\s*p_target_user_id\s*,\s*v_club\.tenant_id/
  );
  assert.match(addBody, /ATHLETE_FACILITY_VENUE_REQUIRED/);
});

test("POST_MAP name and code collision guards run in PRECHECK before APPLY mutation", () => {
  const precheck = uncommented(readPkg("01_PRECHECK.sql"));
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  assert.match(precheck, /POST_MAP_DUPLICATE_CLUB_NAME_COUNT/);
  assert.match(precheck, /POST_MAP_DUPLICATE_CLUB_CODE_COUNT/);
  assert.match(precheck, /DATA_RECONCILIATION_OWNER_DECISION_REQUIRED/);
  assert.match(precheck, /lower\(c\.name\)/);
  assert.match(precheck, /JOIN public\.venues v ON v\.id = c\.tenant_id/);
  assert.match(precheck, /to_regprocedure\('public\.club_add_member\(uuid,text,uuid,text,integer\)'\)/);
  assert.match(precheck, /RPC_SIGNATURE_DRIFT/);
  const precheckHasInsert = /\bINSERT\s+INTO\b/i.test(precheck);
  assert.equal(precheckHasInsert, false);
  const applyUpdateIdx = apply.search(/UPDATE public\.clubs/);
  assert.ok(applyUpdateIdx > 0);
});

test("Athlete no-cluster policy is explicit and does not invent Club→Venue ownership", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const helperStart = apply.indexOf(
    "CREATE OR REPLACE FUNCTION public.wave5_ensure_athlete_for_club_member"
  );
  const helperEnd = apply.indexOf(
    "REVOKE ALL ON FUNCTION public.wave5_resolve_club_facility_venue_id"
  );
  const helper = apply.slice(helperStart, helperEnd);
  assert.match(helper, /ORDER BY a\.created_at ASC/);
  assert.match(helper, /ATHLETE_FACILITY_VENUE_REQUIRED/);
  assert.match(helper, /wave5_resolve_club_facility_venue_id/);
  assert.doesNotMatch(helper, /v_club\.tenant_id/);
  assert.doesNotMatch(helper, /FROM public\.venues/);
  assert.doesNotMatch(helper, /profiles\.venue_id/);
  assert.doesNotMatch(apply, /ADD COLUMN[\s\S]*clubs[\s\S]*venue_id/i);
  const resolveStart = apply.indexOf(
    "CREATE OR REPLACE FUNCTION public.wave5_resolve_club_facility_venue_id"
  );
  const resolve = apply.slice(resolveStart, helperStart);
  assert.match(resolve, /registered_cluster_id/);
  assert.match(resolve, /court_clusters/);
  assert.match(resolve, /venues v ON v\.id = cc\.venue_id/);
  assert.doesNotMatch(resolve, /ORDER BY cc\.id/);
});

test("Round 2 docs: blockers remediated, SQL review not claimed PASS", () => {
  const readme = fs.readFileSync(
    path.join(process.cwd(), "docs/platform-core-wave5-club-context-closure/README.md"),
    "utf8"
  );
  const sqlReadme = readPkg("00_README.md");
  const inventory = readPkg("06_CLUB_MUTATION_RPC_INVENTORY.md");
  assert.match(readme, /ROUND2_BLOCKER_01=REMEDIATED/);
  assert.match(readme, /ROUND2_BLOCKER_02=REMEDIATED/);
  assert.match(readme, /SQL_DESIGN_REVIEW_ROUND2_REMEDIATION=COMPLETE_PENDING_ROUND3_OWNER_REVIEW/);
  assert.match(readme, /SQL_DESIGN_REVIEWED_PASS=NO/);
  assert.match(sqlReadme, /POST_MAP_NAME_COLLISION_GUARD=YES/);
  assert.match(sqlReadme, /POST_MAP_CODE_COLLISION_GUARD=YES/);
  assert.match(inventory, /EXPLICIT_REVIEWED_BODY_IN_APPLY/);
  assert.match(inventory, /PHASE_45A4C1_MEMBER_RPC\.sql` \| YES \| YES/);
  assert.match(inventory, /PHASE_45A4D1_MEMBER_RESTORE_RPC\.sql` \| YES \| YES/);
  assert.match(inventory, /PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL\.sql` \| YES \| YES/);
  assert.match(inventory, /docs\/v5\/phase45a4c1\/PHASE_45A4C1_MEMBER_RPC\.sql/);
  assert.match(inventory, /docs\/v5\/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL\.sql/);
});
