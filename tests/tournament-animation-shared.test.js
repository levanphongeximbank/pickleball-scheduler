import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  FLOW_STEP_KEYS,
  TOURNAMENT_FLOW_STEPS,
  getFlowStepState,
} from "../src/components/tournament/animation/shared/tournamentFlowConfig.js";
import {
  buildPairingSteps,
  buildSnakeSteps,
  buildGroupMatchPairingSteps,
} from "../src/components/tournament/animation/animationUtils.js";

describe("tournament animation shared flow", () => {
  it("defines five unified flow steps", () => {
    assert.equal(TOURNAMENT_FLOW_STEPS.length, 5);
    assert.equal(TOURNAMENT_FLOW_STEPS[0].key, FLOW_STEP_KEYS.PAIRING);
    assert.equal(TOURNAMENT_FLOW_STEPS[3].key, FLOW_STEP_KEYS.BRACKET);
  });

  it("marks active and done flow states", () => {
    assert.equal(getFlowStepState(FLOW_STEP_KEYS.DRAW, FLOW_STEP_KEYS.PAIRING), "done");
    assert.equal(getFlowStepState(FLOW_STEP_KEYS.DRAW, FLOW_STEP_KEYS.DRAW), "active");
    assert.equal(getFlowStepState(FLOW_STEP_KEYS.DRAW, FLOW_STEP_KEYS.MATCH_PAIRING), "pending");
  });
});

describe("tournament animation engine step integrity", () => {
  it("pairing 20 players into 10 teams preserves order", () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      id: `team-${index + 1}`,
      name: `P${index * 2 + 1} / P${index * 2 + 2}`,
      playerIds: [`p${index * 2 + 1}`, `p${index * 2 + 2}`],
    }));

    const steps = buildPairingSteps(entries);
    assert.equal(steps.length, 10);
    assert.equal(steps[0].left.name, "P1");
    assert.equal(steps[0].right.name, "P2");
    assert.equal(steps[9].left.name, "P19");
    assert.equal(steps[9].right.name, "P20");
  });

  it("snake draw assigns 10 teams to 4 groups without reshuffling", () => {
    const players = Array.from({ length: 10 }, (_, index) => ({
      id: `p${index + 1}`,
      name: `P${index + 1}`,
      level: 10 - index,
    }));

    const entries = players.map((player, index) => ({
      id: `e${index + 1}`,
      name: player.name,
      playerIds: [player.id],
      rating: player.level,
    }));

    const finalGroups = [
      { label: "A", entryIds: ["e1", "e8"], entries: [] },
      { label: "B", entryIds: ["e2", "e7"], entries: [] },
      { label: "C", entryIds: ["e3", "e6"], entries: [] },
      { label: "D", entryIds: ["e4", "e5", "e9", "e10"], entries: [] },
    ];

    const steps = buildSnakeSteps({
      entries,
      players,
      groupCount: 4,
      finalGroups,
    });

    assert.equal(steps.length, 10);
    assert.deepEqual(
      steps.slice(0, 4).map((step) => step.groupLabel),
      ["A", "B", "C", "D"]
    );
    assert.equal(steps[4].groupLabel, "D");
  });

  it("group match steps keep court label or empty for unassigned", () => {
    const steps = buildGroupMatchPairingSteps({
      groups: [{ id: "g1", label: "A", entryIds: ["e1", "e2"] }],
      matches: [
        {
          id: "m1",
          groupId: "g1",
          entryAId: "e1",
          entryBId: "e2",
          courtId: null,
        },
      ],
      entries: [
        { id: "e1", name: "Team A" },
        { id: "e2", name: "Team B" },
      ],
      courts: [],
    });

    assert.equal(steps.length, 1);
    assert.equal(steps[0].left.name, "Team A");
    assert.equal(steps[0].right.name, "Team B");
    assert.ok(!steps[0].courtLabel);
  });

  it("long player names are preserved in pairing steps", () => {
    const longName = "Nguyễn Văn Anh Tuấn Rất Dài Không Bị Cắt";
    const steps = buildPairingSteps([
      {
        id: "x",
        name: `${longName} / Partner B`,
        playerIds: ["p1", "p2"],
      },
    ]);

    assert.equal(steps[0].left.name, longName);
  });
});
