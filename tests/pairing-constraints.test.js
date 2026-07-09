import test from "node:test";
import assert from "node:assert/strict";

import { EVENT_TYPE } from "../src/models/tournament/constants.js";
import { suggestEntriesFromPlayers } from "../src/tournament/engines/teamPairingEngine.js";
import { createPairingConstraint } from "../src/features/pairing-constraints/models/pairingConstraint.js";
import { CONSTRAINT_TYPE } from "../src/features/pairing-constraints/constants.js";
import { optimizeTeamsWithConstraints } from "../src/features/pairing-constraints/engines/constraintPairingEngine.js";
import { assignGroupsWithConstraints } from "../src/features/pairing-constraints/engines/constraintGroupEngine.js";
import {
  evaluatePartnerConstraintsForTeams,
  evaluateGroupConstraints,
} from "../src/features/pairing-constraints/engines/constraintEvaluator.js";
import { constraintsToCourtPolicies } from "../src/features/pairing-constraints/adapters/courtPolicyAdapter.js";
import { calculatePairScore } from "../src/ai/scoring.js";

function buildMixedPlayers(maleCount, femaleCount) {
  const males = Array.from({ length: maleCount }, (_, index) => ({
    id: `male-${index + 1}`,
    name: `Nam ${index + 1}`,
    gender: "Nam",
    level: 3 + index * 0.1,
    rating: 3 + index * 0.1,
  }));
  const females = Array.from({ length: femaleCount }, (_, index) => ({
    id: `female-${index + 1}`,
    name: `Nu ${index + 1}`,
    gender: "Nữ",
    level: 3 + index * 0.1,
    rating: 3 + index * 0.1,
  }));
  return [...males, ...females];
}

test("avoid_partner constraint keeps players off the same team", () => {
  const players = buildMixedPlayers(4, 4);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
    tournamentId: "t1",
    eventId: "e1",
  });

  const teams = entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    members: entry.playerIds.map((id) => players.find((player) => String(player.id) === String(id))),
  }));

  const constraint = createPairingConstraint({
    type: CONSTRAINT_TYPE.AVOID_PARTNER,
    anchorPlayerId: "male-1",
    targetPlayerIds: ["female-1"],
    mode: "hard",
  });

  const playersById = new Map(players.map((player) => [String(player.id), player]));
  const result = optimizeTeamsWithConstraints(teams, [constraint], { playersById });
  const evaluation = evaluatePartnerConstraintsForTeams(result.teams, [constraint]);

  assert.equal(evaluation.ok, true);
  result.teams.forEach((team) => {
    const memberIds = team.members.map((player) => String(player.id));
    const sameTeam =
      memberIds.includes("male-1") && memberIds.includes("female-1");
    assert.equal(sameTeam, false);
  });
});

test("prefer_partner constraint pairs anchor with a target when possible", () => {
  const players = buildMixedPlayers(4, 4);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
    tournamentId: "t1",
    eventId: "e1",
  });

  const teams = entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    members: entry.playerIds.map((id) => players.find((player) => String(player.id) === String(id))),
  }));

  const constraint = createPairingConstraint({
    type: CONSTRAINT_TYPE.PREFER_PARTNER,
    anchorPlayerId: "male-1",
    targetPlayerIds: ["female-4"],
    mode: "soft",
  });

  const playersById = new Map(players.map((player) => [String(player.id), player]));
  const result = optimizeTeamsWithConstraints(teams, [constraint], { playersById });
  const anchorTeam = result.teams.find((team) =>
    team.members.some((player) => String(player.id) === "male-1")
  );

  assert.ok(anchorTeam);
  const memberIds = anchorTeam.members.map((player) => String(player.id));
  assert.ok(memberIds.includes("female-4"));
});

test("assignGroupsWithConstraints separates players that must avoid same group", () => {
  const players = buildMixedPlayers(8, 8);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
    tournamentId: "t1",
    eventId: "e1",
  });

  const constraint = createPairingConstraint({
    type: CONSTRAINT_TYPE.AVOID_SAME_GROUP,
    anchorPlayerId: "male-1",
    targetPlayerIds: ["male-2"],
    mode: "hard",
  });

  const result = assignGroupsWithConstraints(entries, 4, players, [constraint]);
  const evaluation = evaluateGroupConstraints(result.groups, [constraint]);

  assert.equal(evaluation.ok, true);
});

test("constraintsToCourtPolicies maps founder rules to court policies", () => {
  const constraints = [
    createPairingConstraint({
      type: CONSTRAINT_TYPE.PREFER_PARTNER,
      anchorPlayerId: "p1",
      targetPlayerIds: ["p2"],
      mode: "soft",
    }),
    createPairingConstraint({
      type: CONSTRAINT_TYPE.AVOID_PARTNER,
      anchorPlayerId: "p3",
      targetPlayerIds: ["p4"],
      mode: "hard",
    }),
  ];

  const policies = constraintsToCourtPolicies(constraints);
  assert.equal(policies.length, 2);
  assert.equal(policies[0].type, "prefer_teammate");
  assert.equal(policies[1].type, "avoid_teammate");
  assert.equal(policies[1].priority, "HIGH");
});

test("calculatePairScore penalizes avoid_teammate on same team", () => {
  const option = {
    teamA: [{ id: "p1", level: 3 }, { id: "p2", level: 3 }],
    teamB: [{ id: "p3", level: 3 }, { id: "p4", level: 3 }],
  };

  const withoutPolicy = calculatePairScore(option, { policies: [] });
  const withPolicy = calculatePairScore(option, {
    policies: [
      {
        type: "avoid_teammate",
        playerA: "p1",
        playerB: "p2",
        enabled: true,
        priority: "HIGH",
      },
    ],
  });

  assert.ok(withPolicy.policyScore < withoutPolicy.policyScore);
});

test("suggestEntriesFromPlayers applies pairingConstraints via engine", () => {
  const players = buildMixedPlayers(4, 4);
  const constraints = [
    createPairingConstraint({
      type: CONSTRAINT_TYPE.AVOID_PARTNER,
      anchorPlayerId: "male-1",
      targetPlayerIds: ["female-1"],
      mode: "hard",
    }),
  ];

  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
    tournamentId: "t1",
    eventId: "e1",
    pairingConstraints: constraints,
  });

  entries.forEach((entry) => {
    const ids = entry.playerIds.map(String);
    const conflict = ids.includes("male-1") && ids.includes("female-1");
    assert.equal(conflict, false);
  });
});
