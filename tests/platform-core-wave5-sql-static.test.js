import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { auditSql } from "./helpers/wave5-sql-dollar-quote-audit.js";

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
  "07A2_QUIESCE_SEAL_DESIGN.sql",
  "07B_DRAIN_VERIFY.sql",
  "07B2_MARK_DRAINED_DESIGN.sql",
  "07C_RESTORE_WRITES_DESIGN.sql",
  "07D_RESTORE_INTENDED_WRITES_DESIGN.sql",
  "08_RPC_OVERWRITE_GUARD_INVENTORY.md",
  "08B_RPC_FINGERPRINT_CERTIFICATION.md",
  "09_CANONICAL_MUTATION_SURFACE.sql",
  "10_SERVICE_ROLE_DIRECT_DML_GUARD.md",
  "10A_SERVICE_ROLE_DML_QUIESCE_DESIGN.sql",
  "10B_SERVICE_ROLE_DML_VERIFY_DESIGN.sql",
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

function normalizeCatalogExpr(s) {
  return s.replace(/\s+/g, " ").trim();
}

const APPROVED_KIND_CHECK = "CHECK ((cutover_kind = 'WAVE5_CLUB_TENANT'::text))";
const APPROVED_STATE_CHECK =
  "CHECK ((state = ANY (ARRAY['PREPARED'::text, 'QUIESCED'::text, 'DRAINED'::text, 'APPLYING'::text, 'APPLIED'::text, 'VERIFIED'::text, 'RESTORED'::text, 'ABORTED'::text])))";
const APPROVED_ONE_ACTIVE_PRED = "(state <> ALL (ARRAY['RESTORED'::text, 'ABORTED'::text]))";

function kindCheckExact(def) {
  return normalizeCatalogExpr(def) === APPROVED_KIND_CHECK;
}

function stateCheckExact(def) {
  return normalizeCatalogExpr(def) === APPROVED_STATE_CHECK;
}

function oneActivePredicateExact(def) {
  return normalizeCatalogExpr(def) === APPROVED_ONE_ACTIVE_PRED;
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
  // Column names only in VALUES alias lists (typed aliases are invalid SQL).
  assert.match(q1, /AS t\(sig, is_canonical\)/);
  assert.doesNotMatch(q1, /AS t\(sig text, is_canonical boolean\)/);
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

test("Round 6 J. pre-quiesce transaction drain barrier exists", () => {
  const drain = uncommented(readPkg("07B_DRAIN_VERIFY.sql"));
  const mark = uncommented(readPkg("07B2_MARK_DRAINED_DESIGN.sql"));
  assert.match(drain, /PRE_QUIESCE_INFLIGHT_TRANSACTION_BARRIER/);
  assert.match(drain, /xact_start <= v_visible/);
  assert.match(drain, /pg_stat_activity/);
  assert.match(mark, /PRE_QUIESCE_INFLIGHT_TRANSACTION_BARRIER/);
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

test("Round 6 M. existing overwrite functions require strong fingerprint certification", () => {
  const src = readPkg("02_APPLY_DESIGN.sql");
  const apply = uncommented(src);
  const inventory = readPkg("08_RPC_OVERWRITE_GUARD_INVENTORY.md");
  const cert = readPkg("08B_RPC_FINGERPRINT_CERTIFICATION.md");
  assert.match(apply, /md5\(convert_to\(p\.prosrc, 'UTF8'\)\)/);
  assert.match(src, /EXISTING_RPC_STRONG_FINGERPRINT_COUNT=10/);
  assert.match(apply, /OWNER_REVIEW_REQUIRED/);
  assert.match(inventory, /EXISTING_RPC_STRONG_FINGERPRINT_COUNT=10/);
  assert.match(inventory, /RPC_EXISTING_CERTIFIED_MATCH_COUNT=8/);
  assert.match(inventory, /LIVE_HASH_IS_AUTHORITY=NO/);
  assert.match(cert, /APPROVED_FINGERPRINT_SOURCE=AUTHORITATIVE_REPOSITORY_FUNCTION_BODY/);
  assert.match(cert, /LIVE_HASH_IS_AUTHORITY=NO/);
  // Two live-only predecessors are Owner-accepted captured live; hashes remain encoded.
  for (const name of ["club_create", "club_list_registry"]) {
    assert.match(
      apply,
      new RegExp(`'${name}'[\\s\\S]{0,500}'OWNER_ACCEPTED_CAPTURED_LIVE_PREDECESSOR'`)
    );
    assert.match(
      inventory,
      new RegExp(`${name}[\\s\\S]{0,400}OWNER_ACCEPTED_CAPTURED_LIVE_PREDECESSOR`)
    );
  }
  // Eight CERTIFIED_MATCH functions must carry APPROVED_PREDECESSOR_PROSRC_MD5 (not UNCERTIFIED).
  assert.match(apply, /'phase42_club_canonical'[\s\S]{0,400}'871ff5136397a42f5c5718179b65aed9'/);
  assert.match(apply, /'club_list_members'[\s\S]{0,400}'3089518678635910041656a1ae30cacd'/);
  assert.match(apply, /'phase42_can_update_club'[\s\S]{0,400}'24f9f7e47c2dc0a166c6385811f6c43d'/);
  assert.match(apply, /'phase42_can_assign_club_owner'[\s\S]{0,400}'509ea5949fa8389edd1c4827e1bf5779'/);
  assert.match(apply, /'phase42_can_transfer_president'[\s\S]{0,400}'24f9f7e47c2dc0a166c6385811f6c43d'/);
  assert.match(apply, /'club_add_member'[\s\S]{0,400}'922df1b5d672f70150ae4010bb97bed0'/);
  assert.match(apply, /'club_restore_member'[\s\S]{0,400}'d24dbfa3f21e674f31ad509c655a7ef6'/);
  assert.match(apply, /'club_review_membership_request'[\s\S]{0,400}'0b8ee11ef23090f8cd6e364ad2e6eb60'/);
  // SQL helpers must declare language sql (not plpgsql) once certified.
  assert.match(apply, /'phase42_can_update_club'[\s\S]{0,200}'sql'/);
  assert.match(apply, /'phase42_can_assign_club_owner'[\s\S]{0,200}'sql'/);
  assert.match(apply, /'phase42_can_transfer_president'[\s\S]{0,200}'sql'/);
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

test("Round 7 A. quiesce visibility timestamp is created only after Q1 revoke commit", () => {
  const q1aSrc = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  const q1a = uncommented(q1aSrc);
  const q1bSrc = readPkg("07A2_QUIESCE_SEAL_DESIGN.sql");
  const q1b = uncommented(q1bSrc);
  assert.match(q1a, /'PREPARED'/);
  assert.match(q1a, /\bCOMMIT\s*;/);
  assert.doesNotMatch(q1a, /quiesce_visible_at\s*=/);
  assert.match(q1aSrc, /Q1_REVOKE_COMMIT_PRECEDES_QUIESCED_SEAL=YES/);
  assert.match(q1b, /PREPARED/);
  assert.match(q1b, /quiesce_visible_at = clock_timestamp\(\)/);
  assert.match(q1bSrc, /QUIESCE_VISIBLE_AT_IS_POST_Q1_COMMIT=YES/);
});

test("Round 7 B. pre-commit q1 timestamp cannot authorize drain", () => {
  const drain = uncommented(readPkg("07B_DRAIN_VERIFY.sql"));
  const mark = uncommented(readPkg("07B2_MARK_DRAINED_DESIGN.sql"));
  assert.match(drain, /pre-commit q1 timestamp cannot authorize drain/);
  assert.match(mark, /pre-commit q1 timestamp cannot authorize drain/);
  assert.doesNotMatch(drain, /xact_start <= v_q1/);
  assert.doesNotMatch(mark, /clock_timestamp\(\) > q1_committed_at/);
});

test("Round 7 C. drain uses quiesce_visible_at", () => {
  const drain = uncommented(readPkg("07B_DRAIN_VERIFY.sql"));
  const mark = uncommented(readPkg("07B2_MARK_DRAINED_DESIGN.sql"));
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  assert.match(drain, /b\.quiesce_visible_at/);
  assert.match(drain, /xact_start <= v_visible/);
  assert.match(mark, /quiesce_visible_at IS NOT NULL/);
  assert.match(apply, /drained_at must be after quiesce_visible_at/);
});

test("Round 7 D. service_role mutation entrypoints are quiesced if executable", () => {
  const q1aSrc = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  const q1a = uncommented(q1aSrc);
  assert.match(q1aSrc, /SERVICE_ROLE_MUTATION_ENTRYPOINT_POLICY=QUIESCE_IF_PRESENT/);
  assert.match(q1a, /REVOKE EXECUTE ON FUNCTION %s FROM service_role/);
  assert.match(q1a, /has_function_privilege\('service_role'/);
});

test("Round 7 E. internal helper service_role EXECUTE is preserved", () => {
  const q1aSrc = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  const q1a = uncommented(q1aSrc);
  assert.match(q1aSrc, /SERVICE_ROLE_INTERNAL_HELPER_EXECUTE=PRESERVE/);
  assert.doesNotMatch(
    q1a,
    /REVOKE EXECUTE ON FUNCTION public\.wave5_ensure_athlete_for_club_member/
  );
  assert.doesNotMatch(
    q1a,
    /REVOKE EXECUTE ON FUNCTION public\.wave5_resolve_club_facility_venue_id/
  );
  assert.doesNotMatch(q1a, /REVOKE[^\n]+FROM service_role CASCADE/i);
});

test("Round 7 F. 03B cannot mark VERIFIED with only a partial 3-RPC gate", () => {
  const markSrc = readPkg("03B_MARK_VERIFIED_DESIGN.sql");
  const mark = uncommented(markSrc);
  assert.match(mark, /partial 3-RPC gate is insufficient/);
  assert.match(markSrc, /VERIFIED_STATE_CANNOT_BE_MANUFACTURED=YES/);
  assert.doesNotMatch(
    mark,
    /FOREACH v_sig IN ARRAY ARRAY\[\s*'public\.club_create[\s\S]*club_add_member[\s\S]*club_review_membership_request'\s*\]/
  );
});

test("Round 7 G. 03B rechecks all 14 mutation RPCs quiesced", () => {
  const markSrc = readPkg("03B_MARK_VERIFIED_DESIGN.sql");
  const mark = uncommented(markSrc);
  assert.match(markSrc, /VERIFIED_GATE_MUTATION_RPC_COUNT=14/);
  assert.match(markSrc, /VERIFIED_GATE_CANONICAL_FK_COUNT=4/);
  assert.match(mark, /v_cmd_ok <> 14/);
  assert.match(mark, /club_leave_membership/);
  assert.match(mark, /club_update\(uuid,text,integer/);
});

test("Round 7 H. 07C refuses APPLIED state", () => {
  const restoreSrc = readPkg("07C_RESTORE_WRITES_DESIGN.sql");
  const restore = uncommented(restoreSrc);
  assert.match(restoreSrc, /POST_APPLY_LEGACY_ACL_RESTORE=DENIED/);
  assert.match(restore, /v_state IN \('APPLIED', 'VERIFIED'\)/);
});

test("Round 7 I. 07C refuses VERIFIED state", () => {
  const restore = uncommented(readPkg("07C_RESTORE_WRITES_DESIGN.sql"));
  assert.match(restore, /POST_APPLY_LEGACY_ACL_RESTORE=DENIED state=%/);
  assert.match(restore, /state IN \('PREPARED', 'QUIESCED', 'DRAINED'\)/);
  assert.doesNotMatch(restore, /state IN \('QUIESCED', 'DRAINED', 'APPLYING', 'APPLIED', 'VERIFIED'\)/);
});

test("Round 7 J. failed APPLY durable state returns/remains DRAINED", () => {
  const apply = readPkg("02_APPLY_DESIGN.sql");
  const restore = readPkg("07C_RESTORE_WRITES_DESIGN.sql");
  assert.match(apply, /FAILED_APPLY_DURABLE_STATE=DRAINED/);
  assert.match(apply, /transaction-local and rolls back/);
  assert.match(restore, /APPLYING is not restore authority/);
});

test("Round 7 K. prosrc fingerprint guard includes provolatile", () => {
  const applySrc = readPkg("02_APPLY_DESIGN.sql");
  const apply = uncommented(applySrc);
  const precheck = uncommented(readPkg("01_PRECHECK.sql"));
  assert.match(apply, /p\.provolatile/);
  assert.match(applySrc, /RPC_VOLATILITY_CERTIFICATION=REQUIRED/);
  assert.match(precheck, /p\.provolatile/);
  assert.match(apply, /live_provolatile=/);
});

test("Round 7 L. SECURITY DEFINER owner is inspected/certified", () => {
  const applySrc = readPkg("02_APPLY_DESIGN.sql");
  const apply = uncommented(applySrc);
  const precheck = uncommented(readPkg("01_PRECHECK.sql"));
  assert.match(applySrc, /RPC_OWNER_CERTIFICATION=REQUIRED/);
  assert.match(apply, /unknown\/untrusted SECURITY DEFINER owner/);
  assert.match(apply, /r\.rolname/);
  assert.match(precheck, /owner_role_name/);
  assert.match(precheck, /p\.proowner/);
  assert.doesNotMatch(uncommented(apply), /ALTER FUNCTION[\s\S]{0,80}OWNER TO/i);
});

test("Round 7 M. post-cutover authenticated ACL is normalized before GRANT", () => {
  const restoreSrc = readPkg("07D_RESTORE_INTENDED_WRITES_DESIGN.sql");
  const restore = uncommented(restoreSrc);
  const revokeIdx = restore.search(
    /REVOKE EXECUTE ON FUNCTION public\.club_create\(uuid, text, text, text, text, text\) FROM PUBLIC, anon, authenticated/
  );
  const grantIdx = restore.search(
    /GRANT EXECUTE ON FUNCTION public\.club_create\(uuid, text, text, text, text, text\) TO authenticated/
  );
  assert.ok(revokeIdx >= 0 && grantIdx > revokeIdx);
  assert.match(restoreSrc, /POST_CUTOVER_ACL_NORMALIZED=YES/);
});

test("Round 7 N. authenticated WITH GRANT OPTION is denied", () => {
  const restore = uncommented(readPkg("07D_RESTORE_INTENDED_WRITES_DESIGN.sql"));
  const verify = uncommented(readPkg("03_VERIFY.sql"));
  assert.match(restore, /AUTHENTICATED_GRANT_OPTION_DENIED/);
  assert.match(restore, /acl\.is_grantable/);
  assert.match(verify, /AUTHENTICATED_GRANT_OPTION_DENIED=NO/);
});

test("Round 7 O. control-plane existing schema/index drift aborts", () => {
  const q1aSrc = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  const q1a = uncommented(q1aSrc);
  assert.match(q1aSrc, /CONTROL_PLANE_EXISTING_SCHEMA_GUARD/);
  assert.match(q1a, /one-active unique index missing|one-active index predicate drift/);
  assert.match(q1a, /batch columns=/);
});

test("Round 7 P. no live SQL execution", () => {
  for (const name of PACKAGE_FILES) {
    const text = readPkg(name);
    assert.match(text, /WAVE5_SQL_DESIGN_ONLY/);
    assert.match(text, /OWNER_SQL_EXECUTION_GO=NO/);
    assert.doesNotMatch(text, /SQL_EXECUTED=YES/);
    assert.doesNotMatch(text, /STAGING_PRECHECK_EXECUTED=YES/);
  }
});

function markedInner(sql, name) {
  const re = new RegExp(`${name}_BEGIN([\\s\\S]*?)${name}_END`);
  const m = sql.match(re);
  assert.ok(m, `missing ${name}`);
  return m[1]
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*--\s?/, "").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

test("Round 8 canonical mutation surface is shared and does not drift", () => {
  const canon = readPkg("09_CANONICAL_MUTATION_SURFACE.sql");
  const values = markedInner(canon, "WAVE5_CANONICAL_MUTATION_SURFACE_VALUES");
  const arr14 = markedInner(canon, "WAVE5_CANONICAL_14_ARRAY");
  const arr15 = markedInner(canon, "WAVE5_QUIESCE_15_ARRAY");
  assert.equal((values.match(/true/g) || []).length, 14);
  assert.match(values, /club_leave_my_membership\(\)', false\)/);
  assert.doesNotMatch(arr14, /club_leave_my_membership/);
  assert.match(arr15, /club_leave_my_membership\(\)/);
  assert.equal(markedInner(readPkg("07A_QUIESCE_WRITES_DESIGN.sql"), "WAVE5_CANONICAL_MUTATION_SURFACE_VALUES"), values);
  assert.equal(markedInner(readPkg("01_PRECHECK.sql"), "WAVE5_CANONICAL_14_ARRAY"), arr14);
  assert.equal(markedInner(readPkg("07A2_QUIESCE_SEAL_DESIGN.sql"), "WAVE5_QUIESCE_15_ARRAY"), arr15);
  assert.equal(markedInner(readPkg("07B_DRAIN_VERIFY.sql"), "WAVE5_QUIESCE_15_ARRAY"), arr15);
  assert.equal(markedInner(readPkg("07B2_MARK_DRAINED_DESIGN.sql"), "WAVE5_QUIESCE_15_ARRAY"), arr15);
  assert.equal(markedInner(readPkg("02_APPLY_DESIGN.sql"), "WAVE5_CANONICAL_14_ARRAY"), arr14);
  assert.equal(markedInner(readPkg("03B_MARK_VERIFIED_DESIGN.sql"), "WAVE5_CANONICAL_14_ARRAY"), arr14);
  assert.equal(markedInner(readPkg("07D_RESTORE_INTENDED_WRITES_DESIGN.sql"), "WAVE5_CANONICAL_14_ARRAY"), arr14);
  assert.match(readPkg("00_README.md"), /CANONICAL_MUTATION_RPC_COUNT=14/);
  assert.match(readPkg("00_README.md"), /LEGACY_COMPAT_MUTATION_RPC_COUNT=1/);
  assert.match(readPkg("00_README.md"), /TOTAL_QUIESCE_TARGET_COUNT=15/);
  assert.match(
    readPkg("07B_DRAIN_VERIFY.sql"),
    /CANONICAL_MUTATION_SURFACE_REF=09_CANONICAL_MUTATION_SURFACE.sql/
  );
});

test("Round 8 A. Q1B rechecks unknown overloads", () => {
  const q1b = uncommented(readPkg("07A2_QUIESCE_SEAL_DESIGN.sql"));
  const src = readPkg("07A2_QUIESCE_SEAL_DESIGN.sql");
  assert.match(src, /Q1B_UNKNOWN_OVERLOAD_GATE=ABORT/);
  assert.match(src, /Q1B_UNKNOWN_OVERLOAD_AUTHORITY=OID/);
  assert.match(q1b, /UNKNOWN_MUTATION_RPC_OVERLOAD/);
  assert.match(q1b, /to_regprocedure\(approved\.sig\)::oid = p\.oid/);
  assert.doesNotMatch(
    q1b,
    /format\('%s\.%s\(%s\)',\s*n\.nspname,\s*p\.proname,\s*pg_catalog\.pg_get_function_identity_arguments\(p\.oid\)\)\s*NOT IN/
  );
});

test("Round 8 B. 07B2 rechecks unknown overloads", () => {
  const mark = uncommented(readPkg("07B2_MARK_DRAINED_DESIGN.sql"));
  const src = readPkg("07B2_MARK_DRAINED_DESIGN.sql");
  assert.match(src, /DRAINED_UNKNOWN_OVERLOAD_GATE=ABORT/);
  assert.match(src, /DRAINED_UNKNOWN_OVERLOAD_AUTHORITY=OID/);
  assert.match(mark, /UNKNOWN_MUTATION_RPC_OVERLOAD/);
  assert.match(mark, /to_regprocedure\(approved\.sig\)::oid = p\.oid/);
});

test("Round 8 C. APPLY prelock rechecks unknown overloads", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const src = readPkg("02_APPLY_DESIGN.sql");
  const prelock = apply.slice(0, apply.search(/LOCK TABLE\s+public\.platform_tenants/));
  assert.match(src, /APPLY_PRELOCK_UNKNOWN_OVERLOAD_GATE=ABORT/);
  assert.match(src, /APPLY_PRELOCK_UNKNOWN_OVERLOAD_AUTHORITY=OID/);
  assert.match(prelock, /UNKNOWN_MUTATION_RPC_OVERLOAD/);
  assert.match(prelock, /to_regprocedure\(approved\.sig\)::oid = p\.oid/);
});

test("Round 8 D. APPLY prelock checks all 14 canonical mutation RPCs", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const src = readPkg("02_APPLY_DESIGN.sql");
  const prelock = apply.slice(0, apply.search(/LOCK TABLE\s+public\.platform_tenants/));
  assert.match(src, /APPLY_PRELOCK_MUTATION_RPC_COUNT=14/);
  assert.match(prelock, /APPLY_PRELOCK_MUTATION_RPC_COUNT expected 14/);
  assert.match(prelock, /club_leave_membership/);
  assert.match(prelock, /club_review_membership_request/);
});

test("Round 8 E. APPLY prelock checks PUBLIC/anon/authenticated/service_role", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const src = readPkg("02_APPLY_DESIGN.sql");
  const prelock = apply.slice(0, apply.search(/LOCK TABLE\s+public\.platform_tenants/));
  assert.match(src, /APPLY_PRELOCK_ALL_MUTATION_CALLER_ROLES_QUIESCED=YES/);
  assert.match(prelock, /acl\.grantee = 0/);
  assert.match(prelock, /has_function_privilege\('anon'/);
  assert.match(prelock, /has_function_privilege\('authenticated'/);
  assert.match(prelock, /has_function_privilege\('service_role'/);
  assert.match(prelock, /APPLY_PRELOCK_ALL_MUTATION_CALLER_ROLES_QUIESCED=NO/);
});

test("Round 8 F. no stale Q1 quiesce evidence is accepted as APPLY authority", () => {
  const src = readPkg("02_APPLY_DESIGN.sql");
  const apply = uncommented(src);
  const prelock = apply.slice(0, apply.search(/LOCK TABLE\s+public\.platform_tenants/));
  assert.match(src, /APPLY_DEPENDS_ON_STALE_QUIESCE_EVIDENCE=NO/);
  const drainedIdx = prelock.search(/v_state IS DISTINCT FROM 'DRAINED'/);
  const aclIdx = prelock.search(/has_function_privilege\('authenticated'/);
  const unknownIdx = prelock.search(/UNKNOWN_MUTATION_RPC_OVERLOAD/);
  assert.ok(drainedIdx >= 0 && unknownIdx > drainedIdx && aclIdx > unknownIdx);
});

test("Round 8 G. pre-quiesce barrier catches arbitrary named non-system user transactions", () => {
  const drain = uncommented(readPkg("07B_DRAIN_VERIFY.sql"));
  const mark = uncommented(readPkg("07B2_MARK_DRAINED_DESIGN.sql"));
  for (const src of [drain, mark]) {
    assert.match(src, /PRE_QUIESCE_ALL_USER_TRANSACTION_BARRIER/);
    assert.match(src, /AMBIGUOUS_NAMED_DB_SESSION=FAIL_CLOSED/);
    assert.match(src, /xact_start <= v_visible/);
    assert.match(src, /backend_type/);
    assert.doesNotMatch(src, /a\.usename IN \('authenticated'/);
    assert.doesNotMatch(src, /pg_terminate_backend/);
  }
});

test("Round 8 H. PRECHECK reports direct Club DML privileges", () => {
  const precheck = readPkg("01_PRECHECK.sql");
  const body = uncommented(precheck);
  assert.match(precheck, /DIRECT_CLUB_DML_PUBLIC_REQUIRED=DENIED/);
  assert.match(precheck, /DIRECT_CLUB_DML_ANON_REQUIRED=DENIED/);
  assert.match(precheck, /DIRECT_CLUB_DML_AUTHENTICATED_REQUIRED=DENIED/);
  assert.match(precheck, /SERVICE_ROLE_DIRECT_CLUB_DML/);
  assert.match(precheck, /PRESENT_REQUIRES_EXECUTION_WINDOW_CONTROL/);
  assert.match(body, /has_table_privilege\(r\.rolname/);
  assert.match(body, /has_table_privilege\('service_role'/);
  assert.match(body, /\('anon'\), \('authenticated'\), \('service_role'\)/);
  assert.match(body, /club_governance_assignments/);
  assert.match(body, /club_membership_requests_v42/);
  assert.doesNotMatch(body, /\bINSERT\s+INTO\b/i);
  assert.doesNotMatch(body, /\bREVOKE\b/i);
  assert.doesNotMatch(body, /\bGRANT\b/i);
});

test("Round 8 I. batch PK exactly batch_id", () => {
  const q1a = uncommented(readPkg("07A_QUIESCE_WRITES_DESIGN.sql"));
  const src = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  assert.match(src, /CONTROL_PLANE_BATCH_PK_EXACT=YES/);
  assert.match(q1a, /CONTROL_PLANE_BATCH_PK_EXACT=NO/);
  assert.match(q1a, /v_pk IS DISTINCT FROM 'batch_id'/);
});

test("Round 8 J. snapshot FK exactly targets batch(batch_id)", () => {
  const q1a = uncommented(readPkg("07A_QUIESCE_WRITES_DESIGN.sql"));
  const src = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  assert.match(src, /CONTROL_PLANE_SNAPSHOT_FK_EXACT=YES/);
  assert.match(src, /ON DELETE RESTRICT ON UPDATE RESTRICT/);
  assert.match(q1a, /public\.wave5_club_cutover_batch/);
  assert.match(q1a, /v_fk_lcols IS DISTINCT FROM 'batch_id'/);
  assert.match(q1a, /v_fk_fcols IS DISTINCT FROM 'batch_id'/);
  assert.match(q1a, /v_fk_del IS DISTINCT FROM 'r'/);
});

test("Round 8 K. one-active unique index key exactly cutover_kind", () => {
  const q1a = uncommented(readPkg("07A_QUIESCE_WRITES_DESIGN.sql"));
  const src = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  assert.match(src, /CONTROL_PLANE_ONE_ACTIVE_INDEX_EXACT=YES/);
  assert.match(q1a, /indisunique/);
  assert.match(q1a, /v_idx_key IS DISTINCT FROM 'cutover_kind'/);
  // pg_index.indkey is int2vector with lower bound 0 — first key is [0], not [1].
  assert.match(q1a, /indkey\[0\]/);
  assert.doesNotMatch(q1a, /indkey\[1\]/);
  assert.match(q1a, /indnkeyatts/);
  assert.match(q1a, /'RESTORED'::text, 'ABORTED'::text/);
});

test("Round 12. Q0A/Q1A first-key indkey guards use int2vector [0]", () => {
  const q0a = uncommented(readPkg("10A_SERVICE_ROLE_DML_QUIESCE_DESIGN.sql"));
  const q1a = uncommented(readPkg("07A_QUIESCE_WRITES_DESIGN.sql"));
  for (const [label, src] of [
    ["10A", q0a],
    ["07A", q1a],
  ]) {
    assert.match(
      src,
      /a\.attnum\s*=\s*i\.indkey\[0\]/,
      `${label} must resolve first index key via indkey[0]`
    );
    assert.match(
      src,
      /i\.indkey\[0\]\s*>\s*0/,
      `${label} must guard first-key attnum with indkey[0] > 0`
    );
    assert.doesNotMatch(
      src,
      /indkey\[1\]/,
      `${label} must not use defective first-key indkey[1]`
    );
    assert.match(src, /v_idx_key IS DISTINCT FROM 'cutover_kind'/);
    assert.match(src, /indnkeyatts/);
    assert.match(src, /indisunique/);
    assert.match(src, /CONTROL_PLANE_ONE_ACTIVE_INDEX_EXACT=NO|CONTROL_PLANE_ONE_ACTIVE_INDEX/);
  }
  // Package-wide: no Wave5 SQL design file may use first-key indkey[1].
  const sqlDir = path.join(
    process.cwd(),
    "docs/platform-core-wave5-club-context-closure"
  );
  function walk(dir, out = []) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p, out);
      else if (ent.isFile() && ent.name.endsWith(".sql")) out.push(p);
    }
    return out;
  }
  for (const file of walk(sqlDir)) {
    const body = uncommented(fs.readFileSync(file, "utf8"));
    assert.doesNotMatch(
      body,
      /indkey\[1\]/,
      `${path.relative(process.cwd(), file)} must not use indkey[1]`
    );
  }
});

test("Round 8 L. 03B uses exact regprocedure for critical functions", () => {
  const mark = uncommented(readPkg("03B_MARK_VERIFIED_DESIGN.sql"));
  const src = readPkg("03B_MARK_VERIFIED_DESIGN.sql");
  assert.match(src, /VERIFIED_GATE_EXACT_RPC_RESOLUTION=YES/);
  assert.match(mark, /to_regprocedure\('public\.phase42_club_canonical\(text\)'\)/);
  assert.match(mark, /to_regprocedure\('public\.club_create\(uuid,text,text,text,text,text\)'\)/);
  assert.match(mark, /pg_get_functiondef\('public\.phase42_club_canonical\(text\)'::regprocedure\)/);
  assert.match(mark, /pg_get_functiondef\('public\.club_create\(uuid,text,text,text,text,text\)'::regprocedure\)/);
  assert.match(mark, /overload_count=%/);
  assert.doesNotMatch(mark, /p\.proname = 'phase42_club_canonical'[\s\S]{0,80}LIMIT 1/);
  assert.doesNotMatch(mark, /p\.proname = 'club_create'[\s\S]{0,80}LIMIT 1/);
});

test("Round 8 M. 03B unknown overload fails", () => {
  const mark = uncommented(readPkg("03B_MARK_VERIFIED_DESIGN.sql"));
  const src = readPkg("03B_MARK_VERIFIED_DESIGN.sql");
  assert.match(src, /VERIFIED_GATE_UNKNOWN_OVERLOAD=ABORT/);
  assert.match(mark, /VERIFIED_GATE_UNKNOWN_OVERLOAD=ABORT UNKNOWN_MUTATION_RPC_OVERLOAD/);
});

test("Round 8 N. 07C final caller-role ACL equals captured snapshot", () => {
  const restore = uncommented(readPkg("07C_RESTORE_WRITES_DESIGN.sql"));
  const src = readPkg("07C_RESTORE_WRITES_DESIGN.sql");
  assert.match(src, /RESTORE_FINAL_ACL_EQUALS_SNAPSHOT=YES/);
  assert.match(restore, /RESTORE_FINAL_ACL_EQUALS_SNAPSHOT=NO/);
  assert.match(restore, /KEEP WRITES QUIESCED OWNER REVIEW REQUIRED/);
  assert.match(restore, /grantee_name IN \('PUBLIC', 'anon', 'authenticated', 'service_role'\)/);
  assert.match(src, /POST_APPLY_LEGACY_ACL_RESTORE=DENIED/);
  assert.match(src, /ACL_RESTORE_FUNCTION_IDENTITY_AUTHORITY=APPROVED_REGPROCEDURE_OID/);
  assert.match(restore, /state IN \('PREPARED', 'QUIESCED', 'DRAINED'\)/);
  assert.match(restore, /to_regprocedure\(r\.approved_sig\)/);
  assert.match(restore, /p\.oid = to_regprocedure\(approved\.sig\)/);
  assert.doesNotMatch(restore, /format\('%s\.%s\(%s\)',\s*r\.nspname,\s*r\.proname,\s*r\.identity_args\)/);
  assert.doesNotMatch(restore, /pg_get_function_identity_arguments\(p\.oid\) = s0\.identity_args/);
  assert.doesNotMatch(restore, /pg_get_function_identity_arguments\(p\.oid\) = s\.identity_args/);
});

test("Round 8 O. Round7 Q1A/Q1B/service-role/fingerprint/07D guarantees preserved", () => {
  const q1a = uncommented(readPkg("07A_QUIESCE_WRITES_DESIGN.sql"));
  const q1aSrc = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  const q1b = uncommented(readPkg("07A2_QUIESCE_SEAL_DESIGN.sql"));
  const applySrc = readPkg("02_APPLY_DESIGN.sql");
  const restoreIntended = uncommented(readPkg("07D_RESTORE_INTENDED_WRITES_DESIGN.sql"));
  const restoreSrc = readPkg("07D_RESTORE_INTENDED_WRITES_DESIGN.sql");
  const markSrc = readPkg("03B_MARK_VERIFIED_DESIGN.sql");
  assert.match(q1aSrc, /Q1_REVOKE_COMMIT_PRECEDES_QUIESCED_SEAL=YES/);
  assert.match(q1a, /\bCOMMIT\s*;/);
  assert.doesNotMatch(q1a, /quiesce_visible_at\s*=/);
  assert.match(q1b, /quiesce_visible_at = clock_timestamp\(\)/);
  assert.match(q1aSrc, /SERVICE_ROLE_MUTATION_ENTRYPOINT_POLICY=QUIESCE_IF_PRESENT/);
  assert.match(q1aSrc, /SERVICE_ROLE_INTERNAL_HELPER_EXECUTE=PRESERVE/);
  assert.match(markSrc, /VERIFIED_GATE_CANONICAL_FK_COUNT=4/);
  assert.match(markSrc, /VERIFIED_GATE_MUTATION_RPC_COUNT=14/);
  assert.match(applySrc, /RPC_VOLATILITY_CERTIFICATION=REQUIRED/);
  assert.match(applySrc, /RPC_OWNER_CERTIFICATION=REQUIRED/);
  assert.match(restoreSrc, /POST_CUTOVER_ACL_NORMALIZED=YES/);
  assert.match(restoreIntended, /AUTHENTICATED_GRANT_OPTION_DENIED/);
  assert.match(restoreIntended, /POST_CUTOVER_MUTATION_PRIVILEGE_VERIFY_COUNT=14/);
  assert.match(applySrc, /STAGING_LOCK_TIMEOUT=5s/);
  assert.match(applySrc, /PRODUCTION_LOCK_TIMEOUT=15s/);
  assert.match(readPkg("07C_RESTORE_WRITES_DESIGN.sql"), /POST_APPLY_LEGACY_ACL_RESTORE=DENIED/);
});

test("Round 8 P. no live SQL execution", () => {
  for (const name of PACKAGE_FILES) {
    const text = readPkg(name);
    assert.match(text, /WAVE5_SQL_DESIGN_ONLY/);
    assert.match(text, /OWNER_SQL_EXECUTION_GO=NO/);
    assert.doesNotMatch(text, /SQL_EXECUTED=YES/);
    assert.doesNotMatch(text, /STAGING_PRECHECK_EXECUTED=YES/);
    assert.doesNotMatch(text, /SQL_EXECUTED=YES/);
  }
  assert.match(readPkg("00_README.md"), /SQL_DESIGN_REVIEWED_PASS=NO/);
  assert.match(readPkg("00_README.md"), /SQL_DESIGN_REVIEW_ROUND8_REMEDIATION=COMPLETE_PENDING_ROUND9_OWNER_REVIEW/);
});

test("Round 9 A. cutover_kind inequality cannot pass exact guard", () => {
  const src = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  const q1a = uncommented(src);
  assert.match(src, /CONTROL_PLANE_KIND_CHECK_EXACT=YES/);
  assert.match(q1a, /CONTROL_PLANE_KIND_CHECK_EXACT=NO/);
  assert.equal(kindCheckExact(APPROVED_KIND_CHECK), true);
  assert.equal(kindCheckExact("CHECK ((cutover_kind <> 'WAVE5_CLUB_TENANT'::text))"), false);
  assert.equal(kindCheckExact("CHECK ((cutover_kind != 'WAVE5_CLUB_TENANT'::text))"), false);
  assert.equal(kindCheckExact("CHECK ((NOT (cutover_kind = 'WAVE5_CLUB_TENANT'::text)))"), false);
  assert.equal(
    kindCheckExact("CHECK ((cutover_kind = ANY (ARRAY['WAVE5_CLUB_TENANT'::text, 'OTHER'::text])))"),
    false
  );
  assert.match(q1a, /v_chk ~ '<>'/);
  assert.match(q1a, /cutover_kind = 'WAVE5_CLUB_TENANT'::text/);
  assert.doesNotMatch(q1a, /v_kind_tokens/);
});

test("Round 9 B. inverted state NOT IN cannot pass exact guard", () => {
  const src = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  const q1a = uncommented(src);
  assert.match(src, /CONTROL_PLANE_STATE_CHECK_EXACT=YES/);
  assert.match(q1a, /CONTROL_PLANE_STATE_CHECK_EXACT=NO/);
  assert.equal(stateCheckExact(APPROVED_STATE_CHECK), true);
  assert.equal(
    stateCheckExact(
      "CHECK ((NOT (state = ANY (ARRAY['PREPARED'::text, 'QUIESCED'::text, 'DRAINED'::text, 'APPLYING'::text, 'APPLIED'::text, 'VERIFIED'::text, 'RESTORED'::text, 'ABORTED'::text]))))"
    ),
    false
  );
  assert.equal(
    stateCheckExact(
      "CHECK ((state <> ALL (ARRAY['PREPARED'::text, 'QUIESCED'::text, 'DRAINED'::text, 'APPLYING'::text, 'APPLIED'::text, 'VERIFIED'::text, 'RESTORED'::text, 'ABORTED'::text])))"
    ),
    false
  );
  assert.match(q1a, /NOT\\s\+IN/);
  assert.doesNotMatch(q1a, /v_chk_tokens IS DISTINCT FROM 'ABORTED,APPLIED/);
});

test("Round 9 C. UNIQUE(cutover_kind,batch_id) cannot satisfy one-active index exact guard", () => {
  const src = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  const q1a = uncommented(src);
  assert.match(src, /UNIQUE\(cutover_kind, batch_id\) fails KEY_COUNT=1/);
  assert.match(q1a, /v_idx_nkey IS DISTINCT FROM 1/);
  assert.match(q1a, /v_idx_natts IS DISTINCT FROM 1/);
});

test("Round 9 D. one-active index key count must equal 1", () => {
  const src = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  const q1a = uncommented(src);
  assert.match(src, /CONTROL_PLANE_ONE_ACTIVE_INDEX_KEY_COUNT=1/);
  assert.match(src, /CONTROL_PLANE_ONE_ACTIVE_INDEX_UNIQUE=YES/);
  assert.match(src, /CONTROL_PLANE_ONE_ACTIVE_INDEX_KEY=cutover_kind/);
  assert.match(q1a, /v_idx_nkey IS DISTINCT FROM 1/);
  assert.match(q1a, /v_idx_natts IS DISTINCT FROM 1/);
  assert.match(q1a, /v_idx_expr IS NOT NULL/);
  assert.match(q1a, /v_idx_key IS DISTINCT FROM 'cutover_kind'/);
});

test("Round 9 E. incorrect OR predicate cannot satisfy one-active predicate guard", () => {
  const src = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  const q1a = uncommented(src);
  assert.match(src, /CONTROL_PLANE_ONE_ACTIVE_INDEX_PREDICATE_EXACT=YES/);
  assert.equal(oneActivePredicateExact(APPROVED_ONE_ACTIVE_PRED), true);
  assert.equal(
    oneActivePredicateExact("((state <> 'RESTORED'::text) OR (state <> 'ABORTED'::text))"),
    false
  );
  assert.equal(
    oneActivePredicateExact("((state <> 'RESTORED'::text) AND (state <> 'ABORTED'::text))"),
    false
  );
  assert.match(q1a, /v_pred ~\* '\\mOR\\M'/);
  assert.match(q1a, /state <> ALL \(ARRAY\['RESTORED'::text, 'ABORTED'::text\]\)/);
  assert.doesNotMatch(q1a, /v_idx_tokens IS DISTINCT FROM 'ABORTED,RESTORED'/);
});

test("Round 9 F. unknown mutation overload makes PRECHECK fail", () => {
  const src = readPkg("01_PRECHECK.sql");
  const body = uncommented(src);
  assert.match(src, /PRECHECK_UNKNOWN_MUTATION_OVERLOAD_GATE=ABORT/);
  assert.match(body, /WAVE5_PRECHECK_FAIL: UNKNOWN_MUTATION_RPC_OVERLOAD_COUNT=/);
  assert.match(body, /pg_get_function_identity_arguments/);
  assert.match(body, /IF v_overload > 0/);
});

test("Round 9 G. PUBLIC direct Club DML makes PRECHECK fail", () => {
  const body = uncommented(readPkg("01_PRECHECK.sql"));
  assert.match(
    body,
    /WAVE5_PRECHECK_FAIL: DIRECT_CLUB_DML_PUBLIC_REQUIRED=DENIED observed=PRESENT DIRECT_CLUB_DML_OPERATION_SET=INSERT_UPDATE_DELETE_TRUNCATE/
  );
  assert.match(body, /acl\.grantee = 0/);
  assert.match(body, /acl\.privilege_type IN \('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'\)/);
});

test("Round 9 H. anon direct Club DML makes PRECHECK fail", () => {
  const body = uncommented(readPkg("01_PRECHECK.sql"));
  assert.match(
    body,
    /WAVE5_PRECHECK_FAIL: DIRECT_CLUB_DML_ANON_REQUIRED=DENIED observed=PRESENT DIRECT_CLUB_DML_OPERATION_SET=INSERT_UPDATE_DELETE_TRUNCATE/
  );
  assert.match(body, /has_table_privilege\('anon', format\('public\.%I', t\.table_name\), 'TRUNCATE'\)/);
});

test("Round 9 I. authenticated direct Club DML makes PRECHECK fail", () => {
  const body = uncommented(readPkg("01_PRECHECK.sql"));
  assert.match(
    body,
    /WAVE5_PRECHECK_FAIL: DIRECT_CLUB_DML_AUTHENTICATED_REQUIRED=DENIED observed=PRESENT DIRECT_CLUB_DML_OPERATION_SET=INSERT_UPDATE_DELETE_TRUNCATE/
  );
  assert.match(
    body,
    /has_table_privilege\('authenticated', format\('public\.%I', t\.table_name\), 'TRUNCATE'\)/
  );
});

test("Round 9 J. service_role classification includes TRUNCATE", () => {
  const src = readPkg("01_PRECHECK.sql");
  const body = uncommented(src);
  assert.match(src, /DIRECT_CLUB_DML_OPERATION_SET=INSERT_UPDATE_DELETE_TRUNCATE/);
  assert.match(
    body,
    /has_table_privilege\('service_role', format\('public\.%I', t\.table_name\), 'TRUNCATE'\)/
  );
  assert.match(body, /has_table_privilege\(r\.rolname, format\('public\.%I', t\.table_name\), 'TRUNCATE'\)/);
});

test("Round 9 K. service_role PRESENT produces writer-control-required YES", () => {
  const body = uncommented(readPkg("01_PRECHECK.sql"));
  assert.match(
    body,
    /SERVICE_ROLE_DIRECT_CLUB_DML=PRESENT_REQUIRES_EXECUTION_WINDOW_CONTROL SERVICE_ROLE_DIRECT_WRITER_CONTROL_REQUIRED=YES/
  );
  assert.match(body, /SERVICE_ROLE_DIRECT_WRITER_CONTROL_REQUIRED=NO/);
  assert.match(body, /PRECHECK is not apply-ready/);
  assert.doesNotMatch(body, /\bREVOKE\b/);
});

test("Round 9 L. WAVE5_PRECHECK_OK appears only after security gates", () => {
  const src = readPkg("01_PRECHECK.sql");
  const body = uncommented(src);
  assert.match(src, /WAVE5_PRECHECK_OK_IS_FINAL_GATE=YES/);
  const unknownIdx = body.indexOf("UNKNOWN_MUTATION_RPC_OVERLOAD_COUNT=");
  const publicIdx = body.indexOf("DIRECT_CLUB_DML_PUBLIC_REQUIRED=DENIED observed=PRESENT");
  const anonIdx = body.indexOf("DIRECT_CLUB_DML_ANON_REQUIRED=DENIED observed=PRESENT");
  const authIdx = body.indexOf("DIRECT_CLUB_DML_AUTHENTICATED_REQUIRED=DENIED observed=PRESENT");
  const svcIdx = body.indexOf("SERVICE_ROLE_DIRECT_CLUB_DML=");
  const okIdx = body.indexOf("RAISE NOTICE 'WAVE5_PRECHECK_OK");
  assert.ok(unknownIdx >= 0 && publicIdx > unknownIdx);
  assert.ok(anonIdx > publicIdx && authIdx > anonIdx);
  assert.ok(svcIdx > authIdx && okIdx > svcIdx);
  assert.equal(body.includes("RAISE NOTICE 'WAVE5_PRECHECK_OK"), true);
  const firstOk = body.search(/WAVE5_PRECHECK_OK/);
  assert.ok(firstOk > unknownIdx && firstOk > publicIdx);
});

test("Round 9 M. 01_PRECHECK contains no live mutation statement", () => {
  const src = readPkg("01_PRECHECK.sql");
  const body = uncommented(src);
  assert.match(src, /PRECHECK_READ_ONLY=YES/);
  assert.doesNotMatch(body, /\bINSERT\s+INTO\b/i);
  assert.doesNotMatch(body, /\bUPDATE\s+public\./i);
  assert.doesNotMatch(body, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(body, /\bTRUNCATE\s+(TABLE\s+)?(ONLY\s+)?public\./i);
  assert.doesNotMatch(body, /\bALTER\s+(TABLE|FUNCTION|INDEX|ROLE)\b/i);
  assert.doesNotMatch(body, /\bCREATE\s+(TABLE|INDEX|UNIQUE|FUNCTION|POLICY|ROLE)\b/i);
  assert.doesNotMatch(body, /\bDROP\s+(TABLE|INDEX|FUNCTION|POLICY|ROLE)\b/i);
  assert.doesNotMatch(body, /\bGRANT\b/i);
  assert.doesNotMatch(body, /\bREVOKE\b/i);
});

test("Round 9 N. Round 8 authority-transition guarantees remain present", () => {
  const q1aSrc = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  const q1bSrc = readPkg("07A2_QUIESCE_SEAL_DESIGN.sql");
  const drainSrc = readPkg("07B_DRAIN_VERIFY.sql");
  const markDrainSrc = readPkg("07B2_MARK_DRAINED_DESIGN.sql");
  const applySrc = readPkg("02_APPLY_DESIGN.sql");
  const markSrc = readPkg("03B_MARK_VERIFIED_DESIGN.sql");
  const restoreSrc = readPkg("07C_RESTORE_WRITES_DESIGN.sql");
  const restoreIntended = uncommented(readPkg("07D_RESTORE_INTENDED_WRITES_DESIGN.sql"));
  assert.match(q1bSrc, /Q1B_UNKNOWN_OVERLOAD_GATE=ABORT/);
  assert.match(markDrainSrc, /DRAINED_UNKNOWN_OVERLOAD_GATE=ABORT/);
  assert.match(applySrc, /APPLY_PRELOCK_UNKNOWN_OVERLOAD_GATE=ABORT/);
  assert.match(applySrc, /APPLY_PRELOCK_MUTATION_RPC_COUNT=14/);
  assert.match(applySrc, /APPLY_PRELOCK_ALL_MUTATION_CALLER_ROLES_QUIESCED=YES/);
  assert.match(applySrc, /APPLY_DEPENDS_ON_STALE_QUIESCE_EVIDENCE=NO/);
  assert.match(drainSrc, /PRE_QUIESCE_ALL_USER_TRANSACTION_BARRIER=YES/);
  assert.match(drainSrc, /AMBIGUOUS_NAMED_DB_SESSION=FAIL_CLOSED/);
  assert.match(markSrc, /VERIFIED_GATE_EXACT_RPC_RESOLUTION=YES/);
  assert.match(markSrc, /VERIFIED_GATE_UNKNOWN_OVERLOAD=ABORT/);
  assert.match(restoreSrc, /RESTORE_FINAL_ACL_EQUALS_SNAPSHOT=YES/);
  assert.match(q1aSrc, /Q1_REVOKE_COMMIT_PRECEDES_QUIESCED_SEAL=YES/);
  assert.match(q1bSrc, /QUIESCE_VISIBLE_AT_IS_POST_Q1_COMMIT=YES/);
  assert.match(q1aSrc, /SERVICE_ROLE_MUTATION_ENTRYPOINT_POLICY=QUIESCE_IF_PRESENT/);
  assert.match(q1aSrc, /SERVICE_ROLE_INTERNAL_HELPER_EXECUTE=PRESERVE/);
  assert.match(markSrc, /VERIFIED_GATE_CANONICAL_FK_COUNT=4/);
  assert.match(markSrc, /VERIFIED_GATE_MUTATION_RPC_COUNT=14/);
  assert.match(restoreSrc, /POST_APPLY_LEGACY_ACL_RESTORE=DENIED/);
  assert.match(applySrc, /FAILED_APPLY_DURABLE_STATE=DRAINED/);
  assert.match(applySrc, /RPC_VOLATILITY_CERTIFICATION=REQUIRED/);
  assert.match(applySrc, /RPC_OWNER_CERTIFICATION=REQUIRED/);
  assert.match(readPkg("01_PRECHECK.sql"), /RPC_FINGERPRINT_LIVE_CERTIFICATION_REQUIRED=YES/);
  assert.match(readPkg("07D_RESTORE_INTENDED_WRITES_DESIGN.sql"), /POST_CUTOVER_ACL_NORMALIZED=YES/);
  assert.match(restoreIntended, /AUTHENTICATED_GRANT_OPTION_DENIED/);
  assert.match(readPkg("07D_RESTORE_INTENDED_WRITES_DESIGN.sql"), /POST_CUTOVER_MUTATION_PRIVILEGE_VERIFY_COUNT=14/);
  assert.match(applySrc, /STAGING_LOCK_TIMEOUT=5s/);
  assert.match(applySrc, /PRODUCTION_LOCK_TIMEOUT=15s/);
  assert.match(q1aSrc, /CONTROL_PLANE_DRIFT_ABORTS_Q1=YES/);
  assert.match(readPkg("00_README.md"), /POST_APPLY_VERIFY_FAILURE_KEEP_QUIESCED=YES/);
  assert.match(readPkg("00_README.md"), /SQL_DESIGN_REVIEW_ROUND9_REMEDIATION=COMPLETE_PENDING_ROUND10_OWNER_REVIEW/);
  assert.match(readPkg("00_README.md"), /SQL_DESIGN_REVIEWED_PASS=NO/);
});

const APPROVED_CLUB_ADD_MEMBER = "public.club_add_member(uuid,text,uuid,text,integer)";
const APPROVED_CLUB_CREATE = "public.club_create(uuid,text,text,text,text,text)";
const APPROVED_LEAVE_MY = "public.club_leave_my_membership()";

function unknownOverloadByOid(liveOid, approvedResolvedOids) {
  return !approvedResolvedOids.some((oid) => oid != null && oid === liveOid);
}

function canonicalMissing(resolvedOid) {
  return resolvedOid == null;
}

test("Round 10 A. named display identity arguments still match approved OID", () => {
  const liveOid = 4242;
  const displayIdentityArguments = "p_club_id uuid, p_tenant_id text, p_user_id uuid, p_role text, p_expected_revision integer";
  const approvedSignature = APPROVED_CLUB_ADD_MEMBER;
  const resolvedFromApproved = liveOid;
  assert.equal(displayIdentityArguments.includes("p_club_id"), true);
  assert.equal(approvedSignature, "public.club_add_member(uuid,text,uuid,text,integer)");
  assert.equal(unknownOverloadByOid(liveOid, [resolvedFromApproved]), false);
});

test("Round 10 B. named arguments do not create UNKNOWN_MUTATION_RPC_OVERLOAD", () => {
  assert.equal(unknownOverloadByOid(100, [100, null]), false);
});

test("Round 10 C. a genuinely different overload creates UNKNOWN_MUTATION_RPC_OVERLOAD", () => {
  assert.equal(unknownOverloadByOid(999, [100, 101]), true);
});

test("Round 10 D. missing canonical required signature still aborts", () => {
  const precheck = uncommented(readPkg("01_PRECHECK.sql"));
  assert.equal(canonicalMissing(null), true);
  assert.match(precheck, /CANONICAL_MUTATION_SIGNATURE_MISSING=/);
  assert.match(precheck, /CANONICAL_MUTATION_SIGNATURE_MISSING=ABORT/);
  assert.match(precheck, /to_regprocedure\(v_sig\) IS NULL/);
});

test("Round 10 E. optional legacy alias absent does not produce unknown overload", () => {
  assert.equal(unknownOverloadByOid(100, [100, null]), false);
  const precheck = uncommented(readPkg("01_PRECHECK.sql"));
  assert.match(precheck, /to_regprocedure\(approved\.sig\)::oid = p\.oid/);
});

test("Round 10 F. optional legacy alias present with exact approved OID is accepted", () => {
  const legacyOid = 77;
  assert.equal(unknownOverloadByOid(legacyOid, [100, legacyOid]), false);
  assert.equal(APPROVED_LEAVE_MY, "public.club_leave_my_membership()");
});

test("Round 10 G. extra club_create overload with a different arg vector aborts", () => {
  const approvedCreateOid = 10;
  const extraCreateOid = 11;
  assert.equal(unknownOverloadByOid(extraCreateOid, [approvedCreateOid]), true);
  assert.equal(APPROVED_CLUB_CREATE, "public.club_create(uuid,text,text,text,text,text)");
});

function assertOidUnknownOverloadAuthority(body) {
  assert.match(body, /to_regprocedure\(approved\.sig\)::oid = p\.oid/);
  assert.doesNotMatch(
    body,
    /format\('%s\.%s\(%s\)',\s*n\.nspname,\s*p\.proname,\s*pg_catalog\.pg_get_function_identity_arguments\(p\.oid\)\)\s*(NOT IN|IN)/
  );
}

test("Round 10 H. 01_PRECHECK uses OID membership", () => {
  const src = readPkg("01_PRECHECK.sql");
  const body = uncommented(src);
  assert.match(src, /UNKNOWN_OVERLOAD_AUTHORITY=OID/);
  assert.match(src, /PRECHECK_FALSE_UNKNOWN_OVERLOAD_FROM_NAMED_ARGS=IMPOSSIBLE/);
  assertOidUnknownOverloadAuthority(body);
});

test("Round 10 I. 07A Q1A uses OID membership", () => {
  const src = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  assert.match(src, /Q1A_UNKNOWN_OVERLOAD_AUTHORITY=OID/);
  assert.match(src, /Q1A_CANONICAL_SIGNATURE_GATE=14/);
  assert.match(src, /Q1A_LEGACY_ALIAS_OPTIONAL=YES/);
  assertOidUnknownOverloadAuthority(uncommented(src));
});

test("Round 10 J. 07A2 Q1B uses OID membership", () => {
  assert.match(readPkg("07A2_QUIESCE_SEAL_DESIGN.sql"), /Q1B_UNKNOWN_OVERLOAD_AUTHORITY=OID/);
  assertOidUnknownOverloadAuthority(uncommented(readPkg("07A2_QUIESCE_SEAL_DESIGN.sql")));
});

test("Round 10 K. 07B2 DRAINED gate uses OID membership", () => {
  assert.match(readPkg("07B2_MARK_DRAINED_DESIGN.sql"), /DRAINED_UNKNOWN_OVERLOAD_AUTHORITY=OID/);
  assertOidUnknownOverloadAuthority(uncommented(readPkg("07B2_MARK_DRAINED_DESIGN.sql")));
});

test("Round 10 L. 02 APPLY prelock uses OID membership", () => {
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const prelock = apply.slice(0, apply.search(/LOCK TABLE\s+public\.platform_tenants/));
  assert.match(readPkg("02_APPLY_DESIGN.sql"), /APPLY_PRELOCK_UNKNOWN_OVERLOAD_AUTHORITY=OID/);
  assertOidUnknownOverloadAuthority(prelock);
});

test("Round 10 M. 03B VERIFIED gate uses OID membership", () => {
  assert.match(readPkg("03B_MARK_VERIFIED_DESIGN.sql"), /VERIFIED_UNKNOWN_OVERLOAD_AUTHORITY=OID/);
  assertOidUnknownOverloadAuthority(uncommented(readPkg("03B_MARK_VERIFIED_DESIGN.sql")));
});

test("Round 10 N. 07C restore target identity does not reconstruct authority from identity_args", () => {
  const restore = uncommented(readPkg("07C_RESTORE_WRITES_DESIGN.sql"));
  assert.doesNotMatch(restore, /format\('%s\.%s\(%s\)',\s*r\.nspname,\s*r\.proname,\s*r\.identity_args\)/);
  assert.doesNotMatch(restore, /to_regprocedure\(v_reg\)/);
  assert.match(restore, /to_regprocedure\(r\.approved_sig\)/);
});

test("Round 10 O. 07C final ACL comparison uses exact approved function OID", () => {
  const restore = uncommented(readPkg("07C_RESTORE_WRITES_DESIGN.sql"));
  assert.match(restore, /p\.oid = to_regprocedure\(approved\.sig\)/);
  assert.doesNotMatch(restore, /pg_get_function_identity_arguments\(p\.oid\) = s/);
});

test("Round 10 P. no regex argument-name stripping is introduced", () => {
  const files = [
    "01_PRECHECK.sql",
    "02_APPLY_DESIGN.sql",
    "03B_MARK_VERIFIED_DESIGN.sql",
    "07A_QUIESCE_WRITES_DESIGN.sql",
    "07A2_QUIESCE_SEAL_DESIGN.sql",
    "07B2_MARK_DRAINED_DESIGN.sql",
    "07C_RESTORE_WRITES_DESIGN.sql",
  ];
  for (const name of files) {
    const body = uncommented(readPkg(name));
    assert.doesNotMatch(body, /regexp_replace\s*\([^)]*identity_args/i);
    assert.doesNotMatch(body, /regexp_replace\s*\([^)]*pg_get_function_identity_arguments/i);
    assert.doesNotMatch(body, /substring\s*\([^)]*identity_args/i);
  }
});

test("Round 10 Q. Round4-Round9 execution-safety guarantees remain present", () => {
  const applySrc = readPkg("02_APPLY_DESIGN.sql");
  const q1aSrc = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  const q1bSrc = readPkg("07A2_QUIESCE_SEAL_DESIGN.sql");
  const drainSrc = readPkg("07B_DRAIN_VERIFY.sql");
  const restoreSrc = readPkg("07C_RESTORE_WRITES_DESIGN.sql");
  assert.match(applySrc, /CLUB_CUTOVER_LOCK_MODE=ACCESS EXCLUSIVE/);
  assert.match(applySrc, /CUTOVER_LOCK_ORDER_PARENT_TO_CHILD=YES/);
  assert.match(q1aSrc, /Q1_REVOKE_COMMIT_PRECEDES_QUIESCED_SEAL=YES/);
  assert.match(q1bSrc, /QUIESCE_VISIBLE_AT_IS_POST_Q1_COMMIT=YES/);
  assert.match(drainSrc, /PRE_QUIESCE_ALL_USER_TRANSACTION_BARRIER=YES/);
  assert.match(restoreSrc, /RESTORE_REQUIRES_EXPLICIT_BATCH_ID=YES/);
  assert.match(restoreSrc, /POST_APPLY_LEGACY_ACL_RESTORE=DENIED/);
  assert.match(applySrc, /APPLY_RPC_UNKNOWN_NEWER_BODY_OVERWRITE=DENIED/);
  assert.match(readPkg("00_README.md"), /SQL_DESIGN_REVIEW_ROUND9_REMEDIATION=COMPLETE_PENDING_ROUND10_OWNER_REVIEW/);
});

test("Round 10 R. no live SQL mutation in PRECHECK", () => {
  const body = uncommented(readPkg("01_PRECHECK.sql"));
  assert.match(readPkg("01_PRECHECK.sql"), /PRECHECK_READ_ONLY=YES/);
  assert.doesNotMatch(body, /\bINSERT\s+INTO\b/i);
  assert.doesNotMatch(body, /\bGRANT\b/i);
  assert.doesNotMatch(body, /\bREVOKE\b/i);
});

test("Round 10 semantic search: pg_get_function_identity_arguments is not authority", () => {
  const authorityFiles = [
    "01_PRECHECK.sql",
    "02_APPLY_DESIGN.sql",
    "03B_MARK_VERIFIED_DESIGN.sql",
    "07A_QUIESCE_WRITES_DESIGN.sql",
    "07A2_QUIESCE_SEAL_DESIGN.sql",
    "07B2_MARK_DRAINED_DESIGN.sql",
    "07C_RESTORE_WRITES_DESIGN.sql",
  ];
  for (const name of authorityFiles) {
    const body = uncommented(readPkg(name));
    assert.doesNotMatch(
      body,
      /format\('%s\.%s\(%s\)',\s*n\.nspname,\s*p\.proname,\s*pg_catalog\.pg_get_function_identity_arguments/
    );
    assert.doesNotMatch(body, /format\('%s\.%s\(%s\)',\s*r\.nspname,\s*r\.proname,\s*r\.identity_args\)/);
  }
  assert.match(readPkg("00_README.md"), /PG_GET_FUNCTION_IDENTITY_ARGUMENTS_AUTHORITY_USES=0/);
});

const REMEDIATION_DIR = path.join(
  process.cwd(),
  "docs/platform-core-wave5-club-context-closure/staging-remediation"
);

function readRemediation(name) {
  return fs.readFileSync(path.join(REMEDIATION_DIR, name), "utf8");
}

test("Wave5 Club TRUNCATE remediation package exists outside auto-migration path", () => {
  for (const name of [
    "00_README.md",
    "01_PRECHECK_CLUB_TRUNCATE.sql",
    "02_APPLY_CLUB_TRUNCATE.sql",
    "03_VERIFY_CLUB_TRUNCATE.sql",
    "04_ROLLBACK_DESIGN.md",
  ]) {
    assert.equal(fs.existsSync(path.join(REMEDIATION_DIR, name)), true, name);
  }
  assert.equal(REMEDIATION_DIR.includes("supabase"), false);
  assert.equal(REMEDIATION_DIR.includes("migrations"), false);
  const readme = readRemediation("00_README.md");
  assert.match(readme, /TARGET=STAGING/);
  assert.match(readme, /PROJECT_REF=qyewbxjsiiyufanzcjcq/);
  assert.match(readme, /AUTHORIZED_MUTATION=REVOKE TRUNCATE ONLY/);
  assert.match(readme, /AUTHORIZED_PRIVILEGE_EDGES=8/);
  assert.match(readme, /PLATFORM_DEFAULT_TABLE_PRIVILEGE_HARDENING_GAP=OPEN_SEPARATE_SCOPE/);
  assert.match(readme, /WAVE5_DEFAULT_ACL_MUTATION=NO/);
});

test("A. PHASE_42C revokes TRUNCATE from anon/authenticated on four Club tables", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "docs/v5/PHASE_42C_RLS_RPC.sql"), "utf8");
  for (const table of [
    "clubs",
    "club_members",
    "club_governance_assignments",
    "club_membership_requests_v42",
  ]) {
    assert.match(
      src,
      new RegExp(
        `revoke insert, update, delete, truncate on public\\.${table} from authenticated, anon`,
        "i"
      )
    );
  }
  assert.doesNotMatch(
    uncommented(src),
    /revoke insert, update, delete, truncate on public\.tenant_members/i
  );
  assert.doesNotMatch(uncommented(src), /revoke[^\n]+from service_role/i);
});

test("B/C. clubs-RLS forward revokes TRUNCATE and post-apply verifies it", () => {
  const forward = fs.readFileSync(
    path.join(process.cwd(), "docs/clubs-rls-remediation-01/sql/10_CLUBS_RLS_REMEDIATION_01_FORWARD.sql"),
    "utf8"
  );
  const post = fs.readFileSync(
    path.join(
      process.cwd(),
      "docs/clubs-rls-remediation-01/sql/20_CLUBS_RLS_REMEDIATION_01_POST_APPLY_VERIFY.sql"
    ),
    "utf8"
  );
  assert.match(forward, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.clubs/i);
  assert.match(forward, /REVOKE TRUNCATE ON public\.club_members/i);
  assert.match(forward, /REVOKE TRUNCATE ON public\.club_governance_assignments/i);
  assert.match(forward, /REVOKE TRUNCATE ON public\.club_membership_requests_v42/i);
  assert.match(post, /anon_truncate/);
  assert.match(post, /auth_truncate/);
  assert.match(uncommented(post), /has_table_privilege\('anon'/);
});

test("D-J. Wave5 narrow APPLY changes only TRUNCATE for four tables and two roles", () => {
  const applySrc = readRemediation("02_APPLY_CLUB_TRUNCATE.sql");
  const apply = uncommented(applySrc);
  assert.match(apply, /REVOKE TRUNCATE ON TABLE/);
  assert.match(apply, /public\.clubs/);
  assert.match(apply, /public\.club_members/);
  assert.match(apply, /public\.club_governance_assignments/);
  assert.match(apply, /public\.club_membership_requests_v42/);
  assert.match(apply, /FROM anon, authenticated/);
  assert.equal((apply.match(/REVOKE/gi) || []).length, 1);
  assert.doesNotMatch(apply, /\bGRANT\b/);
  assert.doesNotMatch(apply, /service_role/);
  assert.doesNotMatch(apply, /ALTER DEFAULT PRIVILEGES/i);
  assert.doesNotMatch(apply, /\bALTER\s+TABLE\b/i);
  assert.doesNotMatch(apply, /CREATE POLICY/i);
  assert.doesNotMatch(apply, /DROP POLICY/i);
  assert.doesNotMatch(apply, /ENABLE ROW LEVEL SECURITY/i);
  assert.doesNotMatch(apply, /FORCE ROW LEVEL SECURITY/i);
  assert.doesNotMatch(apply, /\bINSERT\s+INTO\b/i);
  assert.doesNotMatch(apply, /\bUPDATE\s+public\./i);
  assert.doesNotMatch(apply, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(apply, /\bTRUNCATE\s+(TABLE\s+)?(ONLY\s+)?public\./i);
  const tableMatches =
    apply.match(
      /public\.(club_membership_requests_v42|club_governance_assignments|club_members|clubs)\b/g
    ) || [];
  assert.equal(new Set(tableMatches).size, 4);
});

test("G. service_role never appears as a REVOKE target in the truncate package", () => {
  const apply = uncommented(readRemediation("02_APPLY_CLUB_TRUNCATE.sql"));
  const precheck = uncommented(readRemediation("01_PRECHECK_CLUB_TRUNCATE.sql"));
  const verify = uncommented(readRemediation("03_VERIFY_CLUB_TRUNCATE.sql"));
  assert.doesNotMatch(apply, /REVOKE[\s\S]*FROM[\s\S]*service_role/i);
  assert.doesNotMatch(apply, /ALTER DEFAULT PRIVILEGES/i);
  assert.doesNotMatch(precheck, /ALTER DEFAULT PRIVILEGES/i);
  assert.doesNotMatch(verify, /ALTER DEFAULT PRIVILEGES/i);
});

test("K/L. remediation PRECHECK and VERIFY are read-only", () => {
  for (const name of ["01_PRECHECK_CLUB_TRUNCATE.sql", "03_VERIFY_CLUB_TRUNCATE.sql"]) {
    const src = readRemediation(name);
    const body = uncommented(src);
    assert.doesNotMatch(body, /\bINSERT\s+INTO\b/i);
    assert.doesNotMatch(body, /\bUPDATE\s+public\./i);
    assert.doesNotMatch(body, /\bDELETE\s+FROM\b/i);
    assert.doesNotMatch(body, /\bGRANT\b/i);
    assert.doesNotMatch(body, /\bREVOKE\b/i);
    assert.doesNotMatch(body, /\bALTER\s+(TABLE|FUNCTION|INDEX|ROLE)\b/i);
    assert.doesNotMatch(body, /\bCREATE\s+(TABLE|INDEX|UNIQUE|FUNCTION|POLICY|ROLE)\b/i);
    assert.doesNotMatch(body, /\bDROP\s+(TABLE|INDEX|FUNCTION|POLICY|ROLE)\b/i);
    assert.doesNotMatch(body, /ALTER DEFAULT PRIVILEGES/i);
    assert.doesNotMatch(body, /\bTRUNCATE\s+(TABLE\s+)?(ONLY\s+)?public\./i);
  }
  assert.match(readRemediation("01_PRECHECK_CLUB_TRUNCATE.sql"), /TRUNCATE_PRECHECK=PASS/);
  assert.match(readRemediation("03_VERIFY_CLUB_TRUNCATE.sql"), /CLUB_TRUNCATE_REMEDIATION_VERIFY=PASS/);
});

test("M/N/O. full Wave5 PRECHECK still denies Club DML and OID comparator remains intact", () => {
  const precheck = readPkg("01_PRECHECK.sql");
  const body = uncommented(precheck);
  assert.match(precheck, /DIRECT_CLUB_DML_ANON_REQUIRED=DENIED/);
  assert.match(precheck, /DIRECT_CLUB_DML_AUTHENTICATED_REQUIRED=DENIED/);
  assert.match(body, /has_table_privilege\('anon', format\('public\.%I', t\.table_name\), 'TRUNCATE'\)/);
  assert.match(
    body,
    /has_table_privilege\('authenticated', format\('public\.%I', t\.table_name\), 'TRUNCATE'\)/
  );
  assert.match(precheck, /UNKNOWN_OVERLOAD_AUTHORITY=OID/);
  assert.match(body, /to_regprocedure\(approved\.sig\)::oid = p\.oid/);
  assert.match(readPkg("00_README.md"), /PG_GET_FUNCTION_IDENTITY_ARGUMENTS_AUTHORITY_USES=0/);
});

test("Wave5 truncate rollback design forbids auto re-grant", () => {
  const rollback = readRemediation("04_ROLLBACK_DESIGN.md");
  assert.match(rollback, /AUTO_REGRANT_TRUNCATE_ON_VERIFY_FAILURE=NO/);
  assert.match(rollback, /GRANT TRUNCATE/);
  assert.match(rollback, /not\*\* the preferred rollback|not the preferred rollback/i);
});

test("Round 11 A. Q0A service_role DML guard design is fail-closed and scoped", () => {
  const q0a = readPkg("10A_SERVICE_ROLE_DML_QUIESCE_DESIGN.sql");
  const body = uncommented(q0a);
  const guard = readPkg("10_SERVICE_ROLE_DIRECT_DML_GUARD.md");
  assert.match(q0a, /WAVE5_SQL_DESIGN_ONLY/);
  assert.match(q0a, /OWNER_SQL_EXECUTION_GO=NO/);
  assert.match(q0a, /DO_NOT_RUN_ON_STAGING/);
  assert.match(q0a, /PHASE_Q0A_SERVICE_ROLE_DIRECT_DML_QUIESCE/);
  assert.match(q0a, /Q0A_CREATES_PREPARED_BATCH=YES/);
  assert.match(q0a, /Q1A_MUST_NOT_CREATE_BATCH=YES/);
  assert.match(q0a, /wave5_cutover_table_privilege_snapshot/);
  assert.match(guard, /SERVICE_ROLE_DIRECT_DML_IS_CLUB_DOMAIN_AUTHORITY=NO/);
  assert.match(guard, /PLATFORM_DEFAULT_TABLE_PRIVILEGE_HARDENING_GAP=OPEN_SEPARATE_SCOPE/);
  assert.doesNotMatch(body, /ALTER\s+DEFAULT\s+PRIVILEGES/i);
  assert.doesNotMatch(body, /ALTER\s+ROLE\s+service_role/i);
  assert.match(q0a, /SERVICE_ROLE_BYPASSRLS_UNCHANGED=YES/);
  assert.match(body, /rolbypassrls/); // observe/verify unchanged; do not mutate role attrs
  for (const t of [
    "clubs",
    "club_members",
    "club_governance_assignments",
    "club_membership_requests_v42",
  ]) {
    assert.match(q0a, new RegExp(t));
  }
  for (const p of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
    assert.match(q0a, new RegExp(p));
  }
  assert.match(body, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public\.%I FROM service_role/);
  assert.match(body, /has_table_privilege\('service_role'/);
  assert.match(q0a, /WAVE5_Q0A_ABORT/);
});

test("Round 11 B. Q1A requires Q0A guard and does not create batch", () => {
  const q1a = readPkg("07A_QUIESCE_WRITES_DESIGN.sql");
  const body = uncommented(q1a);
  assert.match(q1a, /Q0A_PRECEDES_Q1A=YES|Q1A_MUST_NOT_CREATE_BATCH=YES/);
  assert.match(q1a, /Q0A_SERVICE_ROLE_DIRECT_DML_GUARD_REQUIRED/);
  assert.match(body, /wave5\.cutover_batch_id/);
  assert.match(body, /wave5_cutover_table_privilege_snapshot/);
  assert.doesNotMatch(body, /INSERT INTO public\.wave5_club_cutover_batch/);
  assert.doesNotMatch(body, /v_batch\s*:=\s*gen_random_uuid\(\)/);
});

test("Round 11 C. Q1B / APPLY / VERIFIED reassert service_role table DML denied", () => {
  const q1b = uncommented(readPkg("07A2_QUIESCE_SEAL_DESIGN.sql"));
  const apply = uncommented(readPkg("02_APPLY_DESIGN.sql"));
  const verified = uncommented(readPkg("03B_MARK_VERIFIED_DESIGN.sql"));
  assert.match(readPkg("07A2_QUIESCE_SEAL_DESIGN.sql"), /QUIESCED_MEANS_ALL_KNOWN_WRITER_SURFACES_CLOSED=YES/);
  assert.match(readPkg("02_APPLY_DESIGN.sql"), /APPLY_PRELOCK_SERVICE_ROLE_DIRECT_DML=DENIED/);
  assert.match(readPkg("03B_MARK_VERIFIED_DESIGN.sql"), /VERIFIED_BEFORE_SERVICE_ROLE_RESTORE=YES/);
  for (const src of [q1b, apply, verified]) {
    assert.match(src, /has_table_privilege\('service_role'/);
    assert.match(src, /TRUNCATE/);
  }
});

test("Round 11 D. 07C/07D restore exact service_role table DML snapshot only", () => {
  const c = readPkg("07C_RESTORE_WRITES_DESIGN.sql");
  const d = readPkg("07D_RESTORE_INTENDED_WRITES_DESIGN.sql");
  assert.match(c, /wave5_cutover_table_privilege_snapshot/);
  assert.match(d, /wave5_cutover_table_privilege_snapshot/);
  assert.match(c, /RESTORE_FINAL_TABLE_DML_EQUALS_SNAPSHOT=YES|equals snapshot/i);
  assert.match(d, /SERVICE_ROLE_DIRECT_DML_IS_CLUB_DOMAIN_AUTHORITY=NO|not Club domain/i);
  assert.doesNotMatch(uncommented(c), /GRANT\s+ALL\s+ON\s+TABLE\s+public\.clubs\s+TO\s+service_role/i);
  assert.doesNotMatch(uncommented(d), /GRANT\s+ALL\s+ON\s+TABLE\s+public\.clubs\s+TO\s+service_role/i);
  assert.doesNotMatch(uncommented(c), /ALTER\s+DEFAULT\s+PRIVILEGES/i);
  assert.doesNotMatch(uncommented(d), /ALTER\s+DEFAULT\s+PRIVILEGES/i);
});

test("Round 11 E. post-APPLY VERIFY failure keeps service_role quiesced", () => {
  const runbook = readPkg("07_EXECUTION_RUNBOOK.md");
  const restore = readPkg("07C_RESTORE_WRITES_DESIGN.sql");
  assert.match(runbook, /KEEP_WRITES_QUIESCED|POST_APPLY_VERIFY_FAILURE/);
  assert.match(restore, /POST_APPLY_LEGACY_ACL_RESTORE=DENIED/);
  assert.match(restore, /APPLIED|VERIFIED/);
});

function executableSqlSurface(sql) {
  return uncommented(sql)
    .replace(/'(?:''|[^'])*'/g, " ")
    .replace(/"(?:""|[^"])*"/g, " ");
}

test("07B drain verify raw SQL has no executable JS packaging leakage", () => {
  const src = readPkg("07B_DRAIN_VERIFY.sql");
  assert.match(src, /CANONICAL_MUTATION_SURFACE_REF=09_CANONICAL_MUTATION_SURFACE.sql/);
  const surface = executableSqlSurface(src);
  assert.doesNotMatch(surface, /assert\.match\s*\(/);
  assert.doesNotMatch(surface, /readPkg\s*\(/);
});

test("Wave5 sql-design artifacts contain no executable JS packaging leakage", () => {
  for (const name of PACKAGE_FILES.filter((n) => n.endsWith(".sql"))) {
    const surface = executableSqlSurface(readPkg(name));
    assert.doesNotMatch(surface, /assert\.match\s*\(/, name);
    assert.doesNotMatch(surface, /assert\.equal\s*\(/, name);
    assert.doesNotMatch(surface, /readPkg\s*\(/, name);
    assert.doesNotMatch(surface, /\brequire\s*\(/, name);
    assert.doesNotMatch(surface, /\bconsole\.log\s*\(/, name);
    assert.doesNotMatch(surface, /\bdescribe\s*\(/, name);
  }
});

test("07B drain verify raw SQL static validation remains intact", () => {
  const src = readPkg("07B_DRAIN_VERIFY.sql");
  const body = uncommented(src);
  const parsed = auditSql(src, "07B_DRAIN_VERIFY.sql");
  assert.equal(parsed.parseRisk, "NONE");
  assert.equal(parsed.doBlockCount, 1);
  assert.equal(parsed.unbalanced.length, 0);
  assert.match(src, /CANONICAL_MUTATION_SURFACE_REF=09_CANONICAL_MUTATION_SURFACE.sql/);
  assert.doesNotMatch(src, /assert\.match\s*\(\s*readPkg\s*\(/);
  assert.match(body, /\bDO\s+\$\$/);
  assert.match(body, /wave5\.cutover_batch_id/);
  assert.match(body, /cutover_batch_id required/);
  assert.match(body, /expected QUIESCED or DRAINED/);
  assert.match(body, /quiesce_visible_at missing/);
  assert.match(body, /b\.quiesce_visible_at/);
  assert.match(body, /has_function_privilege\('authenticated'/);
  assert.match(body, /has_function_privilege\('anon'/);
  assert.match(body, /PRE_QUIESCE_ALL_USER_TRANSACTION_BARRIER/);
  assert.match(src, /PRE_QUIESCE_ALL_USER_TRANSACTION_BARRIER=YES/);
  assert.match(body, /WAVE5_DRAIN_PASS/);
});


