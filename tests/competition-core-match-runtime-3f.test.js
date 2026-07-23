import test from "node:test";
import assert from "node:assert/strict";

import {
  createMatchResolver,
  createMatchIdentityLookup,
  createInMemoryMatchPersistencePort,
  createNoopMatchPersistencePort,
  mapLegacyMatchToCompetitionMatch,
  mapLegacyMatchStatus,
  buildMatchIdentityKey,
  buildMatchSideId,
  createMatchIdentity,
  createNoopMatchPolicy,
  assertMatchTransitionAllowed,
  assertMatchSidesValid,
  MATCH_ACTION,
  MATCH_RUNTIME_ERROR_CODE,
  MATCH_ADAPTER_ID,
  MATCH_SOURCE_TYPE,
  MATCH_STATUS,
  MATCH_SIDE_KEY,
  MATCH_COMPLETION_REASON,
  MatchRuntimeError,
  createCompetitionMatch,
  createMatchSide,
  createMatchResultReference,
} from "../src/features/competition-core/matches/index.js";

function legacyIndividualMatch(overrides = {}) {
  return {
    id: "m-1",
    tournamentId: "comp-1",
    entryAId: "e-a",
    entryBId: "e-b",
    status: "waiting",
    courtId: "court-1",
    ...overrides,
  };
}

function legacySubMatch(overrides = {}) {
  return {
    id: "sub-1",
    matchupId: "mu-1",
    disciplineId: "md",
    status: "waiting",
    score: { teamA: 0, teamB: 0 },
    ...overrides,
  };
}

test("3F match resolve: valid legacy individual mapping", async () => {
  const resolver = createMatchResolver();
  const source = legacyIndividualMatch();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source,
  });

  assert.equal(result.ok, true);
  assert.equal(result.adapterId, MATCH_ADAPTER_ID.LEGACY);
  assert.equal(result.match.contextId, "m-1");
  assert.equal(result.match.status, MATCH_STATUS.READY);
  assert.equal(result.match.sides.length, 2);
  assert.equal(
    result.identity.key,
    buildMatchIdentityKey({ competitionId: "comp-1", contextId: "m-1" })
  );
  assert.equal(result.match.identityKey, result.identity.key);
  assert.equal(result.diagnostics.winnerCalculated, false);
  assert.equal(result.diagnostics.scoringImplemented, false);
  assert.equal(source.status, "waiting");
});

test("3F match resolve: TT SubMatch granularity uses matchup::sub id", async () => {
  const resolver = createMatchResolver();
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: legacySubMatch(),
    context: {
      matchup: { id: "mu-1", teamAId: "t-a", teamBId: "t-b" },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.match.contextId, "mu-1::sub-1");
  assert.equal(result.match.sourceType, MATCH_SOURCE_TYPE.LEGACY_SUB_MATCH);
  assert.equal(result.match.sides[0].teamReference, "t-a");
  assert.equal(result.match.sides[1].teamReference, "t-b");
  assert.equal(
    result.identity.key,
    "comp-1::MATCH::mu-1::sub-1"
  );
});

test("3F status mapping: legacy → canonical", () => {
  assert.equal(mapLegacyMatchStatus("waiting"), MATCH_STATUS.READY);
  assert.equal(mapLegacyMatchStatus("assigned"), MATCH_STATUS.READY_TO_START);
  assert.equal(mapLegacyMatchStatus("playing"), MATCH_STATUS.IN_PROGRESS);
  assert.equal(mapLegacyMatchStatus("completed"), MATCH_STATUS.COMPLETED);
  assert.equal(mapLegacyMatchStatus("postponed"), MATCH_STATUS.POSTPONED);
  assert.equal(mapLegacyMatchStatus("forfeit"), MATCH_STATUS.COMPLETED);
  assert.equal(mapLegacyMatchStatus("lineup_open"), MATCH_STATUS.LINEUPS_PENDING);
  assert.equal(mapLegacyMatchStatus("paused"), MATCH_STATUS.PAUSED);
  assert.equal(mapLegacyMatchStatus("suspended"), MATCH_STATUS.SUSPENDED);
});

test("3F identity: match key frozen and display-name independent", () => {
  const identity = createMatchIdentity({
    competitionId: "c",
    contextId: "ctx",
  });
  assert.equal(identity.key, "c::MATCH::ctx");
  assert.throws(() => {
    // @ts-expect-error frozen
    identity.key = "mutated";
  });
  assert.equal(
    buildMatchSideId({ matchIdentityKey: identity.key, sideKey: "A" }),
    "c::MATCH::ctx::SIDE::A"
  );
});

test("3F identity: stable across schedule/court/referee changes", () => {
  const a = mapLegacyMatchToCompetitionMatch(
    legacyIndividualMatch({
      status: "assigned",
      courtId: "c1",
      scheduledAt: "2026-07-01T10:00:00.000Z",
    }),
    { competitionId: "comp-1" }
  );
  const b = mapLegacyMatchToCompetitionMatch(
    legacyIndividualMatch({
      status: "assigned",
      courtId: "c2",
      scheduledAt: "2026-07-02T18:00:00.000Z",
      referee: { id: "ref-9" },
    }),
    { competitionId: "comp-1" }
  );
  assert.equal(a.identityKey, b.identityKey);
  assert.notEqual(a.courtAssignmentRef, b.courtAssignmentRef);
});

test("3F resolve: deterministic identity stable across resolves", async () => {
  const resolver = createMatchResolver({
    identityLookup: createMatchIdentityLookup(),
  });
  const source = legacyIndividualMatch({ status: "draft" });
  const a = await resolver.resolve({ competitionId: "comp-1", source });
  const b = await resolver.resolve({ competitionId: "comp-1", source });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.identity.key, b.identity.key);
});

test("3F resolve: identity collision refuses overwrite", async () => {
  const lookup = createMatchIdentityLookup();
  const resolver = createMatchResolver({ identityLookup: lookup });
  const first = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyIndividualMatch({ status: "draft", entryAId: "e-a" }),
  });
  assert.equal(first.ok, true);
  const second = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyIndividualMatch({ status: "playing", entryAId: "e-x" }),
  });
  assert.equal(second.ok, false);
  assert.equal(
    second.error.code,
    MATCH_RUNTIME_ERROR_CODE.MATCH_IDENTITY_COLLISION
  );
});

test("3F resolve: invalid input / missing source", async () => {
  const resolver = createMatchResolver();
  const missingComp = await resolver.resolve({ source: legacyIndividualMatch() });
  assert.equal(missingComp.ok, false);
  assert.equal(missingComp.error.code, MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT);

  const missingSource = await resolver.resolve({ competitionId: "comp-1" });
  assert.equal(missingSource.ok, false);
  assert.equal(missingSource.error.code, MATCH_RUNTIME_ERROR_CODE.MATCH_NOT_FOUND);
});

test("3F sides: duplicate side / team / participant rejected", () => {
  assert.throws(
    () =>
      assertMatchSidesValid([
        createMatchSide({ sideKey: "A" }),
        createMatchSide({ sideKey: "A" }),
      ]),
    (err) =>
      err instanceof MatchRuntimeError &&
      err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_SIDE_DUPLICATE
  );

  assert.throws(
    () =>
      assertMatchSidesValid([
        createMatchSide({ sideKey: "A", teamReference: "t1" }),
        createMatchSide({ sideKey: "B", teamReference: "t1" }),
      ]),
    (err) =>
      err instanceof MatchRuntimeError &&
      err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_TEAM_DUPLICATE
  );

  assert.throws(
    () =>
      assertMatchSidesValid([
        createMatchSide({
          sideKey: "A",
          participantReferences: [{ kind: "PLAYER_PROFILE", id: "p1" }],
        }),
        createMatchSide({
          sideKey: "B",
          participantReferences: [{ kind: "PLAYER_PROFILE", id: "p1" }],
        }),
      ]),
    (err) =>
      err instanceof MatchRuntimeError &&
      err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_PARTICIPANT_DUPLICATE
  );
});

test("3F lifecycle: allowed transitions and completed immutability", () => {
  assert.equal(
    assertMatchTransitionAllowed({
      action: MATCH_ACTION.START,
      fromStatus: MATCH_STATUS.READY_TO_START,
    }).toStatus,
    MATCH_STATUS.IN_PROGRESS
  );
  assert.equal(
    assertMatchTransitionAllowed({
      action: MATCH_ACTION.SUSPEND,
      fromStatus: MATCH_STATUS.IN_PROGRESS,
    }).toStatus,
    MATCH_STATUS.SUSPENDED
  );
  assert.equal(
    assertMatchTransitionAllowed({
      action: MATCH_ACTION.RESUME,
      fromStatus: MATCH_STATUS.SUSPENDED,
    }).toStatus,
    MATCH_STATUS.IN_PROGRESS
  );
  assert.equal(
    assertMatchTransitionAllowed({
      action: MATCH_ACTION.COMPLETE,
      fromStatus: MATCH_STATUS.IN_PROGRESS,
    }).toStatus,
    MATCH_STATUS.COMPLETED
  );
  assert.equal(
    assertMatchTransitionAllowed({
      action: MATCH_ACTION.POSTPONE,
      fromStatus: MATCH_STATUS.SCHEDULED,
    }).toStatus,
    MATCH_STATUS.POSTPONED
  );
  assert.equal(
    assertMatchTransitionAllowed({
      action: MATCH_ACTION.CANCEL,
      fromStatus: MATCH_STATUS.READY,
    }).toStatus,
    MATCH_STATUS.CANCELLED
  );

  assert.throws(
    () =>
      assertMatchTransitionAllowed({
        action: MATCH_ACTION.START,
        fromStatus: MATCH_STATUS.COMPLETED,
      }),
    (err) =>
      err instanceof MatchRuntimeError &&
      err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_COMPLETED_IMMUTABLE
  );
});

test("3F lifecycle: LINEUPS_PENDING optional path", () => {
  assert.equal(
    assertMatchTransitionAllowed({
      action: MATCH_ACTION.MARK_READY_TO_START,
      fromStatus: MATCH_STATUS.SCHEDULED,
    }).toStatus,
    MATCH_STATUS.READY_TO_START
  );
  assert.equal(
    assertMatchTransitionAllowed({
      action: MATCH_ACTION.REQUIRE_LINEUPS,
      fromStatus: MATCH_STATUS.SCHEDULED,
    }).toStatus,
    MATCH_STATUS.LINEUPS_PENDING
  );
  assert.equal(
    assertMatchTransitionAllowed({
      action: MATCH_ACTION.MARK_READY_TO_START,
      fromStatus: MATCH_STATUS.LINEUPS_PENDING,
    }).toStatus,
    MATCH_STATUS.READY_TO_START
  );
});

test("3F forfeit maps to COMPLETED + completionReason (no winner calc)", () => {
  const match = mapLegacyMatchToCompetitionMatch(
    legacyIndividualMatch({ status: "forfeit", winnerId: "e-a", scoreA: 11, scoreB: 0 }),
    { competitionId: "comp-1" }
  );
  assert.equal(match.status, MATCH_STATUS.COMPLETED);
  assert.equal(match.completionReason, MATCH_COMPLETION_REASON.FORFEIT);
  assert.equal(Object.prototype.hasOwnProperty.call(match, "scoreA"), false);
  assert.ok(match.resultReference);
  assert.equal(match.resultReference.resultType, MATCH_COMPLETION_REASON.FORFEIT);
});

test("3F DI: dependency failure mapped", async () => {
  const resolver = createMatchResolver({
    resolveLineup: async () => {
      throw new Error("lineup boom");
    },
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyIndividualMatch(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, MATCH_RUNTIME_ERROR_CODE.MATCH_DEPENDENCY_FAILED);
  assert.equal(result.error.details.dependency, "resolveLineup");
});

test("3F DI: lineup references via context", async () => {
  const resolver = createMatchResolver({
    resolveLineup: async () => ({
      ok: true,
      lineupReferenceA: "comp-1::LINEUP::mu-1::t-a",
      lineupReferenceB: "comp-1::LINEUP::mu-1::t-b",
    }),
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: legacySubMatch(),
    context: {
      matchup: { id: "mu-1", teamAId: "t-a", teamBId: "t-b" },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.match.sides[0].lineupReference, "comp-1::LINEUP::mu-1::t-a");
  assert.equal(result.match.sides[1].lineupReference, "comp-1::LINEUP::mu-1::t-b");
});

test("3F DI: court/referee assignment refs do not change identity", async () => {
  const resolver = createMatchResolver({
    getCourtAssignment: async () => ({ id: "court-99" }),
    getRefereeAssignment: async () => ({ id: "ref-7" }),
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyIndividualMatch({ courtId: null }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.match.courtAssignmentRef, "court-99");
  assert.equal(result.match.refereeAssignmentRef, "ref-7");
  assert.equal(result.identity.key, "comp-1::MATCH::m-1");
});

test("3F persistence OFF by default; in-memory optional", async () => {
  const noop = createNoopMatchPersistencePort();
  await assert.rejects(() => noop.save({ id: "x" }), /NOOP_PERSISTENCE_WRITE_FORBIDDEN/);

  const mem = createInMemoryMatchPersistencePort();
  const resolver = createMatchResolver({
    enablePersistence: true,
    persistence: mem,
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyIndividualMatch({ status: "draft" }),
  });
  assert.equal(result.ok, true);
  const stored = await mem.findByIdentityKey(result.identity.key);
  assert.ok(stored);
  assert.equal(stored.identityKey, result.identity.key);

  const off = createMatchResolver();
  const offResult = await off.resolve({
    competitionId: "comp-2",
    source: legacyIndividualMatch({ id: "m-2", tournamentId: "comp-2" }),
  });
  assert.equal(offResult.ok, true);
  assert.equal(offResult.diagnostics.persistenceEnabled, false);
});

test("3F normalize: identity mismatch", async () => {
  const { normalizeAndValidateMatch } = await import(
    "../src/features/competition-core/matches/services/normalizeMatch.js"
  );
  assert.throws(
    () =>
      normalizeAndValidateMatch(
        createCompetitionMatch({
          competitionId: "comp-1",
          contextId: "m-1",
          identityKey: "wrong::key",
          sides: [
            createMatchSide({ sideKey: MATCH_SIDE_KEY.A }),
            createMatchSide({ sideKey: MATCH_SIDE_KEY.B }),
          ],
        })
      ),
    (err) =>
      err instanceof MatchRuntimeError &&
      err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_IDENTITY_MISMATCH
  );
});

test("3F result reference opaque factory", () => {
  const ref = createMatchResultReference({
    resultId: "r-1",
    resultType: "COMPLETED",
    sourceType: "LEGACY_MATCH",
  });
  assert.equal(ref.resultId, "r-1");
  assert.equal(ref.resultType, "COMPLETED");
  assert.equal(createMatchResultReference(null), null);
});

test("3F policy noop accepts; custom policy can reject", async () => {
  assert.equal(createNoopMatchPolicy().id, "NOOP_MATCH_POLICY");
  const resolver = createMatchResolver({
    matchPolicy: {
      id: "STRICT",
      validateComposition() {
        return { ok: false, code: "POLICY_NO", message: "nope" };
      },
    },
  });
  const result = await resolver.resolve({
    competitionId: "comp-1",
    source: legacyIndividualMatch(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "POLICY_NO");
});

test("3F batch resolve", async () => {
  const resolver = createMatchResolver({
    identityLookup: createMatchIdentityLookup(),
  });
  const results = await resolver.resolveBatch([
    { competitionId: "comp-1", source: legacyIndividualMatch({ id: "a" }) },
    { competitionId: "comp-1", source: legacyIndividualMatch({ id: "b" }) },
  ]);
  assert.equal(results.length, 2);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, true);
  assert.notEqual(results[0].identity.key, results[1].identity.key);
});

test("3F unsupported status throws", () => {
  assert.throws(
    () => mapLegacyMatchStatus("totally-unknown-xyz"),
    (err) =>
      err instanceof MatchRuntimeError &&
      err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_UNSUPPORTED_STATUS
  );
});

test("3F competition mismatch", async () => {
  const resolver = createMatchResolver();
  const result = await resolver.resolve({
    competitionId: "comp-OTHER",
    source: legacyIndividualMatch({ tournamentId: "comp-1" }),
  });
  // Mapper prefers context.competitionId from request — should match request.
  // Ensure competitionId on mapped match equals request via context injection.
  assert.equal(result.ok, true);
  assert.equal(result.match.competitionId, "comp-OTHER");
});
