import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildPairingSteps,
  buildDailyMatchSteps,
  buildRandomDrawSteps,
  buildSnakeSteps,
  buildBracketRevealSteps,
  buildPairingWaitingPlayers,
  getRevealedPlayerIds,
} from "../src/components/tournament/animation/animationUtils.js";

describe("tournament animation utils", () => {
  it("buildPairingSteps mirrors entries length", () => {
    const entries = [
      { id: "a", name: "Team A" },
      { id: "b", name: "Team B" },
    ];

    const steps = buildPairingSteps(entries);
    assert.equal(steps.length, 2);
    assert.equal(steps[0].pairing.name, "Team A");
    assert.equal(steps[0].team.name, "Team A");
  });

  it("buildDailyMatchSteps formats match labels", () => {
    const steps = buildDailyMatchSteps([
      { id: "m1", teamALabel: "A1 / A2", teamBLabel: "B1 / B2" },
    ]);
    assert.equal(steps[0].team.name, "A1 / A2 vs B1 / B2");
  });

  it("buildRandomDrawSteps flattens final groups without shuffling", () => {
    const groups = [
      {
        label: "A",
        name: "Bảng A",
        entries: [{ id: "1", name: "Team 1" }],
      },
      {
        label: "B",
        name: "Bảng B",
        entries: [{ id: "2", name: "Team 2" }],
      },
    ];

    const steps = buildRandomDrawSteps(groups);
    assert.equal(steps.length, 2);
    assert.equal(steps[0].team.id, "1");
    assert.equal(steps[0].groupLabel, "A");
    assert.equal(steps[1].team.id, "2");
  });

  it("buildSnakeSteps assigns teams to snake order", () => {
    const players = [
      { id: "p1", name: "P1", level: 5 },
      { id: "p2", name: "P2", level: 4 },
      { id: "p3", name: "P3", level: 3 },
      { id: "p4", name: "P4", level: 2 },
    ];
    const entries = players.map((player, index) => ({
      id: `e${index + 1}`,
      name: player.name,
      playerIds: [player.id],
      rating: player.level,
    }));

    const finalGroups = [
      { label: "A", entryIds: ["e1"], entries: [{ id: "e1", name: "P1" }] },
      { label: "B", entryIds: ["e2"], entries: [{ id: "e2", name: "P2" }] },
      { label: "C", entryIds: ["e3"], entries: [{ id: "e3", name: "P3" }] },
      { label: "D", entryIds: ["e4"], entries: [{ id: "e4", name: "P4" }] },
    ];

    const steps = buildSnakeSteps({
      entries,
      players,
      groupCount: 4,
      finalGroups,
    });

    assert.equal(steps.length, 4);
    assert.equal(steps[0].groupLabel, "A");
    assert.equal(steps[1].groupLabel, "B");
    assert.equal(steps[2].groupLabel, "C");
    assert.equal(steps[3].groupLabel, "D");
  });

  it("buildPairingSteps splits left and right names", () => {
    const entries = [
      {
        id: "p1",
        name: "An / Binh",
        seed: 3,
        playerIds: ["player-a", "player-b"],
      },
    ];
    const steps = buildPairingSteps(entries);
    assert.equal(steps[0].left.name, "An");
    assert.equal(steps[0].right.name, "Binh");
    assert.equal(steps[0].left.id, "player-a");
    assert.equal(steps[0].right.id, "player-b");
    assert.equal(steps[0].seed, 3);
  });

  it("buildPairingWaitingPlayers lists each athlete individually", () => {
    const entries = [
      {
        id: "e1",
        name: "An / Binh",
        seed: 1,
        playerIds: ["p1", "p2"],
      },
      {
        id: "e2",
        name: "Chi",
        seed: 2,
        playerIds: ["p3"],
      },
    ];
    const players = [
      { id: "p1", name: "An", rating: 4.5 },
      { id: "p2", name: "Binh", rating: 4.0 },
      { id: "p3", name: "Chi", rating: 3.5 },
    ];

    const waiting = buildPairingWaitingPlayers(entries, players);
    assert.equal(waiting.length, 3);
    assert.deepEqual(
      waiting.map((player) => player.name),
      ["An", "Binh", "Chi"]
    );
    assert.equal(waiting[0].rating, 4.5);
  });

  it("getRevealedPlayerIds tracks athletes removed from waiting queue", () => {
    const steps = buildPairingSteps([
      {
        id: "e1",
        name: "An / Binh",
        playerIds: ["p1", "p2"],
      },
      {
        id: "e2",
        name: "Chi / Dung",
        playerIds: ["p3", "p4"],
      },
    ]);

    const revealed = getRevealedPlayerIds(steps, 1);
    assert.deepEqual([...revealed].sort(), ["p1", "p2"]);
  });

  it("buildBracketRevealSteps maps rounds", () => {
    const progress = {
      rounds: [
        {
          name: "Bán kết",
          matches: [{ id: "m1", home: { name: "A" }, away: { name: "B" } }],
        },
      ],
    };

    const steps = buildBracketRevealSteps(progress);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].roundName, "Bán kết");
    assert.equal(steps[0].matches.length, 1);
  });

  it("shuffleVisualOrder keeps all ids without changing engine data", async () => {
    const { shuffleVisualOrder } = await import("../src/components/tournament/animation/animationUtils.js");
    const ids = ["e1", "e2", "e3", "e4"];
    const shuffled = shuffleVisualOrder(ids);

    assert.equal(shuffled.length, ids.length);
    assert.deepEqual([...shuffled].sort(), ids);
  });

  it("buildGroupMatchPairingSteps orders matches by group and labels courts", async () => {
    const {
      buildGroupMatchPairingSteps,
      getGroupMatchRanges,
    } = await import("../src/components/tournament/animation/animationUtils.js");

    const entries = [
      { id: "e1", name: "Team 1", seed: 1 },
      { id: "e2", name: "Team 2", seed: 2 },
      { id: "e3", name: "Team 3", seed: 3 },
      { id: "e4", name: "Team 4", seed: 4 },
    ];

    const groups = [
      {
        id: "gA",
        label: "A",
        name: "Bảng A",
        entries,
        matches: [
          {
            id: "m1",
            groupId: "gA",
            round: 1,
            entryAId: "e1",
            entryBId: "e2",
          },
          {
            id: "m2",
            groupId: "gA",
            round: 1,
            entryAId: "e3",
            entryBId: "e4",
            courtId: "c2",
          },
        ],
      },
      {
        id: "gB",
        label: "B",
        name: "Bảng B",
        entries: entries.slice(0, 2),
        matches: [
          {
            id: "m3",
            groupId: "gB",
            round: 1,
            entryAId: "e1",
            entryBId: "e2",
          },
        ],
      },
    ];

    const courts = [{ id: "c2", name: "Sân 2", number: 2, active: true }];
    const steps = buildGroupMatchPairingSteps({ groups, entries, courts });
    const ranges = getGroupMatchRanges(steps);

    assert.equal(steps.length, 3);
    assert.equal(steps[0].left.name, "Team 1");
    assert.equal(steps[0].right.name, "Team 2");
    assert.equal(steps[0].matchLabel, "Trận 01");
    assert.equal(steps[1].courtLabel, "Sân 2");
    assert.equal(steps[2].groupLabel, "B");
    assert.equal(ranges.length, 2);
    assert.equal(ranges[0].matchCount, 2);
  });

  it("stripMatchesFromEvent clears matches but keeps groups", async () => {
    const { stripMatchesFromEvent } = await import("../src/components/tournament/animation/animationUtils.js");
    const event = stripMatchesFromEvent({
      id: "e1",
      groups: [{ id: "g1", label: "A", matches: [{ id: "m1" }] }],
      matches: [{ id: "m1" }],
    });

    assert.equal(event.matches.length, 0);
    assert.equal(event.groups[0].matches.length, 0);
  });
});

describe("tournament animation config", () => {
  it("getScaledTiming scales by speed multiplier", async () => {
    const { getScaledTiming } = await import("../src/components/tournament/animation/animationConfig.js");
    const normal = getScaledTiming("normal");
    const fast = getScaledTiming("fast");
    assert.ok(fast.shuffleMs < normal.shuffleMs);
    assert.equal(normal.shuffleMs, 2000);
  });

  it("getSnakeFlowLabels alternates direction for 4 groups", async () => {
    const { getSnakeFlowLabels } = await import("../src/components/tournament/animation/animationConfig.js");
    assert.deepEqual(getSnakeFlowLabels(4), ["A", "B", "C", "D", "C", "B", "A"]);
  });
});
