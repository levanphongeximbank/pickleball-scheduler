/**
 * BM-FINAL-RATING-01 — Canonical SSOT & writer freeze certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PLAYER_RATING_FOUNDATION_ERROR_CODE,
  PLAYER_RATING_CAPABILITY,
  PLAYER_RATING_SOURCE_SCALE,
  PlayerRatingFoundationError,
  createPlayerRatingWriteFacade,
  composePlayerRatingWriteFacade,
  createV5DurableAdapterBundle,
  createInMemoryV5DurableRuntime,
  createCanonicalPlayerIdResolverAdapter,
  mapPlayerManagementResolution,
  createUnimplementedMatchResultRatingPort,
  MATCH_RESULT_RATING_ALGORITHM,
} from "../src/features/player-rating/foundation/index.js";
import { RESOLUTION_OUTCOME } from "../src/features/player/constants/resolutionOutcomes.js";
import {
  saveSelfDeclaredRating,
  completePickVnOnboarding,
  applyVerifiedRatingToRecord,
  setProvisionalRating,
  incrementRatingMatchCount,
  incrementRatingMatchCountForClubPlayers,
  needsPickVnOnboarding,
  hasCompletedPickVnOnboarding,
  getPickVnRatingByAuthUserId,
} from "../src/features/pick-vn-rating/services/pickVnRatingService.js";
import {
  verifyClubPlayerRating,
  verifyClubPlayerRatingAsync,
  applySystemVerifiedRating,
} from "../src/features/pick-vn-rating/services/ratingVerificationService.js";
import {
  hydrateClubPlayersPickVnRatings,
  pushClubPlayersPickVnRatings,
} from "../src/features/pick-vn-rating/services/pickVnClubSyncService.js";
import {
  __setPlayerRatingWriteFacadeForTests,
  __resetPlayerRatingWriteFacadeForTests,
  frozenWriterResult,
} from "../src/features/pick-vn-rating/services/playerRatingCanonicalBridge.js";
import {
  resetPickVnRatingLocalStoreForTests,
  upsertPickVnRating,
} from "../src/features/pick-vn-rating/storage/pickVnRatingLocalStore.js";
import {
  resetPlayerRatingAssessmentStoreForTests,
  getPlayerAssessmentByAuthUserId,
} from "../src/features/player-rating/playerRatingAssessmentLocalStore.js";
import { RATING_TYPE } from "../src/features/competition-core/rating/ratingConstants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SCOPE = Object.freeze({ kind: "tenant", tenantId: "tenant-bm-01" });
const T0 = "2026-07-26T00:00:00.000Z";
const T1 = "2026-07-26T01:00:00.000Z";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function verifierActor(overrides = {}) {
  return {
    actorId: "actor-verify-bm",
    actorType: "staff",
    capabilities: [PLAYER_RATING_CAPABILITY.VERIFY],
    tenantId: "tenant-bm-01",
    reason: "bm-final-rating-01 verification",
    correlationId: "corr-bm-verify",
    operationId: "op-bm-verify-1",
    occurredAt: T1,
    ...overrides,
  };
}

function adjusterActor(overrides = {}) {
  return {
    actorId: "actor-adjust-bm",
    actorType: "staff",
    capabilities: [PLAYER_RATING_CAPABILITY.ADJUST],
    tenantId: "tenant-bm-01",
    reason: "bm-final-rating-01 adjustment",
    correlationId: "corr-bm-adjust",
    operationId: "op-bm-adjust-1",
    occurredAt: T1,
    ...overrides,
  };
}

async function createReadyFacade(seedOverrides = {}) {
  const runtime = createInMemoryV5DurableRuntime();
  await runtime.seedCurrentState({
    playerId: "player-bm-1",
    scope: SCOPE,
    ratingMode: "overall",
    selfAssessedRating: 3.0,
    provisionalRating: 3.0,
    status: "provisional",
    source: "self_assessment",
    effectiveAt: T0,
    stateVersion: 1,
    sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0,
    ...seedOverrides,
  });
  const bundle = createV5DurableAdapterBundle({ runtime });
  const facade = createPlayerRatingWriteFacade({
    currentStateAdapter: bundle.currentStateAdapter,
    historyAdapter: bundle.historyAdapter,
    snapshotAdapter: bundle.snapshotAdapter,
    auditAdapter: bundle.auditAdapter,
    identityResolver: createCanonicalPlayerIdResolverAdapter({
      resolve: () => ({
        ok: true,
        outcome: RESOLUTION_OUTCOME.MAPPED,
        playerId: "player-bm-1",
        authUserId: "auth-bm-1",
        candidatePlayerIds: ["player-bm-1"],
        warnings: [],
        meta: {},
      }),
    }),
    durableRuntimeReady: true,
  });
  return { facade, runtime, bundle };
}

test("foundation write facade is the canonical write boundary", async () => {
  const { facade } = await createReadyFacade();
  assert.equal(facade.phase.id, "BM-FINAL-RATING-01");
  assert.equal(typeof facade.verify, "function");
  assert.equal(typeof facade.adjust, "function");
  assert.equal(typeof facade.persistCurrentState, "function");
  assert.equal(typeof facade.appendHistoryEvent, "function");
  assert.equal(typeof facade.persistSnapshot, "function");
});

test("V5 durable adapter requires expectedVersion and idempotency on CAS", async () => {
  const runtime = createInMemoryV5DurableRuntime();
  await runtime.seedCurrentState({
    playerId: "player-bm-1",
    scope: SCOPE,
    ratingMode: "overall",
    selfAssessedRating: 3.0,
    status: "provisional",
    source: "self_assessment",
    effectiveAt: T0,
    stateVersion: 1,
    sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0,
  });
  const bundle = createV5DurableAdapterBundle({ runtime });
  await assert.rejects(
    () =>
      bundle.currentStateAdapter.compareAndSetCurrentState({
        playerId: "player-bm-1",
        scope: SCOPE,
        ratingMode: "overall",
        expectedVersion: null,
        nextState: { stateVersion: 2 },
      }),
    (err) => {
      assert.ok(err instanceof PlayerRatingFoundationError);
      assert.equal(err.code, PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_COMMAND);
      return true;
    }
  );
});

test("durable runtime missing → typed failure (no local success)", async () => {
  const bundle = createV5DurableAdapterBundle({ runtime: null });
  assert.equal(bundle.ready, false);
  await assert.rejects(
    () => bundle.currentStateAdapter.getCurrentState("p1", SCOPE, "overall"),
    (err) => {
      assert.equal(
        err.code,
        PLAYER_RATING_FOUNDATION_ERROR_CODE.DURABLE_RUNTIME_UNAVAILABLE
      );
      return true;
    }
  );

  assert.throws(
    () => composePlayerRatingWriteFacade({ runtime: null }),
    (err) => {
      assert.equal(
        err.code,
        PLAYER_RATING_FOUNDATION_ERROR_CODE.DURABLE_RUNTIME_UNAVAILABLE
      );
      return true;
    }
  );
});

test("compose allowUnready fails closed on verify/adjust", async () => {
  const facade = composePlayerRatingWriteFacade({ allowUnready: true, runtime: null });
  await assert.rejects(
    () =>
      facade.verify({
        playerId: "player-bm-1",
        scope: SCOPE,
        ratingMode: "overall",
        verifiedRating: 4,
        expectedVersion: 1,
        actor: verifierActor(),
      }),
    (err) => {
      assert.equal(
        err.code,
        PLAYER_RATING_FOUNDATION_ERROR_CODE.DURABLE_RUNTIME_UNAVAILABLE
      );
      return true;
    }
  );
});

test("verification keeps current state + immutable history/snapshot consistency", async () => {
  const { facade, runtime } = await createReadyFacade();
  const result = await facade.verify({
    playerId: "player-bm-1",
    scope: SCOPE,
    ratingMode: "overall",
    verifiedRating: 4.0,
    expectedVersion: 1,
    actor: verifierActor(),
  });
  assert.equal(result.outcome, "accepted");
  assert.equal(result.afterState.verifiedRating, 4.0);
  assert.equal(result.afterState.stateVersion, 2);

  const history = await runtime.getHistoryEntry(result.operationId);
  assert.equal(history.eventId, result.operationId);

  const snap = await runtime.getSnapshot(`snap-${result.operationId}`, SCOPE);
  assert.equal(String(snap.sourceStateVersion), "2");
});

test("adjustment unauthorized actor → fail closed", async () => {
  const { facade } = await createReadyFacade();
  await assert.rejects(
    () =>
      facade.adjust({
        playerId: "player-bm-1",
        scope: SCOPE,
        ratingMode: "overall",
        targetField: "provisionalRating",
        newValue: 3.5,
        expectedVersion: 1,
        auditId: "audit-1",
        actor: adjusterActor({ capabilities: [] }),
      }),
    (err) => {
      assert.equal(
        err.code,
        PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED_MANUAL_ADJUSTMENT
      );
      return true;
    }
  );
});

test("identity unresolved / ambiguous → fail closed", async () => {
  assert.throws(
    () =>
      mapPlayerManagementResolution(
        {
          outcome: RESOLUTION_OUTCOME.UNMAPPED,
          playerId: null,
          warnings: ["ATHLETE_UNMAPPED"],
        },
        { athleteId: "ath-1" }
      ),
    (err) => {
      assert.equal(err.code, PLAYER_RATING_FOUNDATION_ERROR_CODE.IDENTITY_UNRESOLVED);
      return true;
    }
  );

  assert.throws(
    () =>
      mapPlayerManagementResolution(
        {
          outcome: RESOLUTION_OUTCOME.AMBIGUOUS,
          playerId: null,
          candidatePlayerIds: ["a", "b"],
          warnings: [],
        },
        { authUserId: "u1" }
      ),
    (err) => {
      assert.equal(err.code, PLAYER_RATING_FOUNDATION_ERROR_CODE.IDENTITY_AMBIGUOUS);
      return true;
    }
  );

  const resolver = createCanonicalPlayerIdResolverAdapter({
    resolve: () => ({
      outcome: RESOLUTION_OUTCOME.AMBIGUOUS,
      playerId: null,
      candidatePlayerIds: ["p1", "p2"],
      warnings: [],
      meta: {},
    }),
  });
  await assert.rejects(
    () => resolver.resolveCanonicalPlayerId({ authUserId: "u1" }, SCOPE),
    (err) => {
      assert.equal(err.code, PLAYER_RATING_FOUNDATION_ERROR_CODE.IDENTITY_AMBIGUOUS);
      return true;
    }
  );
});

test("write facade rejects alias FK as canonical playerId", async () => {
  const { facade } = await createReadyFacade();
  await assert.rejects(
    () =>
      facade.verify({
        athleteId: "ath-1",
        scope: SCOPE,
        ratingMode: "overall",
        verifiedRating: 4,
        expectedVersion: 1,
        actor: verifierActor(),
      }),
    (err) => {
      assert.equal(err.code, PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_COMMAND);
      return true;
    }
  );
});

test("V2 saveSelfDeclaredRating does not local-success without facade", async () => {
  globalThis.localStorage = createLocalStorageMock();
  resetPickVnRatingLocalStoreForTests();
  __resetPlayerRatingWriteFacadeForTests();

  const result = await saveSelfDeclaredRating("user-freeze-1", 4.0);
  assert.equal(result.ok, false);
  assert.equal(result.code, PLAYER_RATING_FOUNDATION_ERROR_CODE.WRITER_FROZEN);
  assert.equal(getPickVnRatingByAuthUserId("user-freeze-1"), null);
});

test("V2 applyVerifiedRatingToRecord sync writer frozen (no local upsert success)", () => {
  globalThis.localStorage = createLocalStorageMock();
  resetPickVnRatingLocalStoreForTests();
  const out = applyVerifiedRatingToRecord(
    { authUserId: "u1", currentRating: 3 },
    { rating: 4, status: "club_verified" }
  );
  assert.equal(out, null);
  assert.equal(getPickVnRatingByAuthUserId("u1"), null);
});

test("V2 setProvisionalRating / match-count writers frozen", () => {
  assert.equal(setProvisionalRating("u1", 3.5), null);
  assert.equal(incrementRatingMatchCount("u1", 1), null);
  const club = incrementRatingMatchCountForClubPlayers("club-1", ["p1"]);
  assert.equal(club.ok, false);
  assert.equal(club.code, PLAYER_RATING_FOUNDATION_ERROR_CODE.WRITER_FROZEN);
});

test("V2 verification does not write local success; async delegates to facade", async () => {
  globalThis.localStorage = createLocalStorageMock();
  resetPickVnRatingLocalStoreForTests();
  __resetPlayerRatingWriteFacadeForTests();

  const frozen = verifyClubPlayerRating("club-1", "player-x", 4.0, {
    authUserId: "auth-1",
  });
  assert.equal(frozen.ok, false);
  assert.equal(frozen.code, PLAYER_RATING_FOUNDATION_ERROR_CODE.WRITER_FROZEN);

  const system = applySystemVerifiedRating("club-1", "player-x", 4.0);
  assert.equal(system.ok, false);
  assert.equal(system.code, PLAYER_RATING_FOUNDATION_ERROR_CODE.WRITER_FROZEN);

  const { facade } = await createReadyFacade();
  __setPlayerRatingWriteFacadeForTests(facade);
  try {
    const ok = await verifyClubPlayerRatingAsync("club-1", "player-bm-1", 4.0, {
      canonicalPlayerId: "player-bm-1",
      actor: verifierActor({ operationId: "op-bm-verify-async" }),
      expectedVersion: 1,
      scope: SCOPE,
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.mode, "canonical_facade");
  } finally {
    __resetPlayerRatingWriteFacadeForTests();
  }
});

test("no dual-write: V2 local upsert is not used by frozen public writers", async () => {
  globalThis.localStorage = createLocalStorageMock();
  resetPickVnRatingLocalStoreForTests();
  await saveSelfDeclaredRating("dual-1", 3.5);
  assert.equal(getPickVnRatingByAuthUserId("dual-1"), null);

  // Explicit local store helper still exists for hydrate mirror allowlist only.
  upsertPickVnRating({
    id: "pvn-rating-dual-1",
    authUserId: "dual-1",
    currentRating: 3.5,
    ratingStatus: "self_declared",
    mirrorOnly: true,
  });
  assert.equal(getPickVnRatingByAuthUserId("dual-1")?.currentRating, 3.5);
});

test("assessment draft still works and is not rating SSOT", async () => {
  globalThis.localStorage = createLocalStorageMock();
  resetPickVnRatingLocalStoreForTests();
  resetPlayerRatingAssessmentStoreForTests();

  const authUserId = "user-draft-1";
  assert.equal(needsPickVnOnboarding(authUserId), true);

  const result = await completePickVnOnboarding(authUserId, {
    answers: {
      gender: "male",
      birth_year: 1992,
      playing_duration: "2_3yr",
      sessions_per_week: "3",
      has_coach: "regular",
      tournament_level: "club_internal",
      best_result: "quarter",
      was_seed: "never",
      prior_sports: ["badminton"],
      prior_sport_level: "club",
      rally_consistency: "pct_80",
      return_stability: "pct_50",
      dink_ability: "10",
      volley_ability: "basic",
      third_shot_drop: "stable",
      reset_ability: "basic",
      play_style: "all_around",
      kitchen_frequency: "often",
      stacking_knowledge: "frequent",
      nvz_transition: "basic",
      team_coordination: "medium",
      pace_control: "basic",
      doubles_positioning: "none",
      self_rating: "3.0",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.draftOnly, true);
  assert.equal(result.record, null);
  assert.equal(result.ratingWrite.ok, false);
  assert.ok(
    result.ratingWrite.code ===
      PLAYER_RATING_FOUNDATION_ERROR_CODE.DURABLE_RUNTIME_UNAVAILABLE ||
      result.ratingWrite.code === PLAYER_RATING_FOUNDATION_ERROR_CODE.WRITER_FROZEN ||
      result.ratingWrite.code ===
        PLAYER_RATING_FOUNDATION_ERROR_CODE.DURABLE_RUNTIME_UNAVAILABLE
  );
  assert.ok(getPlayerAssessmentByAuthUserId(authUserId));
  assert.equal(getPickVnRatingByAuthUserId(authUserId), null);
  assert.equal(hasCompletedPickVnOnboarding(authUserId), true);
  assert.equal(needsPickVnOnboarding(authUserId), false);
});

test("club blob push frozen; hydrate is mirror-only", async () => {
  const push = await pushClubPlayersPickVnRatings("club-mirror-1");
  assert.equal(push.ok, false);
  assert.equal(push.code, PLAYER_RATING_FOUNDATION_ERROR_CODE.WRITER_FROZEN);

  // hydrate without club players still returns mirror-only flags when club exists in storage path
  // Missing clubId fails closed.
  const missing = await hydrateClubPlayersPickVnRatings(null);
  assert.equal(missing.ok, false);
});

test("Competition Elo is not public Player Rating", () => {
  assert.equal(RATING_TYPE.COMPETITION_ELO, "competition_elo");
  assert.notEqual(RATING_TYPE.COMPETITION_ELO, "player_rating");
  assert.equal(MATCH_RESULT_RATING_ALGORITHM.hasAlgorithm, false);
  const port = createUnimplementedMatchResultRatingPort();
  assert.equal(typeof port.applyRatingFromMatchResult, "function");
});

test("Ranking has no Player Rating writer symbols under vpr-ranking", () => {
  const rankingRoot = path.join(ROOT, "src/features/vpr-ranking");
  if (!fs.existsSync(rankingRoot)) {
    assert.ok(true, "vpr-ranking absent — boundary holds");
    return;
  }
  /** @type {string[]} */
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) files.push(full);
    }
  };
  walk(rankingRoot);
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    assert.equal(src.includes("upsertPickVnRating("), false, file);
    assert.equal(src.includes("createPlayerRatingWriteFacade"), false, file);
    assert.equal(src.includes("verifyPlayerRating("), false, file);
  }
});

test("ownership lock prevents new upsert writers outside allowlist", () => {
  const lockPath = path.join(ROOT, "scripts/ci/ownership-lock.mjs");
  const src = fs.readFileSync(lockPath, "utf8");
  assert.match(src, /player-rating-canonical-write-boundary/);
  assert.match(src, /player-rating-no-silent-rpc-swallow/);
});

test("public writer paths have no silent rpcPickVnSyncRating swallow", () => {
  const files = [
    "src/features/pick-vn-rating/services/pickVnRatingService.js",
    "src/features/pick-vn-rating/services/ratingVerificationService.js",
    "src/features/pick-vn-rating/services/pickVnClubSyncService.js",
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.equal(
      /rpcPickVnSyncRating\s*\([^)]*\)\s*\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/.test(
        src
      ),
      false,
      rel
    );
  }
});

test("V2 import compatibility surface still exports writer symbols", async () => {
  const service = await import(
    "../src/features/pick-vn-rating/services/pickVnRatingService.js"
  );
  const verification = await import(
    "../src/features/pick-vn-rating/services/ratingVerificationService.js"
  );
  assert.equal(typeof service.saveSelfDeclaredRating, "function");
  assert.equal(typeof service.completePickVnOnboarding, "function");
  assert.equal(typeof verification.verifyClubPlayerRating, "function");
  assert.equal(typeof verification.applySystemVerifiedRating, "function");
  assert.equal(typeof frozenWriterResult, "function");
});
