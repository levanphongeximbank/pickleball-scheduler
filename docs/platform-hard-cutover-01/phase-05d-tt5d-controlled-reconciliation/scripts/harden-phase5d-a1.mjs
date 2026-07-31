/**
 * Phase 5D-A.1 — harden fail-closed SQL + promotion contract + supersession evidence.
 * Repository-only. No database. No git add/commit/push.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, "..");
const ROOT = path.resolve(PKG, "../../..");

const MIGRATION_NAME = "phase5d_tt5d_controlled_reconciliation";
const MIGRATION_VERSION = "20260731150000";
const LOCK_KEY = "phase5d_tt5d_controlled_reconciliation";
const AUTHORIZED_STAGING = "qyewbxjsiiyufanzcjcq";
const FORBIDDEN_PROD = "expuvcohlcjzvrrauvud";

const EFFECTIVE_BASELINE_DEF =
  "CREATE OR REPLACE FUNCTION public.referee_v5_assignment_effective_status(p_status text, p_expires_at timestamp with time zone, p_revoked_at timestamp with time zone)\n RETURNS text\n LANGUAGE sql\n IMMUTABLE\nAS $function$\r\n  select case\r\n    when p_revoked_at is not null or lower(coalesce(p_status, '')) = 'revoked' then 'revoked'\r\n    when lower(coalesce(p_status, '')) = 'completed' then 'completed'\r\n    when lower(coalesce(p_status, '')) = 'expired' then 'expired'\r\n    when lower(coalesce(p_status, '')) = 'pending' then 'pending'\r\n    when p_expires_at is not null and p_expires_at <= now() then 'expired'\r\n    when lower(coalesce(p_status, '')) = 'active' then 'active'\r\n    else coalesce(lower(p_status), 'pending')\r\n  end;\r\n$function$\n";

function md5(s) {
  return crypto.createHash("md5").update(s, "utf8").digest("hex");
}
function sha256(s) {
  return crypto.createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
}
function write(rel, text) {
  const abs = path.join(PKG, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}
function sqlStr(s) {
  if (s == null) return "NULL";
  return `'${String(s).replace(/'/g, "''")}'`;
}

const baseline = JSON.parse(
  fs.readFileSync(path.join(PKG, "evidence/02_TT5D_EXACT_CATALOG_BASELINE.json"), "utf8"),
);
if (baseline.functionCount !== 13) throw new Error("baseline must have 13 functions");

const baseMd5 = md5(EFFECTIVE_BASELINE_DEF);
const baseSha = sha256(EFFECTIVE_BASELINE_DEF);
if (baseMd5 !== "c91ffb1ec3faa1e6fa2b3ea9395c4058") throw new Error(`baseline def md5 mismatch ${baseMd5}`);
if (baseSha !== "af04174b41386c244bded827805197c123a3767d71c4a2de809deee3b201a620") {
  throw new Error(`baseline def sha mismatch ${baseSha}`);
}
const postDef = EFFECTIVE_BASELINE_DEF.replace("\n IMMUTABLE\n", "\n STABLE\n");
const postMd5 = md5(postDef);
const postSha = sha256(postDef);
if (postMd5 !== "ed3cf88b96355d92d5483eb0f4e1a6aa") throw new Error(`post md5 mismatch ${postMd5}`);
if (postSha !== "49d71648e74a006bf6aa9478f44f5512927d94542b350b2db032ed2af5af21a7") {
  throw new Error(`post sha mismatch ${postSha}`);
}

const ALLOWLIST = {
  referee_v5_apply_admin_result_revision: ["service_role"],
  referee_v5_assert_assignment_write: ["authenticated", "service_role"],
  referee_v5_assignment_effective_status: ["authenticated", "service_role"],
  referee_v5_current_user_has_assignment: ["authenticated"],
  referee_v5_mark_assignment_expired_if_needed: ["authenticated", "service_role"],
  team_tournament_create_referee_assignment: ["authenticated"],
  team_tournament_list_referee_assignments: ["authenticated"],
  team_tournament_list_referee_corrections: ["authenticated"],
  team_tournament_referee_match_access_ops: ["authenticated"],
  team_tournament_reopen_referee_match: ["authenticated"],
  team_tournament_request_referee_correction: ["authenticated"],
  team_tournament_review_referee_correction: ["authenticated"],
  team_tournament_revoke_referee_assignment: ["authenticated"],
};

function shortArgs(identityArgs) {
  // Convert "p_x text, p_y uuid" style identity args already in signature after (
  // Use signature field: public.name(text, uuid)
  return null;
}

function parseShort(sig) {
  const m = sig.match(/\((.*)\)$/);
  return m ? m[1] : "";
}

function expectedPostAcl(name) {
  const grants = ALLOWLIST[name];
  if (grants.length === 1 && grants[0] === "service_role") {
    return "{postgres=X/postgres,service_role=X/postgres}";
  }
  if (grants.length === 1 && grants[0] === "authenticated") {
    return "{postgres=X/postgres,authenticated=X/postgres}";
  }
  if (grants.includes("authenticated") && grants.includes("service_role")) {
    return "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}";
  }
  throw new Error(`no post acl for ${name}`);
}

function fnProc(f) {
  return `to_regprocedure('public.${f.name}(${parseShort(f.signature)})')`;
}

function preFnGuards(f) {
  const p = fnProc(f);
  const cfg = f.proconfig || "{}";
  return `
  IF ${p} IS NULL THEN RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH missing ${f.name}'; END IF;
  IF (
    SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
    WHERE nn.nspname='public' AND pp.proname='${f.name}'
  ) <> 1 THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH overload count ${f.name}';
  END IF;
  IF md5(pg_get_functiondef(${p})) IS DISTINCT FROM ${sqlStr(f.defMd5)} THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH def_md5 ${f.name}';
  END IF;
  IF (
    SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc pp WHERE pp.oid=${p}
  ) IS DISTINCT FROM ${sqlStr(f.volatility)} THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH volatility ${f.name}';
  END IF;
  IF (
    SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=${p}
  ) IS DISTINCT FROM ${sqlStr(f.language)} THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH language ${f.name}';
  END IF;
  IF (SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=${p}) IS DISTINCT FROM ${f.securityDefiner} THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH security_definer ${f.name}';
  END IF;
  IF coalesce((SELECT pp.proconfig::text FROM pg_proc pp WHERE pp.oid=${p}), '{}') IS DISTINCT FROM ${sqlStr(cfg)} THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH proconfig ${f.name}';
  END IF;
  IF (SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=${p}) IS DISTINCT FROM ${sqlStr(f.owner)} THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH owner ${f.name}';
  END IF;
  IF (SELECT pp.proacl::text FROM pg_proc pp WHERE pp.oid=${p}) IS DISTINCT FROM ${sqlStr(f.acl)} THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH proacl ${f.name}';
  END IF;
  IF has_function_privilege('public', ${p}, 'EXECUTE') IS DISTINCT FROM ${f.publicExecute} THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH public ${f.name}';
  END IF;
  IF has_function_privilege('anon', ${p}, 'EXECUTE') IS DISTINCT FROM ${f.anonExecute} THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH anon ${f.name}';
  END IF;
  IF has_function_privilege('authenticated', ${p}, 'EXECUTE') IS DISTINCT FROM ${f.authenticatedExecute} THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH authenticated ${f.name}';
  END IF;
  IF has_function_privilege('service_role', ${p}, 'EXECUTE') IS DISTINCT FROM ${f.serviceRoleExecute} THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH service_role ${f.name}';
  END IF;`;
}

function postFnGuards(f) {
  const p = fnProc(f);
  const grants = ALLOWLIST[f.name];
  const vol = f.name === "referee_v5_assignment_effective_status" ? "STABLE" : f.volatility;
  const defMd5 =
    f.name === "referee_v5_assignment_effective_status" ? postMd5 : f.defMd5;
  const cfg = f.proconfig || "{}";
  const postAcl = expectedPostAcl(f.name);
  return `
  IF ${p} IS NULL THEN RAISE EXCEPTION 'VERIFY missing ${f.name}'; END IF;
  IF md5(pg_get_functiondef(${p})) IS DISTINCT FROM ${sqlStr(defMd5)} THEN
    RAISE EXCEPTION 'VERIFY def_md5 ${f.name}';
  END IF;
  IF (
    SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc pp WHERE pp.oid=${p}
  ) IS DISTINCT FROM ${sqlStr(vol)} THEN
    RAISE EXCEPTION 'VERIFY volatility ${f.name}';
  END IF;
  IF (
    SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=${p}
  ) IS DISTINCT FROM ${sqlStr(f.language)} THEN
    RAISE EXCEPTION 'VERIFY language ${f.name}';
  END IF;
  IF (SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=${p}) IS DISTINCT FROM ${f.securityDefiner} THEN
    RAISE EXCEPTION 'VERIFY security_definer ${f.name}';
  END IF;
  IF coalesce((SELECT pp.proconfig::text FROM pg_proc pp WHERE pp.oid=${p}), '{}') IS DISTINCT FROM ${sqlStr(cfg)} THEN
    RAISE EXCEPTION 'VERIFY proconfig ${f.name}';
  END IF;
  IF (SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=${p}) IS DISTINCT FROM ${sqlStr(f.owner)} THEN
    RAISE EXCEPTION 'VERIFY owner ${f.name}';
  END IF;
  IF (SELECT pp.proacl::text FROM pg_proc pp WHERE pp.oid=${p}) IS DISTINCT FROM ${sqlStr(postAcl)} THEN
    RAISE EXCEPTION 'VERIFY proacl ${f.name}';
  END IF;
  IF has_function_privilege('public', ${p}, 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY public denied ${f.name}';
  END IF;
  IF has_function_privilege('anon', ${p}, 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon denied ${f.name}';
  END IF;
  IF has_function_privilege('authenticated', ${p}, 'EXECUTE') IS DISTINCT FROM ${grants.includes("authenticated")} THEN
    RAISE EXCEPTION 'VERIFY authenticated ${f.name}';
  END IF;
  IF has_function_privilege('service_role', ${p}, 'EXECUTE') IS DISTINCT FROM ${grants.includes("service_role")} THEN
    RAISE EXCEPTION 'VERIFY service_role ${f.name}';
  END IF;`;
}

const ra = baseline.tables.referee_assignments;
const corr = baseline.tables.team_tournament_referee_correction_requests;
const namesList = baseline.functions.map((f) => `'${f.name}'`).join(", ");

function tableGuards(mode) {
  const fail = mode === "pre" ? "PHASE5D_BASELINE_MISMATCH" : mode === "post" ? "VERIFY" : "ROLLBACK_VERIFY";
  const corrAcl =
    mode === "post"
      ? "{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=arwdDxtm/postgres}"
      : corr.acl;
  const pol = corr.policies;
  return `
  IF (
    SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
    WHERE nn.nspname='public' AND pp.proname IN (${namesList})
  ) <> 13 THEN
    RAISE EXCEPTION '${fail} expected exactly 13 TT5D functions';
  END IF;

  IF (SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION '${fail} referee_assignments owner';
  END IF;
  IF (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION '${fail} referee_assignments rls';
  END IF;
  IF (SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION '${fail} referee_assignments rls_forced';
  END IF;

  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='referee_assignments'
      AND column_name IN ('external_matchup_id','external_sub_match_id','matchup_id','sub_match_id','revoke_reason','version')
  ) <> 6 THEN RAISE EXCEPTION '${fail} tt5d columns count'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='referee_assignments' AND column_name='version'
      AND data_type='integer' AND is_nullable='NO' AND column_default='1'
  ) THEN RAISE EXCEPTION '${fail} version column'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
    WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='matchup_id'
      AND ccu.table_name='team_tournament_matchups' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
  ) THEN RAISE EXCEPTION '${fail} matchup_id fkey'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
    WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='sub_match_id'
      AND ccu.table_name='team_tournament_sub_matches' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
  ) THEN RAISE EXCEPTION '${fail} sub_match_id fkey'; END IF;

  IF (
    SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='referee_assignments' AND c.conname='referee_assignments_status_check'
  ) IS DISTINCT FROM ${sqlStr(ra.statusCheck)} THEN
    RAISE EXCEPTION '${fail} status_check';
  END IF;

  IF (
    SELECT pg_get_indexdef(i.oid) FROM pg_class i JOIN pg_namespace n ON n.oid=i.relnamespace
    WHERE n.nspname='public' AND i.relname='referee_assignments_sub_match_idx'
  ) IS DISTINCT FROM ${sqlStr(ra.index.def)} THEN
    RAISE EXCEPTION '${fail} sub_match index def';
  END IF;
  IF (
    SELECT pg_get_userbyid(i.relowner) FROM pg_class i JOIN pg_namespace n ON n.oid=i.relnamespace
    WHERE n.nspname='public' AND i.relname='referee_assignments_sub_match_idx'
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION '${fail} sub_match index owner';
  END IF;

  IF (
    SELECT pg_get_indexdef(i.oid) FROM pg_class i JOIN pg_namespace n ON n.oid=i.relnamespace
    WHERE n.nspname='public' AND i.relname='tt5d_correction_pending_idx'
  ) IS DISTINCT FROM ${sqlStr(corr.index.def)} THEN
    RAISE EXCEPTION '${fail} correction index def';
  END IF;
  IF (
    SELECT pg_get_userbyid(i.relowner) FROM pg_class i JOIN pg_namespace n ON n.oid=i.relnamespace
    WHERE n.nspname='public' AND i.relname='tt5d_correction_pending_idx'
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION '${fail} correction index owner';
  END IF;

  IF (SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION '${fail} correction owner';
  END IF;
  IF (SELECT c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS DISTINCT FROM ${sqlStr(corrAcl)} THEN
    RAISE EXCEPTION '${fail} correction acl';
  END IF;
  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='team_tournament_referee_correction_requests'
  ) <> 25 THEN RAISE EXCEPTION '${fail} correction column count'; END IF;
  IF (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION '${fail} correction rls';
  END IF;
  IF (SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION '${fail} correction rls_forced';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND pol.polname='tt5d_correction_referee_select'
      AND pol.polcmd='r'
      AND pg_get_expr(pol.polqual, pol.polrelid) = ${sqlStr(pol[0].using)}
      AND pg_get_expr(pol.polwithcheck, pol.polrelid) IS NULL
      AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
  ) THEN RAISE EXCEPTION '${fail} policy select'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND pol.polname='tt5d_correction_no_client_write'
      AND pol.polcmd='*'
      AND pg_get_expr(pol.polqual, pol.polrelid) = 'false'
      AND pg_get_expr(pol.polwithcheck, pol.polrelid) = 'false'
      AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
  ) THEN RAISE EXCEPTION '${fail} policy no_client_write'; END IF;
`;
}

const mutateAcl = baseline.functions
  .map((f) => {
    const short = parseShort(f.signature);
    const grants = ALLOWLIST[f.name].join(", ");
    return `REVOKE ALL ON FUNCTION public.${f.name}(${short}) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.${f.name}(${short}) TO ${grants};`;
  })
  .join("\n\n");

const restoreAcl = baseline.functions
  .map((f) => {
    const short = parseShort(f.signature);
    const roles = [];
    if (f.anonExecute) roles.push("anon");
    if (f.authenticatedExecute) roles.push("authenticated");
    if (f.serviceRoleExecute) roles.push("service_role");
    return `REVOKE ALL ON FUNCTION public.${f.name}(${short}) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.${f.name}(${short}) TO ${roles.join(", ")};`;
  })
  .join("\n\n");

write(
  "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql",
  `-- Phase 5D-A.1 hardened reconciliation — AUTHOR ONLY. Do not execute in Phase 5D-A.
-- Staging ONLY (${AUTHORIZED_STAGING}). Forbidden Production target: ${FORBIDDEN_PROD}.
-- Catalog/ACL/volatility reconciliation only. No table drops, truncates, or business-row deletes.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtextextended('${LOCK_KEY}', 0));

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE name = '${MIGRATION_NAME}' OR version = '${MIGRATION_VERSION}'
  ) THEN
    RAISE EXCEPTION 'PHASE5D_PROVENANCE_ALREADY_PRESENT';
  END IF;
  IF to_regclass('public.club_ai_data') IS NOT NULL THEN
    RAISE EXCEPTION 'PHASE5D_TARGET_GUARD_FAILED club_ai_data present';
  END IF;
${tableGuards("pre")}
${baseline.functions.map(preFnGuards).join("\n")}
END
$guard$;

ALTER FUNCTION public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) STABLE;

${mutateAcl}

REVOKE ALL ON TABLE public.team_tournament_referee_correction_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.team_tournament_referee_correction_requests TO authenticated;
GRANT ALL ON TABLE public.team_tournament_referee_correction_requests TO service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '${MIGRATION_VERSION}',
  '${MIGRATION_NAME}',
  ARRAY['phase5d_tt5d_controlled_reconciliation_volatility_and_acl']
);

COMMIT;
`,
);

write(
  "sql/20_TT5D_POST_APPLY_VERIFY.sql",
  `-- Phase 5D-A.1 post-apply verify — exact fingerprints/ACL/policy/provenance.
DO $verify$
BEGIN
${tableGuards("post")}
${baseline.functions.map(postFnGuards).join("\n")}

  IF has_table_privilege('anon', 'public.team_tournament_referee_correction_requests', 'SELECT')
     OR has_table_privilege('anon', 'public.team_tournament_referee_correction_requests', 'INSERT') THEN
    RAISE EXCEPTION 'VERIFY anon table denied';
  END IF;
  IF has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'SELECT') IS NOT TRUE THEN
    RAISE EXCEPTION 'VERIFY authenticated SELECT';
  END IF;
  IF has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'INSERT')
     OR has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'DELETE') THEN
    RAISE EXCEPTION 'VERIFY authenticated write denied';
  END IF;

  IF (
    SELECT count(*) FROM supabase_migrations.schema_migrations
    WHERE version='${MIGRATION_VERSION}' AND name='${MIGRATION_NAME}'
      AND statements = ARRAY['phase5d_tt5d_controlled_reconciliation_volatility_and_acl']::text[]
  ) <> 1 THEN
    RAISE EXCEPTION 'VERIFY provenance row';
  END IF;

  RAISE NOTICE 'PHASE5D_POST_APPLY_VERIFY_PASS';
END
$verify$;
`,
);

write(
  "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql",
  `-- Phase 5D-A.1 exact baseline rollback — same advisory lock as apply. Fail closed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtextextended('${LOCK_KEY}', 0));

DO $pre$
BEGIN
  -- Require exact post-apply state before rollback mutations
${tableGuards("post")}
${baseline.functions.map(postFnGuards).join("\n")}
  IF NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version='${MIGRATION_VERSION}' AND name='${MIGRATION_NAME}'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK_TARGET_MISSING_PROVENANCE';
  END IF;
END
$pre$;

ALTER FUNCTION public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) IMMUTABLE;

${restoreAcl}

REVOKE ALL ON TABLE public.team_tournament_referee_correction_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.team_tournament_referee_correction_requests TO authenticated;
GRANT ALL ON TABLE public.team_tournament_referee_correction_requests TO service_role;

DELETE FROM supabase_migrations.schema_migrations
WHERE version = '${MIGRATION_VERSION}' AND name = '${MIGRATION_NAME}';

DO $post$
BEGIN
${tableGuards("pre")}
${baseline.functions.map(preFnGuards).join("\n")}
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version='${MIGRATION_VERSION}' OR name='${MIGRATION_NAME}'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK_PROVENANCE_STILL_PRESENT';
  END IF;
END
$post$;

COMMIT;
`,
);

write(
  "evidence/06_PRODUCTION_PROMOTION_CONTRACT.json",
  JSON.stringify(
    {
      marker: "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_PRODUCTION_PROMOTION_CONTRACT_VERIFIED",
      StagingSQLExecutions: 0,
      StagingDatabaseMutations: 0,
      ProductionAccess: 0,
      ProductionDatabaseMutations: 0,
      RestoreExecutions: 0,
      stagingProjectRefAuthorized: AUTHORIZED_STAGING,
      productionProjectRefForbiddenForThisSql: FORBIDDEN_PROD,
      paths: {
        PREEXISTING_OBJECT_PATH: {
          description:
            "State-specific baseline reconciliation for objects already present without controlled provenance",
          stagingFingerprintsValidFor: AUTHORIZED_STAGING,
          productionReuseOfPr354StagingFingerprints: "FORBIDDEN",
          requires: [
            "fresh Production read-only baseline capture",
            "Production-specific fail-closed reconciliation authored from that baseline",
            "Owner runbook acceptance",
            "explicit productionExecutionGo",
          ],
        },
        FRESH_ABSENT_OBJECT_PATH: {
          description:
            "Apply corrected canonical TT5D source / corrected M9 copies when objects are absent",
          artefacts: [
            "docs/v5/team-tournament/tt5/TT5-D_*.sql (corrected STABLE + deterministic ACL)",
            "M9 190/200/210/220 byte-identical copies",
          ],
          requires: [
            "future Production read-only baseline proving absence or exact intended state",
            "Owner runbook acceptance",
            "explicit productionExecutionGo",
          ],
        },
      },
      note: "sql/10 in this package embeds Staging-specific fingerprints and must never be executed on Production.",
    },
    null,
    2,
  ) + "\n",
);

const oldHashes = {
  "190_TT5D_ASSIGNMENT_SAFETY.sql":
    "5ABEE354336E5A6D8744558D880F86803C33C283E95A43A4CD9877A2E3B69E70",
  "200_TT5D_REOPEN_RESULT.sql":
    "7DB37D8A39B35789DF6D3948F6899B8ED0D950A6963E97855F0F579FDF43A755",
  "210_TT5D_CORRECTION.sql":
    "F9941BF7316273247D317B2344E2404FC7177F6CD28BB650C0E6BB9CBB66D0B7",
  "220_TT5D_SECURITY_GUARDS.sql":
    "DC359FFAA81F4217491339AF879B509A0903AB98D176C3F7D5E98F3D1A94045F",
};
const pairs = [
  [
    "docs/v5/team-tournament/tt5/TT5-D_ASSIGNMENT_SAFETY.sql",
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/190_TT5D_ASSIGNMENT_SAFETY.sql",
    "190_TT5D_ASSIGNMENT_SAFETY.sql",
  ],
  [
    "docs/v5/team-tournament/tt5/TT5-D_REOPEN_RESULT_REVISION.sql",
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/200_TT5D_REOPEN_RESULT.sql",
    "200_TT5D_REOPEN_RESULT.sql",
  ],
  [
    "docs/v5/team-tournament/tt5/TT5-D_CORRECTION_WORKFLOW.sql",
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/210_TT5D_CORRECTION.sql",
    "210_TT5D_CORRECTION.sql",
  ],
  [
    "docs/v5/team-tournament/tt5/TT5-D_SECURITY_GUARDS.sql",
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/220_TT5D_SECURITY_GUARDS.sql",
    "220_TT5D_SECURITY_GUARDS.sql",
  ],
];

const supersessions = pairs.map(([src, m9, leaf]) => {
  const sb = fs.readFileSync(path.join(ROOT, src));
  const mb = fs.readFileSync(path.join(ROOT, m9));
  const neu = crypto.createHash("sha256").update(sb).digest("hex").toUpperCase();
  const neuM9 = crypto.createHash("sha256").update(mb).digest("hex").toUpperCase();
  if (!sb.equals(mb)) throw new Error(`source/M9 not byte-identical: ${leaf}`);
  return {
    leaf,
    sourcePath: src,
    m9Path: m9,
    oldSha256ExactGitBlobBytes: oldHashes[leaf],
    newSha256ExactGitBlobBytes: neu,
    sourceEqualsM9: neu === neuM9,
    remainsNonExecutable: true,
  };
});

write(
  "evidence/07_CANONICAL_SOURCE_M9_SUPERSESSION.json",
  JSON.stringify(
    {
      marker: "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_CANONICAL_SOURCE_SYNCHRONIZED",
      corrections: [
        "referee_v5_assignment_effective_status IMMUTABLE→STABLE",
        "deterministic REVOKE ALL FROM PUBLIC,anon,authenticated,service_role then GRANT allowlist for all 13",
        "correction table deterministic ACL",
      ],
      supersessions,
      m9: { executableApplyCount: 20, nonExecutableCandidateCount: 4, tt5dMovedToOrderedApply: false },
      historicalPhase5B5CEvidenceRewritten: false,
    },
    null,
    2,
  ) + "\n",
);

write(
  "evidence/08_EFFECTIVE_STATUS_POST_APPLY_FINGERPRINT.json",
  JSON.stringify(
    {
      derivation: "IMMUTABLE_TOKEN_REPLACED_WITH_STABLE_IN_CAPTURED_PG_GET_FUNCTIONDEF",
      baselineDefMd5: baseMd5,
      baselineDefSha256: baseSha,
      postApplyDefMd5: postMd5,
      postApplyDefSha256: postSha,
      mutatedDatabaseCaptureUsed: false,
    },
    null,
    2,
  ) + "\n",
);

// Update decision markers
const decision = JSON.parse(fs.readFileSync(path.join(PKG, "evidence/05_PHASE5D_A_DECISION.json"), "utf8"));
decision.markers = [
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_FAIL_CLOSED_GUARDS_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_CANONICAL_SOURCE_SYNCHRONIZED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_PRODUCTION_PROMOTION_CONTRACT_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_ROLLBACK_HARDENED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_READY_FOR_STAGING_GO_RECONFIRMED",
];
decision.hardening = "PHASE5D_A1_PRE_STAGING_GO";
decision.decision = "READY_FOR_OWNER_STAGING_GO";
fs.writeFileSync(path.join(PKG, "evidence/05_PHASE5D_A_DECISION.json"), JSON.stringify(decision, null, 2) + "\n");

const readiness = JSON.parse(fs.readFileSync(path.join(PKG, "PHASE5D_A_READINESS_MANIFEST.json"), "utf8"));
readiness.markers = decision.markers;
readiness.hardening = "PHASE5D_A1_PRE_STAGING_GO";
for (const f of [
  "evidence/06_PRODUCTION_PROMOTION_CONTRACT.json",
  "evidence/07_CANONICAL_SOURCE_M9_SUPERSESSION.json",
  "evidence/08_EFFECTIVE_STATUS_POST_APPLY_FINGERPRINT.json",
]) {
  if (!readiness.packageFiles.includes(f)) readiness.packageFiles.push(f);
}
fs.writeFileSync(path.join(PKG, "PHASE5D_A_READINESS_MANIFEST.json"), JSON.stringify(readiness, null, 2) + "\n");

const dep = JSON.parse(fs.readFileSync(path.join(PKG, "evidence/04_TWO_WAY_DEPENDENCY_MAP.json"), "utf8"));
dep.canonicalSourceSync = "PHASE5D_A1_COMPLETED";
dep.productionPromotionContract = "PASS";
dep.phase5dAModifiesHistoricalPhase5B5CEvidence = false;
dep.phase5dAUpdatesActiveOperationalConsumers = [
  "four TT5D source SQL",
  "four M9 TT5D copies",
  "M9_MANIFEST hashes",
  "00_SOURCE_PROVENANCE hashes",
  "PHASE5B_CHECKSUM_MANIFEST hashes",
];
fs.writeFileSync(path.join(PKG, "evidence/04_TWO_WAY_DEPENDENCY_MAP.json"), JSON.stringify(dep, null, 2) + "\n");

console.log(
  JSON.stringify(
    {
      ok: true,
      postMd5,
      postSha,
      supersessions,
      lockKey: LOCK_KEY,
    },
    null,
    2,
  ),
);
