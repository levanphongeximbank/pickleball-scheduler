/**
 * Phase 1J — Player Rating Foundation integration certification.
 * Certifies Phases 1B–1I as an integrated, runtime-neutral foundation.
 * Does not introduce new Player Rating capability.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as foundation from "../src/features/player-rating/foundation/index.js";
import {
  MATCH_RESULT_RATING_ALGORITHM,
  PLAYER_RATING_CAPABILITY,
  PLAYER_RATING_FOUNDATION_ERROR_CODE,
  PLAYER_RATING_FOUNDATION_PHASE,
  PLAYER_RATING_PRIVACY_PROJECTION_LEVEL,
  PLAYER_RATING_READ_CAPABILITY,
  PLAYER_RATING_SOURCE_SCALE,
  PLAYER_RATING_SOURCE_TYPE,
  PlayerRatingFoundationError,
  adjustPlayerRating,
  appendRatingHistory,
  collectRatingCandidates,
  createInMemoryRatingAdjustmentAuditAdapter,
  createInMemoryRatingCurrentStateAdapter,
  createInMemoryRatingHistoryAdapter,
  createInMemoryRatingSnapshotAdapter,
  createPlayerRatingReadFacade,
  createRatingSnapshot,
  createSecurePlayerRatingReadFacade,
  createUnimplementedMatchResultRatingPort,
  normalizeLegacyRating,
  normalizeV2Rating,
  normalizeV5Rating,
  projectPublicPlayerRating,
  verifyPlayerRating,
} from "../src/features/player-rating/foundation/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FOUNDATION_ROOT = path.resolve(
  __dirname,
  "../src/features/player-rating/foundation"
);
const REPO_ROOT = path.resolve(__dirname, "..");
const CI_REGISTRY = path.join(REPO_ROOT, "scripts/ci/unit-test-files.json");

const SCOPE = Object.freeze({ kind: "tenant", tenantId: "tenant-1" });
const OTHER_SCOPE = Object.freeze({ kind: "tenant", tenantId: "tenant-2" });
const FIXED_AT = "2026-07-23T08:00:00.000Z";
const T0 = "2026-07-20T00:00:00.000Z";
const T1 = "2026-07-21T00:00:00.000Z";
const T2 = "2026-07-22T00:00:00.000Z";

const READ_FACADE_METHODS = Object.freeze([
  "collectCandidates",
  "getCandidate",
  "listCandidates",
  "listHistory",
  "getHistoryEntry",
  "listSnapshots",
  "getSnapshot",
  "getPlayerRatingOverview",
]);

const SECURE_FACADE_METHODS = Object.freeze([
  "getPublicOverview",
  "getSelfOverview",
  "getReviewerOverview",
  "getInternalOverview",
]);

const FORBIDDEN_WRITE_METHODS = Object.freeze([
  "verify",
  "adjust",
  "update",
  "save",
  "append",
  "createSnapshot",
  "delete",
  "applyResult",
  "reverseResult",
  "verifyPlayerRating",
  "adjustPlayerRating",
  "appendHistoryEntry",
]);

const REQUIRED_PUBLIC_EXPORTS = Object.freeze([
  // Contracts / identity
  "PLAYER_RATING_SUPPORTED_MODES",
  "createRatingCurrentStateContract",
  "createRatingHistoryEntryContract",
  "createRatingSnapshotContract",
  "createRatingVerificationRequestContract",
  "createRatingAdjustmentRequestContract",
  "createRatingAdjustmentAuditContract",
  "createRatingApplicationIdentityContract",
  "createRatingReversalIdentityContract",
  "requireExplicitPlayerRatingScope",
  // Ports
  "createUnimplementedCanonicalPlayerIdResolverPort",
  "createUnimplementedRatingCurrentStatePort",
  "createUnimplementedRatingHistoryPort",
  "createUnimplementedRatingSnapshotPort",
  "createUnimplementedRatingVerificationPort",
  "createUnimplementedRatingAdjustmentAuditPort",
  "createUnimplementedMatchResultRatingPort",
  "MATCH_RESULT_RATING_ALGORITHM",
  // Errors
  "PLAYER_RATING_FOUNDATION_ERROR_CODE",
  "PlayerRatingFoundationError",
  // Read model
  "normalizeV2Rating",
  "normalizeV5Rating",
  "normalizeLegacyRating",
  "collectRatingCandidates",
  // History / snapshot
  "appendRatingHistory",
  "createRatingSnapshot",
  "createInMemoryRatingHistoryAdapter",
  "createInMemoryRatingSnapshotAdapter",
  // Verification / adjustment
  "verifyPlayerRating",
  "adjustPlayerRating",
  "createInMemoryRatingCurrentStateAdapter",
  "createInMemoryRatingAdjustmentAuditAdapter",
  // Read facade
  "createPlayerRatingReadFacade",
  // Security / privacy
  "PLAYER_RATING_PRIVACY_PROJECTION_LEVEL",
  "createSecurePlayerRatingReadFacade",
  "projectPublicPlayerRating",
  "projectRestrictedPlayerRating",
  "authorizePlayerRatingRead",
  "createPlayerRatingPrivacyPolicy",
]);

const INTERNAL_HELPERS_NOT_REQUIRED = Object.freeze([
  "stateHelpers",
  "buildEntries",
  "portHelpers",
  "scopeMatch",
  "ordering",
  "readFacadeErrors",
  "securityPrivacyErrors",
]);

async function expectCodeAsync(fn, code) {
  await assert.rejects(fn, (err) => {
    assert.ok(err instanceof PlayerRatingFoundationError);
    assert.equal(err.code, code);
    return true;
  });
}

function readAllJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readAllJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

function containsKeyDeep(value, key) {
  if (value == null || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some((item) => containsKeyDeep(item, key));
  }
  if (Object.prototype.hasOwnProperty.call(value, key)) return true;
  return Object.values(value).some((child) => containsKeyDeep(child, key));
}

function verifierActor(overrides = {}) {
  return {
    actorId: "actor-verify-1",
    actorType: "staff",
    capabilities: [PLAYER_RATING_CAPABILITY.VERIFY],
    tenantId: "tenant-1",
    reason: "manual verification review",
    correlationId: "corr-verify-1",
    operationId: "op-verify-1j",
    occurredAt: T1,
    ...overrides,
  };
}

function adjusterActor(overrides = {}) {
  return {
    actorId: "actor-adjust-1",
    actorType: "staff",
    capabilities: [PLAYER_RATING_CAPABILITY.ADJUST],
    tenantId: "tenant-1",
    reason: "manual correction",
    correlationId: "corr-adjust-1",
    operationId: "op-adjust-1j",
    occurredAt: T2,
    ...overrides,
  };
}

function baseState(overrides = {}) {
  return {
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    selfAssessedRating: 3.5,
    provisionalRating: 3.5,
    status: "provisional",
    source: "self_assessment",
    effectiveAt: T0,
    stateVersion: 1,
    sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0,
    ...overrides,
  };
}

async function createHarness(seedOverrides = {}) {
  const currentState = createInMemoryRatingCurrentStateAdapter();
  const history = createInMemoryRatingHistoryAdapter();
  const audit = createInMemoryRatingAdjustmentAuditAdapter();
  await currentState.seedCurrentState(baseState(seedOverrides));
  return { currentState, history, audit };
}

function v2Source(overrides = {}) {
  const { record: recordOverrides, ...rest } = overrides;
  return {
    sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
    canonicalPlayerId: "player-1",
    record: {
      id: "v2-1",
      auth_user_id: "auth-abc",
      self_declared_rating: 4.5,
      provisional_rating: 4.0,
      verified_rating: 5.0,
      current_rating: 5.0,
      rating_status: "provisional",
      last_rating_updated_at: FIXED_AT,
      ...recordOverrides,
    },
    ...rest,
  };
}

function v5Source(overrides = {}) {
  const { record: recordOverrides, ...rest } = overrides;
  return {
    sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V5,
    canonicalPlayerId: "player-1",
    record: {
      id: "v5-1",
      tenant_id: "tenant-1",
      player_id: "11111111-1111-1111-1111-111111111111",
      rating_mode: "overall",
      provisional_rating: 3.25,
      open_rating_mean: 3.4,
      verified_rating_mean: 3.6,
      display_rating: 3.6,
      reliability_score: 80,
      open_rating_deviation: 0.2,
      evidence_level: 2,
      rating_status: "provisional",
      last_rated_at: FIXED_AT,
      email: "should-not-leak@example.com",
      ...recordOverrides,
    },
    ...rest,
  };
}

function legacySource(overrides = {}) {
  const { record: recordOverrides, ...rest } = overrides;
  return {
    sourceType: PLAYER_RATING_SOURCE_TYPE.LEGACY_ASSESSMENT,
    canonicalPlayerId: "player-1",
    record: {
      id: "legacy-1",
      rating: 3.0,
      status: "draft",
      updatedAt: FIXED_AT,
      ...recordOverrides,
    },
    ...rest,
  };
}

function publicAccess(overrides = {}) {
  return {
    actorId: "actor-public",
    capabilities: [PLAYER_RATING_READ_CAPABILITY.READ_PUBLIC],
    tenantId: "tenant-1",
    projectionLevel: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PUBLIC,
    subjectPlayerId: "player-1",
    correlationId: "corr-public-1j",
    ...overrides,
  };
}

function selfAccess(overrides = {}) {
  return {
    actorId: "actor-self",
    capabilities: [PLAYER_RATING_READ_CAPABILITY.READ_SELF],
    tenantId: "tenant-1",
    projectionLevel: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PLAYER_SELF,
    subjectPlayerId: "player-1",
    mappedSubjectPlayerId: "player-1",
    subjectMappingConfirmed: true,
    correlationId: "corr-self-1j",
    ...overrides,
  };
}

function reviewerAccess(overrides = {}) {
  return {
    actorId: "actor-reviewer",
    capabilities: [PLAYER_RATING_READ_CAPABILITY.READ_RESTRICTED],
    tenantId: "tenant-1",
    projectionLevel: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.AUTHORIZED_REVIEWER,
    subjectPlayerId: "player-1",
    correlationId: "corr-reviewer-1j",
    ...overrides,
  };
}

function internalAccess(overrides = {}) {
  return {
    actorId: "actor-internal",
    capabilities: [PLAYER_RATING_READ_CAPABILITY.READ_INTERNAL],
    tenantId: "tenant-1",
    projectionLevel: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.INTERNAL_SYSTEM,
    subjectPlayerId: "player-1",
    correlationId: "corr-internal-1j",
    trustedServerContext: true,
    ...overrides,
  };
}

async function createSecureFacade() {
  const historyPort = createInMemoryRatingHistoryAdapter();
  const snapshotPort = createInMemoryRatingSnapshotAdapter();
  const readFacade = createPlayerRatingReadFacade({ historyPort, snapshotPort });
  return createSecurePlayerRatingReadFacade({ readFacade });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

test("1J public foundation barrel imports and exports certified APIs", () => {
  assert.equal(typeof foundation, "object");
  for (const name of REQUIRED_PUBLIC_EXPORTS) {
    assert.ok(name in foundation, `missing export: ${name}`);
  }
  assert.equal(PLAYER_RATING_FOUNDATION_PHASE.wiredToProductionRuntime, false);
  assert.equal(PLAYER_RATING_FOUNDATION_PHASE.hasFinalAlgorithm, false);
});

test("1J consumers are not required to import internal-only helpers", () => {
  for (const name of INTERNAL_HELPERS_NOT_REQUIRED) {
    assert.equal(
      name in foundation,
      false,
      `internal helper unexpectedly exported: ${name}`
    );
  }
});

test("1J MatchResultRatingPort remains unimplemented with no algorithm", async () => {
  assert.equal(MATCH_RESULT_RATING_ALGORITHM.hasAlgorithm, false);
  assert.equal(MATCH_RESULT_RATING_ALGORITHM.status, "unimplemented");
  const port = createUnimplementedMatchResultRatingPort();
  const identity = {
    tenantId: "tenant-1",
    matchId: "m-1",
    resultRevision: "1",
    playerId: "player-1",
    ratingType: "overall",
    algorithmVersion: "algo-unimplemented",
  };
  await expectCodeAsync(
    () => port.applyRatingFromMatchResult(identity),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.MATCH_RESULT_RATING_INTEGRATION_UNAVAILABLE
  );
});

// ---------------------------------------------------------------------------
// Read model
// ---------------------------------------------------------------------------

test("1J V2, V5, and legacy candidates coexist without scale conversion or preferred winner", () => {
  const v2 = normalizeV2Rating(v2Source().record, { scope: SCOPE });
  const v5 = normalizeV5Rating(v5Source().record, {
    scope: SCOPE,
    canonicalPlayerId: "player-1",
  });
  assert.equal(
    normalizeLegacyRating(legacySource().record, { scope: SCOPE }).sourceType,
    PLAYER_RATING_SOURCE_TYPE.LEGACY_ASSESSMENT
  );

  assert.equal(v2.sourceScale, PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0);
  assert.equal(v5.sourceScale, PLAYER_RATING_SOURCE_SCALE.PICK_VN_V5_1_5_TO_6_0);
  assert.ok(v2.warnings.includes("NO_SCALE_CONVERSION_APPLIED"));
  assert.ok(v5.warnings.includes("NO_SCALE_CONVERSION_APPLIED"));

  const result = collectRatingCandidates({
    scope: SCOPE,
    sources: [legacySource(), v5Source(), v2Source()],
  });

  assert.equal(result.candidates.length, 3);
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, "preferredCandidate"),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, "selectedSsot"),
    false
  );
  assert.ok(result.scaleConflicts.length >= 1);
  assert.ok(
    result.candidates.every((c) =>
      c.warnings.includes("NO_SCALE_CONVERSION_APPLIED")
    )
  );
  assert.notEqual(v2.sourceScale, v5.sourceScale);
});

test("1J collectRatingCandidates is deterministic across equivalent input orderings", () => {
  const sourcesAsc = [v2Source(), v5Source(), legacySource()];
  const sourcesDesc = [legacySource(), v5Source(), v2Source()];
  const a = collectRatingCandidates({ scope: SCOPE, sources: sourcesAsc });
  const b = collectRatingCandidates({ scope: SCOPE, sources: sourcesDesc });
  assert.deepEqual(
    a.candidates.map((c) => c.candidateId),
    b.candidates.map((c) => c.candidateId)
  );
  assert.deepEqual(a.scaleConflicts, b.scaleConflicts);
});

// ---------------------------------------------------------------------------
// History / snapshot
// ---------------------------------------------------------------------------

test("1J history remains append-only; snapshots immutable; adapters isolated; caller IDs", async () => {
  const historyA = createInMemoryRatingHistoryAdapter();
  const historyB = createInMemoryRatingHistoryAdapter();
  const snapA = createInMemoryRatingSnapshotAdapter();
  const snapB = createInMemoryRatingSnapshotAdapter();

  const entry = await historyA.appendHistoryEntry({
    eventId: "evt-1j-1",
    playerId: "player-1",
    scope: SCOPE,
    eventType: "PLAYER_RATING_SELF_ASSESSED",
    beforeState: { status: "draft" },
    afterState: { status: "provisional", value: 3.5 },
    effectiveAt: T0,
    recordedAt: T1,
    ratingMode: "overall",
  });
  assert.equal(entry.eventId, "evt-1j-1");
  assert.equal(entry.recordedAt, T1);
  assert.ok(Object.isFrozen(entry));
  assert.throws(() => {
    /** @type {any} */ (entry).afterState.status = "mutated";
  });
  await expectCodeAsync(
    () => historyA.updateHistoryEntry("evt-1j-1", { afterState: {} }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.HISTORY_MUTATION_FORBIDDEN
  );
  await expectCodeAsync(
    () => historyA.deleteHistoryEntry("evt-1j-1"),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.HISTORY_MUTATION_FORBIDDEN
  );

  const listedB = await historyB.listHistory("player-1", SCOPE);
  assert.equal(listedB.length, 0);

  const snap = await snapA.createSnapshot({
    snapshotId: "snap-1j-1",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 3.5,
    sourceStateVersion: "v1",
    effectiveAt: T1,
    createdAt: T2,
    sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0,
  });
  assert.equal(snap.snapshotId, "snap-1j-1");
  assert.equal(snap.createdAt, T2);
  assert.ok(Object.isFrozen(snap));
  assert.throws(() => {
    /** @type {any} */ (snap).ratingValue = 9.9;
  });
  await expectCodeAsync(
    () => snapA.updateSnapshot("snap-1j-1", { ratingValue: 9.9 }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.SNAPSHOT_MUTATION_FORBIDDEN
  );
  await expectCodeAsync(
    () => snapA.deleteSnapshot("snap-1j-1"),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.SNAPSHOT_MUTATION_FORBIDDEN
  );

  const listedSnapB = await snapB.listSnapshots("player-1", SCOPE);
  assert.equal(listedSnapB.length, 0);

  // Service-level helpers remain available and also keep caller-supplied IDs.
  const serviceStore = { byEventId: new Map() };
  const serviceEntry = appendRatingHistory(serviceStore, {
    eventId: "evt-1j-svc",
    playerId: "player-1",
    scope: SCOPE,
    eventType: "PLAYER_RATING_SELF_ASSESSED",
    afterState: { status: "provisional", value: 3.5 },
    effectiveAt: T0,
    recordedAt: T1,
    ratingMode: "overall",
  });
  assert.equal(serviceEntry.eventId, "evt-1j-svc");
  const snapStore = { bySnapshotId: new Map() };
  const serviceSnap = createRatingSnapshot(snapStore, {
    snapshotId: "snap-1j-svc",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 3.5,
    sourceStateVersion: "v1",
    effectiveAt: T1,
    createdAt: T2,
    sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0,
  });
  assert.equal(serviceSnap.snapshotId, "snap-1j-svc");
});

// ---------------------------------------------------------------------------
// Verification / adjustment
// ---------------------------------------------------------------------------

test("1J verification requires authorization; stale version fails; idempotency and conflict hold", async () => {
  const { currentState, history } = await createHarness();

  await expectCodeAsync(
    () =>
      verifyPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          verifiedRating: 4.0,
          expectedVersion: 1,
          actor: verifierActor({
            capabilities: [],
            isAdmin: true,
            operationId: "op-unauth",
          }),
        },
        { currentStateAdapter: currentState, historyAdapter: history }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED_VERIFICATION
  );

  await expectCodeAsync(
    () =>
      verifyPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          verifiedRating: 4.0,
          expectedVersion: 99,
          actor: verifierActor({ operationId: "op-stale" }),
        },
        { currentStateAdapter: currentState, historyAdapter: history }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_VERSION_CONFLICT
  );

  const request = {
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    verifiedRating: 4.0,
    expectedVersion: 1,
    actor: verifierActor({ operationId: "op-idem-1j" }),
  };
  const first = await verifyPlayerRating(request, {
    currentStateAdapter: currentState,
    historyAdapter: history,
  });
  const second = await verifyPlayerRating(request, {
    currentStateAdapter: currentState,
    historyAdapter: history,
  });
  assert.deepEqual(second, first);
  const state = await currentState.getCurrentState("player-1", SCOPE, "overall");
  assert.equal(state.stateVersion, 2);
  assert.equal((await history.listHistory("player-1", SCOPE)).length, 1);

  await expectCodeAsync(
    () =>
      verifyPlayerRating(
        {
          ...request,
          verifiedRating: 4.5,
        },
        { currentStateAdapter: currentState, historyAdapter: history }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_OPERATION_PAYLOAD_CONFLICT
  );
});

test("1J validation failure leaves current state, history, and audit unchanged", async () => {
  const { currentState, history, audit } = await createHarness();
  const before = await currentState.getCurrentState("player-1", SCOPE, "overall");

  await expectCodeAsync(
    () =>
      adjustPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          targetField: "notAllowedField",
          newValue: 9.0,
          expectedVersion: 1,
          auditId: "audit-fail-1j",
          actor: adjusterActor({ operationId: "op-fail-1j" }),
        },
        {
          currentStateAdapter: currentState,
          historyAdapter: history,
          auditAdapter: audit,
        }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.ADJUSTMENT_FIELD_NOT_ALLOWED
  );

  const after = await currentState.getCurrentState("player-1", SCOPE, "overall");
  assert.deepEqual(after, before);
  assert.equal((await history.listHistory("player-1", SCOPE)).length, 0);
  assert.equal((await audit.listAdjustmentAudits("player-1", SCOPE)).length, 0);
});

// ---------------------------------------------------------------------------
// Facade / security
// ---------------------------------------------------------------------------

test("1J read facade and secure facade expose no write API", () => {
  const readFacade = createPlayerRatingReadFacade({
    historyPort: createInMemoryRatingHistoryAdapter(),
    snapshotPort: createInMemoryRatingSnapshotAdapter(),
  });
  const secure = createSecurePlayerRatingReadFacade({ readFacade });

  for (const method of READ_FACADE_METHODS) {
    assert.equal(typeof readFacade[method], "function");
  }
  for (const method of SECURE_FACADE_METHODS) {
    assert.equal(typeof secure[method], "function");
  }
  for (const method of FORBIDDEN_WRITE_METHODS) {
    assert.equal(typeof readFacade[method], "undefined");
    assert.equal(typeof secure[method], "undefined");
  }
});

test("1J PUBLIC projection cannot leak restricted fields", () => {
  const candidate = normalizeV5Rating(v5Source().record, {
    scope: SCOPE,
    canonicalPlayerId: "player-1",
  });
  const projected = projectPublicPlayerRating(candidate, { kind: "candidate" });
  assert.equal(projected.playerId, "player-1");
  assert.equal(containsKeyDeep(projected, "confidence"), false);
  assert.equal(containsKeyDeep(projected, "rawSourceMetadata"), false);
  assert.equal(containsKeyDeep(projected, "aliases"), false);
  assert.equal(containsKeyDeep(projected, "evidence"), false);
  assert.equal(containsKeyDeep(projected, "email"), false);
  assert.equal(containsKeyDeep(projected, "actorId"), false);
  assert.equal(Object.isFrozen(projected), true);
});

test("1J PLAYER_SELF cannot access another player; reviewer cannot cross tenant; INTERNAL requires trusted context; isAdmin alone insufficient", async () => {
  const secure = await createSecureFacade();
  const overviewInput = {
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    sourceRecords: [v5Source()],
  };

  await expectCodeAsync(
    () =>
      secure.getSelfOverview(overviewInput, selfAccess({
        subjectPlayerId: "player-1",
        mappedSubjectPlayerId: "player-2",
      })),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_SUBJECT_MISMATCH
  );

  await expectCodeAsync(
    () =>
      secure.getSelfOverview(
        {
          playerId: "player-2",
          scope: SCOPE,
          ratingMode: "overall",
          sourceRecords: [v5Source()],
        },
        selfAccess({
          subjectPlayerId: "player-1",
          mappedSubjectPlayerId: "player-1",
        })
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_SUBJECT_MISMATCH
  );

  await expectCodeAsync(
    () =>
      secure.getReviewerOverview(overviewInput, reviewerAccess({
        tenantId: OTHER_SCOPE.tenantId,
      })),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_TENANT_ACCESS_DENIED
  );

  await expectCodeAsync(
    () =>
      secure.getInternalOverview(
        overviewInput,
        internalAccess({ trustedServerContext: false })
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_READ_UNAUTHORIZED
  );

  await expectCodeAsync(
    () =>
      secure.getInternalOverview(overviewInput, {
        actorId: "admin-only",
        isAdmin: true,
        capabilities: [],
        tenantId: "tenant-1",
        projectionLevel: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.INTERNAL_SYSTEM,
        subjectPlayerId: "player-1",
        correlationId: "corr-admin-only",
        trustedServerContext: true,
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_READ_UNAUTHORIZED
  );

  const publicView = await secure.getPublicOverview(
    overviewInput,
    publicAccess()
  );
  assert.equal(containsKeyDeep(publicView, "email"), false);
  assert.equal(containsKeyDeep(publicView, "rawSourceMetadata"), false);
});

// ---------------------------------------------------------------------------
// Boundaries / static scans
// ---------------------------------------------------------------------------

test("1J foundation source has no forbidden runtime imports or nondeterministic generators", () => {
  const files = readAllJsFiles(FOUNDATION_ROOT);
  assert.ok(files.length > 0);

  const forbiddenImportPatterns = [
    /from\s+['"][^'"]*supabase[^'"]*['"]/i,
    /require\s*\(\s*['"][^'"]*supabase[^'"]*['"]\s*\)/i,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /from\s+['"][^'"]*features\/identity[^'"]*['"]/,
    /from\s+['"][^'"]*features\/auth[^'"]*['"]/,
    /from\s+['"][^'"]*rbac[^'"]*['"]/i,
    /from\s+['"][^'"]*competition-core[^'"]*['"]/,
    /from\s+['"][^'"]*vpr-ranking[^'"]*['"]/,
    /from\s+['"][^'"]*features\/player\/[^'"]*['"]/,
    /from\s+['"][^'"]*features\/club[^'"]*['"]/,
    /from\s+['"]@mui\//,
    /from\s+['"]react['"]/,
    /from\s+['"]react-dom['"]/,
  ];

  const forbiddenExecPatterns = [
    /\bDate\.now\s*\(/,
    /\bMath\.random\s*\(/,
    /\brandomUUID\s*\(/,
    /\bcrypto\.randomUUID\s*\(/,
  ];

  const scaleConversionPatterns = [
    /\*\s*400\b/,
    /\bexpectedScore\b/,
    /\bkFactor\b/,
    /\beloDelta\b/i,
    /\bconvertScale\s*\(/,
    /\bpreferredCandidate\b/,
    /\bselectWinner\b/,
    /\bselectSsot\b/i,
  ];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const rel = path.relative(FOUNDATION_ROOT, file);

    for (const pattern of forbiddenImportPatterns) {
      assert.equal(
        pattern.test(source),
        false,
        `forbidden import/runtime pattern ${pattern} in ${rel}`
      );
    }
    for (const pattern of forbiddenExecPatterns) {
      assert.equal(
        pattern.test(source),
        false,
        `forbidden generator ${pattern} in ${rel}`
      );
    }
    for (const pattern of scaleConversionPatterns) {
      assert.equal(
        pattern.test(source),
        false,
        `forbidden algorithm/scale pattern ${pattern} in ${rel}`
      );
    }

    assert.equal(
      /\bCREATE\s+TABLE\b/i.test(source) || /\bSELECT\s+.+\bFROM\b/i.test(source),
      false,
      `SQL runtime pattern in ${rel}`
    );
  }
});

test("1J CI registry includes all Player Rating Foundation tests including Phase 1J", () => {
  const registry = JSON.parse(fs.readFileSync(CI_REGISTRY, "utf8"));
  assert.ok(Array.isArray(registry));
  const required = [
    "tests/player-rating-foundation.test.js",
    "tests/player-rating-current-state-read-model.test.js",
    "tests/player-rating-history-snapshot.test.js",
    "tests/player-rating-verification-adjustment.test.js",
    "tests/player-rating-read-facade.test.js",
    "tests/player-rating-security-privacy.test.js",
    "tests/player-rating-integration-certification.test.js",
  ];
  for (const entry of required) {
    assert.ok(registry.includes(entry), `CI registry missing ${entry}`);
  }
});

test("1J foundation root index remains unwired from Production player-rating barrel", () => {
  const rootIndex = fs.readFileSync(
    path.join(REPO_ROOT, "src/features/player-rating/index.js"),
    "utf8"
  );
  assert.equal(rootIndex.includes("foundation"), false);
  assert.equal(rootIndex.includes("./foundation"), false);
});
