import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceTeamKnockoutWinner,
  generateTeamKnockoutMatchups,
  listGroupStageMatchups,
  listKnockoutMatchups,
  maybeAdvanceKnockoutAfterResult,
  qualifyTeamsFromGroups,
} from "../src/features/team-tournament/engines/teamKnockoutEngine.js";
import { computeMatchupResult } from "../src/features/team-tournament/engines/teamResultEngine.js";
import {
  addTeamToTournament,
  initializeTeamTournamentData,
} from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import {
  createDisciplineRecord,
  createMatchupRecord,
  findMatchup,
  normalizeTeamData,
} from "../src/features/team-tournament/models/index.js";
import {
  MATCHUP_STATUS,
  SUB_MATCH_STATUS,
} from "../src/features/team-tournament/constants.js";

function withCompletedResult(matchup, winnerTeamId) {
  const winnerIsA = String(winnerTeamId) === String(matchup.teamAId);
  return {
    ...matchup,
    status: MATCHUP_STATUS.COMPLETED,
    result: {
      teamAWins: winnerIsA ? 1 : 0,
      teamBWins: winnerIsA ? 0 : 1,
      teamAPoints: winnerIsA ? 11 : 5,
      teamBPoints: winnerIsA ? 5 : 11,
      winnerTeamId,
    },
  };
}

function buildTwoGroupFixture() {
  let teamData = initializeTeamTournamentData({
    disciplines: [
      createDisciplineRecord({
        id: "d1",
        name: "Đôi nam",
        playerCount: 2,
        sortOrder: 1,
      }),
    ],
  });

  for (const [id, name] of [
    ["a1", "A1"],
    ["a2", "A2"],
    ["b1", "B1"],
    ["b2", "B2"],
  ]) {
    teamData = addTeamToTournament(teamData, {
      id,
      name,
      playerIds: [`${id}-p1`, `${id}-p2`],
      captainPlayerId: `${id}-p1`,
    });
  }

  const rrA = withCompletedResult(
    createMatchupRecord("a1", "a2", {
      id: "rr-a",
      groupId: "g-a",
      disciplines: teamData.disciplines,
      status: MATCHUP_STATUS.COMPLETED,
    }),
    "a1"
  );
  const rrB = withCompletedResult(
    createMatchupRecord("b1", "b2", {
      id: "rr-b",
      groupId: "g-b",
      disciplines: teamData.disciplines,
      status: MATCHUP_STATUS.COMPLETED,
    }),
    "b1"
  );

  return normalizeTeamData({
    ...teamData,
    groups: [
      { id: "g-a", name: "Bảng A", teamIds: ["a1", "a2"] },
      { id: "g-b", name: "Bảng B", teamIds: ["b1", "b2"] },
    ],
    matchups: [rrA, rrB],
  });
}

function buildThreeGroupOneQualifierFixture() {
  let teamData = initializeTeamTournamentData({
    disciplines: [
      createDisciplineRecord({
        id: "d1",
        name: "Đôi nam",
        playerCount: 2,
        sortOrder: 1,
      }),
    ],
  });

  for (const [id, name] of [
    ["a1", "A1"],
    ["a2", "A2"],
    ["b1", "B1"],
    ["b2", "B2"],
    ["c1", "C1"],
    ["c2", "C2"],
  ]) {
    teamData = addTeamToTournament(teamData, {
      id,
      name,
      playerIds: [`${id}-p1`, `${id}-p2`],
      captainPlayerId: `${id}-p1`,
    });
  }

  const matchups = [
    withCompletedResult(
      createMatchupRecord("a1", "a2", {
        id: "rr-a",
        groupId: "g-a",
        disciplines: teamData.disciplines,
      }),
      "a1"
    ),
    withCompletedResult(
      createMatchupRecord("b1", "b2", {
        id: "rr-b",
        groupId: "g-b",
        disciplines: teamData.disciplines,
      }),
      "b1"
    ),
    withCompletedResult(
      createMatchupRecord("c1", "c2", {
        id: "rr-c",
        groupId: "g-c",
        disciplines: teamData.disciplines,
      }),
      "c1"
    ),
  ];

  return normalizeTeamData({
    ...teamData,
    groups: [
      { id: "g-a", name: "Bảng A", teamIds: ["a1", "a2"] },
      { id: "g-b", name: "Bảng B", teamIds: ["b1", "b2"] },
      { id: "g-c", name: "Bảng C", teamIds: ["c1", "c2"] },
    ],
    matchups,
  });
}

test("T-S2-D01 qualify from 2 groups", () => {
  const teamData = buildTwoGroupFixture();
  const result = qualifyTeamsFromGroups(teamData, { qualifiersPerGroup: 2 });
  assert.equal(result.ok, true);
  assert.equal(result.qualified.length, 4);
  assert.deepEqual(
    result.qualified.map((row) => row.teamId),
    ["a1", "b1", "a2", "b2"]
  );
});

test("T-S2-D02 require groups before knockout", () => {
  let teamData = initializeTeamTournamentData({
    disciplines: [
      createDisciplineRecord({ id: "d1", name: "Đôi", playerCount: 2 }),
    ],
  });
  teamData = addTeamToTournament(teamData, {
    id: "t1",
    name: "T1",
    playerIds: ["p1", "p2"],
  });
  teamData = addTeamToTournament(teamData, {
    id: "t2",
    name: "T2",
    playerIds: ["p3", "p4"],
  });

  const result = generateTeamKnockoutMatchups(teamData, { qualifiersPerGroup: 2 });
  assert.equal(result.ok, false);
  assert.equal(result.code, "GROUPS_REQUIRED");
});

test("T-S2-D03 generate preserves RR matchups", () => {
  const teamData = buildTwoGroupFixture();
  const beforeIds = listGroupStageMatchups(teamData).map((row) => row.id).sort();
  const built = generateTeamKnockoutMatchups(teamData, { qualifiersPerGroup: 2 });
  assert.equal(built.ok, true);
  const afterIds = listGroupStageMatchups(built.teamData).map((row) => row.id).sort();
  assert.deepEqual(afterIds, beforeIds);
  assert.ok(listKnockoutMatchups(built.teamData).length >= 2);
});

test("T-S2-D04 first round pairs cross-group seeds", () => {
  const teamData = buildTwoGroupFixture();
  const built = generateTeamKnockoutMatchups(teamData, { qualifiersPerGroup: 2 });
  assert.equal(built.ok, true);
  const firstRound = listKnockoutMatchups(built.teamData).filter(
    (row) => Number(row.roundNumber) === 1
  );
  assert.equal(firstRound.length, 2);
  const pairKeys = firstRound
    .map((row) => [row.teamAId, row.teamBId].sort().join("+"))
    .sort();
  assert.deepEqual(pairKeys, ["a1+b2", "a2+b1"]);
});

test("T-S2-D05 bye advances into next round", () => {
  const teamData = buildThreeGroupOneQualifierFixture();
  const built = generateTeamKnockoutMatchups(teamData, { qualifiersPerGroup: 1 });
  assert.equal(built.ok, true);
  assert.equal(built.qualified.length, 3);

  const bye = listKnockoutMatchups(built.teamData).find(
    (row) => row.result?.resultType === "bye" || (!row.teamAId && row.teamBId) || (row.teamAId && !row.teamBId)
  );
  // After generate, bye may already be COMPLETED and advanced — look for advanced slot
  const finals = listKnockoutMatchups(built.teamData).filter(
    (row) => Number(row.roundNumber) === 2
  );
  assert.equal(finals.length, 1);
  const final = finals[0];
  const filled =
    Boolean(final.teamAId) || Boolean(final.teamBId);
  assert.equal(filled, true);
  assert.ok(
    ["a1", "b1", "c1"].includes(final.teamAId) ||
      ["a1", "b1", "c1"].includes(final.teamBId)
  );
  assert.ok(bye || filled);
});

test("T-S2-D06 advanceTeamKnockoutWinner fills next slot + maybeAdvance via computeMatchupResult", () => {
  const teamData = buildTwoGroupFixture();
  const built = generateTeamKnockoutMatchups(teamData, { qualifiersPerGroup: 2 });
  assert.equal(built.ok, true);

  const first = listKnockoutMatchups(built.teamData).find(
    (row) =>
      Number(row.roundNumber) === 1 &&
      row.teamAId &&
      row.teamBId &&
      row.status !== MATCHUP_STATUS.COMPLETED
  );
  assert.ok(first);

  const withResult = normalizeTeamData({
    ...built.teamData,
    matchups: built.teamData.matchups.map((row) =>
      row.id === first.id
        ? {
            ...row,
            status: MATCHUP_STATUS.COMPLETED,
            result: {
              teamAWins: 1,
              teamBWins: 0,
              teamAPoints: 11,
              teamBPoints: 3,
              winnerTeamId: first.teamAId,
            },
          }
        : row
    ),
  });

  const advanced = advanceTeamKnockoutWinner(withResult, first.id);
  assert.equal(advanced.ok, true);
  assert.equal(advanced.advanced, true);
  const next = findMatchup(advanced.teamData, first.nextMatchupId);
  assert.ok(next);
  if (first.nextSlot === "B") {
    assert.equal(next.teamBId, first.teamAId);
  } else {
    assert.equal(next.teamAId, first.teamAId);
  }

  // Second first-round matchup via computeMatchupResult → maybeAdvanceKnockoutAfterResult
  const other = listKnockoutMatchups(advanced.teamData).find(
    (row) =>
      Number(row.roundNumber) === 1 &&
      row.id !== first.id &&
      row.teamAId &&
      row.teamBId
  );
  assert.ok(other);

  const playing = normalizeTeamData({
    ...advanced.teamData,
    matchups: advanced.teamData.matchups.map((row) => {
      if (row.id !== other.id) return row;
      return {
        ...row,
        subMatches: (row.subMatches || []).map((sub) => ({
          ...sub,
          status: SUB_MATCH_STATUS.COMPLETED,
          score: { teamA: 11, teamB: 5 },
          winnerTeamId: other.teamAId,
        })),
      };
    }),
  });

  const computed = computeMatchupResult(playing, other.id);
  assert.equal(computed.ok, true);
  assert.equal(computed.result?.winnerTeamId, other.teamAId);

  const maybe = maybeAdvanceKnockoutAfterResult(computed.teamData, other.id);
  assert.equal(maybe.ok, true);
  const final = findMatchup(maybe.teamData, other.nextMatchupId);
  assert.ok(final);
  assert.ok(final.teamAId && final.teamBId);
});
