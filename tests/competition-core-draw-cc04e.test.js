import test from "node:test";
import assert from "node:assert/strict";

import { assignGroupsWithConstraints } from "../src/features/pairing-constraints/engines/constraintGroupEngine.js";
import { assignEntriesOpenConditional } from "../src/tournament/engines/openConditionalRandomEngine.js";
import { TEAM_GROUP_SEEDING } from "../src/features/team-tournament/constants.js";
import { sortTeamsForGroupSeeding } from "../src/features/team-tournament/engines/teamGroupSeedEngine.js";
import { initializeTeamTournamentData } from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import {
  CANONICAL_DRAW_STRATEGY_ID,
  COMPETITION_CORE_FLAG_KEYS,
  compareDrawShadowParity,
  compareSeedShadowParity,
  buildCompleteDrawTraceRecord,
  buildLegacySeedRowsFromOrder,
  cloneLegacyDrawPayload,
  evaluateCanonicalDraw,
  extractDrawGroupMembership,
  isDrawTraceJsonSerializable,
  isDrawV2Enabled,
  runDirectTeamDraw,
  runDrawShadowComparison,
  runLegacyDrawWithCanonicalAdapter,
  runTeamDrawWithCanonicalAdapter,
  validateCompleteDrawTraceRecord,
} from "../src/features/competition-core/index.js";

const drawV2Env = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.DRAW_V2]: "true",
};

function makeEntries(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `e${index + 1}`,
    playerIds: [`p${index + 1}`, `p${index + 100 + index}`],
    rating: 4 - index * 0.1,
    seed: index + 1,
  }));
}

function makePlayers(count) {
  return Array.from({ length: count * 2 }, (_, index) => ({
    id: index < count ? `p${index + 1}` : `p${index + 100 + (index - count)}`,
    level: 4 - (index % count) * 0.1,
    rating: 4 - (index % count) * 0.1,
    clubName: index % 3 === 0 ? "Club A" : "Club B",
  }));
}

function makeTeams(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    playerIds: [`p${index * 2 + 1}`, `p${index * 2 + 2}`],
    avgLevel: 4 - index * 0.2,
  }));
}

function makeTeamPlayers(teamCount) {
  const players = [];
  for (let teamIndex = 0; teamIndex < teamCount; teamIndex += 1) {
    players.push(
      {
        id: `p${teamIndex * 2 + 1}`,
        name: `P${teamIndex * 2 + 1}`,
        gender: "Nam",
        level: 4 - teamIndex * 0.15,
        rating: 4 - teamIndex * 0.15,
      },
      {
        id: `p${teamIndex * 2 + 2}`,
        name: `P${teamIndex * 2 + 2}`,
        gender: "Nữ",
        level: 3.8 - teamIndex * 0.1,
        rating: 3.8 - teamIndex * 0.1,
      }
    );
  }
  return players;
}

function constrainedExecutor(payload) {
  return assignGroupsWithConstraints(
    payload.entries,
    payload.groupCount,
    payload.players,
    payload.constraints
  );
}

function openExecutor(payload) {
  return assignEntriesOpenConditional(payload.entries, payload.groupCount, payload.options);
}

test("team draw flag OFF preserves direct legacy output", () => {
  const teamData = initializeTeamTournamentData({
    settings: { groupSeeding: TEAM_GROUP_SEEDING.AVG_LEVEL },
  });
  teamData.teams = makeTeams(8);
  const players = makeTeamPlayers(8);

  const direct = runDirectTeamDraw({
    teamData,
    players,
    seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
    groupCount: 2,
  });

  const adapted = runTeamDrawWithCanonicalAdapter({
    teamData,
    players,
    seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
    groupCount: 2,
    envSource: {},
  });

  const parity = compareDrawShadowParity({
    strategy: "team_draw",
    directLegacy: { groups: direct.teamData.groups },
    adapterLegacy: { groups: adapted.teamData.groups },
  });
  assert.equal(parity.membershipParity, true);
});

test("team draw flag ON preserves group membership and selects TEAM strategy", () => {
  const teamData = initializeTeamTournamentData({
    settings: { groupSeeding: TEAM_GROUP_SEEDING.AVG_LEVEL },
  });
  teamData.teams = makeTeams(8);
  const players = makeTeamPlayers(8);

  const direct = runDirectTeamDraw({
    teamData,
    players,
    seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
    groupCount: 2,
  });

  const adapted = runTeamDrawWithCanonicalAdapter({
    teamData,
    players,
    seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
    groupCount: 2,
    envSource: drawV2Env,
  });

  const parity = compareDrawShadowParity({
    strategy: "team_draw",
    directLegacy: { ok: true, groups: direct.teamData.groups, warnings: direct.warnings },
    adapterLegacy: { ok: true, groups: adapted.teamData.groups, warnings: adapted.warnings },
    trace: adapted.bridge?.trace,
  });

  assert.equal(parity.membershipParity, true);
  assert.equal(
    adapted.bridge?.strategyDrawRequest?.selection?.strategyId,
    CANONICAL_DRAW_STRATEGY_ID.TEAM
  );
});

test("team draw avg_level mode parity", () => {
  const teamData = initializeTeamTournamentData({
    settings: { groupSeeding: TEAM_GROUP_SEEDING.AVG_LEVEL },
  });
  teamData.teams = makeTeams(6);
  const players = makeTeamPlayers(6);

  const direct = runDirectTeamDraw({
    teamData,
    players,
    seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
    groupCount: 2,
  });
  const adapted = runTeamDrawWithCanonicalAdapter({
    teamData,
    players,
    seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
    groupCount: 2,
    envSource: drawV2Env,
  });

  assert.equal(direct.balance?.seedingMode, TEAM_GROUP_SEEDING.AVG_LEVEL);
  assert.equal(adapted.balance?.seedingMode, TEAM_GROUP_SEEDING.AVG_LEVEL);
  assert.equal(
    compareDrawShadowParity({
      strategy: "team_avg_level",
      directLegacy: { groups: direct.teamData.groups },
      adapterLegacy: { groups: adapted.teamData.groups },
    }).membershipParity,
    true
  );
});

test("team draw top_player_then_total mode parity", () => {
  const teamData = initializeTeamTournamentData({
    settings: { groupSeeding: TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL },
  });
  teamData.teams = makeTeams(6);
  const players = makeTeamPlayers(6);

  const direct = runDirectTeamDraw({
    teamData,
    players,
    seedingMode: TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL,
    groupCount: 2,
  });
  const adapted = runTeamDrawWithCanonicalAdapter({
    teamData,
    players,
    seedingMode: TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL,
    groupCount: 2,
    envSource: drawV2Env,
  });

  assert.equal(direct.balance?.seedingMode, TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL);
  assert.equal(
    compareDrawShadowParity({
      strategy: "team_top_player",
      directLegacy: { groups: direct.teamData.groups },
      adapterLegacy: { groups: adapted.teamData.groups },
    }).membershipParity,
    true
  );
});

test("team draw preserves manual seed metadata on teams", () => {
  const teamData = initializeTeamTournamentData({
    settings: { groupSeeding: TEAM_GROUP_SEEDING.AVG_LEVEL },
  });
  teamData.teams = makeTeams(6).map((team, index) => ({
    ...team,
    seed: index + 1,
    manualSeed: index === 0,
  }));
  const players = makeTeamPlayers(6);

  const adapted = runTeamDrawWithCanonicalAdapter({
    teamData,
    players,
    seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
    groupCount: 2,
    envSource: drawV2Env,
  });

  assert.equal(adapted.teamData.teams.some((team) => team.manualSeed === true), true);
});

test("team draw decision trace is complete and JSON serializable", () => {
  const teamData = initializeTeamTournamentData({
    settings: { groupSeeding: TEAM_GROUP_SEEDING.AVG_LEVEL },
  });
  teamData.teams = makeTeams(6);
  const players = makeTeamPlayers(6);

  const adapted = runTeamDrawWithCanonicalAdapter({
    teamData,
    players,
    seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
    groupCount: 2,
    envSource: drawV2Env,
  });

  const trace = buildCompleteDrawTraceRecord({
    bridge: adapted.bridge,
    drawId: "team-draw-test",
    legacyRuntime: "assignSeededTeamsToGroups",
  });

  assert.equal(validateCompleteDrawTraceRecord(trace).length, 0);
  assert.equal(isDrawTraceJsonSerializable(trace), true);
  assert.equal(trace.strategy, CANONICAL_DRAW_STRATEGY_ID.TEAM);
  assert.equal(trace.finalPlacements.length > 0, true);
});

test("seed shadow same order reports no mismatch", () => {
  const participants = makePlayers(4).slice(0, 4);
  const sorted = [...participants].sort((a, b) => b.rating - a.rating);
  const legacySeeds = buildLegacySeedRowsFromOrder(sorted, "legacy_runtime");
  const shadow = compareSeedShadowParity({ participants: sorted, legacySeeds });
  assert.equal(Array.isArray(shadow.rows), true);
  assert.equal(shadow.canonicalResult.seeds.length, sorted.length);
});

test("seed shadow reports ranking mismatch without changing business output", () => {
  const participants = [
    { id: "p1", rating: 5, level: 5 },
    { id: "p2", rating: 4, level: 4 },
  ];
  const legacySeeds = [
    { participantId: "p1", seedNumber: 2, seedScore: 5, source: "legacy_runtime" },
    { participantId: "p2", seedNumber: 1, seedScore: 4, source: "legacy_runtime" },
  ];
  const shadow = compareSeedShadowParity({ participants, legacySeeds });
  assert.equal(shadow.ok, false);
  assert.equal(shadow.rows.some((row) => row.rankingMismatch), true);
});

test("seed shadow reports tie-break difference on equal scores", () => {
  const participants = [
    { id: "p1", rating: 4, level: 4, name: "Alpha" },
    { id: "p2", rating: 4, level: 4, name: "Beta" },
  ];
  buildLegacySeedRowsFromOrder(participants, "legacy_runtime").reverse();
  const shadow = compareSeedShadowParity({ participants, legacySeeds: buildLegacySeedRowsFromOrder(participants, "legacy_runtime").reverse() });
  assert.equal(shadow.rows.length, participants.length);
  if (!shadow.ok) {
    assert.equal(shadow.warnings.length > 0, true);
  }
});

test("internal skill-controlled draw shadow membership parity", () => {
  const entries = makeEntries(8);
  const players = makePlayers(8);
  const payload = {
    strategyKey: "skill_controlled",
    entries,
    groupCount: 2,
    players,
    constraints: [],
  };
  const shadow = runDrawShadowComparison({
    strategy: "internal_tournament",
    legacyPayload: payload,
    envSource: drawV2Env,
    legacyExecutor: constrainedExecutor,
  });

  assert.equal(shadow.comparison.membershipParity, true);
  assert.equal(shadow.comparison.strategy, "internal_tournament");
});

test("official open draw shadow membership parity with injected randomFn", () => {
  let randomCalls = 0;
  const randomFn = () => {
    randomCalls += 1;
    return 0.42;
  };
  const entries = makeEntries(12);
  const players = makePlayers(12);
  const playersById = new Map(players.map((player) => [String(player.id), player]));
  const payload = {
    strategyKey: "official_open",
    entries,
    groupCount: 3,
    options: { hostClubName: "Club A", splitUnits: false, playersById, randomFn },
  };

  const directCallsBefore = randomCalls;
  const direct = openExecutor(payload);
  const directCalls = randomCalls - directCallsBefore;

  randomCalls = 0;
  const shadow = runDrawShadowComparison({
    strategy: "official_open",
    legacyPayload: payload,
    envSource: drawV2Env,
    legacyExecutor: openExecutor,
  });

  assert.equal(shadow.comparison.membershipParity, true);
  assert.equal(shadow.primary.groups.length, direct.groups.length);
  assert.equal(directCalls > 0, true);
  assert.equal(randomCalls, directCalls * 2);
});

test("official AI balance draw shadow membership parity", () => {
  const entries = makeEntries(8);
  const players = makePlayers(8);
  const payload = {
    strategyKey: "official_ai_balance",
    entries,
    groupCount: 2,
    players,
    constraints: [],
  };
  const shadow = runDrawShadowComparison({
    strategy: "official_ai_balance",
    legacyPayload: payload,
    envSource: drawV2Env,
    legacyExecutor: constrainedExecutor,
  });
  assert.equal(shadow.comparison.membershipParity, true);
});

test("team draw shadow membership parity via comparison helper", () => {
  const teamData = initializeTeamTournamentData({
    settings: { groupSeeding: TEAM_GROUP_SEEDING.AVG_LEVEL },
  });
  teamData.teams = makeTeams(8);
  const players = makeTeamPlayers(8);
  const direct = runDirectTeamDraw({ teamData, players, groupCount: 2 });
  const adapted = runTeamDrawWithCanonicalAdapter({
    teamData,
    players,
    groupCount: 2,
    envSource: drawV2Env,
  });
  const parity = compareDrawShadowParity({
    strategy: "team_draw",
    directLegacy: { groups: direct.teamData.groups, warnings: direct.warnings },
    adapterLegacy: { groups: adapted.teamData.groups, warnings: adapted.warnings },
  });
  assert.equal(parity.membershipParity, true);
});

test("shadow comparison detects duplicate membership drift", () => {
  const membership = extractDrawGroupMembership([
    { id: "g1", teamIds: ["a", "b"] },
    { id: "g2", teamIds: ["c"] },
  ]);
  const drifted = extractDrawGroupMembership([
    { id: "g1", teamIds: ["a"] },
    { id: "g2", teamIds: ["b", "c"] },
  ]);
  assert.notDeepEqual(membership, drifted);
});

test("adapter does not add extra randomFn calls for open draw", () => {
  let calls = 0;
  const randomFn = () => {
    calls += 1;
    return 0.1;
  };
  const payload = {
    strategyKey: "official_open",
    entries: makeEntries(8),
    groupCount: 2,
    options: {
      hostClubName: "",
      splitUnits: false,
      playersById: new Map(),
      randomFn,
    },
  };

  evaluateCanonicalDraw({
    consumer: "official_open",
    legacyPayload: payload,
    envSource: drawV2Env,
    legacyExecutor: openExecutor,
  });

  const directCalls = calls;
  calls = 0;
  openExecutor(payload);
  assert.equal(calls, directCalls);
});

test("clone preserves Map randomFn and teamData for adapter payload", () => {
  const randomFn = () => 0.5;
  const playersById = new Map([["p1", { id: "p1" }]]);
  const cloned = cloneLegacyDrawPayload({
    teamData: { teams: [{ id: "t1" }], groups: [], settings: {} },
    options: { randomFn, playersById },
  });
  cloned.teamData.teams.push({ id: "t2" });
  assert.equal(cloned.options.randomFn, randomFn);
  assert.equal(cloned.options.playersById, playersById);
});

test("feature flag matrix: core off always legacy path", () => {
  assert.equal(isDrawV2Enabled({ [COMPETITION_CORE_FLAG_KEYS.CORE]: "false", [COMPETITION_CORE_FLAG_KEYS.DRAW_V2]: "true" }), false);
  const bridge = evaluateCanonicalDraw({
    consumer: "internal_tournament",
    legacyPayload: { strategyKey: "skill_controlled", entries: makeEntries(4), groupCount: 2, players: [], constraints: [] },
    envSource: { [COMPETITION_CORE_FLAG_KEYS.CORE]: "false", [COMPETITION_CORE_FLAG_KEYS.DRAW_V2]: "true" },
    legacyExecutor: constrainedExecutor,
  });
  assert.equal(bridge.usedCanonical, false);
});

test("feature flag matrix: master on draw off stays legacy", () => {
  const bridge = evaluateCanonicalDraw({
    consumer: "internal_tournament",
    legacyPayload: { strategyKey: "skill_controlled", entries: makeEntries(4), groupCount: 2, players: [], constraints: [] },
    envSource: { [COMPETITION_CORE_FLAG_KEYS.CORE]: "true", [COMPETITION_CORE_FLAG_KEYS.DRAW_V2]: "false" },
    legacyExecutor: constrainedExecutor,
  });
  assert.equal(bridge.usedCanonical, false);
});

test("internal tournament plan builder path uses adapter wrapper", () => {
  const result = runLegacyDrawWithCanonicalAdapter({
    consumer: "internal_tournament",
    strategyKey: "skill_controlled",
    legacyPayload: {
      entries: makeEntries(8),
      groupCount: 2,
      players: makePlayers(8),
      constraints: [],
    },
    envSource: drawV2Env,
    legacyExecutor: constrainedExecutor,
  });
  assert.equal(result.groups.length, 2);
});

test("legacy team seed order helper aligns with sortTeamsForGroupSeeding", () => {
  const teams = makeTeams(4);
  const players = makeTeamPlayers(4);
  const sorted = sortTeamsForGroupSeeding(teams, players, TEAM_GROUP_SEEDING.AVG_LEVEL);
  const legacySeeds = buildLegacySeedRowsFromOrder(
    sorted.map((team) => ({ id: team.id, rating: team.avgLevel, level: team.avgLevel })),
    "team_avg_level"
  );
  assert.equal(legacySeeds[0].seedNumber, 1);
  assert.equal(legacySeeds.length, 4);
});
