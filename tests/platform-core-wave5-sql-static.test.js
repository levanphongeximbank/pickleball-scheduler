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
  "02_APPLY_STAGING_WRAPPER.sql",
  "02_APPLY_PRODUCTION_WRAPPER.sql",
  "03_VERIFY.sql",
  "03B_MARK_VERIFIED_DESIGN.sql",
  "04_ROLLBACK_DESIGN.md",
  "05_CLUB_TENANT_TABLE_INVENTORY.md",
  "06_CLUB_MUTATION_RPC_INVENTORY.md",
  "07_EXECUTION_RUNBOOK.md",
  "07A_QUIESCE_WRITES_DESIGN.sql",
  "07B_DRAIN_VERIFY.sql",
  "07B2_MARK_DRAINED_DESIGN.sql",
  "07C_RESTORE_WRITES_DESIGN.sql",
  "07D_RESTORE_INTENDED_WRITES_DESIGN.sql",
  "08_RPC_OVERWRITE_GUARD_INVENTORY.md",
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
  assert.match(src, /APPLY_RPC_UNKNOWN_NEWER_BODY_OVERWRITE=DENIED/);
  assert.match(apply, /pg_get_functiondef\s*\(/);
  assert.doesNotMatch(apply, /EXECUTE\s+v_next/);
  assert.doesNotMatch(apply, /EXECUTE\s+v_rpc_def/);
  assert.doesNotMatch(apply, /regexp_replace\s*\(\s*v_def/);
  assert.doesNotMatch(apply, /regexp_replace\s*\(\s*v_rpc_def/);
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
  const restoreIntended = readPkg("07D_RESTORE_INTENDED_WRITES_DESIGN.sql");
  assert.match(restoreIntended, /GRANT EXECUTE ON FUNCTION public\.club_add_member\(uuid, text, uuid, text, integer\)/);
  assert.match(restoreIntended, /GRANT EXECUTE ON FUNCTION public\.club_restore_member\(uuid, text, uuid, integer\)/);
  assert.match(
    restoreIntended,
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
  assert.match(resolve, /v\.tenant_id = c\.tenant_id/);
  assert.match(resolve, /REGISTERED_CLUSTER_TENANT_MISMATCH/);
  assert.doesNotMatch(resolve, /cc\.venue_id = c\.tenant_id/);
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

test("ATHLETE_INTERNAL_HELPER_AUTHENTICATED_EXECUTE_DESIGN=DENY", () => {
  const src = readPkg("02_APPLY_DESIGN.sql");
  const apply = uncommented(src);
  const verify = uncommented(readPkg("03_VERIFY.sql"));
  assert.match(src, /WAVE5_ATHLETE_HELPER_DIRECT_AUTHENTICATED_EXECUTE=DENY/);
  assert.match(
    apply,
    /REVOKE ALL ON FUNCTION public\.wave5_ensure_athlete_for_club_member\(uuid, text, text\) FROM public, anon, authenticated/
  );
  assert.match(
    apply,
    /REVOKE ALL ON FUNCTION public\.wave5_resolve_club_facility_venue_id\(text\) FROM public, anon, authenticated/
  );
  assert.doesNotMatch(
    apply,
    /GRANT EXECUTE ON FUNCTION public\.wave5_ensure_athlete_for_club_member\(uuid, text, text\) TO authenticated/
  );
  assert.doesNotMatch(
    apply,
    /GRANT EXECUTE ON FUNCTION public\.wave5_resolve_club_facility_venue_id\(text\) TO authenticated/
  );
  assert.match(
    apply,
    /GRANT EXECUTE ON FUNCTION public\.wave5_ensure_athlete_for_club_member\(uuid, text, text\) TO service_role/
  );
  const restoreIntended = readPkg("07D_RESTORE_INTENDED_WRITES_DESIGN.sql");
  assert.match(restoreIntended, /GRANT EXECUTE ON FUNCTION public\.club_add_member\(uuid, text, uuid, text, integer\) TO authenticated/);
  assert.match(restoreIntended, /GRANT EXECUTE ON FUNCTION public\.club_restore_member\(uuid, text, uuid, integer\) TO authenticated/);
  assert.match(
    restoreIntended,
    /GRANT EXECUTE ON FUNCTION public\.club_review_membership_request\(uuid, uuid, text, text, integer\) TO authenticated/
  );
  assert.doesNotMatch(
    apply,
    /GRANT EXECUTE ON FUNCTION public\.club_add_member\(uuid, text, uuid, text, integer\) TO authenticated/
  );
  assert.match(verify, /has_function_privilege\(\s*'authenticated',\s*'public\.wave5_ensure_athlete_for_club_member/);
  assert.match(verify, /authenticated EXECUTE must be DENIED on wave5_ensure_athlete_for_club_member/);
  assert.match(verify, /authenticated EXECUTE must be DENIED on wave5_resolve_club_facility_venue_id/);
  assert.match(verify, /authenticated GRANT EXECUTE missing on club_add_member/);
});

test("REGISTERED_CLUSTER tenant binding precheck helper verify", () => {
  const precheck = uncommented(readPkg("01_PRECHECK.sql"));
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const verify = uncommented(readPkg("03_VERIFY.sql"));
  assert.match(precheck, /REGISTERED_CLUSTER_ORPHAN_COUNT/);
  assert.match(precheck, /REGISTERED_CLUSTER_CROSS_TENANT_COUNT/);
  assert.match(precheck, /club_v\.tenant_id IS DISTINCT FROM cluster_v\.tenant_id/);
  assert.match(precheck, /v\.tenant_id IS DISTINCT FROM c\.tenant_id/);
  assert.match(precheck, /JOIN public\.venues club_v ON club_v\.id = c\.tenant_id/);
  assert.doesNotMatch(precheck, /c\.tenant_id\s*=\s*cc\.venue_id/);
  assert.match(apply, /v\.tenant_id = c\.tenant_id/);
  assert.match(apply, /CLUSTER_TENANT_MISMATCH/);
  assert.match(verify, /REGISTERED_CLUSTER_ORPHAN_COUNT=/);
  assert.match(verify, /REGISTERED_CLUSTER_CROSS_TENANT_COUNT=/);
  assert.match(verify, /facility resolver missing canonical Tenant binding/);
});

test("Round 4 transaction safety: table lock before first mutation", () => {
  const src = readPkg("02_APPLY_DESIGN.sql");
  const apply = uncommented(src);
  assert.match(src, /CLUB_CUTOVER_TABLE_LOCK=YES/);
  assert.match(src, /CLUB_CUTOVER_LOCK_MODE=ACCESS EXCLUSIVE/);
  assert.match(src, /CLUB_CUTOVER_LOCK_ORDER=DETERMINISTIC/);
  assert.match(src, /CLUB_CUTOVER_CONCURRENT_WRITE_WINDOW=CLOSED/);
  assert.match(
    apply,
    /LOCK TABLE\s+public\.clubs,\s+public\.club_members,\s+public\.club_governance_assignments,\s+public\.club_membership_requests_v42\s+IN ACCESS EXCLUSIVE MODE/
  );
  const parentLockIdx = apply.search(/LOCK TABLE\s+public\.platform_tenants/);
  const lockIdx = apply.search(/LOCK TABLE\s+public\.clubs/);
  assert.ok(parentLockIdx >= 0 && parentLockIdx < lockIdx, "parent/supporting locks before Club ACCESS EXCLUSIVE");
  const tempIdx = apply.search(/CREATE TEMP TABLE wave5_club_tenant_map/);
  const dropIdx = apply.search(/DROP CONSTRAINT/);
  const updateIdx = apply.search(/UPDATE public\.clubs/);
  assert.ok(lockIdx >= 0, "club ACCESS EXCLUSIVE lock required");
  assert.ok(tempIdx > lockIdx, "LOCK_BEFORE_FIRST_MUTATION temp map");
  assert.ok(dropIdx > lockIdx, "LOCK_BEFORE_FIRST_MUTATION DROP CONSTRAINT");
  assert.ok(updateIdx > lockIdx, "LOCK_BEFORE_FIRST_MUTATION UPDATE clubs");
  assert.doesNotMatch(apply, /PERFORM 1 FROM public\.clubs FOR UPDATE/);
});

test("Round 4 in-transaction APPLY safety gate markers", () => {
  const src = readPkg("02_APPLY_DESIGN.sql");
  const apply = uncommented(src);
  assert.match(src, /APPLY_IN_TRANSACTION_FK_STATE_GUARD=YES/);
  assert.match(src, /APPLY_EXPECTS_WAVE4_TENANT_MEMBERS_CANONICAL=YES/);
  assert.match(src, /APPLY_IN_TRANSACTION_MAPPING_GUARD=YES/);
  assert.match(src, /APPLY_IN_TRANSACTION_CHILD_CONSISTENCY_GUARD=YES/);
  assert.match(src, /APPLY_IN_TRANSACTION_NAME_COLLISION_GUARD=YES/);
  assert.match(src, /APPLY_IN_TRANSACTION_CODE_COLLISION_GUARD=YES/);
  assert.match(src, /APPLY_IN_TRANSACTION_CLUSTER_ORPHAN_GUARD=YES/);
  assert.match(src, /APPLY_IN_TRANSACTION_CLUSTER_CROSS_TENANT_GUARD=YES/);
  assert.match(src, /APPLY_IN_TRANSACTION_RPC_SIGNATURE_GUARD=YES/);
  assert.match(src, /APPLY_DEPENDS_ON_PRIOR_PRECHECK_FRESHNESS=NO/);
  assert.match(src, /CANONICAL_STATE_DATA_TRANSLATION=DENIED/);
  assert.match(apply, /to_regprocedure\('public\.club_add_member\(uuid,text,uuid,text,integer\)'\)/);
  assert.match(apply, /to_regprocedure\('public\.club_restore_member\(uuid,text,uuid,integer\)'\)/);
  assert.match(apply, /to_regprocedure\('public\.club_review_membership_request\(uuid,uuid,text,text,integer\)'\)/);
  assert.match(apply, /POST_MAP_DUPLICATE_CLUB_NAME_COUNT=/);
  assert.match(apply, /POST_MAP_DUPLICATE_CLUB_CODE_COUNT=/);
  assert.match(apply, /REGISTERED_CLUSTER_ORPHAN_COUNT=/);
  assert.match(apply, /REGISTERED_CLUSTER_CROSS_TENANT_COUNT=/);
  assert.match(apply, /APPLY_LOCKED_SAFETY_GATE_COMPLETE/);
});

test("Round 4 no durable mutation before locked safety gate", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const gateIdx = apply.search(/APPLY_LOCKED_SAFETY_GATE_COMPLETE/);
  assert.ok(gateIdx >= 0, "locked safety gate marker required");
  const before = apply.slice(0, gateIdx);
  assert.match(before, /LOCK TABLE\s+public\.clubs/);
  assert.match(before, /IN ACCESS EXCLUSIVE MODE/);
  assert.doesNotMatch(before, /UPDATE\s+public\.clubs\b/i);
  assert.doesNotMatch(before, /UPDATE\s+public\.club_members\b/i);
  assert.doesNotMatch(before, /ALTER TABLE[\s\S]{0,80}DROP CONSTRAINT/i);
  assert.doesNotMatch(before, /CREATE OR REPLACE FUNCTION/i);
  assert.doesNotMatch(before, /\bGRANT\b/i);
  assert.doesNotMatch(before, /\bREVOKE\b/i);
});

test("Round 4 trigger enablement captured and restored exactly", () => {
  const src = readPkg("02_APPLY_DESIGN.sql");
  const apply = uncommented(src);
  assert.match(src, /TRIGGER_PRE_STATE_CAPTURED=YES/);
  assert.match(src, /TRIGGER_POST_STATE_PRESERVED=YES/);
  assert.match(apply, /t\.tgenabled/);
  assert.match(apply, /NOT IN \('O', 'D', 'R', 'A'\)/);
  assert.match(apply, /ENABLE REPLICA TRIGGER trg_phase42_gov_active_member/);
  assert.match(apply, /ENABLE ALWAYS TRIGGER trg_phase42_gov_active_member/);
  assert.match(apply, /v_gov_tg_enabled = 'O'/);
  assert.match(apply, /v_gov_tg_enabled = 'D'/);
  const firstDo = apply.match(/DO\s+\$\$[\s\S]*?END\s+\$\$;/i)[0];
  const enableAll = [...firstDo.matchAll(/ENABLE TRIGGER trg_phase42_gov_active_member/g)];
  assert.equal(enableAll.length, 1, "origin ENABLE must be conditional, not the only restore path");
  assert.match(firstDo, /v_gov_tg_enabled = 'O'[\s\S]*ENABLE TRIGGER trg_phase42_gov_active_member/);
  assert.match(firstDo, /v_gov_tg_enabled = 'D'[\s\S]*DISABLE TRIGGER trg_phase42_gov_active_member/);
});

test("Round 4 docs: transaction-safety remediation pending Round 5 Owner review", () => {
  const readme = fs.readFileSync(
    path.join(process.cwd(), "docs/platform-core-wave5-club-context-closure/README.md"),
    "utf8"
  );
  const sqlReadme = readPkg("00_README.md");
  const verify = readPkg("03_VERIFY.sql");
  assert.match(readme, /ROUND4_BLOCKER_01_CONCURRENT_WRITE_LOCKING=FIXED/);
  assert.match(readme, /ROUND4_BLOCKER_02_LOCKED_APPLY_SAFETY_GATE=FIXED/);
  assert.match(readme, /ROUND4_P2_TRIGGER_STATE_PRESERVATION=FIXED/);
  assert.match(readme, /SQL_DESIGN_REVIEW_ROUND4_REMEDIATION=COMPLETE_PENDING_ROUND5_OWNER_REVIEW/);
  assert.match(readme, /SQL_DESIGN_REVIEW_ROUND5_REMEDIATION=COMPLETE_PENDING_ROUND6_OWNER_REVIEW/);
  assert.match(readme, /SQL_DESIGN_REVIEW_ROUND6_REMEDIATION=COMPLETE_PENDING_ROUND7_OWNER_REVIEW/);
  assert.match(readme, /CLUB_CUTOVER_CONCURRENT_WRITE_WINDOW=CLOSED/);
  assert.match(readme, /APPLY_DEPENDS_ON_PRIOR_PRECHECK_FRESHNESS=NO/);
  assert.match(sqlReadme, /APPLY_DEPENDS_ON_PRIOR_PRECHECK_FRESHNESS=NO/);
  assert.match(sqlReadme, /CLUB_CUTOVER_LOCK_ORDER=DETERMINISTIC/);
  assert.match(verify, /Cannot prove a historical LOCK TABLE/);
  assert.doesNotMatch(readme, /SQL_DESIGN_REVIEWED_PASS=YES/);
});

test("Round 3 docs: helper privilege and cluster binding, SQL review not claimed PASS", () => {
  const readme = fs.readFileSync(
    path.join(process.cwd(), "docs/platform-core-wave5-club-context-closure/README.md"),
    "utf8"
  );
  const sqlReadme = readPkg("00_README.md");
  assert.match(readme, /ROUND3_BLOCKER_01_INTERNAL_HELPER_PRIVILEGE=FIXED/);
  assert.match(readme, /ROUND3_BLOCKER_02_REGISTERED_CLUSTER_TENANT_BINDING=FIXED/);
  assert.match(readme, /SQL_DESIGN_REVIEW_ROUND3_REMEDIATION=COMPLETE_PENDING_ROUND4_OWNER_REVIEW/);
  assert.match(readme, /ATHLETE_EXISTING_REUSE_POLICY=APPROVED/);
  assert.match(readme, /ATHLETE_NEW_CREATE_NO_FACILITY_POLICY=FAIL_CLOSED_ATHLETE_FACILITY_VENUE_REQUIRED/);
  assert.match(sqlReadme, /REGISTERED_CLUSTER_ORPHAN_PRECHECK=YES/);
  assert.match(sqlReadme, /REGISTERED_CLUSTER_CROSS_TENANT_PRECHECK=YES/);
  assert.match(sqlReadme, /REGISTERED_CLUSTER_RUNTIME_TENANT_BINDING=YES/);
  assert.match(sqlReadme, /REGISTERED_CLUSTER_VERIFY=YES/);
  assert.doesNotMatch(readme, /SQL_DESIGN_REVIEWED_PASS=YES/);
});

const EXISTING_APPLY_RPCS = [
  "phase42_club_canonical",
  "club_create",
  "club_list_registry",
  "club_list_members",
  "phase42_can_update_club",
  "phase42_can_assign_club_owner",
  "phase42_can_transfer_president",
  "club_add_member",
  "club_restore_member",
  "club_review_membership_request",
];

const NEW_WAVE5_FNS = [
  "platform_is_canonical_tenant_entitled",
  "wave5_resolve_club_facility_venue_id",
  "wave5_ensure_athlete_for_club_member",
];

test("Round 5 A. quiesce is a committed phase before APPLY", () => {
  const q1 = uncommented(readPkg("07A_QUIESCE_WRITES_DESIGN.sql"));
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const runbook = readPkg("07_EXECUTION_RUNBOOK.md");
  assert.match(runbook, /PHASE_Q1_COMMITTED_WRITE_QUIESCE/);
  assert.match(runbook, /QUIESCE_COMMITTED_PHASE_DESIGNED=YES/);
  assert.match(q1, /\bCOMMIT\s*;/);
  assert.match(q1, /REVOKE EXECUTE ON FUNCTION/);
  assert.match(q1, /FROM authenticated/);
  assert.doesNotMatch(apply, /REVOKE EXECUTE ON FUNCTION public\.club_create/);
  assert.match(apply, /Q1 quiesce not visible/);
});

test("Round 5 B. APPLY is forbidden without drain-pass evidence", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const drain = uncommented(readPkg("07B_DRAIN_VERIFY.sql"));
  const runbook = readPkg("07_EXECUTION_RUNBOOK.md");
  assert.match(runbook, /APPLY=ABORT/);
  assert.match(runbook, /CLUB_MUTATION_IN_FLIGHT_DRAINED/);
  assert.match(drain, /CLUB_MUTATION_IN_FLIGHT_DRAINED=NO/);
  assert.match(drain, /pg_locks/);
  assert.match(apply, /wave5\.drain_pass/);
  assert.match(apply, /ARBITRARY_DRAIN_PASS_GUC_NOT_SUFFICIENT/);
  assert.doesNotMatch(apply, /SET LOCAL wave5\.drain_pass\s*=\s*'YES'/);
  assert.doesNotMatch(apply, /SET wave5\.drain_pass\s*=\s*'YES'/);
});

test("Round 5 C. exact pre-privilege state is captured", () => {
  const q1 = uncommented(readPkg("07A_QUIESCE_WRITES_DESIGN.sql"));
  assert.match(q1, /wave5_cutover_rpc_privilege_snapshot/);
  assert.match(q1, /aclexplode/);
  assert.match(q1, /privilege snapshot empty/);
  assert.match(readPkg("00_README.md"), /MUTATION_RPC_PRIVILEGE_CAPTURE=EXACT_ACL_SNAPSHOT/);
});

test("Round 5 D. restore does not generic-GRANT privileges", () => {
  const restoreLegacy = uncommented(readPkg("07C_RESTORE_WRITES_DESIGN.sql"));
  const restoreIntended = uncommented(readPkg("07D_RESTORE_INTENDED_WRITES_DESIGN.sql"));
  assert.match(restoreLegacy, /WAVE5_RESTORE_ABORT: no privilege snapshot — refusing generic GRANT/);
  assert.doesNotMatch(restoreLegacy, /GRANT EXECUTE ON FUNCTION public\.club_create/);
  assert.doesNotMatch(restoreLegacy, /GRANT EXECUTE[^\n]+TO authenticated/);
  assert.match(
    restoreIntended,
    /GRANT EXECUTE ON FUNCTION public\.club_create\(uuid, text, text, text, text, text\) TO authenticated/
  );
  assert.doesNotMatch(restoreIntended, /GRANT EXECUTE ON ALL FUNCTIONS/i);
});

test("Round 5 E. parent/supporting lock order precedes Club child lock order", () => {
  const src = readPkg("02_APPLY_DESIGN.sql");
  const apply = uncommented(src);
  const tenantsIdx = apply.search(/LOCK TABLE\s+public\.platform_tenants/);
  const venuesIdx = apply.indexOf("public.venues", tenantsIdx);
  const clustersIdx = apply.indexOf("public.court_clusters", tenantsIdx);
  const tmIdx = apply.search(/LOCK TABLE public\.tenant_members IN ACCESS SHARE MODE/);
  const clubsIdx = apply.search(/LOCK TABLE\s+public\.clubs/);
  assert.ok(tenantsIdx >= 0 && venuesIdx > tenantsIdx && clustersIdx > venuesIdx);
  assert.ok(tmIdx > clustersIdx && clubsIdx > tmIdx);
  assert.match(src, /CUTOVER_LOCK_ORDER_PARENT_TO_CHILD=YES/);
  assert.match(src, /LOCK_ORDER_INVERSION_REVIEW=PASS/);
  assert.match(src, /not a deadlock-freedom proof/);
});

test("Round 5 F. lock_timeout is bounded", () => {
  const src = readPkg("02_APPLY_DESIGN.sql");
  const apply = uncommented(src);
  const runbook = readPkg("07_EXECUTION_RUNBOOK.md");
  const staging = readPkg("02_APPLY_STAGING_WRAPPER.sql");
  const production = readPkg("02_APPLY_PRODUCTION_WRAPPER.sql");
  assert.match(apply, /set_config\(\s*'lock_timeout'/);
  assert.match(apply, /WHEN 'staging' THEN '5s'/);
  assert.match(apply, /WHEN 'production' THEN '15s'/);
  assert.match(apply, /set_config\(\s*'statement_timeout'/);
  assert.match(src, /UNBOUNDED_LOCK_WAIT=NO/);
  assert.match(src, /STAGING_LOCK_TIMEOUT=5s/);
  assert.match(src, /PRODUCTION_LOCK_TIMEOUT=15s/);
  const timeoutIdx = apply.search(/set_config\(\s*'lock_timeout'/);
  const lockIdx = apply.search(/LOCK TABLE\s+public\.platform_tenants/);
  assert.ok(timeoutIdx >= 0 && timeoutIdx < lockIdx);
  assert.match(runbook, /STAGING_LOCK_TIMEOUT=5s/);
  assert.match(runbook, /PRODUCTION_LOCK_TIMEOUT=15s/);
  assert.match(staging, /STAGING_LOCK_TIMEOUT=5s/);
  assert.match(production, /PRODUCTION_LOCK_TIMEOUT=15s/);
  assert.doesNotMatch(uncommented(src), /SET LOCAL lock_timeout = '15s'/);
});

test("Round 5 G. no mutation occurs before locked safety gate", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const gateIdx = apply.search(/APPLY_LOCKED_SAFETY_GATE_COMPLETE/);
  assert.ok(gateIdx >= 0);
  const before = apply.slice(0, gateIdx);
  assert.match(before, /set_config\(\s*'lock_timeout'/);
  assert.match(before, /LOCK TABLE\s+public\.platform_tenants/);
  assert.match(before, /IN ACCESS EXCLUSIVE MODE/);
  assert.doesNotMatch(before, /UPDATE\s+public\.clubs\b/i);
  assert.doesNotMatch(before, /ALTER TABLE[\s\S]{0,80}DROP CONSTRAINT/i);
  assert.doesNotMatch(before, /CREATE OR REPLACE FUNCTION/i);
});

test("Round 5 H. every CREATE OR REPLACE existing RPC has an overwrite guard", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const creates = [...apply.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)/gi)].map(
    (m) => m[1]
  );
  assert.equal(
    creates.length,
    13,
    `APPLY_CREATE_OR_REPLACE_FUNCTION_COUNT expected 13, got ${creates.length}`
  );
  for (const name of EXISTING_APPLY_RPCS) {
    assert.equal(creates.includes(name), true, `missing CREATE ${name}`);
    assert.match(apply, new RegExp(`'${name}'`));
    assert.match(apply, /WAVE5_APPLY_ABORT_RPC_BODY_DRIFT/);
  }
  const inventory = readPkg("08_RPC_OVERWRITE_GUARD_INVENTORY.md");
  assert.match(inventory, /EXISTING_RPC_OVERWRITE_GUARD_COUNT=10/);
  assert.match(inventory, /APPLY_CREATE_OR_REPLACE_FUNCTION_COUNT=13/);
});

test("Round 5 I. unknown/newer RPC body aborts", () => {
  const src = readPkg("02_APPLY_DESIGN.sql");
  const apply = uncommented(src);
  assert.match(apply, /WAVE5_APPLY_ABORT_RPC_BODY_DRIFT: % missing certified marker/);
  assert.match(src, /APPLY_RPC_UNKNOWN_NEWER_BODY_OVERWRITE=DENIED/);
  assert.doesNotMatch(apply, /regexp_replace\s*\(\s*v_rpc_def/);
});

test("Round 5 J. Wave5-new unexpected existing helper aborts", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  for (const name of NEW_WAVE5_FNS) {
    assert.match(apply, new RegExp(`unexpected existing ${name}`));
  }
  assert.match(readPkg("08_RPC_OVERWRITE_GUARD_INVENTORY.md"), /NEW_WAVE5_FUNCTION_GUARD_COUNT=3/);
});

test("Round 5 K. internal helpers remain non-executable by authenticated", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const restoreIntended = uncommented(readPkg("07D_RESTORE_INTENDED_WRITES_DESIGN.sql"));
  const verify = uncommented(readPkg("03_VERIFY.sql"));
  assert.match(
    apply,
    /REVOKE ALL ON FUNCTION public\.wave5_ensure_athlete_for_club_member\(uuid, text, text\) FROM public, anon, authenticated/
  );
  assert.match(restoreIntended, /INTERNAL_HELPER_AUTHENTICATED_EXECUTE=DENIED/);
  assert.match(restoreIntended, /authenticated EXECUTE must stay DENIED on wave5_ensure_athlete_for_club_member/);
  assert.match(verify, /authenticated EXECUTE must be DENIED on wave5_ensure_athlete_for_club_member/);
});

test("Round 5 L. no live SQL execution in tests or design GO", () => {
  for (const name of PACKAGE_FILES) {
    const text = readPkg(name);
    assert.match(text, /WAVE5_SQL_DESIGN_ONLY/);
    assert.match(text, /OWNER_SQL_EXECUTION_GO=NO/);
    assert.doesNotMatch(text, /PRODUCTION_ACCESS_GO\s*=\s*YES/);
  }
  const apply = readPkg("02_APPLY_DESIGN.sql");
  assert.match(apply, /DO_NOT_RUN_ON_STAGING/);
  assert.match(apply, /DO_NOT_RUN_ON_PRODUCTION/);
  assert.match(apply, /SQL_EXECUTED=NO/);
});

test("Round 5 fail-closed while quiesced and mutation inventory count", () => {
  const runbook = readPkg("07_EXECUTION_RUNBOOK.md");
  const inventory = readPkg("06_CLUB_MUTATION_RPC_INVENTORY.md");
  const verify = uncommented(readPkg("03_VERIFY.sql"));
  assert.match(runbook, /FAIL_CLOSED_WHILE_QUIESCED=YES/);
  assert.match(runbook, /Do \*\*not\*\* auto-run APPLY again/);
  assert.match(inventory, /MUTATION_RPC_ENTRYPOINT_COUNT=14/);
  assert.match(verify, /wave5\.verify_privileges/);
  assert.match(verify, /still executable while quiesced/);
  assert.match(readPkg("00_README.md"), /RECONCILIATION_REQUIRED_BEFORE_STAGING_MUTATION=YES/);
  assert.match(readPkg("00_README.md"), /MAIN_DRIFT_CLUB_SCOPE_OVERLAP=NO/);
});

test("Round 6 A. 14 canonical is not 15 total quiesce targets", () => {
  const q1 = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  const inventory = readPkg("06_CLUB_MUTATION_RPC_INVENTORY.md");
  assert.match(q1, /CANONICAL_MUTATION_RPC_COUNT=14/);
  assert.match(q1, /LEGACY_COMPAT_MUTATION_RPC_COUNT=1/);
  assert.match(q1, /TOTAL_QUIESCE_TARGET_COUNT=15/);
  assert.match(inventory, /CANONICAL_MUTATION_RPC_COUNT=14/);
  assert.match(inventory, /LEGACY_COMPAT_MUTATION_RPC_COUNT=1/);
  assert.match(inventory, /TOTAL_QUIESCE_TARGET_COUNT=15/);
  assert.notEqual(14, 15);
});

test("Round 6 B. legacy alias cannot satisfy canonical required count", () => {
  const q1 = uncommented(readPkg("07A_QUIESCE_WRITES_DESIGN.sql"));
  const inventory = readPkg("06_CLUB_MUTATION_RPC_INVENTORY.md");
  assert.match(q1, /legacy alias cannot satisfy canonical required count/);
  assert.match(q1, /is_canonical boolean/);
  assert.match(inventory, /CANONICAL_COMMAND_SURFACE=NO/);
  assert.match(inventory, /POST_CANONICAL_RESTORE=NO/);
  assert.match(inventory, /club_leave_my_membership/);
});

test("Round 6 C. missing canonical signature aborts Q1", () => {
  const q1 = uncommented(readPkg("07A_QUIESCE_WRITES_DESIGN.sql"));
  assert.match(q1, /ALL_CANONICAL_MUTATION_SIGNATURES_PRESENT_BEFORE_Q1=NO missing/);
  assert.doesNotMatch(q1, /WAVE5_Q1_SKIP_MISSING/);
  assert.match(q1, /v_canonical_present <> 14/);
});

test("Round 6 D. unknown overload aborts", () => {
  const q1 = uncommented(readPkg("07A_QUIESCE_WRITES_DESIGN.sql"));
  assert.match(q1, /UNKNOWN_MUTATION_RPC_OVERLOAD/);
  assert.match(q1, /MUTATION_RPC_OVERLOAD_INVENTORY_COMPLETE=NO/);
});

test("Round 6 E. PUBLIC/anon/authenticated all denied after Q1", () => {
  const q1 = uncommented(readPkg("07A_QUIESCE_WRITES_DESIGN.sql"));
  assert.match(q1, /PUBLIC_MUTATION_EXECUTE_AFTER_Q1=/);
  assert.match(q1, /ANON_MUTATION_EXECUTE_AFTER_Q1=/);
  assert.match(q1, /AUTHENTICATED_MUTATION_EXECUTE_AFTER_Q1=/);
  assert.match(q1, /acl\.grantee = 0/);
  assert.match(q1, /has_function_privilege\('anon'/);
  assert.match(q1, /has_function_privilege\('authenticated'/);
});

test("Round 6 F. only one active batch", () => {
  const q1 = uncommented(readPkg("07A_QUIESCE_WRITES_DESIGN.sql"));
  assert.match(q1, /wave5_club_cutover_batch_one_active/);
  assert.match(q1, /ONE_ACTIVE_CUTOVER_BATCH violated/);
  assert.match(q1, /state NOT IN \('RESTORED', 'ABORTED'\)/);
});

test("Round 6 G. restore requires explicit batch id", () => {
  const restore = uncommented(readPkg("07C_RESTORE_WRITES_DESIGN.sql"));
  assert.match(restore, /RESTORE_REQUIRES_EXPLICIT_BATCH_ID/);
  assert.match(restore, /wave5\.restore_batch_id/);
});

test("Round 6 H. latest-snapshot restore is absent", () => {
  const restore = uncommented(readPkg("07C_RESTORE_WRITES_DESIGN.sql"));
  assert.doesNotMatch(restore, /ORDER BY[\s\S]*captured_at[\s\S]*DESC[\s\S]*LIMIT 1/);
  assert.match(readPkg("07C_RESTORE_WRITES_DESIGN.sql"), /LATEST_SNAPSHOT_IMPLICIT_RESTORE=DENIED/);
});

test("Round 6 I. cutover metadata application-role access denied", () => {
  const q1 = uncommented(readPkg("07A_QUIESCE_WRITES_DESIGN.sql"));
  assert.match(q1, /REVOKE ALL ON TABLE public\.wave5_club_cutover_batch FROM PUBLIC/);
  assert.match(q1, /REVOKE ALL ON TABLE public\.wave5_club_cutover_batch FROM anon, authenticated/);
  assert.match(q1, /REVOKE ALL ON TABLE public\.wave5_cutover_rpc_privilege_snapshot FROM PUBLIC/);
  assert.match(q1, /REVOKE ALL ON TABLE public\.wave5_cutover_rpc_privilege_snapshot FROM anon, authenticated/);
  assert.match(q1, /ENABLE ROW LEVEL SECURITY/);
});

test("Round 6 J. pre-Q1 transaction drain barrier exists", () => {
  const drain = uncommented(readPkg("07B_DRAIN_VERIFY.sql"));
  const mark = uncommented(readPkg("07B2_MARK_DRAINED_DESIGN.sql"));
  assert.match(drain, /PRE_Q1_INFLIGHT_TRANSACTION_BARRIER/);
  assert.match(drain, /xact_start <= v_q1/);
  assert.match(drain, /pg_stat_activity/);
  assert.match(mark, /PRE_Q1_INFLIGHT_TRANSACTION_BARRIER/);
  assert.match(mark, /state = 'DRAINED'/);
});

test("Round 6 K. arbitrary wave5.drain_pass=YES alone cannot authorize APPLY", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  assert.match(apply, /ARBITRARY_DRAIN_PASS_GUC_NOT_SUFFICIENT/);
  assert.match(apply, /wave5\.drain_pass cannot manufacture DRAINED/);
});

test("Round 6 L. APPLY requires durable DRAINED batch", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  assert.match(apply, /APPLY_REQUIRES_DURABLE_DRAIN_STATE/);
  assert.match(apply, /APPLY_BATCH_ID_MATCH_REQUIRED/);
  assert.match(apply, /wave5\.cutover_batch_id/);
  assert.match(apply, /v_state IS DISTINCT FROM 'DRAINED'/);
});

test("Round 6 M. all existing overwrite functions require strong fingerprint", () => {
  const src = readPkg("02_APPLY_DESIGN.sql");
  const apply = uncommented(src);
  const inventory = readPkg("08_RPC_OVERWRITE_GUARD_INVENTORY.md");
  assert.match(apply, /md5\(convert_to\(p\.prosrc, 'UTF8'\)\)/);
  assert.match(src, /EXISTING_RPC_STRONG_FINGERPRINT_COUNT=10/);
  assert.match(apply, /OWNER_REVIEW_REQUIRED/);
  assert.match(inventory, /EXISTING_RPC_STRONG_FINGERPRINT_COUNT=10/);
  for (const name of EXISTING_APPLY_RPCS) {
    assert.match(apply, new RegExp(`'${name}'[\\s\\S]{0,400}'UNCERTIFIED'`));
  }
});

test("Round 6 N. all 14 post-cutover command privileges are verified", () => {
  const verify = uncommented(readPkg("03_VERIFY.sql"));
  const restore = uncommented(readPkg("07D_RESTORE_INTENDED_WRITES_DESIGN.sql"));
  assert.match(verify, /POST_CUTOVER_MUTATION_PRIVILEGE_VERIFY_COUNT expected 14/);
  assert.match(restore, /POST_CUTOVER_MUTATION_PRIVILEGE_VERIFY_COUNT=14/);
  assert.match(restore, /GRANT EXECUTE ON FUNCTION public\.club_update\(uuid, text, integer, text, text, text, text, text\) TO authenticated/);
  assert.match(restore, /GRANT EXECUTE ON FUNCTION public\.club_leave_membership\(uuid, text\) TO authenticated/);
});

test("Round 6 O. internal helper direct execute remains denied", () => {
  const verify = uncommented(readPkg("03_VERIFY.sql"));
  const restore = uncommented(readPkg("07D_RESTORE_INTENDED_WRITES_DESIGN.sql"));
  assert.match(verify, /internal helper direct execute must be DENIED/);
  assert.match(restore, /INTERNAL_HELPER_AUTHENTICATED_EXECUTE=DENIED/);
  assert.match(restore, /LEGACY_LEAVE_MY_POST_CUTOVER_STATE=QUIESCED_EXECUTE_DENIED/);
});

test("Round 6 P. Staging timeout resolves to 5s", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const staging = readPkg("02_APPLY_STAGING_WRAPPER.sql");
  assert.match(staging, /SET wave5\.target_env = 'staging'/);
  assert.match(staging, /STAGING_LOCK_TIMEOUT=5s/);
  assert.match(apply, /WHEN 'staging' THEN '5s'/);
  assert.doesNotMatch(uncommented(staging), /SET LOCAL lock_timeout/);
});

test("Round 6 Q. Production timeout resolves to 15s", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const production = readPkg("02_APPLY_PRODUCTION_WRAPPER.sql");
  assert.match(production, /SET wave5\.target_env = 'production'/);
  assert.match(production, /PRODUCTION_LOCK_TIMEOUT=15s/);
  assert.match(apply, /WHEN 'production' THEN '15s'/);
});

test("Round 6 R. no live SQL execution", () => {
  for (const name of PACKAGE_FILES) {
    const text = readPkg(name);
    assert.match(text, /WAVE5_SQL_DESIGN_ONLY/);
    assert.match(text, /OWNER_SQL_EXECUTION_GO=NO/);
    assert.doesNotMatch(text, /SQL_EXECUTED=YES/);
  }
  const precheck = readPkg("01_PRECHECK.sql");
  assert.match(precheck, /RPC_FINGERPRINT_LIVE_CERTIFICATION_REQUIRED=YES/);
  assert.match(precheck, /prosrc_md5/);
  assert.match(precheck, /certification_status/);
});
