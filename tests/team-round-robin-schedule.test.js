import test from "node:test";
import assert from "node:assert/strict";

import {
  addTeamToTournament,
  buildRoundRobinMatchups,
  initializeTeamTournamentData,
} from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import {
  assignTeamsToGroupsBySizes,
  buildRoundRobinRoundsForTeamCount,
  buildStructuredRoundRobinMatchups,
  buildTeamTournamentScheduleDiagram,
  buildUnifiedScheduleDiagram,
  defaultCourtCountForPool,
  getRestingTeamIndices,
  recommendGroupSizes,
} from "../src/features/team-tournament/engines/teamRoundRobinScheduleEngine.js";

function addTeams(teamData, count) {
  let next = teamData;
  for (let index = 0; index < count; index += 1) {
    const label = String.fromCharCode(65 + index);
    next = addTeamToTournament(next, {
      id: `team-${label.toLowerCase()}`,
      name: `Đội ${label}`,
      playerIds: [],
    });
  }
  return next;
}

function pairKey(leftIndex, rightIndex) {
  return leftIndex < rightIndex ? `${leftIndex}-${rightIndex}` : `${rightIndex}-${leftIndex}`;
}

function collectPairsFromRounds(rounds) {
  const pairs = new Set();
  rounds.forEach((round) => {
    round.pairs.forEach(([left, right]) => {
      pairs.add(pairKey(left, right));
    });
  });
  return pairs;
}

test("buildRoundRobinRoundsForTeamCount — 3 đội đúng 3 vòng, 1 trận/vòng", () => {
  const rounds = buildRoundRobinRoundsForTeamCount(3);
  assert.equal(rounds.length, 3);
  rounds.forEach((round) => {
    assert.equal(round.pairs.length, 1);
    assert.equal(getRestingTeamIndices(3, round).length, 1);
  });
  assert.deepEqual(rounds[0].pairs, [[0, 1]]);
  assert.deepEqual(rounds[1].pairs, [[1, 2]]);
  assert.deepEqual(rounds[2].pairs, [[0, 2]]);
});

test("buildRoundRobinRoundsForTeamCount — 4 đội đúng 3 vòng, 2 trận/vòng", () => {
  const rounds = buildRoundRobinRoundsForTeamCount(4);
  assert.equal(rounds.length, 3);
  rounds.forEach((round) => {
    assert.equal(round.pairs.length, 2);
    assert.equal(getRestingTeamIndices(4, round).length, 0);
  });
  assert.deepEqual(rounds[0].pairs, [[0, 1], [2, 3]]);
  assert.deepEqual(rounds[1].pairs, [[0, 2], [1, 3]]);
  assert.deepEqual(rounds[2].pairs, [[0, 3], [1, 2]]);
});

test("buildRoundRobinRoundsForTeamCount — 5 đội đúng 5 vòng, 2 trận/vòng, 1 nghỉ", () => {
  const rounds = buildRoundRobinRoundsForTeamCount(5);
  assert.equal(rounds.length, 5);
  rounds.forEach((round) => {
    assert.equal(round.pairs.length, 2);
    assert.equal(getRestingTeamIndices(5, round).length, 1);
  });
  const pairs = collectPairsFromRounds(rounds);
  assert.equal(pairs.size, 10);
});

test("recommendGroupSizes — 6 đến 10 đội", () => {
  assert.deepEqual(recommendGroupSizes(5), null);
  assert.deepEqual(recommendGroupSizes(6), [3, 3]);
  assert.deepEqual(recommendGroupSizes(7), [3, 4]);
  assert.deepEqual(recommendGroupSizes(8), [4, 4]);
  assert.deepEqual(recommendGroupSizes(9), [4, 5]);
  assert.deepEqual(recommendGroupSizes(10), [5, 5]);
  assert.equal(recommendGroupSizes(11), null);
});

test("defaultCourtCountForPool — 3 đội 1 sân, còn lại 2 sân", () => {
  assert.equal(defaultCourtCountForPool(3), 1);
  assert.equal(defaultCourtCountForPool(4), 2);
  assert.equal(defaultCourtCountForPool(5), 2);
});

test("buildStructuredRoundRobinMatchups — gắn roundNumber và Sân 1/2", () => {
  let teamData = addTeams(initializeTeamTournamentData(), 4);
  teamData = buildStructuredRoundRobinMatchups(teamData, {
    scheduledAt: "2099-06-01T08:00:00.000Z",
    roundIntervalMinutes: 60,
    courtCount: 2,
  });

  assert.equal(teamData.matchups.length, 6);

  const round1 = teamData.matchups.filter((matchup) => matchup.roundNumber === 1);
  assert.equal(round1.length, 2);
  assert.ok(round1.some((matchup) => matchup.courtLabel === "Sân 1"));
  assert.ok(round1.some((matchup) => matchup.courtLabel === "Sân 2"));
  assert.equal(round1[0].scheduledAt, "2099-06-01T08:00:00.000Z");

  const round2 = teamData.matchups.filter((matchup) => matchup.roundNumber === 2);
  assert.equal(round2[0].scheduledAt, "2099-06-01T09:00:00.000Z");
});

test("buildRoundRobinMatchups — 6 đội without groups → GROUPS_REQUIRED", () => {
  let teamData = addTeams(initializeTeamTournamentData(), 6);
  teamData = buildRoundRobinMatchups(teamData, {
    scheduledAt: "2099-06-01T08:00:00.000Z",
  });

  assert.equal(teamData.ok, false);
  assert.equal(teamData.code, "GROUPS_REQUIRED");
  assert.equal((teamData.groups || []).length, 0);
});

test("buildRoundRobinMatchups — 6 đội with explicit groups builds matchups", () => {
  let teamData = addTeams(initializeTeamTournamentData(), 6);
  teamData = assignTeamsToGroupsBySizes(teamData, [3, 3]);
  teamData = buildRoundRobinMatchups(teamData, {
    scheduledAt: "2099-06-01T08:00:00.000Z",
  });

  assert.equal(teamData.groups.length, 2);
  assert.equal(teamData.groups[0].teamIds.length, 3);
  assert.equal(teamData.groups[1].teamIds.length, 3);
  assert.equal(teamData.matchups.length, 6);
});

test("assignTeamsToGroupsBySizes — snake vào bảng 3 + 4", () => {
  let teamData = addTeams(initializeTeamTournamentData(), 7);
  teamData = assignTeamsToGroupsBySizes(teamData, [3, 4]);

  assert.equal(teamData.groups.length, 2);
  assert.equal(teamData.groups[0].teamIds.length, 3);
  assert.equal(teamData.groups[1].teamIds.length, 4);
});

test("buildTeamTournamentScheduleDiagram — đánh số trận toàn cục", () => {
  let teamData = addTeams(initializeTeamTournamentData(), 4);
  teamData = buildStructuredRoundRobinMatchups(teamData, {
    scheduledAt: "2099-06-01T08:00:00.000Z",
  });

  const groups = buildTeamTournamentScheduleDiagram(teamData);
  const allMatches = groups.flatMap((group) =>
    group.rounds.flatMap((round) => round.matches)
  );

  assert.equal(allMatches.length, 6);
  assert.equal(allMatches[0].matchNumber, 1);
  assert.equal(allMatches[5].matchNumber, 6);
  assert.ok(allMatches.every((match) => match.matchNumberInRound >= 1));
});

test("buildUnifiedScheduleDiagram — gộp theo khung giờ", () => {
  let teamData = addTeams(initializeTeamTournamentData(), 6);
  teamData = assignTeamsToGroupsBySizes(teamData, [3, 3]);
  teamData = buildRoundRobinMatchups(teamData, {
    scheduledAt: "2099-06-01T08:00:00.000Z",
    roundIntervalMinutes: 60,
  });

  const slots = buildUnifiedScheduleDiagram(teamData);
  assert.ok(slots.length >= 3);
  assert.ok(slots[0].matches.length >= 1);
  assert.ok(slots[0].label.includes("Vòng"));
});
