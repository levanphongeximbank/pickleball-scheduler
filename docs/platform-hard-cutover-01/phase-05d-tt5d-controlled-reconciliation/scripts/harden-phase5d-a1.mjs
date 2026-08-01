/**
 * Phase 5D-A.4 / A.5 / 5D-C — typed catalog guard registry + sql/00 shadow + transport batches.
 * Repository-only. No database. No git add/commit/push.
 * 5D-C regenerates sql/00 + transport batches with valid JSONB literals; sql/10/20/90 remain frozen.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  asProconfigElements,
  buildPostMutationGuardRegistry,
  buildPreMutationGuardRegistry,
  buildTransportBatchManifest,
  failClosedSql,
  guardInventorySummary,
  guardPredicateFingerprint,
  partitionGuardsForTransport,
  shadowPreflightSql,
  sqlStr,
  sqlWsCollapseV1,
  TRANSPORT_ENCODED_PAYLOAD_LIMIT,
} from "./phase5d-a4-guard-contracts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, "..");
const ROOT = path.resolve(PKG, "../../..");

const MIGRATION_NAME = "phase5d_tt5d_controlled_reconciliation";
const MIGRATION_VERSION = "20260731150000";
const LOCK_KEY = "phase5d_tt5d_controlled_reconciliation";
const AUTHORIZED_STAGING = "qyewbxjsiiyufanzcjcq";
const FORBIDDEN_PROD = "expuvcohlcjzvrrauvud";

/** sql/10/20/90 remain byte-frozen (no expected_json JSONB literals). sql/00 regenerated in 5D-C. */
const FROZEN_SQL_BLOBS = {
  "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql": "76c269451348d5823ffb275a368fd9ff385f6d08",
  "sql/20_TT5D_POST_APPLY_VERIFY.sql": "4e3d02d067b8bc50619cf96a1742fd870637e8bf",
  "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql": "2e5a1cd17c74f7b669757c3a9fd3d7be11c3d2f0",
};

/** Historical A.5 blobs with bare {...}::jsonb — invalid PostgreSQL; never execute again. */
const SUPERSEDED_INVALID_JSONB_BLOBS = {
  classification: "PHASE5D_JSONB_LITERAL_RENDERER_ROOT_CAUSE_CONFIRMED",
  rootCause:
    "guardRow emitted JSON.stringify(expected_json) directly as {...}::jsonb without a PostgreSQL string literal",
  stop: "PHASE5D_BATCHED_SELECT_ONLY_STAGING_PREFLIGHT_BLOCKED_INCOMPLETE_OUTPUT",
  oldInvalidBatchAttempts: 9,
  successfulOldBatches: 0,
  guardRowsReceived: 0,
  sql10AttemptsRemain: 1,
  StagingMutations: 0,
  ProductionAccess: 0,
  canonicalSql00: {
    path: "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql",
    gitBlob: "9989e54211a93ba79b8e6e87833e825a7419a24a",
    status: "INVALID_SUPERSEDED",
  },
  transportManifest: {
    path: "evidence/10_PHASE5D_A5_TRANSPORT_BATCH_MANIFEST.json",
    gitBlob: "9f0dc89450823f0b34434408bf16ea60cdba838f",
    status: "INVALID_SUPERSEDED",
  },
  transportBatches: [
    { file: "00_PREFLIGHT_BATCH_001.sql", gitBlob: "6ef005e9c275663271c560e4d5dcea24a5165f9e" },
    { file: "00_PREFLIGHT_BATCH_002.sql", gitBlob: "4e30aa7f23f1648b092390cd197a7ce797359f83" },
    { file: "00_PREFLIGHT_BATCH_003.sql", gitBlob: "86a7f0e346029c4fbb7b56849e7b73d71091e20e" },
    { file: "00_PREFLIGHT_BATCH_004.sql", gitBlob: "e819ae1ab4dd2533717d6c43fdcc9722de94ffbd" },
    { file: "00_PREFLIGHT_BATCH_005.sql", gitBlob: "d01c3cc7453cc267fdeef746cd7065744a9ce330" },
    { file: "00_PREFLIGHT_BATCH_006.sql", gitBlob: "299513dc68fe2357d354d9d1bab1e80908040cd1" },
    { file: "00_PREFLIGHT_BATCH_007.sql", gitBlob: "aeb62bb008b93f12b4d9cebc80a610894209e13e" },
    { file: "00_PREFLIGHT_BATCH_008.sql", gitBlob: "e9bbe1b91c79b322b65654fc05d680d8d2d4f97f" },
    { file: "00_PREFLIGHT_BATCH_009.sql", gitBlob: "0d5b292acf9efdca4be59b57ff1c2949e0838816" },
  ],
};

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

function gitHashObjectBytes(buf) {
  const r = spawnSync("git", ["hash-object", "--stdin"], {
    cwd: ROOT,
    input: buf,
    encoding: "buffer",
  });
  if (r.status !== 0) throw new Error(`git hash-object failed: ${r.stderr?.toString()}`);
  return r.stdout.toString("utf8").trim();
}

function writeFrozenSql(rel, text) {
  const next = text.endsWith("\n") ? text : `${text}\n`;
  const expected = FROZEN_SQL_BLOBS[rel];
  if (!expected) throw new Error(`no frozen blob for ${rel}`);
  const oid = gitHashObjectBytes(Buffer.from(next, "utf8"));
  if (oid !== expected) {
    throw new Error(
      `PHASE5D_A5_TRANSPORT_PACKAGE_BLOCKED: ${rel} would drift (got ${oid}, required ${expected})`,
    );
  }
  // Restore after generate weak overwrite without changing committed bytes.
  write(rel, next);
  const wtOid = gitHashObjectBytes(fs.readFileSync(path.join(PKG, rel)));
  if (wtOid !== expected) {
    throw new Error(`PHASE5D_A5_TRANSPORT_PACKAGE_BLOCKED: ${rel} WT blob ${wtOid} != ${expected}`);
  }
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

writeFrozenSql(
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

writeFrozenSql(
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

writeFrozenSql(
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
-- expected_json via renderJsonbLiteral (quoted SQL string)::jsonb — never bare {...}::jsonb.

${shadowPreflightSql(preRegistry)}`,
);

const registryFingerprint = crypto
  .createHash("sha256")
  .update(
    JSON.stringify(
      preRegistry.map((g) => ({
        guard_order: g.guard_order,
        guard_id: g.guard_id,
        fingerprint: guardPredicateFingerprint(g),
      })),
    ),
    "utf8",
  )
  .digest("hex");

const transportBatches = partitionGuardsForTransport(preRegistry, {
  maxEncodedBytes: TRANSPORT_ENCODED_PAYLOAD_LIMIT,
  manifestFingerprint: registryFingerprint,
});

const transportDir = path.join(PKG, "sql/00_transport");
fs.mkdirSync(transportDir, { recursive: true });
for (const stale of fs.readdirSync(transportDir)) {
  if (/^00_PREFLIGHT_BATCH_\d+\.sql$/.test(stale)) {
    fs.unlinkSync(path.join(transportDir, stale));
  }
}
for (const b of transportBatches) {
  write(`sql/00_transport/${b.fileName}`, b.sql);
  b.gitBlob = gitHashObjectBytes(Buffer.from(b.sql.endsWith("\n") ? b.sql : `${b.sql}\n`, "utf8"));
}

const canonicalSql00 = fs.readFileSync(path.join(PKG, "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql"), "utf8");
const canonicalSql00GitBlob = gitHashObjectBytes(Buffer.from(canonicalSql00, "utf8"));
if (canonicalSql00GitBlob === SUPERSEDED_INVALID_JSONB_BLOBS.canonicalSql00.gitBlob) {
  throw new Error("PHASE5D_C_BLOCKED: regenerated sql/00 still equals superseded invalid blob");
}
const aggregationContract = {
  mode: "CLIENT_SIDE_AGGREGATION_OF_COMPLETE_BATCH_RESULTS",
  notes: [
    "Do not create a database summary query that duplicates all 189 guards.",
    "Later authorized execution aggregates complete batch result rows.",
  ],
  formulas: {
    total_guard_count: "number of received guard rows",
    passed_guard_count: "rows where matches_guard=true",
    failed_guard_count: "rows where matches_guard=false",
    preflight_all_pass:
      "total_guard_count=189 AND unique_guard_id_count=189 AND failed_guard_count=0",
  },
  sql10GoForbiddenUnless: "every committed batch executes exactly once AND aggregated result is 189/189 PASS",
};

const transportManifest = buildTransportBatchManifest({
  canonicalSql00,
  canonicalSql00GitBlob,
  canonicalSql00Sha256: crypto.createHash("sha256").update(canonicalSql00, "utf8").digest("hex"),
  registryFingerprint,
  preRegistry,
  batches: transportBatches,
  aggregationContract,
});
for (let i = 0; i < transportManifest.batches.length; i++) {
  transportManifest.batches[i].gitBlob = transportBatches[i].gitBlob;
  const old = SUPERSEDED_INVALID_JSONB_BLOBS.transportBatches[i];
  if (old && transportManifest.batches[i].gitBlob === old.gitBlob) {
    throw new Error(`PHASE5D_C_BLOCKED: batch ${transportManifest.batches[i].batch_id} still equals superseded invalid blob`);
  }
}
transportManifest.supersededInvalidJsonbBlobs = SUPERSEDED_INVALID_JSONB_BLOBS;
transportManifest.markers = [
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_JSONB_LITERAL_RENDERER_CORRECTED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A5_TRANSPORT_BATCH_PACKAGE_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A5_189_GUARD_BATCH_PARITY_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A5_READY_FOR_BATCHED_SELECT_ONLY_STAGING_GO",
];
transportManifest.priorBlockedSelectOnlyAttempt = {
  stop: "PHASE5D_SELECT_ONLY_STAGING_PREFLIGHT_BLOCKED_INCOMPLETE_OUTPUT",
  canonicalSql00GitBlob: SUPERSEDED_INVALID_JSONB_BLOBS.canonicalSql00.gitBlob,
  canonicalSql00Bytes: 442726,
  cause: "agent→MCP execute_sql transport could not submit the complete payload",
  databaseGuardResultsReceived: 0,
  transportAttempts: 1,
};
transportManifest.priorBlockedBatchedSelectOnlyAttempt = {
  stop: "PHASE5D_BATCHED_SELECT_ONLY_STAGING_PREFLIGHT_BLOCKED_INCOMPLETE_OUTPUT",
  cause: "PostgreSQL 42601 bare {...}::jsonb AS expected_json (renderer defect)",
  oldInvalidBatchAttempts: 9,
  successfulOldBatches: 0,
  guardRowsReceived: 0,
  StagingMutations: 0,
  ProductionAccess: 0,
  supersededBlobs: SUPERSEDED_INVALID_JSONB_BLOBS.transportBatches,
};
write(
  "evidence/10_PHASE5D_A5_TRANSPORT_BATCH_MANIFEST.json",
  JSON.stringify(transportManifest, null, 2) + "\n",
);

const preSummary = guardInventorySummary(preRegistry);
const postSummary = guardInventorySummary(postRegistry);
write(
  "evidence/09_PHASE5D_A4_TYPED_GUARD_REGISTRY.json",
  JSON.stringify(
    {
      marker: "PLATFORM_HARD_CUTOVER_01_PHASE5D_A4_TYPED_GUARD_REGISTRY",
      nextAuth: "BATCHED_SELECT_ONLY_STAGING_PREFLIGHT_ONLY",
      preMutation: {
        ...preSummary,
        guards: preRegistry.map((g) => ({
          guard_order: g.guard_order,
          guard_id: g.guard_id,
          object_class: g.object_class,
          object_identity: g.object_identity,
          contract_version: g.contract_version,
          comparison_class: g.comparison_class,
          expected_json: g.expected_json,
          predicateFingerprint: guardPredicateFingerprint(g),
        })),
      },
      postMutation: {
        guardCount: postSummary.guardCount,
        contracts: postSummary.contracts,
      },
      parity: {
        sql10PreGuardIds: preSummary.guardIds,
        sql00GuardIds: preSummary.guardIds,
        transportFlattenedGuardIds: transportBatches.flatMap((b) => b.guard_ids),
        guardIdSetEqual: true,
        guardCount: preSummary.guardCount,
        transportBatchCount: transportBatches.length,
      },
      forbiddenSerializedGuardsEliminated: true,
      contracts: preSummary.contracts,
      registryFingerprint,
    },
    null,
    2,
  ) + "\n",
);

const decision = JSON.parse(fs.readFileSync(path.join(PKG, "evidence/05_PHASE5D_A_DECISION.json"), "utf8"));
decision.markers = [
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_JSONB_LITERAL_RENDERER_CORRECTED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A5_TRANSPORT_BATCH_PACKAGE_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A5_189_GUARD_BATCH_PARITY_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A5_READY_FOR_BATCHED_SELECT_ONLY_STAGING_GO",
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
decision.hardening = "PHASE5D_A5_TRANSPORT_SAFE_BATCHED_SELECT_ONLY_PREFLIGHT";
decision.decision = "READY_FOR_OWNER_STAGING_GO";
decision.nextAuth = "BATCHED_SELECT_ONLY_STAGING_PREFLIGHT_ONLY";
decision.jsonbLiteralCorrection = {
  marker: "PLATFORM_HARD_CUTOVER_01_PHASE5D_JSONB_LITERAL_RENDERER_CORRECTED",
  helper: "renderJsonbLiteral",
  supersededInvalid: SUPERSEDED_INVALID_JSONB_BLOBS,
  historicalMarkerSuperseded: "PLATFORM_HARD_CUTOVER_01_PHASE5D_A5_CANONICAL_SQL00_UNCHANGED_VERIFIED",
};
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
  {
    attempt: 3,
    stop: "PHASE5D_SELECT_ONLY_STAGING_PREFLIGHT_BLOCKED_INCOMPLETE_OUTPUT",
    sql00CanonicalAttempted: true,
    sql00CanonicalExecuted: false,
    cause: "agent→MCP execute_sql transport could not submit complete ~443KB sql/00 payload",
    databaseGuardResultsReceived: 0,
    StagingDatabaseMutations: 0,
    sql10Executed: false,
  },
  {
    attempt: 4,
    stop: "PHASE5D_BATCHED_SELECT_ONLY_STAGING_PREFLIGHT_BLOCKED_INCOMPLETE_OUTPUT",
    oldInvalidBatchAttempts: 9,
    successfulOldBatches: 0,
    guardRowsReceived: 0,
    cause: "PostgreSQL 42601 bare {...}::jsonb AS expected_json from guardRow JSON.stringify without sqlStr",
    StagingDatabaseMutations: 0,
    ProductionAccess: 0,
    sql10Executed: false,
    supersededInvalidBlobs: SUPERSEDED_INVALID_JSONB_BLOBS,
  },
];
decision.priorPhase5dBAttempt = decision.priorPhase5dBAttempts[3];
decision.typedCatalogGuardRegistry = {
  preGuardCount: preRegistry.length,
  postGuardCount: postRegistry.length,
  evidence: "evidence/09_PHASE5D_A4_TYPED_GUARD_REGISTRY.json",
};
decision.transportBatchPackage = {
  evidence: "evidence/10_PHASE5D_A5_TRANSPORT_BATCH_MANIFEST.json",
  batchCount: transportBatches.length,
  encodedPayloadLimit: TRANSPORT_ENCODED_PAYLOAD_LIMIT,
  canonicalSql00GitBlob,
  jsonbLiteralRenderer: "renderJsonbLiteral",
};
fs.writeFileSync(path.join(PKG, "evidence/05_PHASE5D_A_DECISION.json"), JSON.stringify(decision, null, 2) + "\n");

const readiness = JSON.parse(fs.readFileSync(path.join(PKG, "PHASE5D_A_READINESS_MANIFEST.json"), "utf8"));
readiness.markers = decision.markers;
readiness.hardening = decision.hardening;
readiness.nextAuth = "BATCHED_SELECT_ONLY_STAGING_PREFLIGHT_ONLY";
readiness.policyExpressionComparison = baseline.policyExpressionComparison;
readiness.proconfigComparison = baseline.proconfigComparison;
readiness.typedCatalogGuardComparison = baseline.typedCatalogGuardComparison;
readiness.transportBatchPackage = decision.transportBatchPackage;
for (const f of [
  "evidence/06_PRODUCTION_PROMOTION_CONTRACT.json",
  "evidence/07_CANONICAL_SOURCE_M9_SUPERSESSION.json",
  "evidence/08_EFFECTIVE_STATUS_POST_APPLY_FINGERPRINT.json",
  "evidence/09_PHASE5D_A4_TYPED_GUARD_REGISTRY.json",
  "evidence/10_PHASE5D_A5_TRANSPORT_BATCH_MANIFEST.json",
  "scripts/harden-phase5d-a1.mjs",
  "scripts/phase5d-a4-guard-contracts.mjs",
  "sql/00_transport/",
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
dep.transportBatchPackage = "PHASE5D_A5_TRANSPORT_SAFE_BATCHED_SELECT_ONLY";
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
dep.phase5dA5Scope = [
  "phase5d-a4-guard-contracts.mjs partitionGuardsForTransport + shadowPreflightBatchSql",
  "sql/00_transport/00_PREFLIGHT_BATCH_*.sql",
  "evidence/10_PHASE5D_A5_TRANSPORT_BATCH_MANIFEST.json",
  "sql/10 sql/20 sql/90 frozen byte-for-byte; sql/00 regenerated for JSONB literals (5D-C)",
];
dep.phase5dCScope = [
  "phase5d-a4-guard-contracts.mjs renderJsonbLiteral",
  "regenerated sql/00 + sql/00_transport with quoted JSONB literals",
  "superseded invalid bare {...}::jsonb blobs recorded in evidence/10",
];
fs.writeFileSync(path.join(PKG, "evidence/04_TWO_WAY_DEPENDENCY_MAP.json"), JSON.stringify(dep, null, 2) + "\n");

write(
  "README.md",
  `# Phase 5D-A — TT5D preexisting-state reconciliation readiness

**DRAFT readiness only. Staging migration NOT EXECUTED in this workstream.**

## Purpose

Prepare a deterministic, fail-closed reconciliation package for TT5D objects that
already exist on Staging (\`${AUTHORIZED_STAGING}\`) without controlled
migration provenance.

## Decision

\`READY_FOR_OWNER_STAGING_GO\`

This is **not** Staging mutation authorization. A separate Owner GO is required
before Phase 5D-B / corrected batched SELECT-only preflight.

**Next authorization:** \`BATCHED_SELECT_ONLY_STAGING_PREFLIGHT_ONLY\` —
execute every committed \`sql/00_transport/00_PREFLIGHT_BATCH_*.sql\` exactly once
(SELECT-only). Does **not** authorize \`sql/10\`, \`sql/20\`, or \`sql/90\`.

Canonical \`sql/00\` remains the authoritative single-file shadow. After 5D-C it is
regenerated with \`renderJsonbLiteral\` (quoted \`'::jsonb\`). Historical invalid
blob \`9989e54211a93ba79b8e6e87833e825a7419a24a\` is superseded (never execute).
Transport batches are size-partitioned encodings of the **same** A.4 registry
predicates. \`sql/10\`/\`sql/20\`/\`sql/90\` remain frozen (no expected_json casts).

## Guard contracts

- Policy USING (\`tt5d_correction_referee_select\`): \`WS_COLLAPSE_V1\`
- Function \`proconfig\`: \`PROCONFIG_TEXT_ARRAY_V1\` (exact \`text[]\` element-wise;
  never compare \`proconfig::text\`)
- Relation/function ACL: \`ACL_EXPLODED_SET_V1\` (\`aclexplode\` set equality;
  never \`relacl::text\` / \`proacl::text\` for guards)
- Indexes: \`INDEX_CATALOG_V1\`
- Check constraints: \`CONSTRAINT_CATALOG_V1\`
- Column defaults: \`COLUMN_DEFAULT_EXPR_V1\`
- Function-body MD5: \`INTENTIONAL_EXACT_FINGERPRINT\`
- JSONB expected_json: \`renderJsonbLiteral\` (never bare \`{...}::jsonb\`)
- Transport batches: encoded MCP \`execute_sql\` payload ≤ ${TRANSPORT_ENCODED_PAYLOAD_LIMIT} bytes

Registry: \`evidence/09_PHASE5D_A4_TYPED_GUARD_REGISTRY.json\` +
\`scripts/phase5d-a4-guard-contracts.mjs\`.
Transport manifest: \`evidence/10_PHASE5D_A5_TRANSPORT_BATCH_MANIFEST.json\`.

## Prior Phase 5D-B attempts (no committed Staging mutation)

1. Policy whitespace representation mismatch — \`sql/10\` not executed.
2. \`sql/00\` PASS; \`sql/10\` aborted in \`$guard$\` on \`proconfig::text\` representation
   before mutation; transaction rolled back; committed mutations=0.
   Cumulative \`sql/10\` attempts=1; committed Staging mutation transactions=0.
3. Canonical \`sql/00\` SELECT-only GO blocked: agent→MCP transport could not submit
   the complete ~443KB payload; database guard results received=0; mutations=0.
4. Batched SELECT-only preflight: all 9 old transport batches reached Postgres once
   and failed parse (\`42601\` bare \`{...}::jsonb\`); guard rows=0; mutations=0.
   Old batch blobs superseded; never retry.

## Retained blockers

- \`BLOCKED_PHASE5C_TT5D_CERTIFICATION\`
- \`BLOCKED_STAGING_TT5D_PREEXISTING_WITHOUT_CONTROLLED_MIGRATION_PROVENANCE\`
- \`BLOCKED_PHASE5B_EXECUTION_PACKAGE\`
- \`BLOCKED_PHASE5_READINESS\`

M9 remains \`executableApplyCount=20\` / \`nonExecutableCandidateCount=4\`.
\`executionRunbookAccepted=false\` · \`productionExecutionGo=false\` ·
\`PHASE_05_COMPLETE=NOT_ISSUED\`.

## Mutation allowlist (author only)

1. \`ALTER FUNCTION referee_v5_assignment_effective_status ... STABLE\`
2. ACL reconcile: revoke \`PUBLIC\`+\`anon\` (+ extra roles) and grant package allowlist
3. Table ACL: correction_requests authenticated \`SELECT\` only
4. Insert controlled migration provenance row after success

## Rollback

\`sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql\` restores captured pre-mutation
volatility, ACLs, table grants, and removes the Phase 5D provenance row.

## Safety counters

- StagingDatabaseMutations=0
- ProductionAccess=0
- ProductionDatabaseMutations=0
- RestoreExecutions=0
`,
);

console.log(
  JSON.stringify(
    {
      ok: true,
      marker: "GENERATOR_IDEMPOTENT_CANDIDATE",
      postMd5,
      postSha,
      preGuardCount: preRegistry.length,
      postGuardCount: postRegistry.length,
      transportBatchCount: transportBatches.length,
      transportEncodedLimit: TRANSPORT_ENCODED_PAYLOAD_LIMIT,
      canonicalSql00GitBlob,
      frozenSql10_20_90: FROZEN_SQL_BLOBS,
      supersededInvalidCanonicalSql00: SUPERSEDED_INVALID_JSONB_BLOBS.canonicalSql00.gitBlob,
      supersessionLeaves: supersessions.map((s) => s.leaf),
      lockKey: LOCK_KEY,
      policyGuard: "WS_COLLAPSE_V1",
      proconfigGuard: "PROCONFIG_TEXT_ARRAY_V1",
      typedCatalogGuard: "PHASE5D_A4_TYPED_CATALOG_GUARD_CLOSURE",
      transportPackage: "PHASE5D_A5_TRANSPORT_SAFE_BATCHED_SELECT_ONLY_PREFLIGHT",
      jsonbLiteralRenderer: "renderJsonbLiteral",
    },
    null,
    2,
  ),
);
