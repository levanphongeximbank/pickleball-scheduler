import test from "node:test";
import assert from "node:assert/strict";

import {
  LINEUP_STATUS,
  MATCHUP_STATUS,
  SUB_MATCH_STATUS,
} from "../src/features/team-tournament/constants.js";
import {
  computeTeamTournamentWorkflow,
  isLineupPhaseDone,
} from "../src/components/tournament/team/teamTournamentWorkflow.js";

test("lineup phase done when matchup published", () => {
  const teamData = {
    lineups: {},
    matchups: [
      {
        id: "m1",
        teamAId: "a",
        teamBId: "b",
        status: MATCHUP_STATUS.PUBLISHED,
        subMatches: [],
      },
    ],
  };

  assert.equal(isLineupPhaseDone(teamData, teamData.matchups[0]), true);
  const workflow = computeTeamTournamentWorkflow({
    teams: [{ id: "a" }, { id: "b" }],
    disciplines: [{ id: "d1" }],
    ...teamData,
  });
  assert.equal(workflow.stepComplete[3], true);
  assert.equal(workflow.currentStep, 4);
});

test("lineup phase advances to results when scores entered", () => {
  const teamData = {
    teams: [{ id: "a" }, { id: "b" }],
    disciplines: [{ id: "d1" }],
    lineups: {},
    matchups: [
      {
        id: "m1",
        teamAId: "a",
        teamBId: "b",
        status: MATCHUP_STATUS.IN_PROGRESS,
        subMatches: [{ id: "s1", status: SUB_MATCH_STATUS.PLAYING }],
      },
    ],
  };

  const workflow = computeTeamTournamentWorkflow(teamData);
  assert.equal(workflow.stepComplete[3], true);
  assert.equal(workflow.stepComplete[4], false);
  assert.equal(workflow.currentStep, 4);
  assert.match(workflow.hints[0], /Đang nhập kết quả/);
});

test("results step completes only when all matchups finished", () => {
  const teamData = {
    teams: [{ id: "a" }, { id: "b" }, { id: "c" }],
    disciplines: [{ id: "d1" }],
    lineups: {},
    matchups: [
      {
        id: "m1",
        teamAId: "a",
        teamBId: "b",
        status: MATCHUP_STATUS.COMPLETED,
        subMatches: [],
      },
      {
        id: "m2",
        teamAId: "a",
        teamBId: "c",
        status: MATCHUP_STATUS.IN_PROGRESS,
        subMatches: [],
      },
    ],
  };

  const workflow = computeTeamTournamentWorkflow(teamData);
  assert.equal(workflow.stepComplete[4], false);
  assert.equal(workflow.progress.results.done, 1);
});

test("lineup phase done when both lineups published even if matchup status lags", () => {
  const teamData = {
    teams: [{ id: "a" }, { id: "b" }],
    disciplines: [{ id: "d1" }],
    lineups: {
      "m1::a": { status: LINEUP_STATUS.PUBLISHED, selections: {} },
      "m1::b": { status: LINEUP_STATUS.PUBLISHED, selections: {} },
    },
    matchups: [
      {
        id: "m1",
        teamAId: "a",
        teamBId: "b",
        status: MATCHUP_STATUS.LOCKED,
        subMatches: [],
      },
    ],
  };

  assert.equal(isLineupPhaseDone(teamData, teamData.matchups[0]), true);
});
