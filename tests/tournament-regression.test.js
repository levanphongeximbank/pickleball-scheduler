import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { loadClubData } from "../src/domain/clubStorage.js";

import {
  MATCH_STATUS,
  EVENT_TYPE,
  OFFICIAL_MODE,
  TOURNAMENT_MODE,
} from "../src/models/tournament/index.js";
import {
  DAILY_MATCH_TYPE,
  DAILY_GENDER_FILTER,
  assignDailyMatchToCourt,
  createFairDailyMatches,
  getBusyPlayerIdsFromDailyMatches,
  getDefaultDailyPlaySettings,
  submitDailyPlayMatchScore,
} from "../src/tournament/engines/dailyPlayEngine.js";
import { buildCourtRuntimeStates } from "../src/tournament/engines/courtEngine.js";
import {
  buildInternalTournamentPlan,
  buildOfficialOpenPlan,
  buildOfficialAiBalancePlan,
  generateKnockoutBracket,
  resolveBracketProgress,
  submitKnockoutMatchScore,
  suggestEntriesFromPlayers,
  assignEntriesToGroupsSnake,
  buildGroupStageSchedule,
} from "../src/tournament/engines/index.js";
import {
  buildEventDirectorSnapshot,
  submitTournamentDirectorMatchScore,
} from "../src/tournament/engines/tournamentDirectorEngine.js";
import { buildKnockoutProgress } from "../src/pages/tournament.bracket.logic.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

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

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  loadClubData(DEFAULT_CLUB.id);
});

afterEach(() => {});

function buildGenderedPlayers(maleCount, femaleCount) {
  const males = Array.from({ length: maleCount }, (_, index) => ({
    id: `male-${index + 1}`,
    name: `Nam ${index + 1}`,
    gender: "Nam",
    rating: 4 - index * 0.1,
    level: 4 - index * 0.1,
  }));
  const females = Array.from({ length: femaleCount }, (_, index) => ({
    id: `female-${index + 1}`,
    name: `Nu ${index + 1}`,
    gender: "Nữ",
    rating: 4 - index * 0.1,
    level: 4 - index * 0.1,
  }));
  return [...males, ...females];
}

function buildMalePlayers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `male-${index + 1}`,
    name: `Nam ${index + 1}`,
    gender: "Nam",
    rating: 5 - index * 0.2,
    level: 5 - index * 0.2,
  }));
}

function completeAllGroupMatches(event) {
  return {
    ...event,
    matches: event.matches.map((match, index) => ({
      ...match,
      scoreA: index % 2 === 0 ? 11 : 8,
      scoreB: index % 2 === 0 ? 6 : 11,
      winnerId: index % 2 === 0 ? match.entryAId : match.entryBId,
      loserId: index % 2 === 0 ? match.entryBId : match.entryAId,
      status: MATCH_STATUS.COMPLETED,
    })),
  };
}

test("regression Test 1: daily play mixed doubles with 12 men, 8 women, 4 courts", () => {
  const players = buildGenderedPlayers(12, 8);
  const courts = [1, 2, 3, 4].map((id) => ({ id, name: `San ${id}`, active: true }));
  const settings = {
    ...getDefaultDailyPlaySettings(),
    checkedInPlayerIds: players.map((player) => String(player.id)),
    matchType: DAILY_MATCH_TYPE.MIXED_DOUBLE,
    genderFilter: DAILY_GENDER_FILTER.ALL,
  };

  const created = createFairDailyMatches({
    players,
    settings,
    tournamentId: "t-daily",
    matchCount: 4,
  });

  assert.equal(created.ok, true);
  assert.equal(created.matches.length, 4);

  const usedPlayers = new Set();
  created.matches.forEach((match) => {
    [...match.teamAPlayerIds, ...match.teamBPlayerIds].forEach((playerId) => {
      assert.equal(usedPlayers.has(playerId), false, `Player ${playerId} duplicated across matches`);
      usedPlayers.add(playerId);
    });
    assert.equal(match.teamAPlayerIds.length, 2);
    assert.equal(match.teamBPlayerIds.length, 2);
  });

  let nextSettings = {
    ...settings,
    matches: created.matches,
  };

  const assignedCourtIds = [];
  for (const match of created.matches) {
    const assignResult = assignDailyMatchToCourt({
      settings: nextSettings,
      courts,
      matchId: match.id,
      lockedCourtIds: [],
    });
    assert.equal(assignResult.ok, true);
    nextSettings = assignResult.settings;
    assignedCourtIds.push(assignResult.courtId);
  }

  assert.equal(new Set(assignedCourtIds).size, 4);

  const busy = getBusyPlayerIdsFromDailyMatches(nextSettings.matches);
  assert.equal(busy.size, 16);

  const playingMatch = nextSettings.matches.find((match) => match.status === MATCH_STATUS.PLAYING);
  const scoreResult = submitDailyPlayMatchScore(nextSettings, playingMatch.id, {
    scoreA: 11,
    scoreB: 7,
  });
  assert.equal(scoreResult.ok, true);
  assert.equal(scoreResult.match.status, MATCH_STATUS.COMPLETED);
  assert.ok(scoreResult.releasedCourtId);

  const courtStates = buildCourtRuntimeStates(courts, scoreResult.settings.matches);
  const releasedCourt = courtStates.find(
    (court) => String(court.id) === String(scoreResult.releasedCourtId)
  );
  assert.equal(releasedCourt?.currentMatchId, null);
});

test("regression Test 2: internal mixed doubles 16 pairs, 4 groups, bracket path", () => {
  const players = buildGenderedPlayers(16, 16);
  const plan = buildInternalTournamentPlan({
    tournament: { id: "t-internal", mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT, events: [] },
    players,
    selectedPlayerIds: players.map((player) => String(player.id)),
    eventType: EVENT_TYPE.MIXED_DOUBLE,
    groupCount: 4,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.event.entries.length, 16);
  assert.equal(plan.event.groups.length, 4);
  assert.deepEqual(plan.balance.sizes, [4, 4, 4, 4]);
  assert.ok(plan.matchCount > 0);

  const completed = completeAllGroupMatches(plan.event);
  const bracket = generateKnockoutBracket(completed);
  assert.equal(bracket.ok, true);
  assert.ok(bracket.event.bracket.rounds.length >= 2);

  const progress = resolveBracketProgress(bracket.event);
  assert.ok(progress.rounds.length > 0);
  assert.equal(progress.champion, null);
});

test("regression Test 3: official open mode 20 men's pairs without rating bias", () => {
  const entries = Array.from({ length: 20 }, (_, index) => ({
    id: `entry-${index + 1}`,
    name: `Cap ${index + 1}`,
    playerIds: [`p-${index * 2 + 1}`, `p-${index * 2 + 2}`],
    clubName: index < 5 ? "CLB A" : index < 10 ? "CLB B" : index < 15 ? "CLB C" : "Vang lai",
    representativeClubName:
      index < 5 ? "CLB A" : index < 10 ? "CLB B" : index < 15 ? "CLB C" : "Vang lai",
    rating: null,
    seed: null,
  }));

  const players = entries.flatMap((entry) =>
    entry.playerIds.map((playerId) => ({
      id: playerId,
      name: playerId,
      gender: "Nam",
      clubName: entry.clubName,
    }))
  );

  const plan = buildOfficialOpenPlan({
    tournament: {
      id: "t-open",
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.OPEN,
      events: [],
    },
    entries,
    players,
    eventType: EVENT_TYPE.MEN_DOUBLE,
    groupCount: 4,
    randomFn: () => 0.33,
    hostClubName: "CLB A",
  });

  assert.equal(plan.ok, true);
  assert.deepEqual(plan.balance.sizes, [5, 5, 5, 5]);
  assert.equal(plan.event.entries.every((entry) => entry.rating == null || entry.rating === 0), true);
  assert.equal(plan.event.entries.every((entry) => !entry.seed), true);
  assert.ok(plan.matchCount > 0);
});

test("regression Test 4: official AI balance pairs 16 men and seeds groups", () => {
  const players = buildMalePlayers(16);
  const plan = buildOfficialAiBalancePlan({
    tournament: {
      id: "t-ai",
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.AI_BALANCE,
      events: [],
    },
    players,
    selectedPlayerIds: players.map((player) => String(player.id)),
    eventType: EVENT_TYPE.MEN_DOUBLE,
    groupCount: 2,
    individualRegistration: true,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.event.entries.length, 8);
  assert.equal(plan.event.entries[0].seed, 1);
  assert.deepEqual(plan.balance.sizes, [4, 4]);
  assert.equal(plan.matchCount, 12);

  const bracket = generateKnockoutBracket(completeAllGroupMatches(plan.event));
  assert.equal(bracket.ok, true);
  assert.ok(bracket.knockoutMatchCount > 0);
});

test("regression Test 5: bracket and director sync when semifinal score is revised", () => {
  const players = buildMalePlayers(16);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MEN_DOUBLE, {
    tournamentId: "t5",
    eventId: "e5",
  });
  const groups = assignEntriesToGroupsSnake(entries, 2, players).map((group) => ({
    ...group,
    tournamentId: "t5",
    eventId: "e5",
  }));
  const schedule = buildGroupStageSchedule(groups, {
    tournamentId: "t5",
    eventId: "e5",
    players,
  });
  const completed = completeAllGroupMatches({
    id: "e5",
    entries,
    groups: schedule.groups,
    matches: schedule.matches,
  });

  const generated = generateKnockoutBracket(completed);
  assert.equal(generated.ok, true);

  const semiMatch = generated.event.matches.find((match) => match.bracketMatchId === "R1-M1");
  assert.ok(semiMatch);

  const firstWinner = submitKnockoutMatchScore(generated.event, semiMatch.id, {
    scoreA: 11,
    scoreB: 4,
  });
  assert.equal(firstWinner.ok, true);

  const finalAfterFirst = firstWinner.event.matches.find((match) => match.bracketMatchId === "R2-M1");
  const firstFinalEntryA = finalAfterFirst.entryAId;

  const revisedWinner = submitKnockoutMatchScore(firstWinner.event, semiMatch.id, {
    scoreA: 3,
    scoreB: 11,
  });
  assert.equal(revisedWinner.ok, true);

  const finalAfterRevision = revisedWinner.event.matches.find(
    (match) => match.bracketMatchId === "R2-M1"
  );
  assert.notEqual(finalAfterRevision.entryAId, firstFinalEntryA);

  const progress = resolveBracketProgress(revisedWinner.event);
  const legacyProgress = buildKnockoutProgress(
    revisedWinner.event.bracket.rounds,
    revisedWinner.event.bracket.winnersByMatch,
    new Map(revisedWinner.event.entries.map((entry) => [String(entry.id), entry]))
  );
  assert.equal(progress.rounds.length, legacyProgress.rounds.length);

  const playingSemi = {
    ...revisedWinner.event.matches.find((match) => match.bracketMatchId === "R1-M1"),
    status: MATCH_STATUS.PLAYING,
  };
  const eventForDirector = {
    ...revisedWinner.event,
    matches: revisedWinner.event.matches.map((match) =>
      match.id === playingSemi.id ? playingSemi : match
    ),
  };

  const directorResult = submitTournamentDirectorMatchScore(eventForDirector, playingSemi.id, {
    scoreA: 11,
    scoreB: 9,
  });
  assert.equal(directorResult.ok, true);

  const snapshot = buildEventDirectorSnapshot({
    event: directorResult.event,
    courts: [],
    players,
  });
  assert.ok(snapshot.bracketProgress);
  assert.equal(snapshot.bracketProgress.rounds.length, progress.rounds.length);
});

test("regression legacy: Tournament.jsx and legacy bracket logic remain available", () => {
  const legacyPage = join(rootDir, "src/pages/Tournament.jsx");
  const legacyShell = join(rootDir, "src/pages/tournament/TournamentShell.jsx");
  const legacyBracketLogic = join(rootDir, "src/pages/tournament.bracket.logic.js");

  assert.equal(existsSync(legacyPage), true);
  assert.equal(existsSync(legacyShell), true);
  assert.equal(existsSync(legacyBracketLogic), true);

  const legacySource = readFileSync(legacyPage, "utf8");
  assert.match(legacySource, /export default function/);
  assert.match(legacySource, /buildTournamentBracket/);

  const shellSource = readFileSync(legacyShell, "utf8");
  assert.match(shellSource, /TournamentHome/);

  const homeSource = readFileSync(join(rootDir, "src/pages/tournament/TournamentHome.jsx"), "utf8");
  assert.match(homeSource, /Tổng quan/);
});
