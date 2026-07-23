import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { assertTestModuleAvailable } from "./helpers/testModuleAvailability.js";
import { buildGroupStandingFromMatches } from "../src/tournament/engines/rankingEngine.js";
import { buildGroupStandingFromSessions } from "../src/pages/tournament.standings.logic.js";
import { computeTeamStandings } from "../src/features/team-tournament/engines/teamStandingsEngine.js";
import { MATCHUP_STATUS } from "../src/features/team-tournament/constants.js";
import { MATCH_STATUS } from "../src/models/tournament/constants.js";
import {
  COMPETITION_CORE_FLAG_KEYS,
  COMPETITION_ENGINE_TYPE,
  LEGACY_STANDINGS_RUNTIME_INVENTORY,
  calculateCanonicalStandings,
  evaluateCanonicalStandingsRuntime,
  executeCompetitionEngine,
  isEngineV2Available,
  isStandingsV2Enabled,
  mapLegacyGroupStandingsPayloadToRequest,
  mapLegacyTeamStandingsPayloadToRequest,
  mapStandingsResultToLegacyTeamRows,
  runStandingsShadowComparison,
} from "../src/features/competition-core/index.js";

const v2Env = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.STANDINGS_V2]: "true",
};

const groupPayload = {
  group: { id: "g1", entryIds: ["a", "b", "c"] },
  entries: [
    { id: "a", name: "Alpha" },
    { id: "b", name: "Bravo" },
    { id: "c", name: "Charlie" },
  ],
  matches: [
    { id: "m1", groupId: "g1", entryAId: "a", entryBId: "b", status: MATCH_STATUS.COMPLETED, scoreA: 11, scoreB: 5 },
    { id: "m2", groupId: "g1", entryAId: "a", entryBId: "c", status: MATCH_STATUS.COMPLETED, scoreA: 11, scoreB: 8 },
    { id: "m3", groupId: "g1", entryAId: "b", entryBId: "c", status: MATCH_STATUS.COMPLETED, scoreA: 11, scoreB: 9 },
  ],
};

const teamDataBase = {
  teams: [
    { id: "team-a", name: "A" },
    { id: "team-b", name: "B" },
    { id: "team-c", name: "C" },
  ],
  matchups: [
    {
      id: "mx1",
      teamAId: "team-a",
      teamBId: "team-b",
      status: MATCHUP_STATUS.COMPLETED,
      result: { winnerTeamId: "team-a", teamAWins: 3, teamBWins: 1, teamAPoints: 33, teamBPoints: 20 },
    },
    {
      id: "mx2",
      teamAId: "team-a",
      teamBId: "team-c",
      status: MATCHUP_STATUS.COMPLETED,
      result: { winnerTeamId: "team-a", teamAWins: 3, teamBWins: 0, teamAPoints: 33, teamBPoints: 11 },
    },
    {
      id: "mx3",
      teamAId: "team-b",
      teamBId: "team-c",
      status: MATCHUP_STATUS.COMPLETED,
      result: { winnerTeamId: "team-b", teamAWins: 3, teamBWins: 2, teamAPoints: 30, teamBPoints: 28 },
    },
  ],
  settings: { tiebreakOrder: ["wins", "subMatchDiff", "pointsScored", "manual"] },
};

function assertShadowOk(bridge, label) {
  assert.equal(bridge.usedCanonical, true, `${label}: expected canonical shadow path`);
  assert.equal(bridge.outputPreserved, true, `${label}: legacy output must remain primary`);
  assert.ok(bridge.comparison, `${label}: comparison object required`);
  assert.equal(bridge.comparison.membershipParity, true, `${label}: membershipParity`);
  assert.equal(bridge.comparison.rankParity, true, `${label}: rankParity`);
  assert.equal(bridge.comparison.pointsParity, true, `${label}: pointsParity`);
}

test("CC08C-1 latest standardization imports CC-08 exports cleanly", async () => {
  const mod = await import("../src/features/competition-core/index.js");
  assert.equal(typeof mod.calculateCanonicalStandings, "function");
  assert.equal(typeof mod.evaluateCanonicalStandingsRuntime, "function");
  assert.equal(typeof mod.LEGACY_STANDINGS_RUNTIME_INVENTORY, "object");
});

test("CC08C-2 competition core exports remain valid after rebase", () => {
  assert.ok(Array.isArray(LEGACY_STANDINGS_RUNTIME_INVENTORY));
  assert.ok(LEGACY_STANDINGS_RUNTIME_INVENTORY.some((item) => item.id === "canonical-standings-runtime"));
});

test("CC08C-3 legacy adapter routing delegates standings in shadow mode", async () => {
  const result = await executeCompetitionEngine(
    {
      engineType: COMPETITION_ENGINE_TYPE.STANDINGS,
      payload: { entries: [{ id: "a" }], matches: [] },
    },
    {
      envSource: v2Env,
      legacyExecutor: () => ({ standing: [{ id: "a", rank: 1, matchPoints: 0 }] }),
    }
  );
  assert.equal(result.executionPath, "v2");
  assert.deepEqual(result.result.standing, [{ id: "a", rank: 1, matchPoints: 0 }]);
});

test("CC08C-4 TT-4 forfeit outcomes preserve wins/losses and expose forfeitWins metadata (TT-7)", () => {
  const teamData = {
    ...teamDataBase,
    matchups: [
      {
        id: "forfeit-mx",
        teamAId: "team-a",
        teamBId: "team-b",
        status: MATCHUP_STATUS.COMPLETED,
        result: {
          winnerTeamId: "team-a",
          teamAWins: 3,
          teamBWins: 0,
          teamAPoints: 0,
          teamBPoints: 0,
          resultType: "forfeit",
        },
      },
    ],
  };
  const legacy = computeTeamStandings(teamData);
  const rows = legacy.standings;
  const rowA = rows.find((row) => row.teamId === "team-a");
  const rowB = rows.find((row) => row.teamId === "team-b");
  assert.equal(rowA.wins, 1);
  assert.equal(rowB.losses, 1);
  assert.equal(rowA.rankingPoints, 2);
  assert.equal(rowB.rankingPoints, 1);
  // TT-7: forfeit metadata is additive; wins/losses remain canonical matchup counters.
  assert.equal(rowA.forfeitWins, 1);
  assert.equal(rowB.forfeitWins, 0);
});

test("CC08C-5 withdrawal winnerTeamId does not corrupt team standings", () => {
  const teamData = {
    teams: [
      { id: "team-a", name: "A" },
      { id: "team-b", name: "B" },
    ],
    matchups: [
      {
        id: "withdraw-mx",
        teamAId: "team-a",
        teamBId: "team-b",
        status: MATCHUP_STATUS.COMPLETED,
        result: {
          winnerTeamId: "team-b",
          teamAWins: 0,
          teamBWins: 3,
          teamAPoints: 0,
          teamBPoints: 0,
          resultType: "team_withdrawal",
        },
      },
    ],
    settings: { tiebreakOrder: ["wins", "subMatchDiff", "pointsScored", "manual"] },
  };
  const bridge = runStandingsShadowComparison({
    consumer: "team_tournament",
    envSource: v2Env,
    legacyPayload: teamData,
    legacyExecutor: () => computeTeamStandings(teamData),
  });
  assertShadowOk(bridge, "withdrawal");
});

test("CC08C-6 team tournament ranking shadow parity on latest base", () => {
  const bridge = runStandingsShadowComparison({
    consumer: "team_tournament",
    envSource: v2Env,
    legacyPayload: teamDataBase,
    legacyExecutor: () => computeTeamStandings(teamDataBase),
  });
  assertShadowOk(bridge, "team tournament");
});

test("CC08C-7 individual group ranking shadow parity on latest base", () => {
  const bridge = runStandingsShadowComparison({
    consumer: "group",
    envSource: v2Env,
    legacyPayload: groupPayload,
    legacyExecutor: () => buildGroupStandingFromMatches(groupPayload),
  });
  assertShadowOk(bridge, "individual group");
});

test("CC08C-8 tournament engine 4.0 base standing shadow parity (buildGroupStandingFromMatches)", () => {
  const bridge = runStandingsShadowComparison({
    consumer: "tournament_engine",
    envSource: v2Env,
    legacyPayload: {
      ...groupPayload,
      qualifiersCount: 2,
    },
    legacyExecutor: () => buildGroupStandingFromMatches(groupPayload),
  });
  assertShadowOk(bridge, "TE 4.0 base standing");
});

test("CC08C-9 multi-way tie mini-table still passes on latest base", () => {
  const mapped = mapLegacyGroupStandingsPayloadToRequest(groupPayload);
  const result = calculateCanonicalStandings(mapped.request);
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[0].entryId, "a");
});

test("CC08C-10 deterministic draw-lot still passes on latest base", () => {
  const request = mapLegacyGroupStandingsPayloadToRequest({
    group: { id: "draw-seed", entryIds: ["a", "b"] },
    entries: [
      { id: "a", name: "A", seed: 1 },
      { id: "b", name: "B", seed: 1 },
    ],
    matches: [],
  }).request;
  const first = calculateCanonicalStandings(request);
  const second = calculateCanonicalStandings(request);
  assert.deepEqual(
    first.rows.map((row) => row.entryId),
    second.rows.map((row) => row.entryId)
  );
});

test("CC08C-11 manual overrides preserved through canonical engine", () => {
  const mapped = mapLegacyGroupStandingsPayloadToRequest({
    ...groupPayload,
    manualOverrides: [
      {
        overrideId: "ov1",
        overrideType: "rank",
        affectedEntryId: "c",
        afterRank: 1,
        reason: "BTC",
      },
    ],
  });
  const result = calculateCanonicalStandings(mapped.request);
  assert.equal(result.rows.find((row) => row.entryId === "c").rank, 1);
});

test("CC08C-12 qualification status preserved", () => {
  const mapped = mapLegacyGroupStandingsPayloadToRequest({
    ...groupPayload,
    qualifiersCount: 2,
  });
  const result = calculateCanonicalStandings(mapped.request, {
    groupComplete: true,
    applyQualification: true,
  });
  const qualified = result.rows.filter((row) => row.qualificationStatus === "QUALIFIED");
  assert.equal(qualified.length, 2);
});

test("CC08C-13 session standings path is legacy-only and not adapter-wired", () => {
  const sessionInventory = LEGACY_STANDINGS_RUNTIME_INVENTORY.find(
    (item) => item.id === "legacy-session-standings"
  );
  assert.ok(sessionInventory);
  assert.equal(sessionInventory.legacyEngine, "tournament.standings.logic");
  const sessionResult = buildGroupStandingFromSessions(
    [
      {
        meta: { roundId: "r1" },
        result: {
          status: "completed",
          courts: [{ courtId: "1", teamAScore: 11, teamBScore: 5 }],
        },
        courts: [{ court: "1", teamA: [{ id: "p1", name: "P1" }], teamB: [{ id: "p2", name: "P2" }] }],
      },
    ],
    { id: "r1", name: "Bang A" }
  );
  assert.ok(Array.isArray(sessionResult.standing));
  const bridge = evaluateCanonicalStandingsRuntime({
    consumer: "session_standings_probe",
    envSource: v2Env,
    legacyPayload: { sessions: [], round: {} },
    legacyExecutor: () => sessionResult,
  });
  assert.equal(bridge.outputPreserved, true);
});

test("CC08C-14 flag OFF retains legacy for all standings paths", () => {
  const bridge = evaluateCanonicalStandingsRuntime({
    consumer: "group",
    envSource: {},
    legacyPayload: groupPayload,
    legacyExecutor: () => buildGroupStandingFromMatches(groupPayload),
  });
  assert.equal(isStandingsV2Enabled({}), false);
  assert.equal(bridge.usedCanonical, false);
  assert.equal(bridge.executionPath, "legacy");
});

test("CC08C-15 flag ON does not intercept unsupported season/session consumers", () => {
  assert.equal(
    LEGACY_STANDINGS_RUNTIME_INVENTORY.some(
      (item) => item.id === "legacy-season-standings" && item.legacyEngine === "seasonStandingsEngine"
    ),
    true
  );
  assert.equal(isEngineV2Available(COMPETITION_ENGINE_TYPE.STANDINGS, v2Env), true);
  const seasonBridge = evaluateCanonicalStandingsRuntime({
    consumer: "season_standings",
    envSource: v2Env,
    legacyPayload: { players: {}, matchContributions: {} },
    legacyExecutor: () => ({ players: { p1: { points: 3, wins: 1, losses: 0, draws: 0, matches: 1 } } }),
  });
  assert.equal(seasonBridge.outputPreserved, true);
  assert.notEqual(seasonBridge.executionPath, "canonical-primary");
});

test("CC08D unsupported standings consumers remain legacy-primary with STANDINGS_V2 ON", () => {
  const seasonLegacy = { players: { p1: { points: 9, wins: 3, losses: 0, draws: 0, matches: 3 } } };
  const sessionLegacy = { standing: [{ id: "team-key", matchPoints: 3, won: 1 }] };

  const seasonBridge = evaluateCanonicalStandingsRuntime({
    consumer: "season_standings_engine",
    envSource: v2Env,
    legacyPayload: { players: {}, matchContributions: {} },
    legacyExecutor: () => seasonLegacy,
    executionMode: "shadow",
  });
  assert.equal(seasonBridge.outputPreserved, true);
  assert.deepEqual(seasonBridge.legacyResult, seasonLegacy);
  assert.notEqual(seasonBridge.executionPath, "canonical-primary");

  const sessionBridge = evaluateCanonicalStandingsRuntime({
    consumer: "session_standings_engine",
    envSource: v2Env,
    legacyPayload: { sessions: [], round: {} },
    legacyExecutor: () => sessionLegacy,
    executionMode: "shadow",
  });
  assert.equal(sessionBridge.outputPreserved, true);
  assert.deepEqual(sessionBridge.legacyResult, sessionLegacy);
  assert.notEqual(sessionBridge.executionPath, "canonical-primary");
});

test("CC08C-16 existing CC-07 tests import surface remains available", () => {
  assertTestModuleAvailable("../tests/competition-core-rules-cc07.test.js", import.meta.url);
});

test("CC08C-17 existing CC-06 tests import surface remains available", () => {
  assertTestModuleAvailable("../tests/competition-core-matchmaking-cc06.test.js", import.meta.url);
});

test("CC08C-18 existing TT-4 tests import surface remains available", () => {
  assertTestModuleAvailable("../tests/team-tournament-tt4.test.js", import.meta.url);
});

test("CC08C-19 existing Draw/Formation/Rating tests import surface remains available", () => {
  assertTestModuleAvailable("../tests/competition-core-draw-cc04e.test.js", import.meta.url);
  assertTestModuleAvailable("../tests/competition-core-formation-cc05c.test.js", import.meta.url);
  assertTestModuleAvailable("../tests/competition-core-feature-flags.test.js", import.meta.url);
});

test("CC08C-20 package test runner contains CC-08C test file", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const unitScript = String(pkg.scripts["test:unit"] || "");
  if (unitScript.includes("run-unit-tests.mjs")) {
    const manifest = JSON.parse(
      readFileSync(new URL("../scripts/ci/unit-test-files.json", import.meta.url), "utf8")
    );
    assert.ok(
      manifest.includes("tests/competition-core-standings-cc08c.test.js"),
      "unit-test-files.json must list competition-core-standings-cc08c.test.js"
    );
    return;
  }
  assert.match(unitScript, /competition-core-standings-cc08c\.test\.js/);
});

test("CC08C shadow — forfeit group match parity", () => {
  const forfeitPayload = {
    ...groupPayload,
    matches: [
      {
        id: "f1",
        groupId: "g1",
        entryAId: "a",
        entryBId: "b",
        status: MATCH_STATUS.FORFEIT,
        winnerId: "a",
      },
    ],
    entries: groupPayload.entries.slice(0, 2),
    group: { id: "g1", entryIds: ["a", "b"] },
  };
  const bridge = runStandingsShadowComparison({
    consumer: "group",
    envSource: v2Env,
    legacyPayload: forfeitPayload,
    legacyExecutor: () => buildGroupStandingFromMatches(forfeitPayload),
  });
  assertShadowOk(bridge, "forfeit group");
});

test("CC08C shadow — team canonical row mapping preserves TT fields", () => {
  const mapped = mapLegacyTeamStandingsPayloadToRequest(teamDataBase);
  const canonical = calculateCanonicalStandings(mapped);
  const legacyRows = mapStandingsResultToLegacyTeamRows(canonical);
  const legacy = computeTeamStandings(teamDataBase);
  for (const field of [
    "wins",
    "losses",
    "subMatchWins",
    "subMatchLosses",
    "subMatchDiff",
    "pointsScored",
    "pointsConceded",
    "rankingPoints",
    "played",
  ]) {
    const sample = legacyRows[0];
    assert.ok(field in sample, `canonical legacy row missing ${field}`);
  }
  assert.equal(legacyRows.length, legacy.standings.length);
});
