import test from "node:test";
import assert from "node:assert/strict";

import {
  ACTIVATION_RULE,
  DREAMBREAKER_STATUS,
  FORMAT_PRESET,
  SUB_MATCH_STATUS,
} from "../src/features/team-tournament/constants.js";
import {
  computeMatchupTieProgress,
  countDreambreakerPendingMatchups,
} from "../src/features/team-tournament/engines/matchupTieEngine.js";
import { listDreambreakerMatchups } from "../src/features/team-tournament/engines/dreambreakerEngine.js";

function mlpTeamData(matchup) {
  return {
    settings: { formatPreset: FORMAT_PRESET.MLP_4, dreambreakerEnabled: true },
    disciplines: [
      { id: "d1", activationRule: ACTIVATION_RULE.ALWAYS },
      { id: "d2", activationRule: ACTIVATION_RULE.ALWAYS },
      { id: "d3", activationRule: ACTIVATION_RULE.ALWAYS },
      { id: "d4", activationRule: ACTIVATION_RULE.ALWAYS },
      { id: "db", activationRule: "tie_at_2_2" },
    ],
    matchups: [matchup],
  };
}

test("3-1 sub-match score clinches tie without dreambreaker", () => {
  const matchup = {
    id: "m1",
    teamAId: "a",
    teamBId: "b",
    subMatches: [
      { disciplineId: "d1", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: "a" },
      { disciplineId: "d2", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: "a" },
      { disciplineId: "d3", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: "a" },
      { disciplineId: "d4", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: "b" },
    ],
  };

  const progress = computeMatchupTieProgress(mlpTeamData(matchup), matchup);
  assert.equal(progress.scoreLabel, "3–1");
  assert.equal(progress.needsDreambreaker, false);
  assert.equal(progress.tieClinchedEarly, true);
});

test("2-2 sub-match score requires dreambreaker step", () => {
  const matchup = {
    id: "m1",
    teamAId: "a",
    teamBId: "b",
    dreambreaker: { status: DREAMBREAKER_STATUS.LINEUP_OPEN },
    subMatches: [
      { disciplineId: "d1", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: "a" },
      { disciplineId: "d2", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: "a" },
      { disciplineId: "d3", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: "b" },
      { disciplineId: "d4", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: "b" },
    ],
  };

  const teamData = mlpTeamData(matchup);
  const progress = computeMatchupTieProgress(teamData, matchup);
  assert.equal(progress.scoreLabel, "2–2");
  assert.equal(progress.needsDreambreaker, true);
  assert.equal(countDreambreakerPendingMatchups(teamData), 1);
});

test("listDreambreakerMatchups includes 2-2 tie awaiting lineup", () => {
  const matchup = {
    id: "m1",
    teamAId: "a",
    teamBId: "b",
    subMatches: [
      { disciplineId: "d1", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: "a" },
      { disciplineId: "d2", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: "a" },
      { disciplineId: "d3", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: "b" },
      { disciplineId: "d4", status: SUB_MATCH_STATUS.COMPLETED, winnerTeamId: "b" },
    ],
  };

  const teamData = mlpTeamData(matchup);
  assert.equal(listDreambreakerMatchups(teamData).length, 1);
});
