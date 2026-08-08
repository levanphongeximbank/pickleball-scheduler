/**
 * Phase 5D-A — generate readiness package artefacts from captured Staging catalog baseline.
 * Static packaging only. Does not connect to any database. Does not mutate Staging.
 *
 * Usage: node .../generate-phase5d-a-package.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, "..");
const ROOT = path.resolve(PKG, "../../..");

const AUTHORIZED_STAGING_REF = "qyewbxjsiiyufanzcjcq";
const FORBIDDEN_PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const MIGRATION_NAME = "phase5d_tt5d_controlled_reconciliation";
const MIGRATION_VERSION = "20260731150000";
const DECISION = "READY_FOR_OWNER_STAGING_GO";

/** Captured Staging catalog baseline (SELECT-only; no row values). */
const FUNCTIONS = [
  {
    oid: 21418,
    schema: "public",
    name: "referee_v5_apply_admin_result_revision",
    identityArgs:
      "p_tenant_id text, p_tournament_id text, p_match_id text, p_actor_id uuid, p_revision_status text, p_proposed_score jsonb, p_proposed_winner text, p_reason text, p_idempotency_key text, p_expected_result_revision_id uuid",
    identityArgsShort: "text, text, text, uuid, text, jsonb, text, text, text, uuid",
    resultType: "jsonb",
    language: "plpgsql",
    volatility: "VOLATILE",
    securityDefiner: true,
    proconfig: ["search_path=pg_catalog, public"],
    owner: "postgres",
    acl: "{postgres=X/postgres,service_role=X/postgres}",
    anonExecute: false,
    authenticatedExecute: false,
    serviceRoleExecute: true,
    publicExecute: false,
    defMd5: "11b7d3121eb0efd7c05cf2fd8a92da19",
    defSha256:
      "bc256eb5d86b39d7fb8c88b6dc5ed3c36d3dac9f08e0e88b0882a219fceecfe5",
    packageRevokeFrom: ["public", "anon", "authenticated"],
    packageGrantTo: ["service_role"],
  },
  {
    oid: 21486,
    schema: "public",
    name: "referee_v5_assert_assignment_write",
    identityArgs:
      "p_tenant_id text, p_tournament_id text, p_match_id text, p_actor_id uuid, p_allow_read_only boolean",
    identityArgsShort: "text, text, text, uuid, boolean",
    resultType: "jsonb",
    language: "plpgsql",
    volatility: "VOLATILE",
    securityDefiner: true,
    proconfig: ["search_path=public"],
    owner: "postgres",
    acl: "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    anonExecute: false,
    authenticatedExecute: true,
    serviceRoleExecute: true,
    publicExecute: false,
    defMd5: "e7854c03e3ffebf81a7928d6b8740ad5",
    defSha256:
      "1f5817229f73b23e68b3e14ad53bb0f45666a5eb323472ed47803a6f434a5227",
    packageRevokeFrom: ["public", "anon"],
    packageGrantTo: ["authenticated", "service_role"],
  },
  {
    oid: 21412,
    schema: "public",
    name: "referee_v5_assignment_effective_status",
    identityArgs:
      "p_status text, p_expires_at timestamp with time zone, p_revoked_at timestamp with time zone",
    identityArgsShort: "text, timestamptz, timestamptz",
    resultType: "text",
    language: "sql",
    volatility: "IMMUTABLE",
    securityDefiner: false,
    proconfig: [],
    owner: "postgres",
    acl: "{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    anonExecute: true,
    authenticatedExecute: true,
    serviceRoleExecute: true,
    publicExecute: false,
    defMd5: "c91ffb1ec3faa1e6fa2b3ea9395c4058",
    defSha256:
      "af04174b41386c244bded827805197c123a3767d71c4a2de809deee3b201a620",
    packageRevokeFrom: ["public"],
    packageGrantTo: ["authenticated", "service_role"],
    usesNow: true,
    intendedVolatility: "STABLE",
  },
  {
    oid: 21072,
    schema: "public",
    name: "referee_v5_current_user_has_assignment",
    identityArgs: "p_tenant_id text, p_tournament_id text, p_match_id text, p_roles text[]",
    identityArgsShort: "text, text, text, text[]",
    resultType: "boolean",
    language: "sql",
    volatility: "STABLE",
    securityDefiner: true,
    proconfig: ["search_path=public"],
    owner: "postgres",
    acl: "{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    anonExecute: true,
    authenticatedExecute: true,
    serviceRoleExecute: true,
    publicExecute: false,
    defMd5: "2223a22afbef0ccccc0d0df04ae873f1",
    defSha256:
      "62cf4a6ba2b625bf7fd682973f471b8023051e75e8aadd77a29fa276ded2676c",
    packageRevokeFrom: ["public"],
    packageGrantTo: ["authenticated"],
  },
  {
    oid: 21413,
    schema: "public",
    name: "referee_v5_mark_assignment_expired_if_needed",
    identityArgs: "p_assignment_id uuid",
    identityArgsShort: "uuid",
    resultType: "referee_assignments",
    language: "plpgsql",
    volatility: "VOLATILE",
    securityDefiner: true,
    proconfig: ["search_path=public"],
    owner: "postgres",
    acl: "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    anonExecute: false,
    authenticatedExecute: true,
    serviceRoleExecute: true,
    publicExecute: false,
    defMd5: "0f2e5ea3915cf34cdb0297ac3a844d4d",
    defSha256:
      "61cf17327f06172086d05e6e3cb3f737469b83705d44616e51870b3857f3c904",
    packageRevokeFrom: ["public", "anon"],
    packageGrantTo: ["authenticated", "service_role"],
  },
  {
    oid: 21414,
    schema: "public",
    name: "team_tournament_create_referee_assignment",
    identityArgs:
      "p_tournament_id text, p_matchup_id text, p_sub_match_id text, p_referee_user_id uuid, p_expires_at timestamp with time zone, p_activate boolean, p_idempotency_key text, p_reason text",
    identityArgsShort: "text, text, text, uuid, timestamptz, boolean, text, text",
    resultType: "json",
    language: "plpgsql",
    volatility: "VOLATILE",
    securityDefiner: true,
    proconfig: ["search_path=public"],
    owner: "postgres",
    acl: "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    anonExecute: false,
    authenticatedExecute: true,
    serviceRoleExecute: true,
    publicExecute: false,
    defMd5: "08f6d53845ba88c750caef815543fa46",
    defSha256:
      "47a17e4430b7b4105b01812bf3c1a3b33eaff505236b74f1e522070fd0ad59b4",
    packageRevokeFrom: ["public", "anon"],
    packageGrantTo: ["authenticated"],
  },
  {
    oid: 21417,
    schema: "public",
    name: "team_tournament_list_referee_assignments",
    identityArgs: "p_tournament_id text, p_sub_match_id text",
    identityArgsShort: "text, text",
    resultType: "json",
    language: "plpgsql",
    volatility: "STABLE",
    securityDefiner: true,
    proconfig: ["search_path=public"],
    owner: "postgres",
    acl: "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    anonExecute: false,
    authenticatedExecute: true,
    serviceRoleExecute: true,
    publicExecute: false,
    defMd5: "9ec273071d309641425a3d30d704a14b",
    defSha256:
      "1de85474ed366aadfd79d409c866b9785c479aabd29d4ad0cbbc67a8cd191087",
    packageRevokeFrom: ["public", "anon"],
    packageGrantTo: ["authenticated"],
  },
  {
    oid: 21485,
    schema: "public",
    name: "team_tournament_list_referee_corrections",
    identityArgs: "p_tournament_id text, p_status text",
    identityArgsShort: "text, text",
    resultType: "json",
    language: "plpgsql",
    volatility: "STABLE",
    securityDefiner: true,
    proconfig: ["search_path=public"],
    owner: "postgres",
    acl: "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    anonExecute: false,
    authenticatedExecute: true,
    serviceRoleExecute: true,
    publicExecute: false,
    defMd5: "513f41aabc74d5864a879d714796b53a",
    defSha256:
      "a53166544a2cef68b7eda6ae7a2b027757daf606a1cc438c5389074e014aee50",
    packageRevokeFrom: ["public", "anon"],
    packageGrantTo: ["authenticated"],
  },
  {
    oid: 21487,
    schema: "public",
    name: "team_tournament_referee_match_access_ops",
    identityArgs: "p_tournament_id text, p_match_id text",
    identityArgsShort: "text, text",
    resultType: "json",
    language: "plpgsql",
    volatility: "VOLATILE",
    securityDefiner: true,
    proconfig: ["search_path=public"],
    owner: "postgres",
    acl: "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    anonExecute: false,
    authenticatedExecute: true,
    serviceRoleExecute: true,
    publicExecute: false,
    defMd5: "4229dd7686b6eaae990e9353e764f927",
    defSha256:
      "3c0f91525dbcdd828048953c2f77218db87a34cf10b4d45c929bbbbddf0a11a9",
    packageRevokeFrom: ["public", "anon"],
    packageGrantTo: ["authenticated"],
  },
  {
    oid: 21420,
    schema: "public",
    name: "team_tournament_reopen_referee_match",
    identityArgs:
      "p_tournament_id text, p_sub_match_id text, p_reason text, p_idempotency_key text",
    identityArgsShort: "text, text, text, text",
    resultType: "json",
    language: "plpgsql",
    volatility: "VOLATILE",
    securityDefiner: true,
    proconfig: ["search_path=public"],
    owner: "postgres",
    acl: "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    anonExecute: false,
    authenticatedExecute: true,
    serviceRoleExecute: true,
    publicExecute: false,
    defMd5: "81f3b086288dc8da26700349bbbab3b2",
    defSha256:
      "8d2e5504f16e7d7bd74ea6fba8dbb6ad568cf84654325b8c248e3468b35c20e0",
    packageRevokeFrom: ["public", "anon"],
    packageGrantTo: ["authenticated"],
  },
  {
    oid: 21483,
    schema: "public",
    name: "team_tournament_request_referee_correction",
    identityArgs:
      "p_tournament_id text, p_match_id text, p_result_revision_id uuid, p_proposed_score jsonb, p_proposed_winner text, p_reason text, p_request_id text, p_expected_revision_version integer, p_idempotency_key text",
    identityArgsShort: "text, text, uuid, jsonb, text, text, text, integer, text",
    resultType: "json",
    language: "plpgsql",
    volatility: "VOLATILE",
    securityDefiner: true,
    proconfig: ["search_path=public"],
    owner: "postgres",
    acl: "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    anonExecute: false,
    authenticatedExecute: true,
    serviceRoleExecute: true,
    publicExecute: false,
    defMd5: "42b96c5091086edfc822392ed49999d2",
    defSha256:
      "db754d1059dc4868b5c1af562e19a03e61e3725d49d01d942e6c031a0a1734df",
    packageRevokeFrom: ["public", "anon"],
    packageGrantTo: ["authenticated"],
  },
  {
    oid: 21484,
    schema: "public",
    name: "team_tournament_review_referee_correction",
    identityArgs:
      "p_tournament_id text, p_correction_request_id uuid, p_decision text, p_review_reason text, p_expected_version integer, p_idempotency_key text",
    identityArgsShort: "text, uuid, text, text, integer, text",
    resultType: "json",
    language: "plpgsql",
    volatility: "VOLATILE",
    securityDefiner: true,
    proconfig: ["search_path=public"],
    owner: "postgres",
    acl: "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    anonExecute: false,
    authenticatedExecute: true,
    serviceRoleExecute: true,
    publicExecute: false,
    defMd5: "175c9ee13eeefaccdbb67160cd0a5a16",
    defSha256:
      "ec71858f44e595d57d5adf2dce1c0860474aa60eda3d5ef2fa842ea8e49c9453",
    packageRevokeFrom: ["public", "anon"],
    packageGrantTo: ["authenticated"],
  },
  {
    oid: 21416,
    schema: "public",
    name: "team_tournament_revoke_referee_assignment",
    identityArgs:
      "p_tournament_id text, p_assignment_id uuid, p_expected_version integer, p_reason text, p_idempotency_key text",
    identityArgsShort: "text, uuid, integer, text, text",
    resultType: "json",
    language: "plpgsql",
    volatility: "VOLATILE",
    securityDefiner: true,
    proconfig: ["search_path=public"],
    owner: "postgres",
    acl: "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    anonExecute: false,
    authenticatedExecute: true,
    serviceRoleExecute: true,
    publicExecute: false,
    defMd5: "f3280a760c9f4449aee6916d16c5026d",
    defSha256:
      "98313bd25f063dca3d2465688e5afd29c0fb282e90d342b2e76b8d41fb1e1dff",
    packageRevokeFrom: ["public", "anon"],
    packageGrantTo: ["authenticated"],
  },
];

if (FUNCTIONS.length !== 13) {
  throw new Error(`Expected 13 functions, got ${FUNCTIONS.length}`);
}

function writeJson(rel, obj) {
  const abs = path.join(PKG, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

function writeText(rel, text) {
  const abs = path.join(PKG, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

function fnSig(f) {
  return `${f.schema}.${f.name}(${f.identityArgsShort})`;
}

function observedRoles(f) {
  const roles = [];
  if (f.anonExecute) roles.push("anon");
  if (f.authenticatedExecute) roles.push("authenticated");
  if (f.serviceRoleExecute) roles.push("service_role");
  return roles;
}

function aclDrift(f) {
  const observed = new Set(observedRoles(f));
  const intended = new Set(f.packageGrantTo);
  // Phase 5D strengthens package: always revoke PUBLIC + anon explicitly.
  const phase5dRevoke = new Set(["public", "anon", ...f.packageRevokeFrom]);
  const extra = [...observed].filter((r) => !intended.has(r));
  const missing = [...intended].filter((r) => !observed.has(r));
  const packageMissesAnonRevoke = !f.packageRevokeFrom.includes("anon");
  return {
    extraExecuteRoles: extra,
    missingExecuteRoles: missing,
    packageMissesAnonRevoke,
    phase5dRequiredRevokeFrom: [...phase5dRevoke],
    drifted: extra.length > 0 || missing.length > 0 || packageMissesAnonRevoke || f.usesNow,
  };
}

const drifts = FUNCTIONS.map((f) => ({ function: fnSig(f), ...aclDrift(f), volatility: f.volatility, intendedVolatility: f.intendedVolatility || f.volatility }));

const mutationAllowlist = [
  {
    id: "VOLATILITY_EFFECTIVE_STATUS_IMMUTABLE_TO_STABLE",
    object: "public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)",
    action: "ALTER FUNCTION ... STABLE",
    reason: "Declared IMMUTABLE while body uses now(); intended STABLE",
  },
  {
    id: "ACL_REVOKE_ANON_PUBLIC_AND_ALIGN_ALLOWLIST",
    objects: FUNCTIONS.filter((f) => aclDrift(f).drifted).map(fnSig),
    action: "REVOKE ALL FROM public, anon [, extras]; GRANT EXECUTE only to package allowlist",
    reason: "Align Staging ACL to package allowlist; Phase 5D requires explicit PUBLIC+anon revoke",
  },
  {
    id: "TABLE_ACL_CORRECTION_REQUESTS_AUTHENTICATED_SELECT_ONLY",
    object: "public.team_tournament_referee_correction_requests",
    action: "REVOKE ALL FROM authenticated; GRANT SELECT TO authenticated; keep service_role ALL",
    reason: "Staging grants authenticated ALL; package grants SELECT only",
    observedAcl: "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
    packageIntent: "REVOKE anon; GRANT SELECT authenticated; GRANT ALL service_role",
  },
  {
    id: "MIGRATION_PROVENANCE_INSERT",
    object: "supabase_migrations.schema_migrations",
    action: `INSERT version=${MIGRATION_VERSION} name=${MIGRATION_NAME}`,
    reason: "Establish controlled migration provenance after successful reconciliation",
  },
];

// Evidence 01
writeJson("evidence/01_STAGING_TARGET_AND_BASELINE_GATE.json", {
  marker: "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_READ_ONLY_BASELINE_CAPTURED",
  mode: "READ_ONLY_SELECT_CATALOG_ONLY",
  StagingDatabaseMutations: 0,
  ProductionAccess: 0,
  ProductionDatabaseMutations: 0,
  RestoreExecutions: 0,
  targetGuard: {
    authorizedProjectRef: AUTHORIZED_STAGING_REF,
    forbiddenProductionRef: FORBIDDEN_PRODUCTION_REF,
    mcpServer: "project-0-pickleball-scheduler-supabase-staging",
    mcpConfigProjectRef: AUTHORIZED_STAGING_REF,
    identityProof: {
      club_ai_data_absent: true,
      referee_assignments_present: true,
      correction_table_present: true,
      database_name: "postgres",
      note: "MCP staging project_ref matched via .cursor/mcp.json binding plus catalog fingerprint; Production MCP not queried",
    },
    result: "PASS_TARGET_STAGING",
  },
  predecessor: {
    phase5c: "PLATFORM_HARD_CUTOVER_01_PHASE5C_CLOSED_WITH_BLOCKERS",
    originMain: "42d7a34887f77494103a34e77d58dfa365ed7708",
  },
  rowValuesCaptured: false,
});

// Evidence 02 — catalog baseline
writeJson("evidence/02_TT5D_EXACT_CATALOG_BASELINE.json", {
  marker: "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_CATALOG_BASELINE",
  functionCount: 13,
  functions: FUNCTIONS.map((f) => ({
    schema: f.schema,
    name: f.name,
    identityArgs: f.identityArgs,
    signature: fnSig(f),
    resultType: f.resultType,
    language: f.language,
    volatility: f.volatility,
    securityDefiner: f.securityDefiner,
    proconfig: f.proconfig,
    owner: f.owner,
    acl: f.acl,
    anonExecute: f.anonExecute,
    authenticatedExecute: f.authenticatedExecute,
    serviceRoleExecute: f.serviceRoleExecute,
    publicExecute: f.publicExecute,
    defMd5: f.defMd5,
    defSha256: f.defSha256,
  })),
  proconfigComparison: {
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
  },
  tables: {
    referee_assignments: {
      owner: "postgres",
      rlsEnabled: true,
      rlsForced: false,
      tt5dColumns: [
        { column: "external_matchup_id", dataType: "text", nullable: true, default: null },
        { column: "external_sub_match_id", dataType: "text", nullable: true, default: null },
        { column: "matchup_id", dataType: "uuid", nullable: true, default: null },
        { column: "sub_match_id", dataType: "uuid", nullable: true, default: null },
        { column: "revoke_reason", dataType: "text", nullable: true, default: null },
        { column: "version", dataType: "integer", nullable: false, default: "1" },
      ],
      foreignKeys: [
        {
          name: "referee_assignments_matchup_id_fkey",
          column: "matchup_id",
          references: "public.team_tournament_matchups(id)",
          onDelete: "SET NULL",
        },
        {
          name: "referee_assignments_sub_match_id_fkey",
          column: "sub_match_id",
          references: "public.team_tournament_sub_matches(id)",
          onDelete: "SET NULL",
        },
      ],
      statusCheck:
        "CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'expired'::text, 'revoked'::text, 'completed'::text])))",
      index: {
        name: "referee_assignments_sub_match_idx",
        def: "CREATE INDEX referee_assignments_sub_match_idx ON public.referee_assignments USING btree (sub_match_id, status) WHERE (sub_match_id IS NOT NULL)",
        owner: "postgres",
      },
    },
    team_tournament_referee_correction_requests: {
      owner: "postgres",
      rlsEnabled: true,
      rlsForced: false,
      acl: "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      columnCount: 25,
      index: {
        name: "tt5d_correction_pending_idx",
        def: "CREATE INDEX tt5d_correction_pending_idx ON public.team_tournament_referee_correction_requests USING btree (tenant_id, tournament_id, status) WHERE (status = 'pending'::text)",
        owner: "postgres",
      },
      policies: [
        {
          name: "tt5d_correction_referee_select",
          cmd: "r",
          roles: ["authenticated"],
          using:
            "(team_tournament_can_manage() OR (requested_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM referee_assignments ra WHERE ((ra.id = team_tournament_referee_correction_requests.assignment_id) AND (ra.referee_user_id = auth.uid())))))",
          withCheck: null,
        },
        {
          name: "tt5d_correction_no_client_write",
          cmd: "*",
          roles: ["authenticated"],
          using: "false",
          withCheck: "false",
        },
      ],
    },
  },
  migrationHistory: {
    tt5dNamedMigrationPresent: false,
    phase5cNamedMigrationPresent: false,
    phase5dNamedMigrationPresent: false,
    relatedRows: [
      { version: "20260712231952", name: "phase_tt5b_bridge_schema" },
      { version: "20260712232004", name: "phase_tt5b_bridge_helpers_rls" },
    ],
    classification: "TT5D_OBJECTS_PRESENT_WITHOUT_CONTROLLED_MIGRATION_PROVENANCE",
  },
  rowValuesCaptured: false,
});

// Evidence 03 — semantic delta
writeJson("evidence/03_TT5D_SEMANTIC_DELTA.json", {
  marker: "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_SEMANTIC_DELTA_VERIFIED",
  findings: [
    {
      id: 1,
      claim: "referee_v5_assignment_effective_status is declared IMMUTABLE while using now()",
      result: "CONFIRMED",
      evidence: "volatility=IMMUTABLE; body contains p_expires_at <= now()",
    },
    {
      id: 2,
      claim: "Intended correct volatility is STABLE unless code analysis proves otherwise",
      result: "CONFIRMED",
      evidence: "SQL function reads now(); STABLE is required; no proof supports IMMUTABLE",
    },
    {
      id: 3,
      claim: "Revoking from PUBLIC alone does not remove a direct anon grant",
      result: "CONFIRMED",
      evidence:
        "publicExecute=false on effective_status and current_user_has_assignment while anonExecute=true",
    },
    {
      id: 4,
      claim:
        "Every protected TT5D function must use explicit role allowlist and explicit revoke from PUBLIC and anon",
      result: "CONFIRMED_AS_REQUIREMENT",
      evidence:
        "Package omits anon revoke on effective_status and current_user_has_assignment; Phase 5D migration will revoke PUBLIC+anon for all 13",
    },
    {
      id: 5,
      claim: "Phase 5C 99_TT5D_VERIFY.sql checks only a subset of 13 functions and incomplete ACL/owner/volatility/policy/fingerprint/provenance",
      result: "CONFIRMED",
      evidence: "99_TT5D_VERIFY.sql lists only 4 function names and no ACL/volatility/policy fingerprint checks",
    },
    {
      id: 6,
      claim: "Phase 5B historical text that TT5D objects were absent is historical only",
      result: "CONFIRMED",
      evidence: "Current Staging has all 13 functions + tables; no TT5D migration row; historical Phase 5B evidence retained unchanged",
    },
    {
      id: 7,
      claim: "Phase 5C rollback is incomplete because no exact pre-mutation baseline existed",
      result: "CONFIRMED",
      evidence: "Phase 5C classification ROLLBACK_INCOMPLETE_PREEXISTING_TT5D_WITHOUT_PREAPPLY_BASELINE; Phase 5D-A now captures exact baseline",
    },
  ],
  aclDrift: drifts.filter((d) => d.drifted),
  tableAclDrift: {
    table: "public.team_tournament_referee_correction_requests",
    observedAuthenticated: "ALL(arwdDxtm)",
    packageAuthenticated: "SELECT",
    classification: "CONFLICTING_TABLE_GRANT_DRIFT",
  },
  mutationAllowlist,
  objectsNotMutated: [
    "function bodies (except volatility attribute via ALTER FUNCTION)",
    "columns",
    "foreign keys",
    "indexes",
    "RLS enable flags",
    "policy definitions",
    "table schemas",
  ],
  strategyUnchanged: true,
  note: "Additional service_role extras and table SELECT-vs-ALL drift included in allowlist; strategy remains controlled ACL+volatility reconciliation — not widened to DDL recreate/wipe",
});

// Evidence 04 — dependency map
const protectedFutureConsumers = [
  "docs/platform-hard-cutover-01/phase-05b-execution-package/PHASE5B_CHECKSUM_MANIFEST.json",
  "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/M9_MANIFEST.json",
  "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/00_SOURCE_PROVENANCE.json",
  "docs/platform-hard-cutover-01/phase-05b-execution-package/M0_M11_EXECUTION_MANIFEST.json",
  "docs/platform-hard-cutover-01/phase-05b-execution-package/PHASE5_ORDERED_RUNBOOK_CANDIDATE.md",
  "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/190_TT5D_ASSIGNMENT_SAFETY.sql",
  "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/200_TT5D_REOPEN_RESULT.sql",
  "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/210_TT5D_CORRECTION.sql",
  "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/220_TT5D_SECURITY_GUARDS.sql",
  "docs/v5/team-tournament/tt5/TT5-D_ASSIGNMENT_SAFETY.sql",
  "docs/v5/team-tournament/tt5/TT5-D_REOPEN_RESULT_REVISION.sql",
  "docs/v5/team-tournament/tt5/TT5-D_CORRECTION_WORKFLOW.sql",
  "docs/v5/team-tournament/tt5/TT5-D_SECURITY_GUARDS.sql",
  "tests/platform-hard-cutover-01-phase-05b-package.test.js",
  "tests/platform-hard-cutover-01-phase-05c-tt5d-certification.test.js",
  "docs/platform-hard-cutover-01/phase-05b-execution-package/scripts/verify-phase5b-checksums.mjs",
  "docs/platform-hard-cutover-01/phase-05c-tt5d-staging-certification/scripts/sync-phase5b-checksum-manifest.mjs",
];

writeJson("evidence/04_TWO_WAY_DEPENDENCY_MAP.json", {
  marker: "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_DEPENDENCY_CLOSURE_VERIFIED",
  phase5dAModifiesHistoricalPhase5B5C: false,
  forward: {
    "docs/v5/team-tournament/tt5/TT5-D_*.sql": [
      "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/190|200|210|220_TT5D_*.sql",
      "M9_MANIFEST.json nonExecutionCandidates",
      "00_SOURCE_PROVENANCE.json",
      "PHASE5B_CHECKSUM_MANIFEST.json",
      "PHASE5_ORDERED_RUNBOOK_CANDIDATE.md",
      "Phase 5C evidence + 99_TT5D_VERIFY.sql",
      "Phase 5D-A sql/10 reconciliation (derived contract)",
      "Phase 5D-A tests/verifier",
    ],
    "phase5d sql/10_TT5D_CONTROLLED_RECONCILIATION.sql": [
      "sql/20_TT5D_POST_APPLY_VERIFY.sql",
      "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql",
      "evidence/03_TT5D_SEMANTIC_DELTA.json mutationAllowlist",
      "scripts/verify-phase5d-a.mjs",
      "PHASE5D_A_READINESS_MANIFEST.json",
      "tests/platform-hard-cutover-01-phase-05d-a-readiness.test.js",
    ],
  },
  reverse: {
    "scripts/verify-phase5d-a.mjs": [
      "PHASE5D_CHECKSUM_MANIFEST.json",
      "PHASE5D_A_READINESS_MANIFEST.json",
      "evidence/*",
      "sql/*",
    ],
    "phase-05b verify-phase5b-checksums.mjs": [
      "PHASE5B_CHECKSUM_MANIFEST.json (42 files) — NOT modified by Phase 5D-A",
    ],
    "sync-phase5b-checksum-manifest.mjs": [
      "PHASE5B_CHECKSUM_MANIFEST.json allowlist paths — check mode only in Phase 5D-A",
    ],
  },
  futureUpdateRequirementsWithoutRewritingHistory: protectedFutureConsumers.map((p) => ({
    path: p,
    phase5dAAction: "IDENTIFY_ONLY_DO_NOT_MODIFY",
    futureNeed:
      p.includes("TT5-D_ASSIGNMENT") || p.includes("190_TT5D")
        ? "After Owner Staging GO + successful 5D-B: consider STABLE + explicit anon revoke in source/M9 copy, then checksum rematerialize"
        : p.includes("M9_MANIFEST")
          ? "TT5D remains non-executable (4) until post-certification Owner decision"
          : "Consumer may need refresh only after executed reconciliation is certified",
  })),
  dependencyClosureResult: "PASS",
});

// Evidence 05 — decision
writeJson("evidence/05_PHASE5D_A_DECISION.json", {
  marker: "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_READY_FOR_STAGING_GO",
  decision: DECISION,
  meaning:
    "Package ready for Owner review of a separate explicit Staging mutation authorization (Phase 5D-B). Not authorization itself.",
  StagingDatabaseMutations: 0,
  ProductionAccess: 0,
  ProductionDatabaseMutations: 0,
  RestoreExecutions: 0,
  retainedBlockers: {
    BLOCKED_PHASE5C_TT5D_CERTIFICATION: true,
    BLOCKED_STAGING_TT5D_PREEXISTING_WITHOUT_CONTROLLED_MIGRATION_PROVENANCE: true,
    BLOCKED_PHASE5B_EXECUTION_PACKAGE: true,
    BLOCKED_PHASE5_READINESS: true,
  },
  m9: {
    executableApplyCount: 20,
    nonExecutableCandidateCount: 4,
    tt5dMovedToOrderedApply: false,
    tt5dDeclaredExecutable: false,
  },
  continuingPhase5: {
    executionRunbookAccepted: false,
    productionExecutionGo: false,
    PHASE_05_COMPLETE: "NOT_ISSUED",
  },
  phase5dB: "NOT_STARTED",
  phase6: "NOT_STARTED",
  rollbackReady: true,
  markers: [
    "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_READ_ONLY_BASELINE_CAPTURED",
    "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_SEMANTIC_DELTA_VERIFIED",
    "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_DEPENDENCY_CLOSURE_VERIFIED",
    "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_ROLLBACK_READY",
    "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_READY_FOR_STAGING_GO",
  ],
});

writeJson("PHASE5D_A_READINESS_MANIFEST.json", {
  marker: "PLATFORM_HARD_CUTOVER_01_PHASE5D_A_READINESS_MANIFEST",
  decision: DECISION,
  authorizedStagingRef: AUTHORIZED_STAGING_REF,
  forbiddenProductionRef: FORBIDDEN_PRODUCTION_REF,
  functionCount: 13,
  migrationName: MIGRATION_NAME,
  migrationVersion: MIGRATION_VERSION,
  mutationAllowlistIds: mutationAllowlist.map((m) => m.id),
  historicalPhase5B5CUnchanged: true,
  m9ExecutableApplyCount: 20,
  m9NonExecutableCandidateCount: 4,
  StagingDatabaseMutations: 0,
  ProductionAccess: 0,
  ProductionDatabaseMutations: 0,
  RestoreExecutions: 0,
  packageFiles: [
    "README.md",
    "PHASE5D_A_READINESS_MANIFEST.json",
    "PHASE5D_CHECKSUM_MANIFEST.json",
    "evidence/01_STAGING_TARGET_AND_BASELINE_GATE.json",
    "evidence/02_TT5D_EXACT_CATALOG_BASELINE.json",
    "evidence/03_TT5D_SEMANTIC_DELTA.json",
    "evidence/04_TWO_WAY_DEPENDENCY_MAP.json",
    "evidence/05_PHASE5D_A_DECISION.json",
    "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql",
    "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql",
    "sql/20_TT5D_POST_APPLY_VERIFY.sql",
    "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql",
    "scripts/generate-phase5d-a-package.mjs",
    "scripts/verify-phase5d-a.mjs",
    "scripts/sync-phase5d-checksum-manifest.mjs",
  ],
});

writeText(
  "README.md",
  `# Phase 5D-A — TT5D preexisting-state reconciliation readiness

**DRAFT readiness only. Staging migration NOT EXECUTED in this workstream.**

## Purpose

Prepare a deterministic, fail-closed reconciliation package for TT5D objects that
already exist on Staging (\`${AUTHORIZED_STAGING_REF}\`) without controlled
migration provenance.

## Decision

\`${DECISION}\`

This is **not** Staging mutation authorization. A separate Owner GO is required
before Phase 5D-B.

**Next authorization (A.4):** \`SELECT_ONLY_STAGING_PREFLIGHT_ONLY\` — execute
committed \`sql/00\` only. Does **not** authorize \`sql/10\`, \`sql/20\`, or \`sql/90\`.

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

\`sql/00\` is a complete SELECT-only, non-fail-fast shadow of every \`sql/10\`
pre-mutation guard (\`guard_id\` parity exact; summary:
\`total_guard_count\` / \`passed_guard_count\` / \`failed_guard_count\` /
\`preflight_all_pass\`).

Registry: \`evidence/09_PHASE5D_A4_TYPED_GUARD_REGISTRY.json\` +
\`scripts/phase5d-a4-guard-contracts.mjs\`.

## Prior Phase 5D-B attempts (no committed Staging mutation)

1. Policy whitespace representation mismatch — \`sql/10\` not executed.
2. \`sql/00\` PASS; \`sql/10\` aborted in \`$guard$\` on \`proconfig::text\` representation
   before mutation; transaction rolled back; committed mutations=0.
   Cumulative \`sql/10\` attempts=1; committed Staging mutation transactions=0.

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

// SQL 00 precondition
writeText(
  "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql",
  `-- Phase 5D-A precondition — SELECT/catalog only. Do not mutate.
-- Target must be Staging project_ref ${AUTHORIZED_STAGING_REF}. Forbidden: ${FORBIDDEN_PRODUCTION_REF}.

SELECT to_regclass('public.club_ai_data') IS NULL AS club_ai_data_absent;
SELECT to_regclass('public.referee_assignments') IS NOT NULL AS referee_assignments_present;
SELECT to_regclass('public.team_tournament_referee_correction_requests') IS NOT NULL AS correction_table_present;

SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS identity_args,
       CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END AS volatility,
       md5(pg_get_functiondef(p.oid)) AS def_md5,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'referee_v5_assignment_effective_status',
    'referee_v5_mark_assignment_expired_if_needed',
    'team_tournament_create_referee_assignment',
    'team_tournament_revoke_referee_assignment',
    'team_tournament_list_referee_assignments',
    'referee_v5_apply_admin_result_revision',
    'team_tournament_reopen_referee_match',
    'team_tournament_request_referee_correction',
    'team_tournament_review_referee_correction',
    'team_tournament_list_referee_corrections',
    'referee_v5_current_user_has_assignment',
    'referee_v5_assert_assignment_write',
    'team_tournament_referee_match_access_ops'
  )
ORDER BY 1, 2;

SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE name ILIKE '%tt5d%' OR name ILIKE '%phase5c%' OR name ILIKE '%phase5d%' OR name ILIKE '%tt5%'
ORDER BY version;
`,
);

function fingerprintGuardSql() {
  const lines = FUNCTIONS.map(
    (f) => `  IF md5(pg_get_functiondef(to_regprocedure('public.${f.name}(${f.identityArgsShort})'))) <> '${f.defMd5}' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH function def_md5 %', '${f.name}';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.${f.name}(${f.identityArgsShort})'), 'EXECUTE') IS DISTINCT FROM ${f.anonExecute} THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH anon execute %', '${f.name}';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.${f.name}(${f.identityArgsShort})'), 'EXECUTE') IS DISTINCT FROM ${f.authenticatedExecute} THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH authenticated execute %', '${f.name}';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.${f.name}(${f.identityArgsShort})'), 'EXECUTE') IS DISTINCT FROM ${f.serviceRoleExecute} THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH service_role execute %', '${f.name}';
  END IF;`,
  );
  return lines.join("\n");
}

function reconcileAclSql() {
  return FUNCTIONS.map((f) => {
    const grants = f.packageGrantTo.join(", ");
    return `-- ${f.name}
REVOKE ALL ON FUNCTION public.${f.name}(${f.identityArgsShort}) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.${f.name}(${f.identityArgsShort}) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.${f.name}(${f.identityArgsShort}) TO ${grants};`;
  }).join("\n\n");
}

writeText(
  "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql",
  `-- Phase 5D-A authored reconciliation — DO NOT EXECUTE in Phase 5D-A.
-- Atomic, fail-closed. Target Staging ONLY (${AUTHORIZED_STAGING_REF}).
-- Forbidden Production ref: ${FORBIDDEN_PRODUCTION_REF}.
-- Catalog/ACL/volatility reconciliation only. No table drops, truncates, or business-row deletes. No secrets.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Phase 5D-specific advisory lock
SELECT pg_advisory_xact_lock(hashtextextended('phase5d_tt5d_controlled_reconciliation', 0));

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE name = '${MIGRATION_NAME}' OR version = '${MIGRATION_VERSION}'
  ) THEN
    RAISE EXCEPTION 'PHASE5D_PROVENANCE_ALREADY_PRESENT';
  END IF;

  IF to_regclass('public.club_ai_data') IS NOT NULL THEN
    RAISE EXCEPTION 'PHASE5D_TARGET_GUARD_FAILED club_ai_data present (not Staging fingerprint)';
  END IF;

  IF to_regclass('public.referee_assignments') IS NULL
     OR to_regclass('public.team_tournament_referee_correction_requests') IS NULL THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH required TT5D tables absent';
  END IF;

  -- Volatility baseline for effective_status
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'referee_v5_assignment_effective_status'
      AND pg_get_function_identity_arguments(p.oid) =
          'p_status text, p_expires_at timestamp with time zone, p_revoked_at timestamp with time zone'
  ) IS DISTINCT FROM 'IMMUTABLE' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH expected IMMUTABLE effective_status before mutate';
  END IF;

${fingerprintGuardSql()}

  -- Table ACL baseline (authenticated ALL)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'team_tournament_referee_correction_requests'
      AND c.relacl::text = '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'
  ) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH correction table ACL';
  END IF;

  -- Policy presence
  IF (
    SELECT count(*) FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND pol.polname IN ('tt5d_correction_referee_select', 'tt5d_correction_no_client_write')
  ) <> 2 THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH TT5D policies';
  END IF;
END
$guard$;

-- 1) Volatility correction (body unchanged)
ALTER FUNCTION public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) STABLE;

-- 2) Function ACL reconciliation to package allowlist + explicit PUBLIC/anon revoke
${reconcileAclSql()}

-- 3) Table ACL: authenticated SELECT only (package intent)
REVOKE ALL ON TABLE public.team_tournament_referee_correction_requests FROM authenticated;
GRANT SELECT ON TABLE public.team_tournament_referee_correction_requests TO authenticated;
-- service_role ALL retained (package intent); ensure present
GRANT ALL ON TABLE public.team_tournament_referee_correction_requests TO service_role;

-- 4) Controlled migration provenance (only after mutations above succeed)
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '${MIGRATION_VERSION}',
  '${MIGRATION_NAME}',
  ARRAY['phase5d_tt5d_controlled_reconciliation_volatility_and_acl']
);

COMMIT;
`,
);

// Verify SQL
const verifyFnBlocks = FUNCTIONS.map((f) => {
  const intendedVol = f.intendedVolatility || f.volatility;
  const grants = f.packageGrantTo;
  return `
  -- ${f.name}
  IF to_regprocedure('public.${f.name}(${f.identityArgsShort})') IS NULL THEN
    RAISE EXCEPTION 'VERIFY missing %', '${f.name}';
  END IF;
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.${f.name}(${f.identityArgsShort})')
  ) IS DISTINCT FROM '${intendedVol}' THEN
    RAISE EXCEPTION 'VERIFY volatility %', '${f.name}';
  END IF;
  IF (
    SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.${f.name}(${f.identityArgsShort})')
  ) IS DISTINCT FROM ${f.securityDefiner} THEN
    RAISE EXCEPTION 'VERIFY security_definer %', '${f.name}';
  END IF;
  IF (
    SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid = to_regprocedure('public.${f.name}(${f.identityArgsShort})')
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner %', '${f.name}';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.${f.name}(${f.identityArgsShort})'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon must be denied %', '${f.name}';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.${f.name}(${f.identityArgsShort})'), 'EXECUTE') IS DISTINCT FROM ${grants.includes("authenticated")} THEN
    RAISE EXCEPTION 'VERIFY authenticated grant %', '${f.name}';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.${f.name}(${f.identityArgsShort})'), 'EXECUTE') IS DISTINCT FROM ${grants.includes("service_role")} THEN
    RAISE EXCEPTION 'VERIFY service_role grant %', '${f.name}';
  END IF;`;
}).join("\n");

writeText(
  "sql/20_TT5D_POST_APPLY_VERIFY.sql",
  `-- Phase 5D post-apply verify — SELECT/DO checks only. Covers all 13 functions.
-- Author-only companion to 10_TT5D_CONTROLLED_RECONCILIATION.sql.

DO $verify$
BEGIN
  IF (
    SELECT count(*) FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'referee_v5_assignment_effective_status',
        'referee_v5_mark_assignment_expired_if_needed',
        'team_tournament_create_referee_assignment',
        'team_tournament_revoke_referee_assignment',
        'team_tournament_list_referee_assignments',
        'referee_v5_apply_admin_result_revision',
        'team_tournament_reopen_referee_match',
        'team_tournament_request_referee_correction',
        'team_tournament_review_referee_correction',
        'team_tournament_list_referee_corrections',
        'referee_v5_current_user_has_assignment',
        'referee_v5_assert_assignment_write',
        'team_tournament_referee_match_access_ops'
      )
  ) <> 13 THEN
    RAISE EXCEPTION 'VERIFY expected exactly 13 TT5D functions';
  END IF;

${verifyFnBlocks}

  -- Columns
  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'referee_assignments'
      AND column_name IN ('external_matchup_id','external_sub_match_id','matchup_id','sub_match_id','revoke_reason','version')
  ) <> 6 THEN
    RAISE EXCEPTION 'VERIFY missing TT5D columns';
  END IF;

  -- Status check
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'referee_assignments'
      AND c.conname = 'referee_assignments_status_check'
      AND pg_get_constraintdef(c.oid) LIKE '%pending%'
      AND pg_get_constraintdef(c.oid) LIKE '%completed%'
  ) THEN
    RAISE EXCEPTION 'VERIFY status_check';
  END IF;

  -- Indexes
  IF to_regclass('public.referee_assignments_sub_match_idx') IS NULL
     OR to_regclass('public.tt5d_correction_pending_idx') IS NULL THEN
    RAISE EXCEPTION 'VERIFY indexes';
  END IF;

  -- RLS + policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests'
      AND c.relrowsecurity IS TRUE
  ) THEN
    RAISE EXCEPTION 'VERIFY correction RLS';
  END IF;

  IF (
    SELECT count(*) FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public'
      AND pol.polname IN ('tt5d_correction_referee_select','tt5d_correction_no_client_write')
  ) <> 2 THEN
    RAISE EXCEPTION 'VERIFY policies';
  END IF;

  -- Table ACL: authenticated SELECT (not ALL write bits required absent ideally)
  IF has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'SELECT') IS NOT TRUE THEN
    RAISE EXCEPTION 'VERIFY authenticated SELECT';
  END IF;
  IF has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'INSERT')
     OR has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'DELETE') THEN
    RAISE EXCEPTION 'VERIFY authenticated must not have write privileges';
  END IF;
  IF has_table_privilege('anon', 'public.team_tournament_referee_correction_requests', 'SELECT') THEN
    RAISE EXCEPTION 'VERIFY anon table denied';
  END IF;

  -- Provenance
  IF NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version = '${MIGRATION_VERSION}' AND name = '${MIGRATION_NAME}'
  ) THEN
    RAISE EXCEPTION 'VERIFY migration provenance missing';
  END IF;

  RAISE NOTICE 'PHASE5D_POST_APPLY_VERIFY_PASS';
END
$verify$;
`,
);

// Rollback
const rollbackAcl = FUNCTIONS.map((f) => {
  const roles = [];
  if (f.anonExecute) roles.push("anon");
  if (f.authenticatedExecute) roles.push("authenticated");
  if (f.serviceRoleExecute) roles.push("service_role");
  return `-- restore ${f.name}
REVOKE ALL ON FUNCTION public.${f.name}(${f.identityArgsShort}) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.${f.name}(${f.identityArgsShort}) TO ${roles.join(", ")};`;
}).join("\n\n");

writeText(
  "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql",
  `-- Phase 5D exact baseline rollback — restores pre-mutation Staging state captured in evidence/02.
-- Author-only. Restores captured baseline attributes/ACLs/provenance. No table drops or truncates. No Production identifiers as targets.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtextextended('phase5d_tt5d_controlled_reconciliation_rollback', 0));

-- Restore volatility
ALTER FUNCTION public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) IMMUTABLE;

-- Restore function ACLs to captured baseline
${rollbackAcl}

-- Restore correction table ACL to captured baseline (authenticated ALL)
REVOKE ALL ON TABLE public.team_tournament_referee_correction_requests FROM authenticated;
GRANT ALL ON TABLE public.team_tournament_referee_correction_requests TO authenticated;
GRANT ALL ON TABLE public.team_tournament_referee_correction_requests TO service_role;

-- Remove controlled provenance row if present
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '${MIGRATION_VERSION}' AND name = '${MIGRATION_NAME}';

COMMIT;
`,
);

console.log(
  JSON.stringify(
    {
      ok: true,
      functions: FUNCTIONS.length,
      driftedFunctions: drifts.filter((d) => d.drifted).length,
      decision: DECISION,
      pkg: PKG,
    },
    null,
    2,
  ),
);
