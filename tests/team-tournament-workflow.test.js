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
  WORKFLOW_STEPS,
} from "../src/components/tournament/team/teamTournamentWorkflow.js";

/** Indices after Format + Groups + Matchups stages were added. */
const IDX = {
  format: 0,
  teams: 1,
  groups: 2,
  disciplines: 3,
  matchups: 4,
  schedule: 5,
  lineups: 6,
  results: 7,
};

function withScheduleFields(matchup) {
  return {
    ...matchup,
    scheduledAt: matchup.scheduledAt || "2099-06-01T08:00:00.000Z",
    courtLabel: matchup.courtLabel || "Sân 1",
  };
}

test("workflow steps include format then groups stage", () => {
  assert.equal(WORKFLOW_STEPS[IDX.format].id, "format");
  assert.equal(WORKFLOW_STEPS[IDX.groups].id, "groups");
  assert.equal(WORKFLOW_STEPS[IDX.matchups].id, "matchups");
  assert.equal(WORKFLOW_STEPS.length, 8);
});

test("lineup phase done when matchup published", () => {
  const teamData = {
    lineups: {},
    matchups: [
      withScheduleFields({
        id: "m1",
        teamAId: "a",
        teamBId: "b",
        status: MATCHUP_STATUS.PUBLISHED,
        subMatches: [],
      }),
    ],
  };

  assert.equal(isLineupPhaseDone(teamData, teamData.matchups[0]), true);
  const workflow = computeTeamTournamentWorkflow({
    teams: [{ id: "a" }, { id: "b" }],
    disciplines: [{ id: "d1" }],
    ...teamData,
  });
  assert.equal(workflow.stepComplete[IDX.lineups], true);
  assert.equal(workflow.currentStep, IDX.results);
});

test("lineup phase advances to results when scores entered", () => {
  const teamData = {
    teams: [{ id: "a" }, { id: "b" }],
    disciplines: [{ id: "d1" }],
    lineups: {},
    matchups: [
      withScheduleFields({
        id: "m1",
        teamAId: "a",
        teamBId: "b",
        status: MATCHUP_STATUS.IN_PROGRESS,
        subMatches: [{ id: "s1", status: SUB_MATCH_STATUS.PLAYING }],
      }),
    ],
  };

  const workflow = computeTeamTournamentWorkflow(teamData);
  assert.equal(workflow.stepComplete[IDX.lineups], true);
  assert.equal(workflow.stepComplete[IDX.results], false);
  assert.equal(workflow.currentStep, IDX.results);
  assert.match(workflow.hints[0], /Đang nhập kết quả/);
});

test("results step completes only when all matchups finished", () => {
  const teamData = {
    teams: [{ id: "a" }, { id: "b" }, { id: "c" }],
    disciplines: [{ id: "d1" }],
    lineups: {},
    matchups: [
      withScheduleFields({
        id: "m1",
        teamAId: "a",
        teamBId: "b",
        status: MATCHUP_STATUS.COMPLETED,
        subMatches: [],
      }),
      withScheduleFields({
        id: "m2",
        teamAId: "a",
        teamBId: "c",
        status: MATCHUP_STATUS.IN_PROGRESS,
        subMatches: [],
      }),
    ],
  };

  const workflow = computeTeamTournamentWorkflow(teamData);
  assert.equal(workflow.stepComplete[IDX.results], false);
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
      withScheduleFields({
        id: "m1",
        teamAId: "a",
        teamBId: "b",
        status: MATCHUP_STATUS.LOCKED,
        subMatches: [],
      }),
    ],
  };

  assert.equal(isLineupPhaseDone(teamData, teamData.matchups[0]), true);
});

test("8 teams without groups stop at Chia bảng step", () => {
  const workflow = computeTeamTournamentWorkflow({
    teams: Array.from({ length: 8 }, (_, i) => ({ id: `t${i}` })),
    disciplines: [{ id: "d1" }],
    groups: [],
    matchups: [],
  });
  assert.equal(workflow.stepComplete[IDX.teams], true);
  assert.equal(workflow.stepComplete[IDX.groups], false);
  assert.equal(workflow.currentStep, IDX.groups);
  assert.match(workflow.hints[0], /Chia bảng/);
});
