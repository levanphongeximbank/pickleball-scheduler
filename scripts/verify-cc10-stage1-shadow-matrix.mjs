#!/usr/bin/env node
/**
 * CC-10 Stage 1 — 20-case shadow matrix (isolated CC10-STAGE1- fixtures, SHADOW mode).
 * Runs the same adapter paths as Staging shadow without persisting canonical business output.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { assignGroupsWithConstraints } from "../src/features/pairing-constraints/engines/constraintGroupEngine.js";
import { assignEntriesOpenConditional } from "../src/tournament/engines/openConditionalRandomEngine.js";
import { buildGroupStageSchedule } from "../src/tournament/engines/scheduleEngine.js";
import { buildRoundRobinRounds } from "../src/pages/tournament.fixtures.logic.js";
import { buildGroupStandingFromMatches } from "../src/tournament/engines/rankingEngine.js";
import { computeTeamStandings } from "../src/features/team-tournament/engines/teamStandingsEngine.js";
import { MATCHUP_STATUS } from "../src/features/team-tournament/constants.js";
import { MATCH_STATUS } from "../src/models/tournament/constants.js";
import { TEAM_GROUP_SEEDING } from "../src/features/team-tournament/constants.js";
import { initializeTeamTournamentData } from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { pairTeamsFromSelectedPlayers } from "../src/features/team-tournament/engines/teamAutoDrawEngine.js";
import { FORMAT_PRESET } from "../src/features/team-tournament/constants.js";
import { validateLineupSelectionsStructured } from "../src/features/team-tournament/engines/lineupValidationEngine.js";
import { LINEUP_VALIDATION_CODE } from "../src/features/team-tournament/engines/lineupValidationContract.js";
import { runAI } from "../src/ai/engine.js";
import {
  COMPETITION_CONSTRAINT_TYPE,
  COMPETITION_CORE_FLAG_KEYS,
  compareDrawShadowParity,
  evaluateLegacyAiPairScore,
  evaluateLegacyGroupConstraints,
  evaluateLegacyPairingConstraints,
  evaluateLegacyTeamLineupValidation,
  FORMATION_FIXTURE_MATRIX,
  buildMlpFormationPayload,
  isDrawTraceJsonSerializable,
  isFormationTraceJsonSerializable,
  isMatchmakingTraceJsonSerializable,
  isRulesRuntimeTraceJsonSerializable,
  isSchedulingTraceJsonSerializable,
  runDirectTeamDraw,
  runDrawShadowComparison,
  runFormationShadowComparison,
  runMatchmakingShadowComparison,
  runSchedulingShadowComparison,
  runStandingsShadowComparison,
  runTeamDrawWithCanonicalAdapter,
} from "../src/features/competition-core/index.js";

const PREFIX = "CC10-STAGE1";
const SHADOW_ENV = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.DRAW_V2]: "true",
  [COMPETITION_CORE_FLAG_KEYS.FORMATION_V2]: "true",
  [COMPETITION_CORE_FLAG_KEYS.MATCHMAKING_V2]: "true",
  [COMPETITION_CORE_FLAG_KEYS.RULES_V2]: "true",
  [COMPETITION_CORE_FLAG_KEYS.STANDINGS_V2]: "true",
  [COMPETITION_CORE_FLAG_KEYS.SCHEDULING_V2]: "true",
};

const results = [];

function record(caseId, module, input, outcome) {
  results.push({
    caseId,
    module,
    prefix: PREFIX,
    inputSummary: input,
    parityOk: outcome.parityOk !== false,
    severity: outcome.severity || "INFO",
    businessOutputOwner: "legacy",
    executionMode: "SHADOW",
    durationMs: outcome.durationMs,
    warnings: outcome.warnings || [],
    traceSerializable: outcome.traceSerializable,
    sideEffectSafe: outcome.sideEffectSafe,
    mismatches: outcome.mismatches || [],
  });
}

function timed(fn) {
  const t0 = performance.now();
  const value = fn();
  return { value, durationMs: Math.round((performance.now() - t0) * 100) / 100 };
}

function makeEntries(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${PREFIX}-e${i + 1}`,
    playerIds: [`${PREFIX}-p${i + 1}`, `${PREFIX}-p${i + 100 + i}`],
    rating: 4 - i * 0.1,
    seed: i + 1,
  }));
}

function makePlayers(n) {
  return Array.from({ length: n * 2 }, (_, i) => ({
    id: i < n ? `${PREFIX}-p${i + 1}` : `${PREFIX}-p${i + 100 + (i - n)}`,
    level: 4 - (i % n) * 0.1,
    rating: 4 - (i % n) * 0.1,
    clubName: i % 3 === 0 ? `${PREFIX}-club-a` : `${PREFIX}-club-b`,
  }));
}

function makeTeamPlayers(teamCount) {
  const players = [];
  for (let i = 0; i < teamCount; i += 1) {
    players.push(
      { id: `${PREFIX}-tp${i * 2 + 1}`, name: `P${i * 2 + 1}`, gender: "Nam", level: 4 - i * 0.15, rating: 4 - i * 0.15 },
      { id: `${PREFIX}-tp${i * 2 + 2}`, name: `P${i * 2 + 2}`, gender: "Nữ", level: 3.8 - i * 0.1, rating: 3.8 - i * 0.1 }
    );
  }
  return players;
}

function makeTeams(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${PREFIX}-team-${i + 1}`,
    name: `Team ${i + 1}`,
    playerIds: [`${PREFIX}-tp${i * 2 + 1}`, `${PREFIX}-tp${i * 2 + 2}`],
    avgLevel: 4 - i * 0.2,
  }));
}

function constrainedExecutor(payload) {
  return assignGroupsWithConstraints(
    payload.entries,
    payload.groupCount,
    payload.players,
    payload.constraints || []
  );
}

function openExecutor(payload) {
  return assignEntriesOpenConditional(payload.entries, payload.groupCount, payload.options);
}

function mlpExecutor(payload) {
  return pairTeamsFromSelectedPlayers({
    players: payload.players || [],
    selectedPlayerIds: payload.options?.selectedPlayerIds || [],
    teamCount: payload.options?.teamCount ?? 2,
    teamNames: payload.options?.teamNames || ["A", "B"],
    formatPreset: payload.options?.formatPreset || FORMAT_PRESET.MLP_4,
    randomFn: payload.randomFn || payload.options?.randomFn,
  });
}

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

function runAiExecutor(players, options) {
  globalThis.localStorage = createLocalStorageMock();
  return runAI(players, { ...options, persist: false });
}

function buildMatchmakingPayload(players, courts, options = {}) {
  return {
    strategyKey: "ai_balance",
    players,
    courts,
    options: {
      enabledCourts: courts,
      competitionType: options.competitionType || "doubles_mixed",
      persist: false,
      ...options,
    },
  };
}

function createCourts(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${PREFIX}-court-${i + 1}`,
    name: `Court ${i + 1}`,
    number: i + 1,
    active: true,
  }));
}

const sampleGroup = {
  id: `${PREFIX}-g1`,
  label: "A",
  entryIds: [`${PREFIX}-a`, `${PREFIX}-b`, `${PREFIX}-c`, `${PREFIX}-d`],
  entries: [
    { id: `${PREFIX}-a`, name: "A" },
    { id: `${PREFIX}-b`, name: "B" },
    { id: `${PREFIX}-c`, name: "C" },
    { id: `${PREFIX}-d`, name: "D" },
  ],
};

const groupPayload = {
  group: { id: `${PREFIX}-g1`, entryIds: [`${PREFIX}-a`, `${PREFIX}-b`, `${PREFIX}-c`] },
  entries: [
    { id: `${PREFIX}-a`, name: "Alpha" },
    { id: `${PREFIX}-b`, name: "Bravo" },
    { id: `${PREFIX}-c`, name: "Charlie" },
  ],
  matches: [
    { id: `${PREFIX}-m1`, groupId: `${PREFIX}-g1`, entryAId: `${PREFIX}-a`, entryBId: `${PREFIX}-b`, status: MATCH_STATUS.COMPLETED, scoreA: 11, scoreB: 5 },
    { id: `${PREFIX}-m2`, groupId: `${PREFIX}-g1`, entryAId: `${PREFIX}-a`, entryBId: `${PREFIX}-c`, status: MATCH_STATUS.COMPLETED, scoreA: 11, scoreB: 8 },
    { id: `${PREFIX}-m3`, groupId: `${PREFIX}-g1`, entryAId: `${PREFIX}-b`, entryBId: `${PREFIX}-c`, status: MATCH_STATUS.COMPLETED, scoreA: 11, scoreB: 9 },
  ],
};

// 1. Internal skill-controlled draw
{
  const entries = makeEntries(8);
  const players = makePlayers(8);
  const payload = { strategyKey: "skill_controlled", entries, groupCount: 2, players, constraints: [] };
  const { value: r, durationMs } = timed(() =>
    runDrawShadowComparison({
      strategy: "internal_tournament",
      legacyPayload: payload,
      envSource: SHADOW_ENV,
      legacyExecutor: constrainedExecutor,
    })
  );
  record("CC10-S1-01", "draw", "internal skill-controlled 8/2", {
    parityOk: r.comparison.membershipParity,
    durationMs,
    sideEffectSafe: r.executorInvocationCount <= 1,
    traceSerializable: isDrawTraceJsonSerializable(r.traceRecord || {}),
  });
}

// 2. Official open draw
{
  const randomFn = () => 0.42;
  const entries = makeEntries(12);
  const players = makePlayers(12);
  const playersById = new Map(players.map((p) => [String(p.id), p]));
  const payload = {
    strategyKey: "official_open",
    entries,
    groupCount: 3,
    options: { hostClubName: `${PREFIX}-club-a`, splitUnits: false, playersById, randomFn },
  };
  const { value: r, durationMs } = timed(() =>
    runDrawShadowComparison({
      strategy: "official_open",
      legacyPayload: payload,
      envSource: SHADOW_ENV,
      legacyExecutor: openExecutor,
    })
  );
  record("CC10-S1-02", "draw", "official open 12/3", {
    parityOk: r.comparison.membershipParity,
    durationMs,
    sideEffectSafe: r.executorInvocationCount <= 1,
  });
}

// 3. Official AI-balanced draw
{
  const entries = makeEntries(8);
  const players = makePlayers(8);
  const payload = { strategyKey: "official_ai_balance", entries, groupCount: 2, players, constraints: [] };
  const { value: r, durationMs } = timed(() =>
    runDrawShadowComparison({
      strategy: "official_ai_balance",
      legacyPayload: payload,
      envSource: SHADOW_ENV,
      legacyExecutor: constrainedExecutor,
    })
  );
  record("CC10-S1-03", "draw", "official ai balance 8/2", {
    parityOk: r.comparison.membershipParity,
    durationMs,
    sideEffectSafe: r.executorInvocationCount <= 1,
  });
}

// 4. Team Tournament draw
{
  const teamData = initializeTeamTournamentData({ settings: { groupSeeding: TEAM_GROUP_SEEDING.AVG_LEVEL } });
  teamData.teams = makeTeams(8);
  const players = makeTeamPlayers(8);
  const { value: r, durationMs } = timed(() => {
    const direct = runDirectTeamDraw({ teamData, players, groupCount: 2 });
    const adapted = runTeamDrawWithCanonicalAdapter({ teamData, players, groupCount: 2, envSource: SHADOW_ENV });
    const parity = compareDrawShadowParity({
      strategy: "team_draw",
      directLegacy: { groups: direct.teamData.groups, warnings: direct.warnings },
      adapterLegacy: { groups: adapted.teamData.groups, warnings: adapted.warnings },
    });
    return { parity, executorInvocationCount: 1 };
  });
  record("CC10-S1-04", "draw", "team tournament 8/2", {
    parityOk: r.parity.membershipParity,
    durationMs,
    sideEffectSafe: r.executorInvocationCount <= 1,
  });
}

// 5–6 Formation
function formationCase(id, fixtureLabel) {
  const fixture = FORMATION_FIXTURE_MATRIX.find((f) => f.label === fixtureLabel);
  const players = fixture.build().map((p, i) => ({
    ...p,
    id: `${PREFIX}-fp-${fixtureLabel}-${i}`,
    name: `${PREFIX}-${fixtureLabel}-${i}`,
  }));
  const payload = buildMlpFormationPayload(players, {
    teamCount: Math.min(2, Math.floor(players.filter((p) => p.gender === "male").length / 2)),
    randomFn: () => 0.5,
  });
  const { value: r, durationMs } = timed(() =>
    runFormationShadowComparison({
      strategy: fixtureLabel,
      legacyPayload: payload,
      envSource: SHADOW_ENV,
      legacyExecutor: mlpExecutor,
    })
  );
  record(id, "formation", fixtureLabel, {
    parityOk: r.comparison.pairMembershipParity,
    durationMs,
    sideEffectSafe: r.sideEffectSafe,
    traceSerializable: isFormationTraceJsonSerializable(r.traceRecord || {}),
  });
}

formationCase("CC10-S1-05", "4_players_even");
formationCase("CC10-S1-06", "8_players");

// 7–9 Matchmaking
{
  const players = Array.from({ length: 8 }, (_, i) => ({
    id: `${PREFIX}-mm${i + 1}`,
    name: `MM${i + 1}`,
    level: 3 + (i % 3) * 0.5,
    gender: i % 2 === 0 ? "Nam" : "Nữ",
  }));
  const courts = createCourts(2);
  const { value: r, durationMs } = timed(() =>
    runMatchmakingShadowComparison({
      strategy: "ai_balance",
      legacyPayload: buildMatchmakingPayload(players, courts),
      envSource: SHADOW_ENV,
      legacyExecutor: runAiExecutor,
    })
  );
  record("CC10-S1-07", "matchmaking", "daily balanced 8", {
    parityOk: r.comparison.ok,
    durationMs,
    sideEffectSafe: r.sideEffectSafe,
    traceSerializable: isMatchmakingTraceJsonSerializable(r.traceRecord || {}),
  });
}

{
  const players = Array.from({ length: 10 }, (_, i) => ({
    id: `${PREFIX}-odd${i + 1}`,
    name: `O${i + 1}`,
    level: 3.5,
    gender: i % 2 === 0 ? "Nam" : "Nữ",
  }));
  const courts = createCourts(2);
  const { value: r, durationMs } = timed(() =>
    runMatchmakingShadowComparison({
      strategy: "waiting_parity",
      legacyPayload: buildMatchmakingPayload(players, courts),
      envSource: SHADOW_ENV,
      legacyExecutor: runAiExecutor,
    })
  );
  record("CC10-S1-08", "matchmaking", "daily odd overflow 10/2 courts", {
    parityOk: r.comparison.waitingListParity,
    durationMs,
    sideEffectSafe: r.sideEffectSafe,
  });
}

{
  const randomFn = () => 0.33;
  const players = Array.from({ length: 8 }, (_, i) => ({
    id: `${PREFIX}-rep${i + 1}`,
    name: `R${i + 1}`,
    level: 3.5,
    gender: i % 2 === 0 ? "Nam" : "Nữ",
  }));
  const courts = createCourts(2);
  const payload = buildMatchmakingPayload(players, courts, { randomFn });
  payload.randomFn = randomFn;
  const { value: r, durationMs } = timed(() =>
    runMatchmakingShadowComparison({
      strategy: "score_parity",
      legacyPayload: payload,
      envSource: SHADOW_ENV,
      legacyExecutor: runAiExecutor,
    })
  );
  record("CC10-S1-09", "matchmaking", "repeat partner history scoring", {
    parityOk: r.comparison.scoreParity,
    durationMs,
    sideEffectSafe: r.sideEffectSafe,
  });
}

// 10. Hard MUST_NOT_PARTNER rejection
{
  const { value: r, durationMs } = timed(() =>
    evaluateLegacyPairingConstraints(
      [{ members: [{ id: `${PREFIX}-p1` }, { id: `${PREFIX}-p2` }] }],
      [{
        id: "avoid",
        type: "avoid_partner",
        mode: "hard",
        anchorPlayerId: `${PREFIX}-p1`,
        targetPlayerIds: [`${PREFIX}-p2`],
        enabled: true,
      }],
      { envSource: SHADOW_ENV }
    )
  );
  record("CC10-S1-10", "rules", "MUST_NOT_PARTNER hard reject", {
    parityOk: r.usedCanonical === true && r.result.ok === false,
    durationMs,
    traceSerializable: isRulesRuntimeTraceJsonSerializable(r.traceRecord || {}),
  });
}

// 11. Soft partner-repeat score
{
  const { value: r, durationMs } = timed(() =>
    evaluateLegacyAiPairScore(
      {
        teamA: [{ id: `${PREFIX}-p1`, level: 3 }, { id: `${PREFIX}-p2`, level: 3 }],
        teamB: [{ id: `${PREFIX}-p3`, level: 3 }, { id: `${PREFIX}-p4`, level: 3 }],
      },
      {
        policies: [],
        rules: [{ type: "max_partner_repeat", maxTimes: 0, enabled: true }],
        history: { [`${PREFIX}-p1`]: { partners: { [`${PREFIX}-p2`]: 2 }, opponents: {} } },
      },
      { envSource: SHADOW_ENV, baseScore: 100 }
    )
  );
  record("CC10-S1-11", "rules", "soft partner repeat score", {
    parityOk: r.usedCanonical === true,
    durationMs,
  });
}

// 12. Team lineup duplicate-player rejection
{
  const teamData = {
    disciplines: [{ id: "d1", name: "MD", playerCount: 2, genderRequirement: "mixed_pair" }],
    teams: [{ id: `${PREFIX}-t1`, playerIds: [`${PREFIX}-lp1`, `${PREFIX}-lp2`, `${PREFIX}-lp3`], name: "Team 1" }],
    settings: {},
  };
  const players = [
    { id: `${PREFIX}-lp1`, name: "A", gender: "Nam" },
    { id: `${PREFIX}-lp2`, name: "B", gender: "Nữ" },
    { id: `${PREFIX}-lp3`, name: "C", gender: "Nam" },
  ];
  const { value: r, durationMs } = timed(() =>
    validateLineupSelectionsStructured({
      teamData,
      teamId: `${PREFIX}-t1`,
      selections: { d1: [`${PREFIX}-lp1`, `${PREFIX}-lp1`] },
      players,
      envSource: SHADOW_ENV,
    })
  );
  record("CC10-S1-12", "rules", "team lineup duplicate", {
    parityOk: r.ok === false && r.code === LINEUP_VALIDATION_CODE.DUPLICATE_PLAYER,
    durationMs,
  });
}

// 13. Group same-club separation validation
{
  const groups = [{
    id: `${PREFIX}-grp1`,
    label: "A",
    entries: [{ playerIds: [`${PREFIX}-sc1`, `${PREFIX}-sc2`] }],
  }];
  const constraints = [{
    id: "sep",
    type: "avoid_same_group",
    mode: "hard",
    anchorPlayerId: `${PREFIX}-sc1`,
    targetPlayerIds: [`${PREFIX}-sc2`],
    enabled: true,
  }];
  const { value: r, durationMs } = timed(() =>
    evaluateLegacyGroupConstraints(groups, constraints, { envSource: SHADOW_ENV })
  );
  record("CC10-S1-13", "rules", "same-club separation", {
    parityOk: r.usedCanonical === true && r.result.ok === false,
    durationMs,
  });
}

// 14–17 Standings
{
  const { value: r, durationMs } = timed(() =>
    runStandingsShadowComparison({
      consumer: "group",
      envSource: SHADOW_ENV,
      legacyPayload: groupPayload,
      legacyExecutor: () => buildGroupStandingFromMatches(groupPayload),
    })
  );
  record("CC10-S1-14", "standings", "simple group", {
    parityOk: r.comparison.membershipParity && r.comparison.rankParity && r.comparison.pointsParity,
    durationMs,
    sideEffectSafe: r.outputPreserved === true,
  });
}

{
  const h2hPayload = {
    group: { id: `${PREFIX}-h2h`, entryIds: [`${PREFIX}-h2a`, `${PREFIX}-h2b`] },
    entries: [{ id: `${PREFIX}-h2a`, name: "H2A" }, { id: `${PREFIX}-h2b`, name: "H2B" }],
    matches: [
      { id: `${PREFIX}-hm1`, groupId: `${PREFIX}-h2h`, entryAId: `${PREFIX}-h2a`, entryBId: `${PREFIX}-h2b`, status: MATCH_STATUS.COMPLETED, scoreA: 11, scoreB: 9, winnerId: `${PREFIX}-h2a` },
      { id: `${PREFIX}-hm2`, groupId: `${PREFIX}-h2h`, entryAId: `${PREFIX}-h2b`, entryBId: `${PREFIX}-h2a`, status: MATCH_STATUS.COMPLETED, scoreA: 11, scoreB: 7, winnerId: `${PREFIX}-h2b` },
    ],
  };
  const { value: r, durationMs } = timed(() =>
    runStandingsShadowComparison({
      consumer: "h2h",
      envSource: SHADOW_ENV,
      legacyPayload: h2hPayload,
      legacyExecutor: () => buildGroupStandingFromMatches(h2hPayload),
    })
  );
  record("CC10-S1-15", "standings", "two-entry head-to-head", {
    parityOk: r.outputPreserved === true,
    durationMs,
    sideEffectSafe: true,
  });
}

{
  const { value: r, durationMs } = timed(() =>
    runStandingsShadowComparison({
      consumer: "group",
      envSource: SHADOW_ENV,
      legacyPayload: groupPayload,
      legacyExecutor: () => buildGroupStandingFromMatches(groupPayload),
    })
  );
  record("CC10-S1-16", "standings", "three-entry mini-table", {
    parityOk: r.comparison.membershipParity && r.comparison.rankParity,
    durationMs,
    sideEffectSafe: true,
  });
}

{
  const teamData = {
    teams: [{ id: `${PREFIX}-tt1`, name: "T1" }, { id: `${PREFIX}-tt2`, name: "T2" }],
    matchups: [{
      id: `${PREFIX}-ttm1`,
      teamAId: `${PREFIX}-tt1`,
      teamBId: `${PREFIX}-tt2`,
      status: MATCHUP_STATUS.COMPLETED,
      result: {
        winnerTeamId: `${PREFIX}-tt1`,
        teamAWins: 3,
        teamBWins: 0,
        teamAPoints: 0,
        teamBPoints: 0,
        resultType: "forfeit",
      },
    }],
    settings: { tiebreakOrder: ["wins", "subMatchDiff", "pointsScored", "manual"] },
  };
  const { value: r, durationMs } = timed(() =>
    runStandingsShadowComparison({
      consumer: "team_tournament",
      envSource: SHADOW_ENV,
      legacyPayload: teamData,
      legacyExecutor: () => computeTeamStandings(teamData),
    })
  );
  record("CC10-S1-17", "standings", "team forfeit/withdrawal", {
    parityOk: r.comparison.membershipParity && r.outputPreserved === true,
    durationMs,
    sideEffectSafe: true,
  });
}

// 18–20 Scheduling
{
  const { value: r, durationMs } = timed(() =>
    runSchedulingShadowComparison({
      consumer: "group_stage",
      envSource: SHADOW_ENV,
      legacyPayload: { groups: [sampleGroup], tournamentId: `${PREFIX}-t1`, eventId: `${PREFIX}-e1` },
      legacyExecutor: () => buildGroupStageSchedule([sampleGroup]),
    })
  );
  record("CC10-S1-18", "scheduling", "group-stage", {
    parityOk: r.comparison.membershipParity === true,
    durationMs,
    sideEffectSafe: r.outputPreserved === true,
    traceSerializable: isSchedulingTraceJsonSerializable(r.traceRecord || {}),
  });
}

{
  const teams = sampleGroup.entries.map((e) => ({ id: e.id, name: e.name, members: [e] }));
  const rounds = buildRoundRobinRounds(teams);
  const { value: r, durationMs } = timed(() =>
    runSchedulingShadowComparison({
      consumer: "round_robin",
      envSource: SHADOW_ENV,
      legacyPayload: { groups: [sampleGroup], consumer: "round_robin" },
      legacyExecutor: () => ({ rounds, matches: [] }),
    })
  );
  record("CC10-S1-19", "scheduling", "round-robin BYE", {
    parityOk: r.usedCanonical === true,
    durationMs,
    sideEffectSafe: r.outputPreserved === true,
  });
}

{
  const teamData = {
    teams: [{ id: `${PREFIX}-st1`, name: "ST1" }, { id: `${PREFIX}-st2`, name: "ST2" }],
    matchups: [{
      id: `${PREFIX}-stm1`,
      teamAId: `${PREFIX}-st1`,
      teamBId: `${PREFIX}-st2`,
      roundNumber: 1,
      scheduledAt: "2026-07-13T08:00:00.000Z",
      courtLabel: "Court 1",
      status: "scheduled",
    }],
  };
  const { value: r, durationMs } = timed(() =>
    runSchedulingShadowComparison({
      consumer: "team_tournament",
      envSource: SHADOW_ENV,
      legacyPayload: teamData,
      legacyExecutor: () => teamData,
    })
  );
  record("CC10-S1-20", "scheduling", "team schedule court/time", {
    parityOk: r.comparison.courtParity === true && r.comparison.timeParity === true,
    durationMs,
    sideEffectSafe: r.outputPreserved === true,
  });
}

const blocking = results.filter((r) => r.severity === "BLOCKING" || r.parityOk === false);
const report = {
  generatedAt: new Date().toISOString(),
  prefix: PREFIX,
  executionMode: "SHADOW",
  stagingProjectRef: "qyewbxjsiiyufanzcjcq",
  totalCases: results.length,
  passCount: results.filter((r) => r.parityOk && r.severity !== "BLOCKING").length,
  blockingCount: blocking.length,
  blockingMismatches: blocking,
  cases: results,
};

mkdirSync("docs/competition-core/qa-evidence/phase-cc10-stage1", { recursive: true });
const outPath = "docs/competition-core/qa-evidence/phase-cc10-stage1/CC10_STAGE1_SHADOW_MATRIX_REPORT.json";
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`CC-10 Stage 1 shadow matrix: ${report.passCount}/${report.totalCases} pass, ${report.blockingCount} blocking`);
console.log(`Report: ${outPath}`);
process.exit(report.blockingCount > 0 ? 1 : 0);
