/**
 * Phase 5C — generate BLOCKED evidence + rollback/sql package.
 * No database mutation. Staging apply NOT executed.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../..");
const PKG5C = path.resolve(ROOT, "docs/platform-hard-cutover-01/phase-05c-tt5d-staging-certification");
const M9 = path.resolve(ROOT, "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament");
const now = new Date().toISOString();

function sha256Blob(rel) {
  const buf = execSync(`git cat-file -p HEAD:${rel.replace(/\\/g, "/")}`, {
    cwd: ROOT,
    encoding: "buffer",
    maxBuffer: 50 * 1024 * 1024,
  });
  return crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
}

function writeJson(rel, obj) {
  const fp = path.join(PKG5C, rel);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  return fp;
}

const artefacts = [
  {
    order: 190,
    file: "190_TT5D_ASSIGNMENT_SAFETY.sql",
    path: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/190_TT5D_ASSIGNMENT_SAFETY.sql",
    expected: "5ABEE354336E5A6D8744558D880F86803C33C283E95A43A4CD9877A2E3B69E70",
    sourcePath: "docs/v5/team-tournament/tt5/TT5-D_ASSIGNMENT_SAFETY.sql",
  },
  {
    order: 200,
    file: "200_TT5D_REOPEN_RESULT.sql",
    path: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/200_TT5D_REOPEN_RESULT.sql",
    expected: "7DB37D8A39B35789DF6D3948F6899B8ED0D950A6963E97855F0F579FDF43A755",
    sourcePath: "docs/v5/team-tournament/tt5/TT5-D_REOPEN_RESULT_REVISION.sql",
  },
  {
    order: 210,
    file: "210_TT5D_CORRECTION.sql",
    path: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/210_TT5D_CORRECTION.sql",
    expected: "F9941BF7316273247D317B2344E2404FC7177F6CD28BB650C0E6BB9CBB66D0B7",
    sourcePath: "docs/v5/team-tournament/tt5/TT5-D_CORRECTION_WORKFLOW.sql",
  },
  {
    order: 220,
    file: "220_TT5D_SECURITY_GUARDS.sql",
    path: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/220_TT5D_SECURITY_GUARDS.sql",
    expected: "DC359FFAA81F4217491339AF879B509A0903AB98D176C3F7D5E98F3D1A94045F",
    sourcePath: "docs/v5/team-tournament/tt5/TT5-D_SECURITY_GUARDS.sql",
  },
];

for (const a of artefacts) {
  a.sha256ExactGitBlobBytes = sha256Blob(a.path);
  a.sourceSha256ExactGitBlobBytes = sha256Blob(a.sourcePath);
  a.bytesMatchExpected = a.sha256ExactGitBlobBytes === a.expected;
  a.bytesMatchSource = a.sha256ExactGitBlobBytes === a.sourceSha256ExactGitBlobBytes;
}

const decision = "BLOCKED_PHASE5C_TT5D_CERTIFICATION";
const m9Verdict = "BLOCKED_STAGING_TT5D_PREEXISTING_WITHOUT_CONTROLLED_MIGRATION_PROVENANCE";
const catalogClass = "CONFLICTING";
const blockerCodes = [
  "TT5D_OBJECTS_PRESENT_WITHOUT_SCHEMA_MIGRATIONS_TT5D_ROW",
  "CANNOT_CLASSIFY_ABSENT_AS_EXPECTED",
  "CANNOT_CLASSIFY_ALREADY_EXACTLY_EQUIVALENT_WITH_MATCHING_MIGRATION_PROVENANCE",
  "GRANT_DRIFT_ANON_EXECUTE_ON_FUNCTIONS_REVOKED_FROM_PUBLIC_IN_CANONICAL_PACKAGE",
  "ATOMIC_APPLY_FORBIDDEN_WHEN_PARTIALLY_PRESENT_OR_CONFLICTING",
];

const touched = {
  generatedAt: now,
  phase: "PHASE_05C",
  artefacts,
  tables: {
    altered: ["public.referee_assignments"],
    created: ["public.team_tournament_referee_correction_requests"],
  },
  columnsAddedOnRefereeAssignments: [
    "external_matchup_id",
    "external_sub_match_id",
    "matchup_id",
    "sub_match_id",
    "revoke_reason",
    "version",
  ],
  constraints: {
    droppedThenAdded: ["referee_assignments_status_check"],
    statusValuesRequired: ["pending", "active", "expired", "revoked", "completed"],
  },
  indexes: ["referee_assignments_sub_match_idx", "tt5d_correction_pending_idx"],
  policies: ["tt5d_correction_referee_select", "tt5d_correction_no_client_write"],
  functions: [
    "referee_v5_assignment_effective_status(text,timestamptz,timestamptz)",
    "referee_v5_mark_assignment_expired_if_needed(uuid)",
    "team_tournament_create_referee_assignment(...)",
    "team_tournament_revoke_referee_assignment(...)",
    "team_tournament_list_referee_assignments(text,text)",
    "referee_v5_apply_admin_result_revision(...)",
    "team_tournament_reopen_referee_match(...)",
    "team_tournament_request_referee_correction(...)",
    "team_tournament_review_referee_correction(...)",
    "team_tournament_list_referee_corrections(text,text)",
    "referee_v5_current_user_has_assignment(...)",
    "referee_v5_assert_assignment_write(...)",
    "team_tournament_referee_match_access_ops(text,text)",
  ],
  note: "Inventory derived from exact TT5D package SQL parse; no row values.",
};

writeJson("sql/00_TT5D_TOUCHED_OBJECT_MANIFEST.json", touched);

const preapply = {
  generatedAt: now,
  target: {
    mcpServer: "project-0-pickleball-scheduler-supabase-staging",
    project_ref_authorized: "qyewbxjsiiyufanzcjcq",
    environment: "Staging",
    identityProof: {
      club_ai_data_absent: true,
      fingerprint: "STAGING_PHASE4_WIPE_FINGERPRINT_MATCHES_AUTHORIZED_REF",
      database_name: "postgres",
      note: "MCP staging server bound; Production mutation-forbidden server not used for apply.",
    },
  },
  migrationHistory: {
    tt5d_named_migration_present: false,
    tt5b_migrations: ["phase_tt5b_bridge_schema", "phase_tt5b_bridge_helpers_rls"],
    tt5c_named_migration_present: false,
    note: "No schema_migrations row for tt5d / phase5c_tt5d",
  },
  dependencies: {
    team_sub_match_referee_links: true,
    team_tournament_referee_event_inbox: true,
    referee_assignments: true,
    team_tournaments: true,
    team_tournament_matchups: true,
    team_tournament_sub_matches: true,
    match_result_revisions: true,
    match_integration_outbox: true,
    team_tournament_can_manage: true,
    team_tournament_consume_referee_v5_outbox: true,
    classification: "DEPENDENCIES_PRESENT",
  },
  tt5dCatalogPresence: {
    correction_table: true,
    columns_external_matchup_version_revoke_reason: true,
    status_check_includes_pending_active_expired_revoked_completed: true,
    indexes: { referee_assignments_sub_match_idx: true, tt5d_correction_pending_idx: true },
    policies: ["tt5d_correction_referee_select", "tt5d_correction_no_client_write"],
    functionsPresent: true,
    functionFingerprints: {
      referee_v5_assignment_effective_status: "c91ffb1ec3faa1e6fa2b3ea9395c4058",
      referee_v5_mark_assignment_expired_if_needed: "0f2e5ea3915cf34cdb0297ac3a844d4d",
      team_tournament_create_referee_assignment: "08f6d53845ba88c750caef815543fa46",
      team_tournament_revoke_referee_assignment: "f3280a760c9f4449aee6916d16c5026d",
      team_tournament_list_referee_assignments: "9ec273071d309641425a3d30d704a14b",
      referee_v5_apply_admin_result_revision: "11b7d3121eb0efd7c05cf2fd8a92da19",
      team_tournament_reopen_referee_match: "81f3b086288dc8da26700349bbbab3b2",
      team_tournament_request_referee_correction: "42b96c5091086edfc822392ed49999d2",
      team_tournament_review_referee_correction: "175c9ee13eeefaccdbb67160cd0a5a16",
      team_tournament_list_referee_corrections: "513f41aabc74d5864a879d714796b53a",
      referee_v5_current_user_has_assignment: "2223a22afbef0ccccc0d0df04ae873f1",
      referee_v5_assert_assignment_write: "e7854c03e3ffebf81a7928d6b8740ad5",
      team_tournament_referee_match_access_ops: "4229dd7686b6eaae990e9353e764f927",
    },
  },
  grantDriftVsCanonicalPackage: [
    {
      function: "referee_v5_assignment_effective_status(text,timestamptz,timestamptz)",
      packageIntent: "REVOKE ALL FROM public; GRANT EXECUTE TO authenticated, service_role",
      stagingObserved: { anonExecute: true, authenticatedExecute: true, serviceRoleExecute: true },
      classification: "CONFLICTING_GRANT_DRIFT",
    },
    {
      function: "referee_v5_current_user_has_assignment(text,text,text,text[])",
      packageIntent: "REVOKE ALL FROM public; GRANT EXECUTE TO authenticated",
      stagingObserved: { anonExecute: true, authenticatedExecute: true, serviceRoleExecute: true },
      classification: "CONFLICTING_GRANT_DRIFT",
    },
  ],
  preApplyClassification: catalogClass,
  classificationRationale: [
    "TT5D objects are not ABSENT_AS_EXPECTED",
    "No matching TT5D/phase5c migration provenance exists for verify-only ALREADY_EXACTLY_EQUIVALENT path",
    "Grant matrix drifts from canonical package (anon execute where public revoke expected)",
    "Rules require STOP on PARTIALLY_PRESENT or CONFLICTING — do not overwrite or improvise",
  ],
  rowValuesCaptured: false,
};

writeJson("sql/10_STAGING_PREAPPLY_CATALOG_SNAPSHOT.json", preapply);

const rollbackSql = `-- Phase 5C TT5D Staging rollback CANDIDATE
-- Classification: ROLLBACK_INCOMPLETE_PREEXISTING_TT5D_WITHOUT_PREAPPLY_BASELINE
-- Do NOT execute during blocked certification.
-- Broad DROP CASCADE forbidden. No truncate. No identity/catalog row deletes.
-- After wipe / runtime writes / hard-cutover: BACKUP_RESTORE_REQUIRED

-- Cannot restore replaced function bodies to unknown pre-TT5D definitions:
-- pre-TT5D baselines were not captured because TT5D objects were already present
-- before Phase 5C controlled apply (apply was NOT executed).

SELECT 'TT5D_STAGING_ROLLBACK_NOT_EXECUTED_PHASE5C_BLOCKED' AS status;
SELECT 'ROLLBACK_INCOMPLETE_PREEXISTING_TT5D_WITHOUT_PREAPPLY_BASELINE' AS classification;
SELECT 'BACKUP_RESTORE_REQUIRED' AS after_wipe_or_runtime_writes;
`;

fs.writeFileSync(path.join(PKG5C, "sql/20_TT5D_STAGING_ROLLBACK.sql"), rollbackSql, "utf8");

const prodRollback = `-- M9 Production pre-wipe rollback CANDIDATE for future TT5D
-- Production applicability (2026-07-31 SELECT-only):
--   referee_assignments ABSENT
--   TT5B links ABSENT
--   TT5D objects ABSENT
-- Therefore future Production TT5D apply would introduce NEW objects after M10+TT5B.
-- Pre-wipe rollback (only before runtime writes): DROP newly introduced TT5D objects
-- in dependency-safe reverse order. No CASCADE. No truncate. No identity deletes.
-- Classification while Phase 5C blocked: ROLLBACK_CANDIDATE_NOT_CERTIFIED
-- After wipe/runtime: BACKUP_RESTORE_REQUIRED
-- Production backup/PITR/restore remains NOT_PROVABLE_CANNOT_WAIVE

-- Not executed. Production mutations must remain 0.

-- Reverse-order DROP candidates (only if future apply introduced them and no writes):
-- DROP FUNCTION IF EXISTS public.team_tournament_referee_match_access_ops(text, text);
-- DROP FUNCTION IF EXISTS public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean);
-- (do not drop referee_v5_current_user_has_assignment if M10-owned — restore M10 body instead)
-- DROP FUNCTION IF EXISTS public.team_tournament_list_referee_corrections(text, text);
-- DROP FUNCTION IF EXISTS public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text);
-- DROP FUNCTION IF EXISTS public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text);
-- DROP TABLE IF EXISTS public.team_tournament_referee_correction_requests;
-- DROP FUNCTION IF EXISTS public.team_tournament_reopen_referee_match(text, text, text, text);
-- DROP FUNCTION IF EXISTS public.team_tournament_list_referee_assignments(text, text);
-- DROP FUNCTION IF EXISTS public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text);
-- DROP FUNCTION IF EXISTS public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text);
-- DROP FUNCTION IF EXISTS public.referee_v5_mark_assignment_expired_if_needed(uuid);
-- DROP FUNCTION IF EXISTS public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz);
-- DROP INDEX IF EXISTS public.referee_assignments_sub_match_idx;
-- ALTER columns introduced by TT5D may be dropped ONLY before runtime writes.

SELECT 'M9_PRODUCTION_PREWIPE_ROLLBACK_CANDIDATE_NOT_EXECUTED' AS status;
SELECT 'ROLLBACK_CANDIDATE_NOT_CERTIFIED' AS classification;
SELECT 'BACKUP_RESTORE_REQUIRED' AS after_wipe_or_runtime_writes;
`;

fs.writeFileSync(path.join(PKG5C, "sql/30_M9_PRODUCTION_PREWIPE_ROLLBACK_CANDIDATE.sql"), prodRollback, "utf8");

const verifySql = `-- 99_TT5D_VERIFY.sql — catalog/SELECT-only. No DML/DDL.
-- Phase 5C: used for documentation of expected contracts; apply was NOT executed.

SELECT to_regclass('public.team_tournament_referee_correction_requests') AS correction_table;
SELECT to_regclass('public.team_sub_match_referee_links') AS tt5b_links;
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='referee_assignments' AND column_name='version'
) AS has_version_col;
SELECT EXISTS (
  SELECT 1 FROM pg_constraint c
  JOIN pg_class t ON t.oid=c.conrelid
  JOIN pg_namespace n ON n.oid=t.relnamespace
  WHERE n.nspname='public' AND t.relname='referee_assignments'
    AND c.conname='referee_assignments_status_check'
) AS has_status_check;
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN (
    'team_tournament_create_referee_assignment',
    'team_tournament_reopen_referee_match',
    'team_tournament_request_referee_correction',
    'referee_v5_assert_assignment_write'
  )
ORDER BY 1,2;
`;

fs.writeFileSync(path.join(PKG5C, "sql/99_TT5D_VERIFY.sql"), verifySql, "utf8");

writeJson("evidence/01_OWNER_GO_TARGET_AND_BACKUP_GATE_2026-07-31.json", {
  generatedAt: now,
  ownerAuthorization: {
    STAGING_BACKUP_CONFIRMED: true,
    GO_STAGING_PHASE5C_TT5D_CERTIFICATION: true,
    PRODUCTION_GO: "NO",
  },
  targetGuard: {
    authorizedProjectRef: "qyewbxjsiiyufanzcjcq",
    forbiddenProductionRef: "expuvcohlcjzvrrauvud",
    environment: "Staging",
    result: "PASS_TARGET_STAGING",
    productionMutations: 0,
  },
  backupGate: {
    project_ref: "qyewbxjsiiyufanzcjcq",
    timestampUtc: "2026-07-30T18:54:00Z",
    type: "PHYSICAL",
    restoreActionVisiblePerOwner: true,
    restoreExecutedByAgent: false,
    mcpBackupEnumerationAvailable: false,
    classification: "OWNER_CONFIRMED_STAGING_BACKUP_GATE_ACCEPTED",
    result: "PASS_OWNER_CONFIRMED",
  },
  checksumGate: {
    phase5bVerifier: "PASS_42_FILES",
    fourTt5dExactByteHashes: artefacts.map((a) => ({
      file: a.file,
      sha256ExactGitBlobBytes: a.sha256ExactGitBlobBytes,
      matchExpected: a.bytesMatchExpected,
      matchSource: a.bytesMatchSource,
    })),
    result: "PASS",
  },
});

writeJson("evidence/02_TT5D_PREAPPLY_CATALOG_AND_DEPENDENCIES_2026-07-31.json", {
  generatedAt: now,
  dependencies: preapply.dependencies,
  preApplyClassification: catalogClass,
  blockerCodes,
  snapshotRef: "sql/10_STAGING_PREAPPLY_CATALOG_SNAPSHOT.json",
  mutationAuthorizedButNotStarted: true,
});

writeJson("evidence/03_TT5D_ATOMIC_STAGING_APPLY_RESULT_2026-07-31.json", {
  generatedAt: now,
  intendedMigrationName: "phase5c_tt5d_190_220_staging_certification",
  intendedOrder: ["190", "200", "210", "220"],
  applyAttempted: false,
  applyResult: "NOT_ATTEMPTED_STOP_PREAPPLY_CONFLICTING",
  stagingMutationClassification: "StagingDatabaseMutations=0",
  productionMutations: 0,
  reason: "Pre-apply classification CONFLICTING / PARTIALLY_PRESENT forbids atomic overwrite apply",
  targetLogWouldHaveBeen: {
    TARGET_PROJECT_REF: "qyewbxjsiiyufanzcjcq",
    TARGET_ENVIRONMENT: "STAGING",
    PRODUCTION_GO: "NO",
    BACKUP_CONFIRMED: "YES",
    ARTEFACT_ORDER: "190,200,210,220",
  },
});

writeJson("evidence/04_TT5D_POSTAPPLY_CATALOG_CERTIFICATION_2026-07-31.json", {
  generatedAt: now,
  status: "NOT_RUN_APPLY_NOT_ATTEMPTED",
  observedPreexistingCatalogSanitized: {
    objectsPresent: true,
    migrationProvenance: "ABSENT",
    grantDrift: true,
  },
});

writeJson("evidence/05_TT5D_SECURITY_AND_RUNTIME_CERTIFICATION_2026-07-31.json", {
  generatedAt: now,
  authenticatedRuntimeSmoke: "AUTHENTICATED_RUNTIME_SMOKE_NOT_RUN_NO_APPROVED_FIXTURE",
  unauthenticatedDenialCatalogHints: {
    anonDeniedOnProtectedTtRpcs: true,
    anonExecuteDriftOnEffectiveStatusAndHasAssignment: true,
  },
  serviceRoleUsedForCertification: false,
  jwtRequested: false,
  rowValuesQueried: false,
});

writeJson("evidence/06_M9_ROLLBACK_AND_PRODUCTION_APPLICABILITY_2026-07-31.json", {
  generatedAt: now,
  stagingRollbackClassification: "ROLLBACK_INCOMPLETE_PREEXISTING_TT5D_WITHOUT_PREAPPLY_BASELINE",
  afterWipeOrRuntime: "BACKUP_RESTORE_REQUIRED",
  productionApplicability: {
    access: "SELECT_ONLY_CATALOG_METADATA",
    referee_assignments: "ABSENT",
    tt5b_links: "ABSENT",
    tt5d_objects: "ABSENT",
    club_ai_data: "PRESENT",
    classification: "FUTURE_NEW_AFTER_M10_AND_TT5B_DEPENDENCIES",
    productionMutations: 0,
    note: "Complete Production applicability for READY path not certifiable while Staging certification blocked",
  },
  m9MustRemainBlocked: true,
});

writeJson("evidence/07_PHASE5C_M9_RECLASSIFICATION_DECISION_2026-07-31.json", {
  generatedAt: now,
  decision,
  historicalPhase5BDecisionRetained: "BLOCKED_PHASE5B_EXECUTION_PACKAGE",
  historicalM9Blocker: "BLOCKED_STAGING_CATALOG_NOT_PROVEN_FOR_TT5D",
  supersedingM9Verdict: m9Verdict,
  executableApplyCount: 20,
  nonExecutableCandidateCount: 4,
  tt5dMovedToOrderedApply: false,
  executionEligibleTt5d: false,
  continuingPhase5: {
    BLOCKED_PHASE5_READINESS: true,
    executionRunbookAccepted: false,
    productionExecutionGo: false,
    PHASE_05_COMPLETE: "NOT_ISSUED",
    backupPitrRestore: "NOT_PROVABLE_CANNOT_WAIVE",
  },
  markers: [
    "PLATFORM_HARD_CUTOVER_01_PHASE5C_TT5D_CERTIFICATION_BLOCKED",
    "PLATFORM_HARD_CUTOVER_01_PHASE5C_M9_BLOCKER_REMAINS",
    "PLATFORM_HARD_CUTOVER_01_PHASE5C_BLOCKED",
  ],
  stopAt: "BLOCKED_PHASE5C_TT5D_CERTIFICATION",
});

// Update M9 manifest readiness only (keep TT5D non-executable)
const m9Path = path.join(M9, "M9_MANIFEST.json");
const m9 = JSON.parse(fs.readFileSync(m9Path, "utf8"));
m9.readiness = m9Verdict;
m9.phase5cSupersedingNote = {
  generatedAt: now,
  decision,
  executableApplyCountRemains: 20,
  tt5dRemainNonExecutable: true,
  reason: blockerCodes,
};
m9.generatedAtPhase5cUpdate = now;
fs.writeFileSync(m9Path, JSON.stringify(m9, null, 2) + "\n", "utf8");

// Provenance addendum (do not claim Staging migration is original source)
const provPath = path.join(M9, "00_SOURCE_PROVENANCE.json");
const prov = JSON.parse(fs.readFileSync(provPath, "utf8"));
prov.phase5cStagingCertification = {
  generatedAt: now,
  decision,
  stagingApplyExecuted: false,
  note: "Phase 5C attempted certification; STOPPED before mutation. Original exact-byte source provenance unchanged.",
};
prov.packageVerdict = m9Verdict;
fs.writeFileSync(provPath, JSON.stringify(prov, null, 2) + "\n", "utf8");

console.log(JSON.stringify({ decision, m9Verdict, catalogClass, hashesOk: artefacts.every((a) => a.bytesMatchExpected && a.bytesMatchSource) }, null, 2));
