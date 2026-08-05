/**
 * RATING-V5-CUTOVER-02 Gate A3c — controlled Staging fixture preparation tests.
 * Local only — executeMutations defaults false (STAGING_MUTATIONS=0).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CUTOVER_02_PRODUCTION_PROJECT_REF,
  CUTOVER_02_STAGING_PROJECT_REF,
} from "../src/features/player-rating/cutover-02/config/environmentGuards.js";
import {
  FIXTURE_PREP_OUTCOME,
  FIXTURE_COHORT_LABEL,
  FIXTURE_PREP_VERSION,
  FIXTURE_CALIBRATION_PERMISSION,
  MAPPING_STATUS,
  NORMALIZED_EQUIVALENCE,
  MUTATION_BUDGET,
  SELECTED_ARCHITECTURE,
  DIRECT_RPC_BYPASS_STATUS,
  FIXTURE_CANDIDATES,
  APPROVED_ID_HASHES,
  assertAllFixtureScoresMatchTargets,
  scoreFixtureAnswers,
  buildFixtureAnswers,
  evaluateProjectGuard,
  evaluateCallerGuard,
  evaluateCohortGuard,
  evaluateTargetGuard,
  evaluateValueGuard,
  classifyPreparationState,
  buildCohortWriteModel,
  evaluateMutationBudget,
  buildRedactedPrepAudit,
  buildRollbackRunbook,
  isRollbackTargetInScope,
  prepareStagingFixtureCandidate,
  isFixturePrepPathEnabled,
  FIXTURE_PREP_ENV_NAME,
  invokeFixturePrepFromBrowser,
  browserFixturePrepForbiddenPatterns,
} from "../src/features/player-rating/cutover-02/fixture-prep/index.js";
import { evidenceContainsForbiddenPii as evidencePii } from "../src/features/player-rating/cutover-02/evidence/sanitizeEvidence.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const STAGING_ENV = Object.freeze({
  VITE_APP_ENV: "staging",
  VITE_SUPABASE_URL: `https://${CUTOVER_02_STAGING_PROJECT_REF}.supabase.co`,
  [FIXTURE_PREP_ENV_NAME]: "true",
});

const PRODUCTION_ENV = Object.freeze({
  VITE_APP_ENV: "production",
  VITE_SUPABASE_URL: `https://${CUTOVER_02_PRODUCTION_PROJECT_REF}.supabase.co`,
  [FIXTURE_PREP_ENV_NAME]: "true",
});

function approvedTarget(fixture = FIXTURE_CANDIDATES[0], overrides = {}) {
  return {
    profileId: "11111111-1111-4111-8111-111111111111",
    authUserId: "11111111-1111-4111-8111-111111111111",
    active: true,
    existsInAuth: true,
    existsInProfiles: true,
    emailLooksLikeWave1Fixture: true,
    idHash: fixture.idHash,
    candidateLabel: fixture.label,
    isProductionIdentity: false,
    ...overrides,
  };
}

function superAdminCaller(overrides = {}) {
  return {
    authenticated: true,
    callerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    isSuperAdmin: true,
    permissions: [],
    isAnonymous: false,
    isServiceRoleOnlyAnonymous: false,
    ...overrides,
  };
}

async function prepare(overrides = {}, ports = {}) {
  const fixture = overrides.fixture || FIXTURE_CANDIDATES[0];
  return prepareStagingFixtureCandidate(
    {
      env: STAGING_ENV,
      enabled: true,
      executeMutations: false,
      cohortLabel: FIXTURE_COHORT_LABEL,
      caller: superAdminCaller(),
      target: approvedTarget(fixture),
      v2Raw: fixture.v2Raw,
      v5TargetDisplay: fixture.v5TargetDisplay,
      ...overrides,
    },
    ports
  );
}

test("A3c setup — fixture scores match targets", () => {
  const check = assertAllFixtureScoresMatchTargets();
  assert.equal(check.ok, true);
  assert.equal(FIXTURE_CANDIDATES.length, 5);
  assert.equal(APPROVED_ID_HASHES.length, 5);
});

test("1) Feature/preparation path unavailable by default", () => {
  assert.equal(isFixturePrepPathEnabled({}), false);
  assert.equal(
    isFixturePrepPathEnabled({
      VITE_APP_ENV: "staging",
      VITE_SUPABASE_URL: `https://${CUTOVER_02_STAGING_PROJECT_REF}.supabase.co`,
    }),
    false
  );
});

test("2) Production project always denied", async () => {
  const project = evaluateProjectGuard(PRODUCTION_ENV);
  assert.equal(project.ok, false);
  assert.equal(project.code, FIXTURE_PREP_OUTCOME.WRONG_PROJECT);
  const result = await prepareStagingFixtureCandidate({
    env: PRODUCTION_ENV,
    enabled: true,
    caller: superAdminCaller(),
    target: approvedTarget(),
    cohortLabel: FIXTURE_COHORT_LABEL,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, FIXTURE_PREP_OUTCOME.FEATURE_DISABLED);
});

test("3) Wrong Staging project denied", () => {
  const project = evaluateProjectGuard(
    {
      VITE_APP_ENV: "staging",
      VITE_SUPABASE_URL: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co",
    },
    { projectRef: "aaaaaaaaaaaaaaaaaaaa" }
  );
  assert.equal(project.ok, false);
  assert.equal(project.code, FIXTURE_PREP_OUTCOME.WRONG_PROJECT);
});

test("4) Missing project identity denied", () => {
  const project = evaluateProjectGuard({ VITE_APP_ENV: "staging" }, {});
  assert.equal(project.ok, false);
  assert.match(String(project.reason), /MISSING/);
});

test("5) Anonymous caller denied", () => {
  const caller = evaluateCallerGuard({ authenticated: false, isAnonymous: true });
  assert.equal(caller.ok, false);
  assert.equal(caller.code, FIXTURE_PREP_OUTCOME.UNAUTHORIZED_CALLER);
});

test("6) Ordinary authenticated user denied", () => {
  const caller = evaluateCallerGuard({
    authenticated: true,
    callerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    isSuperAdmin: false,
    permissions: [],
  });
  assert.equal(caller.ok, false);
});

test("7) SUPER_ADMIN caller allowed through trusted boundary", async () => {
  const result = await prepare();
  assert.equal(result.ok, true);
  assert.equal(result.code, FIXTURE_PREP_OUTCOME.PREPARED);
});

test("8) Required calibration permission accepted", () => {
  const caller = evaluateCallerGuard({
    authenticated: true,
    callerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    isSuperAdmin: false,
    permissions: [FIXTURE_CALIBRATION_PERMISSION],
  });
  assert.equal(caller.ok, true);
  assert.equal(caller.via, "CALIBRATION_MANAGE");
});

test("9) Candidate JWT not required", async () => {
  const result = await prepare();
  assert.equal(result.candidateJwtRequired, false);
});

test("10) Candidate password not required", async () => {
  const result = await prepare();
  assert.equal(result.candidatePasswordRequired, false);
});

test("11) Service-role key never exposed to browser code", () => {
  const clientSrc = readFileSync(
    path.join(
      root,
      "src/features/player-rating/cutover-02/fixture-prep/clientInvoke.js"
    ),
    "utf8"
  );
  const publicSrc = readFileSync(
    path.join(root, "src/features/player-rating/cutover-02/fixture-prep/public.js"),
    "utf8"
  );
  // Must not read or embed the service role env key
  assert.doesNotMatch(clientSrc, /Deno\.env\.get\(\s*["']SUPABASE_SERVICE_ROLE/);
  assert.doesNotMatch(clientSrc, /process\.env\.SUPABASE_SERVICE_ROLE/);
  assert.doesNotMatch(publicSrc, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(clientSrc, /VITE_.*SERVICE_ROLE/);
  // Helper rejects service-role-shaped env/body keys
  const patterns = browserFixturePrepForbiddenPatterns();
  assert.ok(patterns.includes(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_")));
});

test("12) Arbitrary target player denied", () => {
  const target = evaluateTargetGuard(
    approvedTarget(FIXTURE_CANDIDATES[0], {
      idHash: "deadbeef0001",
      candidateLabel: undefined,
    })
  );
  assert.equal(target.ok, false);
  assert.equal(target.code, FIXTURE_PREP_OUTCOME.TARGET_NOT_APPROVED);
});

test("13) Non-fixture identity denied", () => {
  const target = evaluateTargetGuard(
    approvedTarget(FIXTURE_CANDIDATES[0], {
      emailLooksLikeWave1Fixture: false,
    })
  );
  assert.equal(target.ok, false);
});

test("14) Candidate outside fixed five denied", () => {
  assert.equal(APPROVED_ID_HASHES.includes("ffffffffffff"), false);
  const target = evaluateTargetGuard({
    ...approvedTarget(),
    idHash: "ffffffffffff",
  });
  assert.equal(target.ok, false);
});

test("15) Wrong cohort label denied", () => {
  const cohort = evaluateCohortGuard("phase4-owner-acceptance");
  assert.equal(cohort.ok, false);
  assert.equal(cohort.code, FIXTURE_PREP_OUTCOME.WRONG_COHORT);
});

test("16) Invalid V2 raw value denied", () => {
  const value = evaluateValueGuard({
    fixture: FIXTURE_CANDIDATES[0],
    v2Raw: 9.9,
    v5TargetDisplay: FIXTURE_CANDIDATES[0].v5TargetDisplay,
  });
  assert.equal(value.ok, false);
  assert.equal(value.code, FIXTURE_PREP_OUTCOME.INVALID_V2_VALUE);
});

test("17) Invalid V5 fixture input denied", () => {
  const value = evaluateValueGuard({
    fixture: FIXTURE_CANDIDATES[0],
    v2Raw: FIXTURE_CANDIDATES[0].v2Raw,
    v5TargetDisplay: 1.9,
  });
  assert.equal(value.ok, false);
  assert.equal(value.code, FIXTURE_PREP_OUTCOME.INVALID_V5_FIXTURE_INPUT);
});

test("18) Mapping remains UNAPPROVED", async () => {
  const result = await prepare();
  assert.equal(result.mappingStatus, MAPPING_STATUS);
  assert.equal(MAPPING_STATUS, "UNAPPROVED");
});

test("19) Normalized equivalence remains disabled", async () => {
  const result = await prepare();
  assert.equal(result.normalizedEquivalence, NORMALIZED_EQUIVALENCE);
  assert.equal(NORMALIZED_EQUIVALENCE, "DISABLED");
});

test("20) Canonical scorer used", () => {
  for (const fixture of FIXTURE_CANDIDATES) {
    const scored = scoreFixtureAnswers(fixture);
    assert.equal(scored.matches, true);
    assert.equal(Object.keys(buildFixtureAnswers(fixture)).length, 22);
  }
  assert.equal(SELECTED_ARCHITECTURE, "A_EDGE_ORCHESTRATION_PLUS_SERVICE_ROLE_RPC");
});

test("21) V5 output remains is_shadow=true", async () => {
  const result = await prepare();
  assert.equal(result.isShadow, true);
});

test("22) V2 remains published authority", async () => {
  const result = await prepare();
  assert.equal(result.publishedAuthority, "V2");
});

test("23) No rollout config mutation", async () => {
  const result = await prepare();
  assert.equal(result.rolloutConfigMutated, false);
  assert.equal(MUTATION_BUDGET.ROLLOUT_CONFIG_CHANGES, 0);
});

test("24) Existing phase4 pilot remains untouched", async () => {
  const result = await prepare();
  assert.equal(result.phase4PilotUntouched, true);
  assert.equal(MUTATION_BUDGET.CURRENT_PHASE4_PILOT_CHANGES, 0);
});

test("25) First preparation returns PREPARED", async () => {
  const result = await prepare();
  assert.equal(result.code, FIXTURE_PREP_OUTCOME.PREPARED);
  assert.equal(result.ok, true);
});

test("26) Identical retry returns ALREADY_PREPARED", async () => {
  const result = await prepareStagingFixtureCandidate(
    {
      env: STAGING_ENV,
      enabled: true,
      executeMutations: false,
      cohortLabel: FIXTURE_COHORT_LABEL,
      caller: superAdminCaller(),
      target: approvedTarget(),
      v2Raw: FIXTURE_CANDIDATES[0].v2Raw,
      v5TargetDisplay: FIXTURE_CANDIDATES[0].v5TargetDisplay,
    },
    {
      loadTargetState: async () => ({
        hasEnrollment: true,
        hasV2Row: true,
        hasDraftAssessment: false,
        hasCompletedAssessment: true,
        hasV5ShadowProfile: true,
        hasConflictingCompletedV5OutsidePrep: false,
        prepAuditStatus: "PREPARED",
        beforeParts: { enrollment: "present" },
        tenantId: "platform",
        phase4PilotUntouched: true,
      }),
    }
  );
  assert.equal(result.code, FIXTURE_PREP_OUTCOME.ALREADY_PREPARED);
  assert.equal(result.idempotent, true);
});

test("27) Retry does not duplicate assessments/events/profiles", async () => {
  let createCalls = 0;
  const result = await prepareStagingFixtureCandidate(
    {
      env: STAGING_ENV,
      enabled: true,
      executeMutations: true,
      cohortLabel: FIXTURE_COHORT_LABEL,
      caller: superAdminCaller(),
      target: approvedTarget(),
      v2Raw: FIXTURE_CANDIDATES[0].v2Raw,
      v5TargetDisplay: FIXTURE_CANDIDATES[0].v5TargetDisplay,
    },
    {
      loadTargetState: async () => ({
        hasEnrollment: true,
        hasV2Row: true,
        hasCompletedAssessment: true,
        hasV5ShadowProfile: true,
        prepAuditStatus: "PREPARED",
        beforeParts: {},
        tenantId: "platform",
        phase4PilotUntouched: true,
      }),
      createDraftAssessment: async () => {
        createCalls += 1;
        return { ok: true, assessment: { id: "x" }, wrote: 1 };
      },
    }
  );
  assert.equal(result.code, FIXTURE_PREP_OUTCOME.ALREADY_PREPARED);
  assert.equal(createCalls, 0);
});

test("28) Partial pre-existing state returns PARTIAL_STATE_BLOCKED", () => {
  const state = classifyPreparationState({
    hasEnrollment: true,
    hasV2Row: false,
    hasCompletedAssessment: false,
    hasV5ShadowProfile: false,
    cohortLabel: FIXTURE_COHORT_LABEL,
  });
  assert.equal(state.outcome, FIXTURE_PREP_OUTCOME.PARTIAL_STATE_BLOCKED);
  assert.equal(state.proceed, false);
});

test("29) Existing conflicting V5 completion returns COLLISION_BLOCKED", () => {
  const state = classifyPreparationState({
    hasConflictingCompletedV5OutsidePrep: true,
    cohortLabel: FIXTURE_COHORT_LABEL,
  });
  assert.equal(state.outcome, FIXTURE_PREP_OUTCOME.COLLISION_BLOCKED);
});

test("30) Score output mismatch returns SCORE_OUTPUT_MISMATCH", async () => {
  const result = await prepareStagingFixtureCandidate(
    {
      env: STAGING_ENV,
      enabled: true,
      executeMutations: false,
      cohortLabel: FIXTURE_COHORT_LABEL,
      caller: superAdminCaller(),
      target: approvedTarget(),
      v2Raw: FIXTURE_CANDIDATES[0].v2Raw,
      v5TargetDisplay: FIXTURE_CANDIDATES[0].v5TargetDisplay,
    },
    {
      scoreFixtureAnswers: () => ({
        answers: {},
        scored: {},
        display: 9.9,
        expectedDisplay: 2.2,
        matches: false,
      }),
    }
  );
  assert.equal(result.code, FIXTURE_PREP_OUTCOME.SCORE_OUTPUT_MISMATCH);
  assert.equal(result.ok, false);
});

test("31) Mutation budget overflow denied", () => {
  const budget = evaluateMutationBudget({
    enrollmentRows: 6,
    v2PrimaryRows: 0,
    v5ProfileRows: 0,
    evidenceRows: 0,
    totalDurableWrites: 0,
  });
  assert.equal(budget.ok, false);
});

test("32) Audit payload is redacted", () => {
  const audit = buildRedactedPrepAudit({
    candidateLabel: "CANDIDATE-01",
    candidateIdHash: "e97fa28f4a36",
    cohortLabel: FIXTURE_COHORT_LABEL,
    email: "secret@example.com",
    password: "nope",
    // Sensitive keys must never appear in audit payload (dropped + sanitized).
    access_token: "redacted-probe-value",
    service_role: "must-not-leak",
    callerIdHash: "abcd",
    outcome: "PREPARED",
    createdUpdatedRowCounts: {
      durable: 1,
      password: "x",
      access_token: "y",
    },
  });
  assert.equal(audit.payload.email, undefined);
  assert.equal(audit.payload.password, undefined);
  assert.equal(audit.payload.access_token, undefined);
  assert.equal(audit.payload.service_role, undefined);
  assert.equal(audit.payload.createdUpdatedRowCounts.password, "[REDACTED]");
  assert.equal(audit.payload.createdUpdatedRowCounts.access_token, "[REDACTED]");
  assert.equal(evidencePii(audit.payload), false);
  assert.equal(audit.containsForbiddenPii, false);
  assert.doesNotMatch(JSON.stringify(audit.payload), /secret@example\.com/);
});

test("33) Rollback targets exact preparation run", () => {
  const runbook = buildRollbackRunbook();
  assert.equal(runbook.ROLLBACK_TARGETS_EXACT_FIVE_CANDIDATES, true);
  assert.deepEqual(runbook.scope.idHashes, APPROVED_ID_HASHES);
  assert.equal(runbook.scope.cohortLabel, FIXTURE_COHORT_LABEL);
  assert.equal(runbook.scope.preparationVersion, FIXTURE_PREP_VERSION);
});

test("34) Rollback preserves unrelated rating data", () => {
  const runbook = buildRollbackRunbook();
  assert.equal(runbook.v2.never, "blanket_delete_rating_rows");
  assert.ok(runbook.enrollment.preserve.includes("phase4-owner-acceptance"));
  assert.equal(runbook.v5.doNotTouchOutsidePrepRun, true);
  const outside = isRollbackTargetInScope({
    projectRef: CUTOVER_02_STAGING_PROJECT_REF,
    cohortLabel: "phase4-owner-acceptance",
    idHash: "e97fa28f4a36",
  });
  assert.equal(outside.ok, false);
});

test("35) Error path rolls back transaction", async () => {
  let rolled = false;
  const result = await prepareStagingFixtureCandidate(
    {
      env: STAGING_ENV,
      enabled: true,
      executeMutations: true,
      cohortLabel: FIXTURE_COHORT_LABEL,
      caller: superAdminCaller(),
      target: approvedTarget(),
      v2Raw: FIXTURE_CANDIDATES[0].v2Raw,
      v5TargetDisplay: FIXTURE_CANDIDATES[0].v5TargetDisplay,
    },
    {
      loadTargetState: async () => ({
        hasEnrollment: false,
        hasV2Row: false,
        hasCompletedAssessment: false,
        hasV5ShadowProfile: false,
        prepAuditStatus: null,
        beforeParts: {},
        tenantId: "platform",
        phase4PilotUntouched: true,
      }),
      upsertEnrollment: async () => ({ ok: false, code: "ENROLL_FAIL" }),
      rollbackTransaction: async () => {
        rolled = true;
        return { ok: true };
      },
    }
  );
  assert.equal(result.code, FIXTURE_PREP_OUTCOME.INTERNAL_ERROR_ROLLED_BACK);
  assert.equal(rolled, true);
});

test("36) No Staging mutation occurs in local unit tests (default)", async () => {
  const result = await prepare();
  assert.equal(result.stagingMutations, 0);
  assert.equal(result.executeMutations, false);
  assert.equal(result.dryRun, true);
});

test("37) Direct database RPC bypass denied or documented", () => {
  assert.equal(DIRECT_RPC_BYPASS_STATUS.BROWSER_AUTHENTICATED, "DENIED");
  assert.equal(DIRECT_RPC_BYPASS_STATUS.ANON, "DENIED");
  assert.equal(DIRECT_RPC_BYPASS_STATUS.SERVICE_ROLE_WITHOUT_CALLER, "DENIED_BY_RPC_GUARD");
  assert.ok(String(DIRECT_RPC_BYPASS_STATUS.UNRESOLVED_RESIDUAL).length > 10);
  const sql = readFileSync(
    path.join(
      root,
      "docs/v5/rating-v5/cutover-02/sql/RATING_V5_CUTOVER_02_A3C_FIXTURE_PREP.sql"
    ),
    "utf8"
  );
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/);
  assert.match(sql, /no anon/i);
  assert.doesNotMatch(sql, /GRANT EXECUTE[\s\S]*TO authenticated/i);
  assert.doesNotMatch(sql, /GRANT EXECUTE[\s\S]*TO anon/i);
});

test("38) Normal player self-assessment flow unchanged (start still auth.uid self)", () => {
  const foundation = readFileSync(
    path.join(root, "docs/v5/rating-v5/PHASE_V5A_RATING_FOUNDATION.sql"),
    "utf8"
  );
  assert.match(foundation, /rating_v5_start_assessment/);
  assert.match(foundation, /v_uid uuid := auth\.uid\(\)/);
  // A3c adds parallel service path; does not rewrite start_assessment in author SQL
  const a3cSql = readFileSync(
    path.join(
      root,
      "docs/v5/rating-v5/cutover-02/sql/RATING_V5_CUTOVER_02_A3C_FIXTURE_PREP.sql"
    ),
    "utf8"
  );
  assert.doesNotMatch(a3cSql, /create or replace function public\.rating_v5_start_assessment/i);
});

test("39) Existing V5 service persistence behavior unchanged", () => {
  const persist = readFileSync(
    path.join(root, "docs/v5/rating-v5/PHASE_V5B1P_PERSISTENCE_AND_EDGE.sql"),
    "utf8"
  );
  assert.match(persist, /rating_v5_service_persist_assessment_completion/);
  const a3cSql = readFileSync(
    path.join(
      root,
      "docs/v5/rating-v5/cutover-02/sql/RATING_V5_CUTOVER_02_A3C_FIXTURE_PREP.sql"
    ),
    "utf8"
  );
  assert.doesNotMatch(
    a3cSql,
    /create or replace function public\.rating_v5_service_persist_assessment_completion/i
  );
});

test("40) Production runtime flags/readers/writers unchanged", () => {
  assert.equal(isFixturePrepPathEnabled(PRODUCTION_ENV), false);
  const model = buildCohortWriteModel();
  assert.equal(model.MUTATION_BUDGET_REQUIRES_OWNER_REVISION, false);
  assert.ok(model.TOTAL_DURABLE_WRITE_CEILING <= 40);
  assert.equal(SELECTED_ARCHITECTURE.startsWith("A_"), true);
});

test("A3c browser invoke disabled by default", async () => {
  const result = await invokeFixturePrepFromBrowser({
    env: { VITE_APP_ENV: "staging" },
    accessToken: "token",
  });
  assert.equal(result.code, FIXTURE_PREP_OUTCOME.FEATURE_DISABLED);
});

test("A3c service-role-only anonymous denied", () => {
  const caller = evaluateCallerGuard({
    isServiceRoleOnlyAnonymous: true,
    authenticated: true,
    callerId: "x",
    isSuperAdmin: true,
  });
  assert.equal(caller.ok, false);
});

test("A3c mutation model within provisional ceiling", () => {
  const model = buildCohortWriteModel();
  assert.ok(model.expected.total_durable_writes_with_one_idempotent_retry_each.max <= 40);
  assert.ok(model.expected.v5_assessment_event_evidence_rows.max <= 25);
});
