/**
 * RATING-V5-CUTOVER-02 — Dual-read compare + writer-freeze focused tests.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { getPlayerCurrentRating } from "../src/models/player.js";
import {
  CUTOVER_02_ENV_NAMES,
  CUTOVER_02_PRODUCTION_PROJECT_REF,
  CUTOVER_02_STAGING_PROJECT_REF,
  CUTOVER_02_WRITER_ID,
  DUAL_READ_COMPARE_OUTCOME,
  SCALE_MAPPING_STATUS,
  SCALE_MAPPING_STRATEGY,
  WRITER_FREEZE_MODE,
  WRITER_FREEZE_BLOCK_CODE,
  comparePublishedRatingDualRead,
  getPublishedRatingWithOptionalCompare,
  classifyDualReadCompareOutcome,
  resolveCutover02Config,
  resolveScaleMappingPolicy,
  compareRawRatingPair,
  evaluateWriterFreezeAttempt,
  withWriterFreezeGuard,
  evaluateStagingEnvironmentProof,
  isProductionDenyActive,
  hashPlayerIdForEvidence,
  sanitizeEvidenceValue,
  evidenceContainsForbiddenPii,
  buildReconciliationReport,
  CUTOVER_02_WRITER_INVENTORY,
  listStagingFreezeTargets,
  __resetDualReadEvidenceForTests,
  __getDualReadEvidenceForTests,
  __resetWriterFreezeAttemptsForTests,
  __getWriterFreezeAttemptsForTests,
} from "../src/features/player-rating/cutover-02/index.js";
import {
  rpcPickVnSyncRating,
  __setPickVnRatingRpcClientForTests,
  __resetPickVnRatingRpcClientForTests,
} from "../src/features/pick-vn-rating/services/pickVnRatingRpcService.js";

const STAGING_ENV = Object.freeze({
  VITE_APP_ENV: "staging",
  VITE_SUPABASE_URL: `https://${CUTOVER_02_STAGING_PROJECT_REF}.supabase.co`,
});

const PRODUCTION_ENV = Object.freeze({
  VITE_APP_ENV: "production",
  VITE_SUPABASE_URL: `https://${CUTOVER_02_PRODUCTION_PROJECT_REF}.supabase.co`,
  [CUTOVER_02_ENV_NAMES.DUAL_READ_COMPARE]: "true",
  [CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE]: "ENFORCE",
});

function stagingEnv(overrides = {}) {
  return { ...STAGING_ENV, ...overrides };
}

test("CUTOVER-02 setup resets sinks", () => {
  __resetDualReadEvidenceForTests();
  __resetWriterFreezeAttemptsForTests();
  __resetPickVnRatingRpcClientForTests();
});

test("1) Published response remains V2 when compare OFF", () => {
  const player = { id: "p1", current_rating: 4.0 };
  const env = stagingEnv({ [CUTOVER_02_ENV_NAMES.DUAL_READ_COMPARE]: "false" });
  const result = comparePublishedRatingDualRead({
    player,
    playerId: "p1",
    v5Record: { id: "v5-1", display_rating: 3.2, player_id: "p1" },
    env,
  });
  assert.equal(result.publishedAuthority, "V2");
  assert.equal(result.publishedRating, 4.0);
  assert.equal(result.compareRan, false);
  assert.equal(getPlayerCurrentRating(player), 4.0);
});

test("2) Published response remains V2 when compare ON", () => {
  __resetDualReadEvidenceForTests();
  const player = { id: "p2", current_rating: 5.0 };
  const env = stagingEnv({ [CUTOVER_02_ENV_NAMES.DUAL_READ_COMPARE]: "true" });
  const result = comparePublishedRatingDualRead({
    player,
    playerId: "p2",
    v5Record: { id: "v5-2", display_rating: 4.1, player_id: "p2" },
    env,
  });
  assert.equal(result.publishedAuthority, "V2");
  assert.equal(result.publishedRating, 5.0);
  assert.equal(result.compareRan, true);
});

test("3) V5 mismatch does not change returned rating", () => {
  const published = getPublishedRatingWithOptionalCompare(
    { id: "p3", current_rating: 3.5 },
    {
      env: stagingEnv({ [CUTOVER_02_ENV_NAMES.DUAL_READ_COMPARE]: "true" }),
      v5Record: { id: "v5-3", display_rating: 2.0, player_id: "p3" },
      playerId: "p3",
    }
  );
  assert.equal(published, 3.5);
});

test("4) V5 missing does not change returned rating", () => {
  const result = comparePublishedRatingDualRead({
    player: { id: "p4", current_rating: 2.5 },
    playerId: "p4",
    v5Record: null,
    env: stagingEnv({ [CUTOVER_02_ENV_NAMES.DUAL_READ_COMPARE]: "true" }),
  });
  assert.equal(result.publishedRating, 2.5);
  assert.equal(
    result.evidence.classification.primary,
    DUAL_READ_COMPARE_OUTCOME.V2_PRESENT_V5_MISSING
  );
});

test("5) V5 read error does not fail user flow", () => {
  const result = comparePublishedRatingDualRead({
    player: { id: "p5", current_rating: 4.5 },
    playerId: "p5",
    v5Record: { __error: "timeout" },
    env: stagingEnv({ [CUTOVER_02_ENV_NAMES.DUAL_READ_COMPARE]: "true" }),
  });
  assert.equal(result.publishedRating, 4.5);
  assert.equal(result.publishedAuthority, "V2");
});

test("6) V2 read error does not promote V5", () => {
  const result = comparePublishedRatingDualRead({
    v2Error: "v2_down",
    playerId: "p6",
    v5Record: { id: "v5-6", display_rating: 5.5, player_id: "p6" },
    env: stagingEnv({ [CUTOVER_02_ENV_NAMES.DUAL_READ_COMPARE]: "true" }),
  });
  assert.equal(result.publishedAuthority, "V2");
  assert.equal(result.publishedRating, null);
  assert.notEqual(result.publishedRating, 5.5);
  assert.equal(
    result.evidence.classification.primary,
    DUAL_READ_COMPARE_OUTCOME.READ_ERROR_V2
  );
});

test("7) Mapping unapproved does not create false equivalence", () => {
  const policy = resolveScaleMappingPolicy({
    status: SCALE_MAPPING_STATUS.UNAPPROVED,
    strategy: SCALE_MAPPING_STRATEGY.RAW_ONLY,
  });
  const cmp = compareRawRatingPair(3.5, 3.5, policy);
  assert.equal(cmp.rawExactMatch, true);
  assert.equal(cmp.normalizedEquivalence, null);
  assert.equal(cmp.equivalenceVerdict, "NO_EQUIVALENCE_MAPPING_UNAPPROVED");
  assert.equal(policy.OWNER_APPROVAL_REQUIRED, "YES");
});

test("8) Invalidated V5 classified correctly", () => {
  const c = classifyDualReadCompareOutcome({
    v2: { present: true, rating: 4 },
    v5: { present: true, rating: 3, invalidated: true },
  });
  assert.equal(c.primary, DUAL_READ_COMPARE_OUTCOME.V5_INVALIDATED);
});

test("9) Out-of-range classified correctly", () => {
  const c = classifyDualReadCompareOutcome({
    v2: { present: true, rating: 9.5 },
    v5: { present: true, rating: 3 },
  });
  assert.equal(c.primary, DUAL_READ_COMPARE_OUTCOME.VALUE_OUT_OF_RANGE);
});

test("10) Tenant mismatch classified correctly", () => {
  const c = classifyDualReadCompareOutcome({
    v2: { present: true, rating: 3, tenantId: "t-a", playerId: "p" },
    v5: { present: true, rating: 3, tenantId: "t-b", playerId: "p" },
    expectedTenantId: "t-a",
  });
  assert.equal(c.primary, DUAL_READ_COMPARE_OUTCOME.TENANT_OR_IDENTITY_MISMATCH);
  assert.ok(c.notes.includes("TENANT_MISMATCH"));
});

test("11) Identity mismatch classified correctly", () => {
  const c = classifyDualReadCompareOutcome({
    v2: { present: true, rating: 3, playerId: "p-a" },
    v5: { present: true, rating: 3, playerId: "p-b" },
    expectedPlayerId: "p-a",
  });
  assert.equal(c.primary, DUAL_READ_COMPARE_OUTCOME.TENANT_OR_IDENTITY_MISMATCH);
  assert.ok(c.notes.includes("IDENTITY_MISMATCH"));
});

test("12) Cohort excluded does not run comparison", () => {
  __resetDualReadEvidenceForTests();
  const result = comparePublishedRatingDualRead({
    player: { id: "outside", current_rating: 3 },
    playerId: "outside",
    v5Record: { id: "v5", display_rating: 3, player_id: "outside" },
    env: stagingEnv({
      [CUTOVER_02_ENV_NAMES.DUAL_READ_COMPARE]: "true",
      [CUTOVER_02_ENV_NAMES.COHORT]: "only-a,only-b",
    }),
  });
  assert.equal(result.compareRan, false);
  assert.equal(__getDualReadEvidenceForTests().length, 0);
});

test("13) Production deny guard keeps behavior OFF", () => {
  assert.equal(isProductionDenyActive(PRODUCTION_ENV), true);
  const cfg = resolveCutover02Config(PRODUCTION_ENV);
  assert.equal(cfg.dualReadCompareEnabled, false);
  assert.equal(cfg.writerFreezeMode, WRITER_FREEZE_MODE.OFF);
  assert.equal(cfg.denyReason, "PRODUCTION_DENY_GUARD");

  const result = comparePublishedRatingDualRead({
    player: { id: "prod-user", current_rating: 4 },
    playerId: "prod-user",
    v5Record: { id: "v5", display_rating: 2, player_id: "prod-user" },
    env: PRODUCTION_ENV,
  });
  assert.equal(result.compareRan, false);
  assert.equal(result.publishedRating, 4);
});

test("14) Freeze OFF does not block writer", () => {
  __resetWriterFreezeAttemptsForTests();
  const d = evaluateWriterFreezeAttempt({
    writerId: CUTOVER_02_WRITER_ID.PICK_VN_SYNC_RATING_RPC,
    env: stagingEnv({ [CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE]: "OFF" }),
  });
  assert.equal(d.blocked, false);
  assert.equal(d.allowed, true);
  assert.equal(d.recorded, false);
});

test("15) Freeze OBSERVE does not block writer", () => {
  const d = evaluateWriterFreezeAttempt({
    writerId: CUTOVER_02_WRITER_ID.PICK_VN_SYNC_RATING_RPC,
    env: stagingEnv({ [CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE]: "OBSERVE" }),
  });
  assert.equal(d.blocked, false);
  assert.equal(d.allowed, true);
});

test("16) Freeze OBSERVE records attempt", () => {
  __resetWriterFreezeAttemptsForTests();
  evaluateWriterFreezeAttempt({
    writerId: CUTOVER_02_WRITER_ID.PICK_VN_SYNC_RATING_RPC,
    env: stagingEnv({ [CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE]: "OBSERVE" }),
  });
  assert.equal(__getWriterFreezeAttemptsForTests().length, 1);
  assert.equal(__getWriterFreezeAttemptsForTests()[0].blocked, false);
});

test("17) Freeze ENFORCE blocks targeted legacy writer", () => {
  const d = evaluateWriterFreezeAttempt({
    writerId: CUTOVER_02_WRITER_ID.PICK_VN_SYNC_RATING_RPC,
    env: stagingEnv({ [CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE]: "ENFORCE" }),
  });
  assert.equal(d.blocked, true);
  assert.equal(d.code, WRITER_FREEZE_BLOCK_CODE);
});

test("18) Freeze ENFORCE does not block V5 shadow writer", () => {
  const d = evaluateWriterFreezeAttempt({
    writerId: CUTOVER_02_WRITER_ID.V5_PERSIST_ASSESSMENT,
    env: stagingEnv({ [CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE]: "ENFORCE" }),
  });
  assert.equal(d.blocked, false);
  assert.equal(d.allowed, true);
});

test("19) Freeze ENFORCE does not block unrelated writer", () => {
  const d = evaluateWriterFreezeAttempt({
    writerId: CUTOVER_02_WRITER_ID.CC02_COMPETITION_ELO,
    env: stagingEnv({ [CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE]: "ENFORCE" }),
  });
  assert.equal(d.blocked, false);
  const d2 = evaluateWriterFreezeAttempt({
    writerId: CUTOVER_02_WRITER_ID.UNRELATED_PROFILE_WRITE,
    env: stagingEnv({ [CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE]: "ENFORCE" }),
  });
  assert.equal(d2.blocked, false);
});

test("20) Direct RPC bypass risk marked blocker (client guard insufficient)", () => {
  const targets = listStagingFreezeTargets();
  const sync = targets.find(
    (r) => r.writer === CUTOVER_02_WRITER_ID.PICK_VN_SYNC_RATING_RPC
  );
  assert.ok(sync);
  assert.match(sync.directCallBypassRisk, /HIGH/i);
  assert.match(sync.directCallBypassRisk, /insufficient|GRANT|direct/i);
  // Inventory must document DB-side guard requirement
  assert.equal(
    CUTOVER_02_WRITER_INVENTORY.some(
      (r) =>
        r.writer === CUTOVER_02_WRITER_ID.PICK_VN_SYNC_RATING_RPC &&
        r.stagingFreezeTarget === true
    ),
    true
  );
});

test("21) Rollback OFF restores behavior", async () => {
  const enforce = await withWriterFreezeGuard(
    CUTOVER_02_WRITER_ID.PICK_VN_SYNC_RATING_RPC,
    async () => ({ ok: true, wrote: true }),
    { env: stagingEnv({ [CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE]: "ENFORCE" }) }
  );
  assert.equal(enforce.ok, false);
  assert.equal(enforce.code, WRITER_FREEZE_BLOCK_CODE);

  const off = await withWriterFreezeGuard(
    CUTOVER_02_WRITER_ID.PICK_VN_SYNC_RATING_RPC,
    async () => ({ ok: true, wrote: true }),
    { env: stagingEnv({ [CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE]: "OFF" }) }
  );
  assert.equal(off.ok, true);
  assert.equal(off.wrote, true);
});

test("22) Evidence payload does not contain email/token/secret", () => {
  __resetDualReadEvidenceForTests();
  const fakeJwt = ["eyJ", "hbGciOi", "JIUzI1NiIsInR5cCI6IkpXVCJ9", ".", "aaa", ".", "bbb"].join("");
  const result = comparePublishedRatingDualRead({
    player: { id: "player-xyz", current_rating: 3 },
    playerId: "player-xyz",
    v5Record: {
      id: "v5",
      display_rating: 3,
      player_id: "player-xyz",
      email: "secret@example.com",
      access_token: fakeJwt,
    },
    env: stagingEnv({ [CUTOVER_02_ENV_NAMES.DUAL_READ_COMPARE]: "true" }),
  });
  assert.equal(evidenceContainsForbiddenPii(result.evidence), false);
  const json = JSON.stringify(result.evidence);
  assert.equal(json.includes("secret@example.com"), false);
  assert.equal(json.includes(fakeJwt), false);
  assert.ok(result.evidence.playerIdHash);
  assert.equal(result.evidence.playerIdHash, hashPlayerIdForEvidence("player-xyz"));
});

test("23) Feature flag missing defaults OFF", () => {
  const cfg = resolveCutover02Config(stagingEnv({}));
  assert.equal(cfg.dualReadCompareEnabled, false);
  assert.equal(cfg.writerFreezeMode, WRITER_FREEZE_MODE.OFF);
  assert.equal(cfg.requested.dualReadCompareEnabled, false);
});

test("24) Reader/writer errors audited without leaking secrets", () => {
  const roleKey = `service${"_"}role`;
  const dirty = sanitizeEvidenceValue({
    email: "a@b.com",
    access_token: "tok",
    [roleKey]: "sr",
    okField: 1,
  });
  assert.equal(dirty.email, "[REDACTED]");
  assert.equal(dirty.access_token, "[REDACTED]");
  assert.equal(dirty[roleKey], "[REDACTED]");
  assert.equal(dirty.okField, 1);

  __resetWriterFreezeAttemptsForTests();
  evaluateWriterFreezeAttempt({
    writerId: CUTOVER_02_WRITER_ID.PICK_VN_SYNC_RATING_RPC,
    env: stagingEnv({ [CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE]: "OBSERVE" }),
    details: { email: "leak@x.com", token: "abc" },
  });
  const attempt = __getWriterFreezeAttemptsForTests()[0];
  assert.equal(attempt.details.email, "[REDACTED]");
  assert.equal(attempt.details.token, "[REDACTED]");
});

test("rpcPickVnSyncRating honors ENFORCE via client guard", async () => {
  let called = false;
  __setPickVnRatingRpcClientForTests({
    rpc: async () => {
      called = true;
      return { data: { ok: true }, error: null };
    },
  });
  // Inject env via process for default resolve path used by rpc wrapper
  const prevMode = process.env[CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE];
  const prevApp = process.env.VITE_APP_ENV;
  const prevUrl = process.env.VITE_SUPABASE_URL;
  process.env[CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE] = "ENFORCE";
  process.env.VITE_APP_ENV = "staging";
  process.env.VITE_SUPABASE_URL = STAGING_ENV.VITE_SUPABASE_URL;
  try {
    // rpc wrapper uses resolveCutover02Config() without explicit env —
    // pass through evaluate by calling withWriterFreezeGuard path: need env on process.
    // Feature flags read process.env when bag empty keys missing — good.
    const result = await rpcPickVnSyncRating({ auth_user_id: "u1", current_rating: 3 });
    // NOTE: withWriterFreezeGuard in rpc does NOT pass env; it relies on process/import.meta.
    assert.equal(result.ok, false);
    assert.equal(result.code, WRITER_FREEZE_BLOCK_CODE);
    assert.equal(called, false);
  } finally {
    if (prevMode === undefined) delete process.env[CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE];
    else process.env[CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE] = prevMode;
    if (prevApp === undefined) delete process.env.VITE_APP_ENV;
    else process.env.VITE_APP_ENV = prevApp;
    if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = prevUrl;
    __resetPickVnRatingRpcClientForTests();
  }
});

test("Staging environment proof blocks when staging ref unknown", () => {
  const blocked = evaluateStagingEnvironmentProof({});
  assert.equal(blocked.STAGING_ENVIRONMENT_PROOF, "BLOCKED");

  const pass = evaluateStagingEnvironmentProof({
    stagingProjectRef: CUTOVER_02_STAGING_PROJECT_REF,
    productionProjectRef: CUTOVER_02_PRODUCTION_PROJECT_REF,
    connectedTargetRef: CUTOVER_02_STAGING_PROJECT_REF,
    mcpMode: "read-only",
    databaseIdentity: "staging-db",
    environmentLabel: "staging",
    deploymentTarget: "vercel-preview",
    branch: "feat/rating-v5-cutover-02-staging-rehearsal",
    sha: "abc123",
    rollbackAuthority: "owner",
  });
  assert.equal(pass.STAGING_ENVIRONMENT_PROOF, "PASS");
});

test("Reconciliation report includes required metrics + OWNER_APPROVAL_REQUIRED", () => {
  const report = buildReconciliationReport({
    eligibleV2Population: 10,
    usersWithV5ShadowProfile: 4,
    comparisons: [
      {
        v2: { present: true },
        v5: { present: true },
        classification: {
          primary: DUAL_READ_COMPARE_OUTCOME.V2_PRESENT_V5_PRESENT,
          secondary: [DUAL_READ_COMPARE_OUTCOME.SCALE_MAPPING_UNAPPROVED],
          notes: [],
        },
        rawCompare: { rawExactMatch: false },
        mapping: { status: "UNAPPROVED" },
      },
    ],
    writerAttempts: [
      { writerId: CUTOVER_02_WRITER_ID.PICK_VN_SYNC_RATING_RPC, blocked: true },
    ],
    rollbackSuccess: true,
  });
  assert.equal(report.eligibleV2Population, 10);
  assert.equal(report.usersWithV5ShadowProfile, 4);
  assert.equal(report.OWNER_APPROVAL_REQUIRED, "YES");
  assert.equal(report.rollbackSuccess, true);
  assert.ok("v5CoveragePercentage" in report);
  assert.ok("blockedAttemptsByWriter" in report);
});

test("SCALE_MAPPING_UNAPPROVED secondary when both present", () => {
  const result = comparePublishedRatingDualRead({
    player: { id: "both", current_rating: 4 },
    playerId: "both",
    v5Record: { id: "v5", display_rating: 3.5, player_id: "both" },
    env: stagingEnv({
      [CUTOVER_02_ENV_NAMES.DUAL_READ_COMPARE]: "true",
      [CUTOVER_02_ENV_NAMES.SCALE_MAPPING_STATUS]: "UNAPPROVED",
    }),
  });
  assert.equal(
    result.evidence.classification.primary,
    DUAL_READ_COMPARE_OUTCOME.V2_PRESENT_V5_PRESENT
  );
  assert.ok(
    result.evidence.classification.secondary.includes(
      DUAL_READ_COMPARE_OUTCOME.SCALE_MAPPING_UNAPPROVED
    )
  );
});
