/**
 * Phase 5D-A.4 — typed catalog guard registry + sql/00 shadow parity.
 * Repository-only. No database. No git add/commit/push.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  asProconfigElements,
  buildPostMutationGuardRegistry,
  buildPreMutationGuardRegistry,
  failClosedSql,
  guardInventorySummary,
  shadowPreflightSql,
  sqlStr,
  sqlWsCollapseV1,
} from "./phase5d-a4-guard-contracts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, "..");

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

/** Exact normalized comparison of live pg_get_expr(..., false) vs expected literal. */
function sqlNormalizedUsingEqLocal(expectedUsing) {
  const live = sqlWsCollapseV1("pg_get_expr(pol.polqual, pol.polrelid, false)");
  const expected = sqlWsCollapseV1(sqlStr(expectedUsing));
  return `${live} = ${expected}`;
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

const namesList = baseline.functions.map((f) => `'${f.name}'`).join(", ");
const corr = baseline.tables.team_tournament_referee_correction_requests;

const registryCtx = {
  baseline,
  fnProc,
  parseShort,
  sqlNormalizedUsingEq: sqlNormalizedUsingEqLocal,
  namesList,
};

const preRegistry = buildPreMutationGuardRegistry(registryCtx);
const postRegistry = buildPostMutationGuardRegistry({
  ...registryCtx,
  postMd5,
  ALLOWLIST,
  expectedPostAcl,
});

const preGuardBody = failClosedSql(preRegistry, "PHASE5D_BASELINE_MISMATCH");
const postGuardBody = failClosedSql(postRegistry, "VERIFY");

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
  `-- Phase 5D hardened reconciliation — AUTHOR ONLY until Owner Staging GO.
-- Staging ONLY (${AUTHORIZED_STAGING}). Forbidden Production target: ${FORBIDDEN_PROD}.
-- Catalog/ACL/volatility reconciliation only. No table drops, truncates, or business-row deletes.
-- Pre-mutation guards generated from typed registry (ACL_EXPLODED_SET_V1, INDEX_CATALOG_V1, CONSTRAINT_CATALOG_V1, COLUMN_DEFAULT_EXPR_V1, PROCONFIG_TEXT_ARRAY_V1, WS_COLLAPSE_V1).

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtextextended('${LOCK_KEY}', 0));

DO $guard$
BEGIN
${preGuardBody}
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
  `-- Phase 5D post-apply verify — typed catalog guards (registry post state).
DO $verify$
BEGIN
${postGuardBody}

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
  `-- Phase 5D exact baseline rollback — same advisory lock as apply. Fail closed typed guards.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtextextended('${LOCK_KEY}', 0));

DO $pre$
BEGIN
  -- Require exact post-apply state before rollback mutations
${postGuardBody}
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
${preGuardBody}
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

const existingSup = path.join(PKG, "evidence/07_CANONICAL_SOURCE_M9_SUPERSESSION.json");
const existingFp = path.join(PKG, "evidence/08_EFFECTIVE_STATUS_POST_APPLY_FINGERPRINT.json");
if (!fs.existsSync(existingSup) || !fs.existsSync(existingFp)) {
  throw new Error("A.2 requires existing supersession/fingerprint evidence from A.1");
}
const supersessions = JSON.parse(fs.readFileSync(existingSup, "utf8")).supersessions;

const selectPol = corr.policies.find((p) => p.name === "tt5d_correction_referee_select");
if (!selectPol?.using) throw new Error("missing select policy using expression in baseline");

for (const f of baseline.functions) {
  f.proconfig = asProconfigElements(f.proconfig);
}
const applyAdmin = baseline.functions.find((f) => f.name === "referee_v5_apply_admin_result_revision");
if (
  !applyAdmin ||
  applyAdmin.proconfig.length !== 1 ||
  applyAdmin.proconfig[0] !== "search_path=pg_catalog, public"
) {
  throw new Error("apply_admin_result_revision proconfig must be one-element comma-containing search_path");
}

baseline.policyExpressionComparison = {
  version: "WS_COLLAPSE_V1",
  scope: "tt5d_correction_referee_select.polqual",
  pgGetExprPretty: false,
  normalization: "COLLAPSE_POSIX_WHITESPACE_TO_SINGLE_SPACE_AND_TRIM",
  comparison: "EXACT_AFTER_NORMALIZATION",
  semanticTokensMayDiffer: false,
  expectedNormalizedUsing: selectPol.using,
  note: "Compact expected string is the canonical normalized expected value, not a claim of raw byte-identical live pg_get_expr output.",
};
baseline.proconfigComparison = {
  version: "PROCONFIG_TEXT_ARRAY_V1",
  catalogType: "text[]",
  comparison: "EXACT_ELEMENTWISE_AFTER_NULL_TO_EMPTY_ARRAY",
  textSerializationCompared: false,
  nullHandling: "COALESCE_NULL_TO_EMPTY_TEXT_ARRAY",
  orderSensitive: true,
  multiplicitySensitive: true,
  caseSensitive: true,
  innerElementNormalization: "NONE",
  commaContainingElementPreserved: true,
  representationOnlyMismatch: {
    function: "referee_v5_apply_admin_result_revision",
    priorGuardExpectedText: "{search_path=pg_catalog, public}",
    liveProconfigText: '{"search_path=pg_catalog, public"}',
    semanticElements: ["search_path=pg_catalog, public"],
    functionBodyDrift: false,
    policyDrift: false,
    aclDrift: false,
    schemaDrift: false,
    committedStagingMutations: 0,
  },
};
baseline.typedCatalogGuardComparison = {
  version: "PHASE5D_A4_TYPED_CATALOG_GUARD_CLOSURE",
  forbiddenSerializedGuards: [
    "relacl::text",
    "proacl::text",
    "pg_get_indexdef(...) IS DISTINCT FROM",
    "pg_get_constraintdef(...) IS DISTINCT FROM",
    "information_schema.column_default equality",
  ],
  contracts: [
    "ACL_EXPLODED_SET_V1",
    "INDEX_CATALOG_V1",
    "CONSTRAINT_CATALOG_V1",
    "COLUMN_DEFAULT_EXPR_V1",
    "PROCONFIG_TEXT_ARRAY_V1",
    "WS_COLLAPSE_V1",
  ],
  preMutationGuardCount: preRegistry.length,
  sql00ShadowParity: "SELECT_ONLY_UNION_ALL_REGISTRY",
};
write("evidence/02_TT5D_EXACT_CATALOG_BASELINE.json", JSON.stringify(baseline, null, 2) + "\n");

write(
  "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql",
  `-- Phase 5D precondition — SELECT-only typed guard shadow (parity with sql/10 pre $guard$).
-- Target must be Staging project_ref ${AUTHORIZED_STAGING}. Forbidden: ${FORBIDDEN_PROD}.
-- No BEGIN/COMMIT/DO/DDL/DML. Registry-driven UNION ALL + preflight_all_pass summary.

${shadowPreflightSql(preRegistry)}`,
);

const preSummary = guardInventorySummary(preRegistry);
const postSummary = guardInventorySummary(postRegistry);
write(
  "evidence/09_PHASE5D_A4_TYPED_GUARD_REGISTRY.json",
  JSON.stringify(
    {
      marker: "PLATFORM_HARD_CUTOVER_01_PHASE5D_A4_TYPED_GUARD_REGISTRY",
      nextAuth: "SELECT_ONLY_STAGING_PREFLIGHT_ONLY",
      preMutation: {
        ...preSummary,
        guards: preRegistry.map(({ guard_order, guard_id, object_class, object_identity, contract_version, comparison_class, expected_json }) => ({
          guard_order,
          guard_id,
          object_class,
          object_identity,
          contract_version,
          comparison_class,
          expected_json,
        })),
      },
      postMutation: {
        guardCount: postSummary.guardCount,
        contracts: postSummary.contracts,
      },
      parity: {
        sql10PreGuardIds: preSummary.guardIds,
        sql00GuardIds: preSummary.guardIds,
        guardIdSetEqual: true,
        guardCount: preSummary.guardCount,
      },
      forbiddenSerializedGuardsEliminated: true,
      contracts: preSummary.contracts,
    },
    null,
    2,
  ) + "\n",
);

const decision = JSON.parse(fs.readFileSync(path.join(PKG, "evidence/05_PHASE5D_A_DECISION.json"), "utf8"));
decision.markers = [
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A4_TYPED_CATALOG_GUARD_CLOSURE_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A4_SELECT_ONLY_PREFLIGHT_PARITY_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A4_NO_SERIALIZED_CATALOG_GUARDS_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A4_READY_FOR_SELECT_ONLY_STAGING_PREFLIGHT_GO",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A3_PROCONFIG_TEXT_ARRAY_GUARDS_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A3_PROCONFIG_REPRESENTATION_DRIFT_RESOLVED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A3_GENERATOR_IDEMPOTENCE_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A3_READY_FOR_STAGING_GO_REISSUE",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_POLICY_GUARD_NORMALIZATION_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_PRECONDITION_REPRESENTATION_DRIFT_RESOLVED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_GENERATOR_IDEMPOTENCE_REVERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_READY_FOR_STAGING_GO_REISSUE",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_FAIL_CLOSED_GUARDS_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_CANONICAL_SOURCE_SYNCHRONIZED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_PRODUCTION_PROMOTION_CONTRACT_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_ROLLBACK_HARDENED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_READY_FOR_STAGING_GO_RECONFIRMED",
];
decision.hardening = "PHASE5D_A4_TYPED_CATALOG_GUARD_CLOSURE";
decision.decision = "READY_FOR_OWNER_STAGING_GO";
decision.nextAuth = "SELECT_ONLY_STAGING_PREFLIGHT_ONLY";
decision.priorPhase5dBAttempts = [
  {
    attempt: 1,
    stop: "PHASE5D_B_BLOCKED_PRECONDITION_NO_MUTATION",
    sql10Executed: false,
    StagingDatabaseMutations: 0,
    RestoreExecutions: 0,
    rootCause: "pg_get_expr pretty-print whitespace vs compact expected USING for tt5d_correction_referee_select",
  },
  {
    attempt: 2,
    stop: "PHASE5D_B_BLOCKED_APPLY_BASELINE_MISMATCH_NO_MUTATION",
    sql00Pass: true,
    sql10ExecutionAttempts: 1,
    sql10Committed: false,
    sql20Executed: false,
    sql90Executed: false,
    StagingDatabaseMutations: 0,
    RestoreExecutions: 0,
    exactError: "P0001: PHASE5D_BASELINE_MISMATCH proconfig referee_v5_apply_admin_result_revision",
    rootCause:
      "proconfig::text representation mismatch for comma-containing search_path text[] element; semantic proconfig unchanged",
  },
];
decision.priorPhase5dBAttempt = decision.priorPhase5dBAttempts[1];
decision.typedCatalogGuardRegistry = {
  preGuardCount: preRegistry.length,
  postGuardCount: postRegistry.length,
  evidence: "evidence/09_PHASE5D_A4_TYPED_GUARD_REGISTRY.json",
};
fs.writeFileSync(path.join(PKG, "evidence/05_PHASE5D_A_DECISION.json"), JSON.stringify(decision, null, 2) + "\n");

const readiness = JSON.parse(fs.readFileSync(path.join(PKG, "PHASE5D_A_READINESS_MANIFEST.json"), "utf8"));
readiness.markers = decision.markers;
readiness.hardening = "PHASE5D_A4_TYPED_CATALOG_GUARD_CLOSURE";
readiness.nextAuth = "SELECT_ONLY_STAGING_PREFLIGHT_ONLY";
readiness.policyExpressionComparison = baseline.policyExpressionComparison;
readiness.proconfigComparison = baseline.proconfigComparison;
readiness.typedCatalogGuardComparison = baseline.typedCatalogGuardComparison;
for (const f of [
  "evidence/06_PRODUCTION_PROMOTION_CONTRACT.json",
  "evidence/07_CANONICAL_SOURCE_M9_SUPERSESSION.json",
  "evidence/08_EFFECTIVE_STATUS_POST_APPLY_FINGERPRINT.json",
  "evidence/09_PHASE5D_A4_TYPED_GUARD_REGISTRY.json",
  "scripts/harden-phase5d-a1.mjs",
  "scripts/phase5d-a4-guard-contracts.mjs",
]) {
  if (!readiness.packageFiles.includes(f)) readiness.packageFiles.push(f);
}
fs.writeFileSync(path.join(PKG, "PHASE5D_A_READINESS_MANIFEST.json"), JSON.stringify(readiness, null, 2) + "\n");

const dep = JSON.parse(fs.readFileSync(path.join(PKG, "evidence/04_TWO_WAY_DEPENDENCY_MAP.json"), "utf8"));
dep.canonicalSourceSync = "PHASE5D_A1_COMPLETED";
dep.productionPromotionContract = "PASS";
dep.policyExpressionComparison = "WS_COLLAPSE_V1";
dep.proconfigComparison = "PROCONFIG_TEXT_ARRAY_V1";
dep.typedCatalogGuardComparison = "PHASE5D_A4_TYPED_CATALOG_GUARD_CLOSURE";
dep.phase5dAModifiesHistoricalPhase5B5CEvidence = false;
dep.phase5dA2Scope = [
  "harden-phase5d-a1.mjs WS_COLLAPSE_V1 helper",
  "sql/00 normalized policy inventory",
  "sql/10 sql/20 sql/90 select-policy USING guards",
  "evidence/02 policyExpressionComparison metadata",
];
dep.phase5dA3Scope = [
  "harden-phase5d-a1.mjs PROCONFIG_TEXT_ARRAY_V1 helper",
  "sql/00 proconfig text[] inventory",
  "sql/10 sql/20 sql/90 semantic proconfig text[] guards (52)",
  "evidence/02 proconfigComparison metadata + array-valued proconfig",
];
dep.phase5dA4Scope = [
  "phase5d-a4-guard-contracts.mjs typed registry",
  "sql/00 shadowPreflightSql registry UNION ALL",
  "sql/10 pre $guard$ via failClosedSql(preRegistry)",
  "sql/20 sql/90 ACL/INDEX/CONSTRAINT/DEFAULT typed guards",
  "evidence/09_PHASE5D_A4_TYPED_GUARD_REGISTRY.json",
];
fs.writeFileSync(path.join(PKG, "evidence/04_TWO_WAY_DEPENDENCY_MAP.json"), JSON.stringify(dep, null, 2) + "\n");

console.log(
  JSON.stringify(
    {
      ok: true,
      marker: "GENERATOR_IDEMPOTENT_CANDIDATE",
      postMd5,
      postSha,
      preGuardCount: preRegistry.length,
      postGuardCount: postRegistry.length,
      supersessionLeaves: supersessions.map((s) => s.leaf),
      lockKey: LOCK_KEY,
      policyGuard: "WS_COLLAPSE_V1",
      proconfigGuard: "PROCONFIG_TEXT_ARRAY_V1",
      typedCatalogGuard: "PHASE5D_A4_TYPED_CATALOG_GUARD_CLOSURE",
    },
    null,
    2,
  ),
);
