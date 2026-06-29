import test from "node:test";
import assert from "node:assert/strict";

import { MATCH_STATUS, MATCH_STAGE } from "../src/models/tournament/index.js";
import {
  buildGroupStandingFromMatches,
  buildAllGroupStandings,
} from "../src/tournament/engines/rankingEngine.js";
import {
  canGenerateBracket,
  generateKnockoutBracket,
  resolveBracketProgress,
  submitKnockoutMatchScore,
  setBracketWinner,
  syncKnockoutMatchParticipants,
  autoSyncBracketFromGroupStandings,
  isGroupStageComplete,
} from "../src/tournament/engines/bracketEngine.js";
import { submitTournamentDirectorMatchScore } from "../src/tournament/engines/tournamentDirectorEngine.js";
import {
  suggestEntriesFromPlayers,
  assignEntriesToGroupsSnake,
  buildGroupStageSchedule,
} from "../src/tournament/engines/index.js";
import { EVENT_TYPE } from "../src/models/tournament/index.js";

function buildMalePlayers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `m${index + 1}`,
    name: `Nam ${index + 1}`,
    gender: "Nam",
    level: 2 + (index % 5) * 0.5,
  }));
}

function buildEventWithGroups() {
  const players = buildMalePlayers(32);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MEN_DOUBLE, {
    tournamentId: "t1",
    eventId: "e1",
  });
  const groups = assignEntriesToGroupsSnake(entries, 4, players).map((group) => ({
    ...group,
    tournamentId: "t1",
    eventId: "e1",
  }));
  const schedule = buildGroupStageSchedule(groups, {
    tournamentId: "t1",
    eventId: "e1",
    players,
  });

  return {
    id: "e1",
    tournamentId: "t1",
    entries,
    groups: schedule.groups,
    matches: schedule.matches,
    bracket: null,
  };
}

function completeGroupStage(event) {
  const nextMatches = event.matches.map((match, index) => ({
    ...match,
    scoreA: index % 2 === 0 ? 11 : 7,
    scoreB: index % 2 === 0 ? 7 : 11,
    winnerId: index % 2 === 0 ? match.entryAId : match.entryBId,
    loserId: index % 2 === 0 ? match.entryBId : match.entryAId,
    status: MATCH_STATUS.COMPLETED,
  }));

  return {
    ...event,
    matches: nextMatches,
  };
}

test("buildGroupStandingFromMatches ranks teams by match points", () => {
  const event = buildEventWithGroups();
  const group = event.groups[0];
  const groupMatches = event.matches.filter((match) => match.groupId === group.id).slice(0, 2);

  const finished = groupMatches.map((match, index) => ({
    ...match,
    scoreA: 11,
    scoreB: index === 0 ? 5 : 9,
    winnerId: match.entryAId,
    loserId: match.entryBId,
    status: MATCH_STATUS.COMPLETED,
  }));

  const standing = buildGroupStandingFromMatches({
    group,
    entries: event.entries,
    matches: finished,
    pointsConfig: group.pointsConfig,
  });

  assert.equal(standing.standing.length, 4);
  assert.equal(standing.standing[0].id, finished[0].entryAId);
  assert.ok(standing.standing[0].matchPoints >= standing.standing[1].matchPoints);
});

test("canGenerateBracket requires even group count", () => {
  const event = buildEventWithGroups();
  const check = canGenerateBracket(event);

  assert.equal(check.ok, true);
  assert.equal(check.groupStandings.length, 4);
});

test("generateKnockoutBracket creates knockout matches from 4 groups", () => {
  const event = completeGroupStage(buildEventWithGroups());
  const generated = generateKnockoutBracket(event);

  assert.equal(generated.ok, true);
  assert.equal(generated.event.bracket.rounds.length, 3);
  assert.equal(generated.knockoutMatchCount, 7);

  const knockoutMatches = generated.event.matches.filter((match) => match.bracketMatchId);
  assert.equal(knockoutMatches.length, 7);
  assert.equal(knockoutMatches[0].stage, MATCH_STAGE.QUARTERFINAL);
});

test("submitKnockoutMatchScore propagates winner to next round", () => {
  const generated = generateKnockoutBracket(completeGroupStage(buildEventWithGroups()));
  let event = generated.event;

  const firstMatch = event.matches.find((match) => match.bracketMatchId === "R1-M1");
  const secondMatch = event.matches.find((match) => match.bracketMatchId === "R1-M2");

  const firstResult = submitKnockoutMatchScore(event, firstMatch.id, {
    scoreA: 11,
    scoreB: 5,
  });
  assert.equal(firstResult.ok, true);

  const secondResult = submitKnockoutMatchScore(firstResult.event, secondMatch.id, {
    scoreA: 8,
    scoreB: 11,
  });
  assert.equal(secondResult.ok, true);

  event = secondResult.event;
  const semiMatch = event.matches.find((match) => match.bracketMatchId === "R2-M1");
  assert.ok(semiMatch.entryAId);
  assert.ok(semiMatch.entryBId);
  assert.notEqual(semiMatch.entryAId, semiMatch.entryBId);
});

test("resolveBracketProgress finds champion after all knockout wins", () => {
  const generated = generateKnockoutBracket(completeGroupStage(buildEventWithGroups()));
  let event = generated.event;

  const winners = ["R1-M1", "R1-M2", "R1-M3", "R1-M4", "R2-M1", "R2-M2", "R3-M1"];
  winners.forEach((bracketMatchId) => {
    const match = event.matches.find((item) => item.bracketMatchId === bracketMatchId);
    const result = setBracketWinner(event, bracketMatchId, "home");
    assert.equal(result.ok, true);
    event = syncKnockoutMatchParticipants(result.event);

    if (bracketMatchId !== "R3-M1") {
      assert.ok(match.entryAId);
    }
  });

  const progress = resolveBracketProgress(event);
  assert.equal(progress.totalRounds, 3);
  assert.equal(progress.completedRounds, 3);
  assert.ok(progress.champion?.name);
});

test("buildAllGroupStandings exposes qualified teams per group", () => {
  const event = completeGroupStage(buildEventWithGroups());
  const standings = buildAllGroupStandings(event, { qualifiersPerGroup: 2 });

  assert.equal(standings.length, 4);
  assert.equal(standings[0].qualified.length, 2);
});

test("autoSyncBracketFromGroupStandings generates bracket when group stage is complete", () => {
  const event = completeGroupStage(buildEventWithGroups());
  const synced = autoSyncBracketFromGroupStandings(event);

  assert.equal(synced.ok, true);
  assert.equal(synced.generated, true);
  assert.ok(synced.event.bracket.rounds.length > 0);
  assert.ok(synced.knockoutMatchCount > 0);
});

test("autoSyncBracketFromGroupStandings skips when bracket already exists", () => {
  const generated = generateKnockoutBracket(completeGroupStage(buildEventWithGroups()));
  const synced = autoSyncBracketFromGroupStandings(generated.event);

  assert.equal(synced.generated, false);
  assert.equal(synced.reason, "already-generated");
});

test("submitTournamentDirectorMatchScore auto-generates bracket on final group score", () => {
  let event = buildEventWithGroups();
  const groupMatches = event.matches.filter((match) => !match.bracketMatchId);

  groupMatches.slice(0, -1).forEach((match, index) => {
    const result = submitTournamentDirectorMatchScore(event, match.id, {
      scoreA: index % 2 === 0 ? 11 : 7,
      scoreB: index % 2 === 0 ? 7 : 11,
    });
    assert.equal(result.ok, true);
    assert.equal(result.bracketAutoGenerated, false);
    event = result.event;
  });

  const lastMatch = groupMatches[groupMatches.length - 1];
  const finalResult = submitTournamentDirectorMatchScore(event, lastMatch.id, {
    scoreA: 11,
    scoreB: 8,
  });

  assert.equal(finalResult.ok, true);
  assert.equal(finalResult.bracketAutoGenerated, true);
  assert.ok(finalResult.event.bracket.rounds.length > 0);
  assert.equal(isGroupStageComplete(finalResult.event), true);
});
