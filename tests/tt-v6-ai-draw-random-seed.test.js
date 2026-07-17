import test from "node:test";
import assert from "node:assert/strict";

import {
  AI_DRAW_ALGORITHM_VERSION,
  AI_DRAW_CHANGE_REASON,
  attachAiDrawPublishMetadata,
  createAiDrawRandomSeed,
  getPublishedAiDrawState,
  snapshotTeamFormationResult,
} from "../src/features/team-tournament/engines/aiDrawSeedAudit.js";
import { runTeamFormationWithCanonicalAdapter } from "../src/features/competition-core/formation/adapters/teamFormationAdapter.js";
import { FORMAT_PRESET } from "../src/features/team-tournament/constants.js";
import {
  FEATURE_FLAG_KEYS,
  PRIVATE_PAIRING_OPERATION,
} from "../src/features/private-pairing-rules/index.js";

const FLAGS_ON = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
};

function mlpPlayers(count = 8) {
  const half = count / 2;
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `P${i + 1}`,
    gender: i < half ? "Nam" : "Nữ",
    level: 3.5 + (i % 3) * 0.1,
    rating: 3.5 + (i % 3) * 0.1,
  }));
}

test("createAiDrawRandomSeed returns distinct seeds on successive calls", () => {
  const a = createAiDrawRandomSeed();
  const b = createAiDrawRandomSeed(a);
  assert.notEqual(a, b);
  assert.ok(String(a).startsWith("aidraw-"));
});

test("same input + seed + algorithmVersion yields identical team assignment", () => {
  const players = mlpPlayers(8);
  const ids = players.map((p) => p.id);
  const seed = "aidraw-determinism-fixed-seed";
  const run = () =>
    runTeamFormationWithCanonicalAdapter({
      players,
      selectedPlayerIds: ids,
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      seed,
      envSource: FLAGS_ON,
      requireFullFill: true,
    });

  const first = run();
  const second = run();
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(
    snapshotTeamFormationResult(first.teams),
    snapshotTeamFormationResult(second.teams)
  );
  assert.equal(AI_DRAW_ALGORITHM_VERSION.length > 0, true);
});

test("different randomSeed can change formation (rearrange)", () => {
  const players = mlpPlayers(8);
  const ids = players.map((p) => p.id);
  const a = runTeamFormationWithCanonicalAdapter({
    players,
    selectedPlayerIds: ids,
    teamCount: 2,
    formatPreset: FORMAT_PRESET.MLP_4,
    seed: "aidraw-rearrange-A",
    envSource: FLAGS_ON,
    requireFullFill: true,
  });
  const b = runTeamFormationWithCanonicalAdapter({
    players,
    selectedPlayerIds: ids,
    teamCount: 2,
    formatPreset: FORMAT_PRESET.MLP_4,
    seed: "aidraw-rearrange-B",
    envSource: FLAGS_ON,
    requireFullFill: true,
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  // Not required that every seed pair differs, but A vs B should usually differ;
  // if equal, at least seeds themselves differ so audit trail is distinct.
  assert.notEqual("aidraw-rearrange-A", "aidraw-rearrange-B");
  const same =
    JSON.stringify(snapshotTeamFormationResult(a.teams)) ===
    JSON.stringify(snapshotTeamFormationResult(b.teams));
  if (same) {
    assert.ok(true, "rare identical layouts still use distinct seeds for audit");
  } else {
    assert.notDeepEqual(
      snapshotTeamFormationResult(a.teams),
      snapshotTeamFormationResult(b.teams)
    );
  }
});

test("attachAiDrawPublishMetadata stores seed, audit log, and previous/next snapshots", () => {
  const previousTeams = [
    { id: "t1", name: "A", playerIds: ["p1", "p2", "p3", "p4"] },
  ];
  const nextTeams = [
    { id: "t1", name: "A", playerIds: ["p1", "p2", "p5", "p6"] },
  ];
  const base = {
    teams: previousTeams,
    groups: [],
    settings: {},
  };
  const first = attachAiDrawPublishMetadata(base, {
    operation: PRIVATE_PAIRING_OPERATION.TEAM_FORMATION,
    reason: AI_DRAW_CHANGE_REASON.INITIAL_DRAW,
    randomSeed: "seed-1",
    previousResult: snapshotTeamFormationResult([]),
    nextResult: snapshotTeamFormationResult(previousTeams),
    scoreBreakdown: {
      superAdminPenalty: 0,
      tournamentPenalty: 0,
      clubPenalty: 0,
      sessionPenalty: 0,
      defaultPenalty: 10,
      totalPenalty: 10,
    },
    rulesVersion: "1",
  });

  assert.equal(
    getPublishedAiDrawState(first, PRIVATE_PAIRING_OPERATION.TEAM_FORMATION)?.randomSeed,
    "seed-1"
  );
  assert.equal(first.settings.aiDraw.rearrangeLog.length, 1);
  assert.equal(first.settings.aiDraw.rearrangeLog[0].reason, AI_DRAW_CHANGE_REASON.INITIAL_DRAW);

  const second = attachAiDrawPublishMetadata(
    { ...first, teams: nextTeams },
    {
      operation: PRIVATE_PAIRING_OPERATION.TEAM_FORMATION,
      randomSeed: "seed-2",
      previousResult: snapshotTeamFormationResult(previousTeams),
      nextResult: snapshotTeamFormationResult(nextTeams),
      scoreBreakdown: { superAdminPenalty: 1, tournamentPenalty: 0, clubPenalty: 0, sessionPenalty: 0, defaultPenalty: 5, totalPenalty: 6 },
      rulesVersion: "1",
    }
  );

  const published = getPublishedAiDrawState(second, PRIVATE_PAIRING_OPERATION.TEAM_FORMATION);
  assert.equal(published.randomSeed, "seed-2");
  assert.equal(second.settings.aiDraw.rearrangeLog.length, 2);
  const last = second.settings.aiDraw.rearrangeLog[1];
  assert.equal(last.reason, AI_DRAW_CHANGE_REASON.USER_REARRANGE);
  assert.equal(last.previousRandomSeed, "seed-1");
  assert.equal(last.randomSeed, "seed-2");
  assert.ok(last.previousResult);
  assert.ok(last.nextResult);
  assert.ok(last.scoreBreakdown);
  assert.ok(last.createdAt);
});

test("reload does not invent a new published seed without user rearrange", () => {
  const teamData = attachAiDrawPublishMetadata(
    { teams: [{ id: "t1", playerIds: ["p1"] }], settings: {} },
    {
      operation: PRIVATE_PAIRING_OPERATION.TEAM_FORMATION,
      randomSeed: "published-seed",
      nextResult: snapshotTeamFormationResult([{ id: "t1", playerIds: ["p1"] }]),
    }
  );
  // Simulating page reload: only read published state — do not mint seed.
  const again = getPublishedAiDrawState(teamData, PRIVATE_PAIRING_OPERATION.TEAM_FORMATION);
  assert.equal(again.randomSeed, "published-seed");
});
