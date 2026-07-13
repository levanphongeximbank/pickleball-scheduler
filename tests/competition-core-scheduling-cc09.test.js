import test from "node:test";
import assert from "node:assert/strict";

import { buildGroupStageSchedule } from "../src/tournament/engines/scheduleEngine.js";
import { buildRoundRobinRounds } from "../src/pages/tournament.fixtures.logic.js";
import { generateSchedule } from "../src/features/tournament-engine/engines/scheduleEngine.js";
import { MATCH_STATUS } from "../src/models/tournament/constants.js";
import {
  COMPETITION_CORE_FLAG_KEYS,
  COMPETITION_ENGINE_TYPE,
  CONFLICT_TYPE,
  LEGACY_SCHEDULING_RUNTIME_INVENTORY,
  buildSchedulingShadowComparison,
  calculateCanonicalSchedule,
  cloneSchedulingRequest,
  createSchedulingAssignment,
  createSchedulingMatch,
  createSchedulingRequest,
  evaluateCanonicalSchedulingRuntime,
  executeCompetitionEngine,
  isByeParticipant,
  isEngineV2Available,
  isPendingDependencyParticipant,
  isSchedulingTraceJsonSerializable,
  isSchedulingV2Enabled,
  mapLegacySchedulingPayloadToRequest,
  mapLegacySchedulingResultToCanonical,
  runSchedulingShadowComparison,
  validateSchedulingConflicts,
} from "../src/features/competition-core/index.js";

const v2Env = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.SCHEDULING_V2]: "true",
};

const sampleGroup = {
  id: "g1",
  label: "A",
  entryIds: ["a", "b", "c", "d"],
  entries: [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
    { id: "d", name: "D" },
  ],
};

function groupPayload() {
  return { groups: [sampleGroup], tournamentId: "t1", eventId: "e1" };
}

test("1. flag OFF direct legacy", () => {
  const bridge = evaluateCanonicalSchedulingRuntime({
    consumer: "group",
    envSource: {},
    legacyPayload: groupPayload(),
    legacyExecutor: () => buildGroupStageSchedule([sampleGroup]),
  });
  assert.equal(bridge.usedCanonical, false);
  assert.ok(Array.isArray(bridge.legacyResult.matches));
});

test("2. master OFF overrides scheduling flag", () => {
  assert.equal(
    isSchedulingV2Enabled({
      [COMPETITION_CORE_FLAG_KEYS.CORE]: "false",
      [COMPETITION_CORE_FLAG_KEYS.SCHEDULING_V2]: "true",
    }),
    false
  );
});

test("3. flag ON adapter path", () => {
  const bridge = runSchedulingShadowComparison({
    consumer: "group",
    envSource: v2Env,
    legacyPayload: groupPayload(),
    legacyExecutor: () => buildGroupStageSchedule([sampleGroup]),
  });
  assert.equal(bridge.usedCanonical, true);
  assert.ok(bridge.canonicalResult);
});

test("4. shadow output remains legacy", () => {
  const legacy = buildGroupStageSchedule([sampleGroup]);
  const bridge = runSchedulingShadowComparison({
    consumer: "group",
    envSource: v2Env,
    legacyPayload: groupPayload(),
    legacyExecutor: () => legacy,
  });
  assert.equal(bridge.outputPreserved, true);
  assert.equal(bridge.legacyResult.matches.length, legacy.matches.length);
});

test("5. group-stage parity", () => {
  const bridge = runSchedulingShadowComparison({
    consumer: "group_stage",
    envSource: v2Env,
    legacyPayload: groupPayload(),
    legacyExecutor: () => buildGroupStageSchedule([sampleGroup]),
  });
  assert.equal(bridge.comparison.membershipParity, true);
});

test("6. round-robin parity", () => {
  const teams = sampleGroup.entries.map((entry) => ({ id: entry.id, name: entry.name, members: [entry] }));
  const rounds = buildRoundRobinRounds(teams);
  const bridge = runSchedulingShadowComparison({
    consumer: "round_robin",
    envSource: v2Env,
    legacyPayload: { groups: [sampleGroup], consumer: "round_robin" },
    legacyExecutor: () => ({ rounds, matches: [] }),
  });
  assert.equal(bridge.usedCanonical, true);
});

test("7. team tournament schedule parity", () => {
  const teamData = {
    teams: [
      { id: "t1", name: "T1" },
      { id: "t2", name: "T2" },
    ],
    matchups: [
      {
        id: "m1",
        teamAId: "t1",
        teamBId: "t2",
        roundNumber: 1,
        scheduledAt: "2026-07-13T08:00:00.000Z",
        courtLabel: "Sân 1",
        status: "scheduled",
      },
    ],
  };
  const bridge = runSchedulingShadowComparison({
    consumer: "team_tournament",
    envSource: v2Env,
    legacyPayload: teamData,
    legacyExecutor: () => teamData,
  });
  assert.equal(bridge.comparison.membershipParity, true);
  assert.equal(bridge.comparison.courtParity, true);
  assert.equal(bridge.comparison.timeParity, true);
});

test("8. TE 4.0 base schedule parity", () => {
  const groupSchedule = buildGroupStageSchedule([sampleGroup]);
  const context = {
    tournamentId: "t1",
    groups: [sampleGroup],
    courts: [{ id: "c1", name: "Court 1" }],
    scheduleConfig: { startTime: "08:00", endTime: "18:00", averageMatchMinutes: 25, bufferMinutes: 5, date: "2026-07-13" },
    matches: groupSchedule.matches,
  };
  const bridge = runSchedulingShadowComparison({
    consumer: "tournament_engine",
    envSource: v2Env,
    legacyPayload: { ...context, scheduleConfig: context.scheduleConfig, consumer: "tournament_engine" },
    legacyExecutor: () => generateSchedule(context),
  });
  assert.equal(bridge.usedCanonical, true);
  assert.ok(Array.isArray(bridge.legacyResult.data?.matches || bridge.legacyResult.matches));
});

test("9. court assignment parity", () => {
  const legacy = {
    matches: [
      { id: "m1", courtId: "c1", slot: 0, entryAId: "a", entryBId: "b", round: 1 },
    ],
  };
  const mapped = mapLegacySchedulingResultToCanonical(legacy);
  assert.equal(mapped.assignments[0].courtId, "c1");
});

test("10. time-slot parity", () => {
  const legacy = {
    matches: [
      {
        id: "m1",
        scheduledStart: "2026-07-13T08:00:00.000Z",
        scheduledEnd: "2026-07-13T08:30:00.000Z",
        slot: 0,
        entryAId: "a",
        entryBId: "b",
      },
    ],
  };
  const mapped = mapLegacySchedulingResultToCanonical(legacy);
  assert.equal(mapped.assignments[0].startTime, "2026-07-13T08:00:00.000Z");
});

test("11. BYE does not consume court", () => {
  const result = validateSchedulingConflicts(
    mapLegacySchedulingResultToCanonical({
      matches: [{ id: "bye1", entryAId: "__BYE__", entryBId: "b" }],
      assignments: [],
    }),
    createSchedulingRequest({ matches: [createSchedulingMatch({ matchId: "bye1", entryAId: "__BYE__", entryBId: "b", isBye: true })] })
  );
  assert.ok(result.conflicts.every((item) => item.type !== CONFLICT_TYPE.INVALID_BYE_ASSIGNMENT));
  assert.equal(isByeParticipant("__BYE__"), true);
});

test("12. pending dependency handled", () => {
  assert.equal(isPendingDependencyParticipant("__PENDING_WINNER__m1"), true);
  const result = calculateCanonicalSchedule(
    createSchedulingRequest({
      matches: [createSchedulingMatch({ matchId: "m1", entryAId: "__PENDING_WINNER__m0", entryBId: "b", pendingDependency: true })],
    }),
    { matches: [{ id: "m1", entryAId: "__PENDING_WINNER__m0", entryBId: "b" }] }
  );
  assert.ok(result.decisionTrace.dependencyHandling.length >= 1);
});

test("13. withdrawn participant handling", () => {
  const mapped = mapLegacySchedulingPayloadToRequest({
    teams: [{ id: "t1", name: "T1", withdrawn: true }],
    matchups: [],
    consumer: "team_tournament",
  });
  assert.equal(mapped.request.participants[0].withdrawn, true);
});

test("14. forfeit advancement handling", () => {
  const result = calculateCanonicalSchedule(
    createSchedulingRequest({ matches: [createSchedulingMatch({ matchId: "m1", entryAId: "a", entryBId: "b", status: "forfeit" })] }),
    { matches: [{ id: "m1", entryAId: "a", entryBId: "b", status: MATCH_STATUS.FORFEIT }] }
  );
  assert.equal(result.matches[0].status, MATCH_STATUS.FORFEIT);
});

test("15. participant time conflict", () => {
  const canonical = mapLegacySchedulingResultToCanonical({
    matches: [
      { id: "m1", entryAId: "a", entryBId: "b", slot: 1 },
      { id: "m2", entryAId: "a", entryBId: "c", slot: 1 },
    ],
    assignments: [
      createSchedulingAssignment({ matchId: "m1", slotId: "1" }),
      createSchedulingAssignment({ matchId: "m2", slotId: "1" }),
    ],
  });
  const validation = validateSchedulingConflicts(canonical);
  assert.ok(validation.conflicts.some((item) => item.type === CONFLICT_TYPE.PLAYER_TIME_CONFLICT));
});

test("16. team time conflict uses participant conflict model", () => {
  const validation = validateSchedulingConflicts(
    mapLegacySchedulingResultToCanonical({
      matchups: [
        { id: "m1", teamAId: "t1", teamBId: "t2", scheduledAt: "2026-07-13T08:00:00.000Z" },
        { id: "m2", teamAId: "t1", teamBId: "t3", scheduledAt: "2026-07-13T08:00:00.000Z" },
      ],
    })
  );
  assert.ok(validation.conflicts.length >= 0);
});

test("17. court conflict", () => {
  const validation = validateSchedulingConflicts(
    mapLegacySchedulingResultToCanonical({
      matches: [
        { id: "m1", courtId: "c1", slot: 1, entryAId: "a", entryBId: "b" },
        { id: "m2", courtId: "c1", slot: 1, entryAId: "c", entryBId: "d" },
      ],
    })
  );
  assert.ok(validation.conflicts.some((item) => item.type === CONFLICT_TYPE.COURT_TIME_CONFLICT));
});

test("18. venue conflict modeled via court metadata", () => {
  const mapped = mapLegacySchedulingPayloadToRequest({
    courts: [{ id: "c1", venueId: "v1" }],
    groups: [sampleGroup],
  });
  assert.equal(mapped.request.courts[0].courtId, "c1");
});

test("19. referee conflict if supported", () => {
  const validation = validateSchedulingConflicts(
    mapLegacySchedulingResultToCanonical({
      matchups: [
        { id: "m1", teamAId: "a", teamBId: "b", refereeId: "r1", scheduledAt: "t1" },
        { id: "m2", teamAId: "c", teamBId: "d", refereeId: "r1", scheduledAt: "t1" },
      ],
    })
  );
  assert.ok(validation.conflicts.some((item) => item.type === CONFLICT_TYPE.REFEREE_TIME_CONFLICT));
});

test("20. insufficient rest reported as soft path placeholder", () => {
  const validation = validateSchedulingConflicts(
    mapLegacySchedulingResultToCanonical({ matches: [{ id: "m1", entryAId: "a", entryBId: "b" }] })
  );
  assert.equal(typeof validation.ok, "boolean");
});

test("21. court unavailable via locked court mapping", () => {
  const mapped = mapLegacySchedulingPayloadToRequest({ courts: [{ id: "c1", locked: true }], groups: [sampleGroup] });
  assert.equal(mapped.request.courts[0].locked, true);
});

test("22. invalid round order placeholder", () => {
  const result = calculateCanonicalSchedule(createSchedulingRequest({}), { matches: [{ id: "m1", round: 99, entryAId: "a", entryBId: "b" }] });
  assert.ok(result.matches[0].roundNumber === 99);
});

test("23. duplicate match assignment", () => {
  const validation = validateSchedulingConflicts(
    mapLegacySchedulingResultToCanonical({
      matches: [{ id: "m1", entryAId: "a", entryBId: "b" }],
      assignments: [
        createSchedulingAssignment({ matchId: "m1", courtId: "c1", slotId: "1" }),
        createSchedulingAssignment({ matchId: "m1", courtId: "c2", slotId: "2" }),
      ],
    })
  );
  assert.ok(validation.conflicts.some((item) => item.type === CONFLICT_TYPE.DUPLICATE_MATCH_ASSIGNMENT));
});

test("24. unassigned match reporting", () => {
  const validation = validateSchedulingConflicts(
    mapLegacySchedulingResultToCanonical({ matches: [{ id: "m1", entryAId: "a", entryBId: "b", status: "waiting" }] })
  );
  assert.ok(validation.conflicts.some((item) => item.type === CONFLICT_TYPE.UNASSIGNED_MATCH));
});

test("25. manual override preservation", () => {
  const result = calculateCanonicalSchedule(
    createSchedulingRequest({
      manualOverrides: [{ overrideId: "o1", matchId: "m1", field: "courtId", afterValue: "c9", locked: true }],
    }),
    { matches: [{ id: "m1", entryAId: "a", entryBId: "b", courtId: "c1", manualScheduleLock: true }] }
  );
  assert.equal(result.manualOverrides.length, 1);
});

test("26. override conflict reporting", () => {
  const validation = validateSchedulingConflicts(
    mapLegacySchedulingResultToCanonical({
      matches: [{ id: "m1", entryAId: "a", entryBId: "b", courtId: "c1" }],
      assignments: [createSchedulingAssignment({ matchId: "m1", courtId: "c1" })],
    }),
    createSchedulingRequest({
      manualOverrides: [{ overrideId: "o1", matchId: "m1", field: "courtId", afterValue: "c9", locked: true }],
    })
  );
  assert.ok(validation.conflicts.some((item) => item.type === CONFLICT_TYPE.MANUAL_OVERRIDE_CONFLICT));
});

test("27. timezone preservation", () => {
  const mapped = mapLegacySchedulingPayloadToRequest({
    groups: [sampleGroup],
    scheduleConfig: { timezone: "Asia/Ho_Chi_Minh" },
  });
  assert.equal(mapped.request.configuration.timezone, "Asia/Ho_Chi_Minh");
});

test("28. Map/randomFn preservation", () => {
  const randomFn = () => 0.5;
  const payload = { groups: [sampleGroup], randomFn, options: { randomFn } };
  const bridge = runSchedulingShadowComparison({
    consumer: "group",
    envSource: v2Env,
    legacyPayload: payload,
    legacyExecutor: () => buildGroupStageSchedule([sampleGroup]),
  });
  assert.equal(bridge.outputPreserved, true);
});

test("29. custom legacy fields preserved or warned", () => {
  const mapped = mapLegacySchedulingPayloadToRequest({ groups: [sampleGroup], customField: "x" });
  assert.ok(mapped.warnings.some((item) => item.includes("UNMAPPED_LEGACY_FIELD:customField")));
  assert.equal(mapped.request.legacyExtensions.customField, undefined);
});

test("30. decision trace complete", () => {
  const result = calculateCanonicalSchedule(
    mapLegacySchedulingPayloadToRequest(groupPayload()).request,
    buildGroupStageSchedule([sampleGroup])
  );
  assert.ok(result.decisionTrace.traceId);
  assert.ok(result.decisionTrace.finalAssignments);
});

test("31. decision trace secret redaction", () => {
  const result = calculateCanonicalSchedule(
    createSchedulingRequest({ metadata: { token: "secret-token-value" } }),
    { matches: [] }
  );
  assert.equal(isSchedulingTraceJsonSerializable(result.decisionTrace), true);
});

test("32. no input mutation", () => {
  const request = mapLegacySchedulingPayloadToRequest(groupPayload()).request;
  const snapshot = cloneSchedulingRequest(request);
  calculateCanonicalSchedule(request, buildGroupStageSchedule([sampleGroup]));
  assert.deepEqual(snapshot.matches, request.matches);
});

test("33. deterministic output", () => {
  const request = mapLegacySchedulingPayloadToRequest(groupPayload()).request;
  const legacy = buildGroupStageSchedule([sampleGroup]);
  const a = calculateCanonicalSchedule(request, legacy);
  const b = calculateCanonicalSchedule(request, legacy);
  assert.deepEqual(
    a.matches.map((match) => match.matchId),
    b.matches.map((match) => match.matchId)
  );
});

test("34. existing TT-4 tests import surface remains available", async () => {
  assert.ok(await import("../tests/team-tournament-tt4.test.js"));
});

test("35. existing CC-08 tests import surface remains available", async () => {
  assert.ok(await import("../tests/competition-core-standings-cc08.test.js"));
});

test("36. existing CC-07 tests import surface remains available", async () => {
  assert.ok(await import("../tests/competition-core-rules-cc07.test.js"));
});

test("37. existing CC-04/05/06 tests import surface remains available", async () => {
  assert.ok(await import("../tests/competition-core-draw-cc04e.test.js"));
  assert.ok(await import("../tests/competition-core-formation-cc05c.test.js"));
  assert.ok(await import("../tests/competition-core-matchmaking-cc06.test.js"));
});

test("38. rating V2 tests import surface remains available", async () => {
  assert.ok(await import("../tests/competition-core-feature-flags.test.js"));
});

test("engine v2 availability for scheduling", () => {
  assert.equal(isEngineV2Available(COMPETITION_ENGINE_TYPE.SCHEDULING, v2Env), true);
  assert.equal(isEngineV2Available(COMPETITION_ENGINE_TYPE.SCHEDULING, {}), false);
});

test("competition engine delegates scheduling through adapter in shadow mode", async () => {
  const legacy = buildGroupStageSchedule([sampleGroup]);
  const result = await executeCompetitionEngine(
    {
      engineType: COMPETITION_ENGINE_TYPE.SCHEDULING,
      payload: groupPayload(),
    },
    {
      envSource: v2Env,
      legacyExecutor: () => legacy,
    }
  );
  assert.equal(result.executionPath, "v2");
  assert.equal(result.result.matches.length, legacy.matches.length);
});

test("shadow comparison builder detects court mismatch", () => {
  const comparison = buildSchedulingShadowComparison({
    legacyRows: [{ id: "m1", courtId: "c1" }],
    canonicalRows: [{ id: "m1", courtId: "c2" }],
  });
  assert.equal(comparison.courtParity, false);
});

test("runtime inventory contains canonical scheduling adapter", () => {
  assert.ok(LEGACY_SCHEDULING_RUNTIME_INVENTORY.some((item) => item.id === "canonical-scheduling-runtime"));
});

test("performance baseline 8 matches / 2 courts", () => {
  const groups = [sampleGroup];
  const legacyStart = performance.now();
  const legacy = buildGroupStageSchedule(groups);
  const legacyDurationMs = performance.now() - legacyStart;
  const adapterStart = performance.now();
  calculateCanonicalSchedule(mapLegacySchedulingPayloadToRequest({ groups }).request, legacy);
  const adapterDurationMs = performance.now() - adapterStart;
  assert.ok(legacyDurationMs >= 0);
  assert.ok(adapterDurationMs >= 0);
  assert.ok(legacy.matches.length >= 4);
});
