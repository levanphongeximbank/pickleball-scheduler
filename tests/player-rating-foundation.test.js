import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as foundation from "../src/features/player-rating/foundation/index.js";
import {
  PLAYER_RATING_FOUNDATION_ERROR_CODE,
  PlayerRatingFoundationError,
  PLAYER_RATING_SUPPORTED_MODES,
  createRatingCurrentStateContract,
  createRatingHistoryEntryContract,
  assertHistoryAppendOnly,
  createRatingSnapshotContract,
  assertSnapshotImmutable,
  requireSupportedRatingMode,
  requireExplicitPlayerRatingScope,
  createRatingVerificationRequestContract,
  createRatingAdjustmentRequestContract,
  createRatingApplicationIdentityContract,
  buildRatingApplicationIdentityKey,
  createRatingReversalIdentityContract,
  buildRatingReversalIdentityKey,
  createUnimplementedCanonicalPlayerIdResolverPort,
  createUnimplementedMatchResultRatingPort,
  createUnimplementedRatingSnapshotPort,
  MATCH_RESULT_RATING_ALGORITHM,
  PLAYER_RATING_FOUNDATION_PHASE,
} from "../src/features/player-rating/foundation/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FOUNDATION_ROOT = path.resolve(
  __dirname,
  "../src/features/player-rating/foundation"
);

const BASE_SCOPE = Object.freeze({ kind: "tenant", tenantId: "tenant-1" });
const NOW = "2026-07-23T00:00:00.000Z";

function expectCode(fn, code) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof PlayerRatingFoundationError);
    assert.equal(err.code, code);
    return true;
  });
}

test("public foundation exports are present", () => {
  const required = [
    "PLAYER_RATING_FOUNDATION_PHASE",
    "PLAYER_RATING_FOUNDATION_ERROR_CODE",
    "PlayerRatingFoundationError",
    "PLAYER_RATING_SUPPORTED_MODES",
    "createRatingCurrentStateContract",
    "createRatingHistoryEntryContract",
    "createRatingSnapshotContract",
    "createRatingVerificationRequestContract",
    "createRatingAdjustmentRequestContract",
    "createRatingAdjustmentAuditContract",
    "createRatingApplicationIdentityContract",
    "createRatingReversalIdentityContract",
    "createUnimplementedCanonicalPlayerIdResolverPort",
    "createUnimplementedRatingCurrentStatePort",
    "createUnimplementedRatingHistoryPort",
    "createUnimplementedRatingSnapshotPort",
    "createUnimplementedRatingVerificationPort",
    "createUnimplementedRatingAdjustmentAuditPort",
    "createUnimplementedMatchResultRatingPort",
    "MATCH_RESULT_RATING_ALGORITHM",
  ];
  for (const name of required) {
    assert.ok(name in foundation, `missing export: ${name}`);
  }
  assert.equal(PLAYER_RATING_FOUNDATION_PHASE.wiredToProductionRuntime, false);
  assert.equal(PLAYER_RATING_FOUNDATION_PHASE.hasFinalAlgorithm, false);
});

test("current-state contract validation — happy path and fail-closed", () => {
  const state = createRatingCurrentStateContract({
    playerId: "player-1",
    scope: BASE_SCOPE,
    ratingMode: "overall",
    selfAssessedRating: 3.5,
    status: "provisional",
    source: "self_assessment",
    effectiveAt: NOW,
    lastEventId: "evt-1",
  });
  assert.equal(state.playerId, "player-1");
  assert.equal(state.scope.kind, "tenant");
  assert.equal(state.ratingMode, "overall");
  assert.ok(Object.isFrozen(state));

  expectCode(
    () =>
      createRatingCurrentStateContract({
        scope: BASE_SCOPE,
        ratingMode: "singles",
        status: "draft",
        source: "manual",
        effectiveAt: NOW,
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT
  );
});

test("supported modes overall/singles/doubles; unsupported rejected", () => {
  assert.deepEqual([...PLAYER_RATING_SUPPORTED_MODES], [
    "overall",
    "singles",
    "doubles",
  ]);
  assert.equal(requireSupportedRatingMode("singles"), "singles");
  assert.equal(requireSupportedRatingMode("doubles"), "doubles");
  expectCode(
    () => requireSupportedRatingMode("mixed_doubles"),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.UNSUPPORTED_RATING_MODE
  );
  expectCode(
    () => requireSupportedRatingMode("team"),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.UNSUPPORTED_RATING_MODE
  );
});

test("history contract is append-only", () => {
  const entry = createRatingHistoryEntryContract({
    eventId: "evt-h1",
    playerId: "player-1",
    tenantId: "tenant-1",
    eventType: "PLAYER_RATING_SELF_ASSESSED",
    beforeState: { status: "draft" },
    afterState: { status: "provisional" },
    effectiveAt: NOW,
    recordedAt: NOW,
    actorId: "actor-1",
    correlationId: "corr-1",
  });
  assert.ok(Object.isFrozen(entry));
  assert.throws(() => {
    /** @type {any} */ (entry).afterState = { status: "verified" };
  });
  expectCode(
    () => assertHistoryAppendOnly(entry, "afterState", { status: "verified" }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.HISTORY_MUTATION_FORBIDDEN
  );
});

test("snapshot contract is immutable and requires identity", () => {
  const snapshot = createRatingSnapshotContract({
    snapshotId: "snap-1",
    playerId: "player-1",
    scope: BASE_SCOPE,
    ratingMode: "doubles",
    ratingValue: 4.2,
    sourceStateVersion: "v1",
    effectiveAt: NOW,
    createdAt: NOW,
    correlationId: "corr-snap",
  });
  assert.ok(Object.isFrozen(snapshot));
  expectCode(
    () => assertSnapshotImmutable(snapshot, "ratingValue", 9),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.SNAPSHOT_MUTATION_FORBIDDEN
  );
  expectCode(
    () =>
      createRatingSnapshotContract({
        playerId: "player-1",
        scope: BASE_SCOPE,
        ratingMode: "overall",
        ratingValue: 3,
        sourceStateVersion: "v1",
        effectiveAt: NOW,
        createdAt: NOW,
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT
  );

  const snapshotPort = createUnimplementedRatingSnapshotPort();
  assert.rejects(
    () => snapshotPort.getSnapshot("missing", BASE_SCOPE),
    (err) =>
      err instanceof PlayerRatingFoundationError &&
      err.code === PLAYER_RATING_FOUNDATION_ERROR_CODE.SNAPSHOT_NOT_FOUND
  );
});

test("missing tenant/scope fails closed", () => {
  expectCode(
    () => requireExplicitPlayerRatingScope(null),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED
  );
  expectCode(
    () => requireExplicitPlayerRatingScope({ kind: "tenant", tenantId: "" }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT
  );
  const globalScope = requireExplicitPlayerRatingScope({ kind: "global" });
  assert.equal(globalScope.kind, "global");
});

test("canonical player ID unresolved error from default resolver port", async () => {
  const port = createUnimplementedCanonicalPlayerIdResolverPort();
  await assert.rejects(
    () => port.resolveCanonicalPlayerId({ authUserId: "u1" }, BASE_SCOPE),
    (err) =>
      err instanceof PlayerRatingFoundationError &&
      err.code ===
        PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED
  );
});

test("verification requires server-authorized actor", () => {
  expectCode(
    () =>
      createRatingVerificationRequestContract({
        playerId: "player-1",
        scope: BASE_SCOPE,
        ratingMode: "overall",
        verifiedRating: 4.0,
        actor: { actorId: "admin-1", serverAuthorized: false },
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED_VERIFICATION
  );

  const ok = createRatingVerificationRequestContract({
    playerId: "player-1",
    scope: BASE_SCOPE,
    ratingMode: "overall",
    verifiedRating: 4.0,
    actor: { actorId: "admin-1", serverAuthorized: true },
  });
  assert.equal(ok.actor.serverAuthorized, true);
});

test("manual adjustment requires server-authorized actor", () => {
  expectCode(
    () =>
      createRatingAdjustmentRequestContract({
        playerId: "player-1",
        scope: BASE_SCOPE,
        ratingMode: "singles",
        adjustedRating: 3.8,
        reason: "correction",
        actor: { actorId: "admin-1" },
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED_MANUAL_ADJUSTMENT
  );

  const ok = createRatingAdjustmentRequestContract({
    playerId: "player-1",
    scope: BASE_SCOPE,
    ratingMode: "singles",
    adjustedRating: 3.8,
    reason: "correction",
    actor: { actorId: "admin-1", serverAuthorized: true },
  });
  assert.equal(ok.reason, "correction");
});

test("complete idempotency identity and separate reversal identity", () => {
  expectCode(
    () =>
      createRatingApplicationIdentityContract({
        tenantId: "t1",
        matchId: "m1",
        playerId: "p1",
        ratingType: "overall",
        algorithmVersion: "algo-x",
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT
  );

  const app = createRatingApplicationIdentityContract({
    tenantId: "t1",
    matchId: "m1",
    resultRevision: "r3",
    playerId: "p1",
    ratingType: "overall",
    algorithmVersion: "algo-x",
  });
  assert.equal(
    buildRatingApplicationIdentityKey(app),
    "t1|m1|r3|p1|overall|algo-x"
  );

  expectCode(
    () =>
      createRatingReversalIdentityContract({
        reversalId: "rev-1",
      }),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_APPLICATION_NOT_FOUND_FOR_REVERSAL
  );

  const reversal = createRatingReversalIdentityContract({
    reversalId: "rev-1",
    originalApplicationIdentity: app,
    reason: "match_invalidated",
  });
  assert.equal(reversal.reversalId, "rev-1");
  assert.notEqual(
    buildRatingReversalIdentityKey(reversal),
    buildRatingApplicationIdentityKey(app)
  );
  assert.ok(
    buildRatingReversalIdentityKey(reversal).startsWith("rev-1|")
  );
});

test("MatchResultRatingPort remains unimplemented / no-algorithm by default", async () => {
  assert.equal(MATCH_RESULT_RATING_ALGORITHM.hasAlgorithm, false);
  const port = createUnimplementedMatchResultRatingPort();
  const identity = {
    tenantId: "t1",
    matchId: "m1",
    resultRevision: "r1",
    playerId: "p1",
    ratingType: "doubles",
    algorithmVersion: "unset",
  };

  await assert.rejects(
    () => port.applyRatingFromMatchResult(identity),
    (err) =>
      err instanceof PlayerRatingFoundationError &&
      err.code ===
        PLAYER_RATING_FOUNDATION_ERROR_CODE
          .MATCH_RESULT_RATING_INTEGRATION_UNAVAILABLE
  );

  await assert.rejects(
    () =>
      port.reverseRatingApplication({
        reversalId: "rev-9",
        originalApplicationIdentity: identity,
      }),
    (err) =>
      err instanceof PlayerRatingFoundationError &&
      err.code ===
        PLAYER_RATING_FOUNDATION_ERROR_CODE
          .MATCH_RESULT_RATING_INTEGRATION_UNAVAILABLE
  );
});

test("foundation sources have no Ranking / Competition Engine / Supabase imports", () => {
  /** @type {string[]} */
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) files.push(full);
    }
  }
  walk(FOUNDATION_ROOT);
  assert.ok(files.length > 0);

  const forbidden = [
    /from\s+["'][^"']*vpr-ranking[^"']*["']/,
    /from\s+["'][^"']*competition-core[^"']*["']/,
    /from\s+["'][^"']*@supabase[^"']*["']/,
    /from\s+["'][^"']*supabase[^"']*["']/,
    /createClient\s*\(/,
  ];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(
        pattern.test(source),
        false,
        `forbidden import pattern ${pattern} in ${path.relative(FOUNDATION_ROOT, file)}`
      );
    }
  }
});
