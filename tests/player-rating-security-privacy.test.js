import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PLAYER_RATING_FOUNDATION_ERROR_CODE,
  PLAYER_RATING_PRIVACY_PROJECTION_LEVEL,
  PLAYER_RATING_READ_CAPABILITY,
  PLAYER_RATING_SECURITY_PRIVACY_PHASE,
  PLAYER_RATING_SOURCE_SCALE,
  PLAYER_RATING_SOURCE_TYPE,
  PlayerRatingFoundationError,
  authorizePlayerRatingRead,
  createInMemoryRatingHistoryAdapter,
  createInMemoryRatingSnapshotAdapter,
  createPlayerRatingPrivacyPolicy,
  createPlayerRatingReadFacade,
  createSecurePlayerRatingReadFacade,
  projectPublicPlayerRating,
  projectRestrictedPlayerRating,
  redactPlayerRatingCandidate,
  redactPlayerRatingOverview,
} from "../src/features/player-rating/foundation/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECURITY_ROOT = path.resolve(
  __dirname,
  "../src/features/player-rating/foundation/security-privacy"
);
const FOUNDATION_ROOT = path.resolve(
  __dirname,
  "../src/features/player-rating/foundation"
);

const SCOPE = Object.freeze({ kind: "tenant", tenantId: "tenant-1" });
const OTHER_SCOPE = Object.freeze({ kind: "tenant", tenantId: "tenant-2" });
const FIXED_AT = "2026-07-23T08:00:00.000Z";
const T0 = "2026-07-20T00:00:00.000Z";
const T1 = "2026-07-21T00:00:00.000Z";

const SECURE_METHODS = Object.freeze([
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
]);

function expectCode(fn, code) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof PlayerRatingFoundationError);
    assert.equal(err.code, code);
    return true;
  });
}

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

function richCandidate(overrides = {}) {
  return {
    candidateId: "PICK_VN_V5|v5-1|overall|player:player-1",
    playerId: "player-1",
    playerIdResolutionStatus: "RESOLVED",
    sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V5,
    sourceRecordId: "v5-1",
    sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V5_1_5_TO_6_0,
    ratingMode: "overall",
    selfAssessedRating: 3.0,
    provisionalRating: 3.25,
    verifiedRating: 3.6,
    calculatedRating: 3.4,
    displayRating: 3.6,
    confidence: 82,
    confidenceScale: "PERCENT_0_100",
    reliability: 0.9,
    deviation: 0.15,
    evidence: { note: "internal-review" },
    status: "provisional",
    effectiveAt: FIXED_AT,
    algorithmVersion: "v5-engine-1",
    tenantId: "tenant-1",
    scope: SCOPE,
    aliases: [
      { kind: "auth_user_id", value: "auth-abc" },
      { kind: "profiles.id", value: "11111111-1111-1111-1111-111111111111" },
    ],
    warnings: [
      "NO_SCALE_CONVERSION_APPLIED",
      "INTERNAL_REVIEWER_EVIDENCE_PRESENT",
    ],
    rawSourceMetadata: {
      store: "player_rating_profiles",
      evidenceLevel: 2,
      openRatingDeviation: 0.2,
      verifiedRatingDeviation: 0.1,
      auth_user_id: "auth-abc",
      email: "secret@example.com",
    },
    authoritativeForPublicPlayerRating: false,
    actorId: "actor-hidden",
    operationId: "op-hidden",
    correlationId: "corr-hidden",
    beforeState: { value: 3.0 },
    afterState: { value: 3.6 },
    ...overrides,
  };
}

function richOverview(overrides = {}) {
  const candidate = richCandidate();
  return {
    playerId: "player-1",
    playerIdResolutionStatus: "RESOLVED",
    scope: SCOPE,
    ratingMode: "overall",
    candidates: [candidate],
    candidateCount: 1,
    history: [
      {
        eventId: "evt-1",
        playerId: "player-1",
        scope: SCOPE,
        eventType: "PLAYER_RATING_VERIFIED",
        beforeState: { status: "provisional", value: 3.25, email: "x@y.z" },
        afterState: { status: "verified", value: 3.6 },
        effectiveAt: T0,
        recordedAt: T1,
        actorId: "verifier-1",
        reason: "manual-verify",
        correlationId: "corr-hist",
        operationId: "op-hist",
      },
    ],
    historyCount: 1,
    snapshots: [
      {
        snapshotId: "snap-1",
        playerId: "player-1",
        scope: SCOPE,
        ratingMode: "overall",
        ratingValue: 3.6,
        sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V5_1_5_TO_6_0,
        effectiveAt: T1,
        createdAt: T1,
        sourceStateVersion: "v1",
        email: "leak@example.com",
      },
    ],
    snapshotCount: 1,
    identityConflicts: [],
    scaleConflicts: [],
    modeConflicts: [],
    rejectedRecords: [
      {
        reason: "INVALID_SOURCE",
        sourceType: "UNKNOWN",
        rawSourceMetadata: { secret: "token-abc", confidence: 9 },
        aliases: [{ kind: "auth_user_id", value: "auth-x" }],
        evidence: { note: "private" },
      },
    ],
    warnings: ["NO_SCALE_CONVERSION_APPLIED", "INTERNAL_REVIEWER_EVIDENCE_PRESENT"],
    sourceSummary: { [PLAYER_RATING_SOURCE_TYPE.PICK_VN_V5]: 1 },
    availabilityStatus: "AVAILABLE",
    ...overrides,
  };
}

function publicAccess(overrides = {}) {
  return {
    actorId: "actor-public",
    capabilities: [PLAYER_RATING_READ_CAPABILITY.READ_PUBLIC],
    tenantId: "tenant-1",
    projectionLevel: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PUBLIC,
    subjectPlayerId: "player-1",
    correlationId: "corr-public-1",
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
    correlationId: "corr-self-1",
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
    correlationId: "corr-reviewer-1",
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
    correlationId: "corr-internal-1",
    trustedServerContext: true,
    ...overrides,
  };
}

function v5Source() {
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
    },
  };
}

async function createSecureFacade() {
  const historyPort = createInMemoryRatingHistoryAdapter();
  const snapshotPort = createInMemoryRatingSnapshotAdapter();
  const readFacade = createPlayerRatingReadFacade({ historyPort, snapshotPort });
  await historyPort.appendHistoryEntry({
    eventId: "evt-1",
    playerId: "player-1",
    scope: SCOPE,
    eventType: "PLAYER_RATING_VERIFIED",
    beforeState: { status: "provisional", value: 3.25 },
    afterState: { status: "verified", value: 3.6 },
    effectiveAt: T0,
    recordedAt: T1,
    ratingMode: "overall",
    actorId: "verifier-1",
    reason: "ok",
    correlationId: "corr-h",
  });
  await snapshotPort.createSnapshot({
    snapshotId: "snap-1",
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    ratingValue: 3.6,
    sourceStateVersion: "v",
    effectiveAt: T1,
    createdAt: T1,
    sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V5_1_5_TO_6_0,
  });
  return createSecurePlayerRatingReadFacade({ readFacade });
}

// ---------------------------------------------------------------------------
// Public projection
// ---------------------------------------------------------------------------

test("Phase 1I public projection retains safe fields and removes restricted ones", () => {
  const projected = projectPublicPlayerRating(richCandidate(), {
    kind: "candidate",
  });

  assert.equal(projected.playerId, "player-1");
  assert.equal(projected.ratingMode, "overall");
  assert.equal(projected.displayRating, 3.6);
  assert.equal(projected.status, "provisional");
  assert.equal(projected.sourceType, PLAYER_RATING_SOURCE_TYPE.PICK_VN_V5);
  assert.equal(
    projected.sourceScale,
    PLAYER_RATING_SOURCE_SCALE.PICK_VN_V5_1_5_TO_6_0
  );
  assert.equal(projected.effectiveAt, FIXED_AT);
  assert.ok(projected.warnings.includes("NO_SCALE_CONVERSION_APPLIED"));
  assert.ok(!projected.warnings.includes("INTERNAL_REVIEWER_EVIDENCE_PRESENT"));

  for (const key of [
    "confidence",
    "reliability",
    "deviation",
    "evidence",
    "rawSourceMetadata",
    "aliases",
    "actorId",
    "operationId",
    "correlationId",
    "beforeState",
    "afterState",
    "selfAssessedRating",
    "provisionalRating",
    "calculatedRating",
    "algorithmVersion",
    "tenantId",
  ]) {
    assert.equal(Object.prototype.hasOwnProperty.call(projected, key), false);
  }

  assert.equal(Object.isFrozen(projected), true);
});

test("Phase 1I public projection does not substitute displayRating", () => {
  const candidate = richCandidate({ displayRating: undefined });
  delete candidate.displayRating;
  const projected = projectPublicPlayerRating(candidate, { kind: "candidate" });
  assert.equal(Object.prototype.hasOwnProperty.call(projected, "displayRating"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(projected, "verifiedRating"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(projected, "calculatedRating"), false);
});

test("Phase 1I public verifiedRating only when policy permits", () => {
  const denied = projectPublicPlayerRating(richCandidate(), { kind: "candidate" });
  assert.equal(Object.prototype.hasOwnProperty.call(denied, "verifiedRating"), false);

  const allowed = projectPublicPlayerRating(richCandidate(), {
    kind: "candidate",
    privacyPolicy: createPlayerRatingPrivacyPolicy({
      exposePublicVerifiedRating: true,
    }),
  });
  assert.equal(allowed.verifiedRating, 3.6);
});

test("Phase 1I public overview redacts nested private fields", () => {
  const projected = projectPublicPlayerRating(richOverview(), {
    kind: "overview",
  });
  assert.equal(projected.availabilityStatus, "AVAILABLE");
  assert.equal(projected.candidates.length, 1);
  assert.equal(containsKeyDeep(projected, "confidence"), false);
  assert.equal(containsKeyDeep(projected, "rawSourceMetadata"), false);
  assert.equal(containsKeyDeep(projected, "aliases"), false);
  assert.equal(containsKeyDeep(projected, "evidence"), false);
  assert.equal(containsKeyDeep(projected, "actorId"), false);
  assert.equal(containsKeyDeep(projected, "history"), false);
  assert.equal(containsKeyDeep(projected.rejectedRecords, "secret"), false);
  assert.equal(containsKeyDeep(projected.rejectedRecords, "aliases"), false);
  assert.ok(!projected.warnings.includes("INTERNAL_REVIEWER_EVIDENCE_PRESENT"));
  assert.equal(Object.isFrozen(projected), true);
});

test("Phase 1I public projection is immutable and does not mutate source", () => {
  const source = richCandidate();
  const before = JSON.stringify(source);
  const projected = projectPublicPlayerRating(source, { kind: "candidate" });
  assert.throws(() => {
    projected.status = "hacked";
  });
  assert.equal(JSON.stringify(source), before);
});

test("Phase 1I public projection is deterministic", () => {
  const a = projectPublicPlayerRating(richOverview(), { kind: "overview" });
  const b = projectPublicPlayerRating(richOverview(), { kind: "overview" });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// ---------------------------------------------------------------------------
// Player self
// ---------------------------------------------------------------------------

test("Phase 1I confirmed self access succeeds", () => {
  const ctx = authorizePlayerRatingRead(selfAccess(), { subjectScope: SCOPE });
  assert.equal(ctx.projectionLevel, PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PLAYER_SELF);
  assert.equal(ctx.subjectMappingConfirmed, true);

  const projected = projectRestrictedPlayerRating(richOverview(), {
    projectionLevel: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PLAYER_SELF,
    kind: "overview",
  });
  assert.equal(projected.candidates[0].selfAssessedRating, 3.0);
  assert.equal(projected.candidates[0].provisionalRating, 3.25);
  assert.equal(projected.candidates[0].verifiedRating, 3.6);
  assert.equal(containsKeyDeep(projected.candidates, "evidence"), false);
  assert.equal(containsKeyDeep(projected.candidates, "rawSourceMetadata"), false);
  assert.equal(containsKeyDeep(projected.candidates, "aliases"), false);
  assert.ok(Array.isArray(projected.historySummary));
  assert.ok(Array.isArray(projected.snapshotSummary));
  assert.equal(containsKeyDeep(projected.historySummary, "actorId"), false);
  assert.equal(containsKeyDeep(projected.historySummary, "correlationId"), false);
});

test("Phase 1I missing self capability rejected", () => {
  expectCode(
    () =>
      authorizePlayerRatingRead(
        selfAccess({ capabilities: [PLAYER_RATING_READ_CAPABILITY.READ_PUBLIC] }),
        { subjectScope: SCOPE }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_READ_UNAUTHORIZED
  );
});

test("Phase 1I unconfirmed subject mapping rejected", () => {
  expectCode(
    () =>
      authorizePlayerRatingRead(
        selfAccess({ subjectMappingConfirmed: false }),
        { subjectScope: SCOPE }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_SUBJECT_MISMATCH
  );
});

test("Phase 1I cross-player self access rejected", () => {
  expectCode(
    () =>
      authorizePlayerRatingRead(
        selfAccess({
          subjectPlayerId: "player-1",
          mappedSubjectPlayerId: "player-2",
        }),
        { subjectScope: SCOPE }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_SUBJECT_MISMATCH
  );
});

test("Phase 1I cross-tenant self access rejected", () => {
  expectCode(
    () =>
      authorizePlayerRatingRead(selfAccess({ tenantId: "tenant-2" }), {
        subjectScope: SCOPE,
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_TENANT_ACCESS_DENIED
  );
});

test("Phase 1I self keeps reviewer evidence hidden by default", () => {
  const projected = projectRestrictedPlayerRating(richCandidate(), {
    projectionLevel: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PLAYER_SELF,
    kind: "candidate",
  });
  assert.equal(Object.prototype.hasOwnProperty.call(projected, "confidence"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(projected, "reliability"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(projected, "deviation"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(projected, "evidence"), false);
});

// ---------------------------------------------------------------------------
// Reviewer
// ---------------------------------------------------------------------------

test("Phase 1I authorized reviewer access succeeds", () => {
  const ctx = authorizePlayerRatingRead(reviewerAccess(), {
    subjectScope: SCOPE,
  });
  assert.equal(
    ctx.projectionLevel,
    PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.AUTHORIZED_REVIEWER
  );

  const projected = projectRestrictedPlayerRating(richOverview(), {
    projectionLevel: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.AUTHORIZED_REVIEWER,
    kind: "overview",
  });
  assert.equal(projected.candidates[0].confidence, 82);
  assert.ok(projected.candidates[0].reviewMetrics);
  assert.equal(projected.candidates[0].reviewMetrics.evidenceLevel, 2);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      projected.candidates[0],
      "rawSourceMetadata"
    ),
    false
  );
  assert.equal(projected.history[0].actorId, "verifier-1");
  assert.equal(containsKeyDeep(projected.history, "correlationId"), false);
  assert.equal(containsKeyDeep(projected, "email"), false);
});

test("Phase 1I missing restricted-read capability rejected", () => {
  expectCode(
    () =>
      authorizePlayerRatingRead(
        reviewerAccess({ capabilities: [PLAYER_RATING_READ_CAPABILITY.READ_PUBLIC] }),
        { subjectScope: SCOPE }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_READ_UNAUTHORIZED
  );
});

test("Phase 1I reviewer tenant mismatch rejected", () => {
  expectCode(
    () =>
      authorizePlayerRatingRead(reviewerAccess({ tenantId: "tenant-9" }), {
        subjectScope: SCOPE,
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_TENANT_ACCESS_DENIED
  );
});

test("Phase 1I reviewer scope mismatch rejected", () => {
  expectCode(
    () =>
      authorizePlayerRatingRead(reviewerAccess(), {
        subjectScope: OTHER_SCOPE,
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_TENANT_ACCESS_DENIED
  );
});

test("Phase 1I reviewer projection returns only requested player data shape", () => {
  const projected = projectRestrictedPlayerRating(
    richOverview({ playerId: "player-1" }),
    {
      projectionLevel: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.AUTHORIZED_REVIEWER,
      kind: "overview",
    }
  );
  assert.equal(projected.playerId, "player-1");
  assert.equal(projected.candidates.every((c) => c.playerId === "player-1"), true);
});

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

test("Phase 1I internal requires capability and trustedServerContext", () => {
  expectCode(
    () =>
      authorizePlayerRatingRead(
        internalAccess({ capabilities: [PLAYER_RATING_READ_CAPABILITY.READ_RESTRICTED] }),
        { subjectScope: SCOPE }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_READ_UNAUTHORIZED
  );

  expectCode(
    () =>
      authorizePlayerRatingRead(
        internalAccess({ trustedServerContext: false }),
        { subjectScope: SCOPE }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_READ_UNAUTHORIZED
  );

  const ctx = authorizePlayerRatingRead(internalAccess(), {
    subjectScope: SCOPE,
  });
  assert.equal(ctx.trustedServerContext, true);
});

test("Phase 1I isAdmin alone rejected for internal", () => {
  expectCode(
    () =>
      authorizePlayerRatingRead(
        internalAccess({
          isAdmin: true,
          capabilities: [],
          trustedServerContext: true,
        }),
        { subjectScope: SCOPE }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_READ_UNAUTHORIZED
  );
});

test("Phase 1I internal retains rating-domain data and excludes unrelated profile fields", () => {
  const overview = richOverview();
  overview.candidates[0].email = "nope@example.com";
  overview.candidates[0].phone = "555";
  const projected = projectRestrictedPlayerRating(overview, {
    projectionLevel: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.INTERNAL_SYSTEM,
    kind: "overview",
  });
  assert.equal(projected.candidates[0].confidence, 82);
  assert.ok(projected.candidates[0].rawSourceMetadata);
  assert.equal(projected.history[0].actorId, "verifier-1");
  assert.equal(containsKeyDeep(projected, "email"), false);
  assert.equal(containsKeyDeep(projected, "phone"), false);
});

// ---------------------------------------------------------------------------
// Redaction / immutability / determinism
// ---------------------------------------------------------------------------

test("Phase 1I nested history and snapshots are redacted for self", () => {
  const projected = redactPlayerRatingOverview(richOverview(), {
    projectionLevel: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PLAYER_SELF,
  });
  assert.equal(containsKeyDeep(projected.historySummary, "reason"), false);
  assert.equal(containsKeyDeep(projected.historySummary, "actorId"), false);
  assert.equal(containsKeyDeep(projected.snapshotSummary, "email"), false);
  assert.ok(projected.snapshotSummary[0].snapshotId);
});

test("Phase 1I rejectedRecords and warnings do not leak private fields", () => {
  const projected = redactPlayerRatingOverview(richOverview(), {
    projectionLevel: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PUBLIC,
  });
  assert.equal(containsKeyDeep(projected.rejectedRecords, "rawSourceMetadata"), false);
  assert.equal(containsKeyDeep(projected.rejectedRecords, "aliases"), false);
  assert.equal(containsKeyDeep(projected.rejectedRecords, "evidence"), false);
  assert.equal(containsKeyDeep(projected.rejectedRecords, "confidence"), false);
  assert.ok(!projected.warnings.includes("INTERNAL_REVIEWER_EVIDENCE_PRESENT"));
});

test("Phase 1I redaction does not mutate source and produces no generated ids", () => {
  const source = richOverview();
  const before = JSON.stringify(source);
  const a = redactPlayerRatingCandidate(source.candidates[0], {
    projectionLevel: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PUBLIC,
  });
  const b = redactPlayerRatingCandidate(source.candidates[0], {
    projectionLevel: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PUBLIC,
  });
  assert.equal(JSON.stringify(source), before);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(a.candidateId, source.candidates[0].candidateId);
});

// ---------------------------------------------------------------------------
// Secure facade
// ---------------------------------------------------------------------------

test("Phase 1I secure facade exposes read methods only and requires access context", async () => {
  const secure = await createSecureFacade();
  assert.deepEqual(Object.keys(secure).sort(), [...SECURE_METHODS].sort());
  for (const method of FORBIDDEN_WRITE_METHODS) {
    assert.equal(typeof secure[method], "undefined");
  }

  await expectCodeAsync(
    () =>
      secure.getPublicOverview({
        playerId: "player-1",
        scope: SCOPE,
        sourceRecords: [v5Source()],
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_READ_UNAUTHORIZED
  );

  const publicView = await secure.getPublicOverview(
    {
      playerId: "player-1",
      scope: SCOPE,
      sourceRecords: [v5Source()],
    },
    publicAccess()
  );
  assert.equal(publicView.availabilityStatus, "AVAILABLE");
  assert.equal(containsKeyDeep(publicView, "confidence"), false);
  assert.equal(containsKeyDeep(publicView, "rawSourceMetadata"), false);

  const selfView = await secure.getSelfOverview(
    {
      playerId: "player-1",
      scope: SCOPE,
      sourceRecords: [v5Source()],
    },
    selfAccess()
  );
  assert.ok(selfView.historySummary.length >= 1);
  assert.equal(containsKeyDeep(selfView, "rawSourceMetadata"), false);

  const reviewerView = await secure.getReviewerOverview(
    {
      playerId: "player-1",
      scope: SCOPE,
      sourceRecords: [v5Source()],
    },
    reviewerAccess()
  );
  assert.ok(reviewerView.candidates[0].confidence != null);

  const internalView = await secure.getInternalOverview(
    {
      playerId: "player-1",
      scope: SCOPE,
      sourceRecords: [v5Source()],
    },
    internalAccess()
  );
  assert.ok(internalView.candidates[0].rawSourceMetadata);
  assert.equal(containsKeyDeep(internalView, "email"), false);
});

test("Phase 1I secure facade rejects subject mismatch and unsupported level", async () => {
  const secure = await createSecureFacade();
  await expectCodeAsync(
    () =>
      secure.getPublicOverview(
        {
          playerId: "player-2",
          scope: SCOPE,
          sourceRecords: [v5Source()],
        },
        publicAccess({ subjectPlayerId: "player-1" })
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_SUBJECT_MISMATCH
  );

  expectCode(
    () =>
      authorizePlayerRatingRead(
        publicAccess({ projectionLevel: "ADMIN_UI_ROLE" }),
        { subjectScope: SCOPE }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_PROJECTION_LEVEL_UNSUPPORTED
  );
});

test("Phase 1I global scope denied without global capability", () => {
  expectCode(
    () =>
      authorizePlayerRatingRead(
        publicAccess({
          tenantId: undefined,
          globalScope: "global",
          capabilities: [PLAYER_RATING_READ_CAPABILITY.READ_PUBLIC],
        }),
        { subjectScope: { kind: "global" } }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_GLOBAL_SCOPE_DENIED
  );

  const ctx = authorizePlayerRatingRead(
    publicAccess({
      tenantId: undefined,
      globalScope: "global",
      capabilities: [
        PLAYER_RATING_READ_CAPABILITY.READ_PUBLIC,
        PLAYER_RATING_READ_CAPABILITY.READ_GLOBAL,
      ],
    }),
    { subjectScope: { kind: "global" } }
  );
  assert.equal(ctx.globalScope, "global");
});

// ---------------------------------------------------------------------------
// Boundaries / phase metadata
// ---------------------------------------------------------------------------

test("Phase 1I security-privacy module has no forbidden imports or generators", () => {
  assert.equal(PLAYER_RATING_SECURITY_PRIVACY_PHASE.id, "1I");
  assert.equal(PLAYER_RATING_SECURITY_PRIVACY_PHASE.hasWriteApi, false);
  assert.equal(PLAYER_RATING_SECURITY_PRIVACY_PHASE.convertsScales, false);
  assert.equal(PLAYER_RATING_SECURITY_PRIVACY_PHASE.selectsWinner, false);
  assert.equal(PLAYER_RATING_SECURITY_PRIVACY_PHASE.selectsRuntimeSsot, false);

  const files = readAllJsFiles(SECURITY_ROOT);
  assert.ok(files.length > 0);
  const joined = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");

  const forbidden = [
    /from\s+['"][^'"]*supabase/i,
    /localStorage/,
    /from\s+['"][^'"]*features\/identity/i,
    /from\s+['"][^'"]*features\/rbac/i,
    /from\s+['"][^'"]*competition-core/i,
    /from\s+['"][^'"]*vpr-ranking/i,
    /from\s+['"][^'"]*features\/player\//i,
    /from\s+['"][^'"]*features\/club/i,
    /from\s+['"][^'"]*pages\//i,
    /Date\.now\s*\(/,
    /Math\.random\s*\(/,
    /crypto\.randomUUID/,
    /uuidv4/,
  ];
  for (const pattern of forbidden) {
    assert.equal(pattern.test(joined), false, `forbidden pattern ${pattern}`);
  }

  // Foundation security-privacy must not import Phase 1H files for mutation;
  // secure facade may consume the facade factory via foundation barrel only.
  const securityImports = files
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");
  assert.equal(/from\s+['"]\.\.\/read-facade\//.test(securityImports), false);
});

test("Phase 1I foundation exports security-privacy surface", async () => {
  const mod = await import("../src/features/player-rating/foundation/index.js");
  for (const name of [
    "createSecurePlayerRatingReadFacade",
    "projectPublicPlayerRating",
    "projectRestrictedPlayerRating",
    "createPlayerRatingPrivacyPolicy",
    "authorizePlayerRatingRead",
    "validatePlayerRatingScopeAccess",
    "redactPlayerRatingCandidate",
    "redactPlayerRatingOverview",
    "PLAYER_RATING_PRIVACY_PROJECTION_LEVEL",
    "PLAYER_RATING_READ_CAPABILITY",
  ]) {
    assert.ok(name in mod, `missing export ${name}`);
  }

  // Ensure foundation tree still has no Supabase/localStorage in security module path.
  const securityFiles = readAllJsFiles(SECURITY_ROOT);
  for (const file of securityFiles) {
    const text = fs.readFileSync(file, "utf8");
    assert.equal(text.includes("localStorage"), false);
    assert.equal(/supabase/i.test(text), false);
  }

  // Touch foundation root listing for ownership boundary sanity.
  assert.ok(fs.existsSync(path.join(FOUNDATION_ROOT, "security-privacy")));
});
