import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  __resetTeamTournamentRpcClientForTests,
  __setTeamTournamentRpcClientForTests,
} from "../src/features/team-tournament/services/teamTournamentRpcService.js";
import {
  __resetCloudRepositoryReplayCacheForTests,
  createCloudTeamTournamentRepository,
} from "../src/features/team-tournament/repositories/cloudTeamTournamentRepository.js";
import { createBlobTeamTournamentRepository } from "../src/features/team-tournament/repositories/blobTeamTournamentRepository.js";
import {
  __resetTeamTournamentRpcGuardsForTests,
  __setTeamTournamentRpcGuardsForTests,
} from "../src/features/team-tournament/repositories/teamTournamentRpcGuards.js";
import { createShadowTeamTournamentRepository } from "../src/features/team-tournament/repositories/shadowTeamTournamentRepository.js";
import {
  __resetTeamTournamentRealtimeServiceForTests,
} from "../src/features/team-tournament/realtime/TeamTournamentRealtimeService.js";
import {
  listAggregateCollectionKeys,
  notImplemented,
  notImplementedSubscriptionResult,
  REPOSITORY_ERROR_CODES,
} from "../src/features/team-tournament/repositories/TeamTournamentRepository.interface.js";

const COMMAND = Object.freeze({
  expectedVersion: 3,
  idempotencyKey: "repo-test-idem-1",
});

let rpcCallCount = 0;

afterEach(() => {
  __resetTeamTournamentRpcClientForTests();
  __resetCloudRepositoryReplayCacheForTests();
  __resetTeamTournamentRpcGuardsForTests();
  __resetTeamTournamentRealtimeServiceForTests({ enabled: false });
  rpcCallCount = 0;
});

function installRpc(handler) {
  __setTeamTournamentRpcClientForTests({
    rpc: async (name, args) => {
      rpcCallCount += 1;
      return handler(name, args);
    },
  });
}

function assertRepositoryResultShape(result) {
  assert.equal(typeof result.ok, "boolean");
  if (result.ok) {
    assert.notEqual(result.data, undefined);
  } else {
    assert.ok(result.code);
    assert.ok(result.error);
  }
  if (result.replayed != null) {
    assert.equal(typeof result.replayed, "boolean");
  }
  if (result.version != null) {
    assert.equal(typeof result.version, "number");
  }
}

test("mutation missing expectedVersion is rejected before RPC", async () => {
  installRpc(async () => ({ data: { ok: true }, error: null }));
  const repo = createCloudTeamTournamentRepository();

  const result = await repo.submitLineup(
    "club-1",
    "tour-1",
    { matchupId: "m1", teamId: "team-a", selections: {} },
    { idempotencyKey: "idem-1" }
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, REPOSITORY_ERROR_CODES.MISSING_EXPECTED_VERSION);
  assert.equal(rpcCallCount, 0);
});

test("mutation missing idempotencyKey is rejected before RPC", async () => {
  installRpc(async () => ({ data: { ok: true }, error: null }));
  const repo = createCloudTeamTournamentRepository();

  const result = await repo.lockLineup(
    "club-1",
    "tour-1",
    { matchupId: "m1" },
    { expectedVersion: 2 }
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, REPOSITORY_ERROR_CODES.MISSING_IDEMPOTENCY_KEY);
  assert.equal(rpcCallCount, 0);
});

test("blob/cloud/shadow mutation validation share the same failure codes", async () => {
  installRpc(async () => ({ data: { ok: true }, error: null }));

  const providers = [
    createBlobTeamTournamentRepository(),
    createCloudTeamTournamentRepository(),
    createShadowTeamTournamentRepository(),
  ];

  for (const repo of providers) {
    const result = await repo.publishLineups(
      "club-1",
      "tour-1",
      { matchupId: "m1" },
      { expectedVersion: 1 }
    );
    assert.equal(result.code, REPOSITORY_ERROR_CODES.MISSING_IDEMPOTENCY_KEY, repo.getProvider());
  }
});

test("cloud aggregate preserves normalized collection fields", async () => {
  installRpc(async (name) => {
    if (name === "team_tournament_get_setup") {
      return {
        data: {
          ok: true,
          tournament: {
            id: "tour-1",
            clubId: "club-1",
            tenantId: "tenant-1",
            mode: "team",
            status: "active",
            version: 7,
            teamData: {
              teams: [{ id: "team-a", name: "A", playerIds: ["p1"] }],
              matchups: [
                {
                  id: "m1",
                  teamAId: "team-a",
                  teamBId: "team-b",
                  status: "scheduled",
                  subMatches: [{ id: "sm1", disciplineId: "d1", status: "waiting", score: { teamA: 0, teamB: 0 } }],
                  scheduledAt: "2026-07-12T10:00:00Z",
                },
              ],
              lineups: { "m1::team-a": { matchupId: "m1", teamId: "team-a", status: "draft", selections: {} } },
              standings: [{ teamId: "team-a", rank: 1, wins: 1, losses: 0, points: 3 }],
              disciplines: [{ id: "d1", name: "Doubles 1" }],
              groups: [],
              settings: { formatPreset: "custom" },
            },
          },
        },
        error: null,
      };
    }
    return { data: { ok: false }, error: null };
  });

  const repo = createCloudTeamTournamentRepository();
  const result = await repo.getTournament("club-1", "tour-1");
  assert.equal(result.ok, true);

  const keys = listAggregateCollectionKeys(result.data);
  assert.deepEqual(keys, [
    "teams",
    "matchups",
    "lineups",
    "standings",
    "subMatches",
    "schedule",
    "disciplines",
    "groups",
    "settings",
  ]);
  assert.equal(result.data.teams[0].name, "A");
  assert.equal(result.data.subMatches.length, 1);
  assert.equal(result.data.schedule[0].matchupId, "m1");
  assert.ok(result.data.teamData);
});

test("notImplemented is awaitable and returns structured failure", async () => {
  const result = await notImplemented("completeMatchup");
  assert.equal(result.ok, false);
  assert.equal(result.code, REPOSITORY_ERROR_CODES.NOT_IMPLEMENTED);
  assert.ok(result.error.includes("completeMatchup"));
  assert.ok(result.details?.methodName);
});

test("subscribeTournament returns subscription handle (cloud delegate)", async () => {
  installRpc(async (name) => {
    if (name === "team_tournament_get_setup") {
      return {
        data: {
          ok: true,
          tenantId: "tenant-1",
          tournament: { id: "tour-1", version: 1, teamData: { matchups: [] } },
        },
        error: null,
      };
    }
    return { data: { ok: true, tournament: { id: "tour-1", teamData: {} } }, error: null };
  });

  const repo = createCloudTeamTournamentRepository();
  const result = await repo.subscribeTournament("club-1", "tour-1", {});
  assert.equal(result.ok, true);
  assert.ok(typeof result.data?.unsubscribe === "function");
  assert.ok(result.data?.subscriptionId);
  assert.ok(["polling", "realtime"].includes(result.data?.fallbackMode));
  result.data.unsubscribe();
});

test("notImplementedSubscriptionResult still available for direct calls", async () => {
  const direct = await notImplementedSubscriptionResult();
  assert.equal(direct.code, REPOSITORY_ERROR_CODES.REALTIME_NOT_IMPLEMENTED);
});

test("cloud repository rejects spoofed viewerTeamId on reads", async () => {
  installRpc(async () => ({ data: { ok: true, tournament: { id: "t1", teamData: {} } }, error: null }));
  const repo = createCloudTeamTournamentRepository();

  const tournament = await repo.getTournament("club-1", "tour-1", {
    viewerTeamId: "fake-team",
  });
  assert.equal(tournament.ok, false);
  assert.equal(tournament.code, REPOSITORY_ERROR_CODES.VIEWER_TEAM_ID_CLIENT_OVERRIDE_REJECTED);

  const visible = await repo.getVisibleLineups("club-1", "tour-1", {
    matchupId: "m1",
    viewerTeamId: "fake-team",
  });
  assert.equal(visible.ok, false);
  assert.equal(visible.code, REPOSITORY_ERROR_CODES.VIEWER_TEAM_ID_CLIENT_OVERRIDE_REJECTED);
  assert.equal(rpcCallCount, 0);
});

test("getVisibleLineups uses options object and cloud ignores client viewerTeamId", async () => {
  let capturedArgs = null;
  installRpc(async (name, args) => {
    if (name === "team_tournament_get_visible_lineups") {
      capturedArgs = args;
      return {
        data: { ok: true, lineups: { own: null, opponent: null } },
        error: null,
      };
    }
    return { data: { ok: false }, error: null };
  });

  const repo = createCloudTeamTournamentRepository();
  const result = await repo.getVisibleLineups("club-1", "tour-1", { matchupId: "m1" });
  assert.equal(result.ok, true);
  assert.equal(capturedArgs.p_viewer_team_id, null);
});

test("cloud saveDraftLineup is fail-fast until TT-1B RPC guard is deployed", async () => {
  installRpc(async () => ({ data: { ok: true }, error: null }));
  const repo = createCloudTeamTournamentRepository();

  const result = await repo.saveDraftLineup(
    "club-1",
    "tour-1",
    { matchupId: "m1", teamId: "team-a", selections: {} },
    COMMAND
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, REPOSITORY_ERROR_CODES.RPC_GUARD_NOT_DEPLOYED);
  assert.equal(rpcCallCount, 0);
});

test("cloud recalculateStandings is fail-fast until TT-1B RPC guard is deployed", async () => {
  installRpc(async () => ({ data: { ok: true }, error: null }));
  const repo = createCloudTeamTournamentRepository();

  const result = await repo.recalculateStandings("club-1", "tour-1", COMMAND);
  assert.equal(result.ok, false);
  assert.equal(result.code, REPOSITORY_ERROR_CODES.RPC_GUARD_NOT_DEPLOYED);
  assert.equal(rpcCallCount, 0);
});

test("recalculateStandings with deployed guard requires command options and returns calculationVersion", async () => {
  __setTeamTournamentRpcGuardsForTests({ recalculateStandings: true });
  installRpc(async (name) => {
    if (name === "team_tournament_get_setup") {
      return {
        data: {
          ok: true,
          tournament: {
            id: "tour-1",
            version: 4,
            teamData: {
              teams: [
                { id: "team-a", name: "A", playerIds: [] },
                { id: "team-b", name: "B", playerIds: [] },
              ],
              matchups: [],
              lineups: {},
              standings: [],
              disciplines: [],
              settings: {},
            },
          },
        },
        error: null,
      };
    }
    if (name === "team_tournament_upsert_standings") {
      return { data: { ok: true, version: 4 }, error: null };
    }
    return { data: { ok: false }, error: null };
  });

  const repo = createCloudTeamTournamentRepository();
  const result = await repo.recalculateStandings("club-1", "tour-1", COMMAND);
  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.data.standings));
  assert.ok(typeof result.data.calculationVersion === "string");
  assert.equal(result.version, 4);
});

test("recalculateStandings replay returns stored result without bumping version when guard deployed", async () => {
  __setTeamTournamentRpcGuardsForTests({ recalculateStandings: true });
  let upsertCount = 0;
  installRpc(async (name) => {
    if (name === "team_tournament_get_setup") {
      return {
        data: {
          ok: true,
          tournament: {
            id: "tour-1",
            version: 9,
            teamData: {
              teams: [
                { id: "team-a", name: "A", playerIds: [] },
                { id: "team-b", name: "B", playerIds: [] },
              ],
              matchups: [],
              lineups: {},
              standings: [],
              disciplines: [],
              settings: {},
            },
          },
        },
        error: null,
      };
    }
    if (name === "team_tournament_upsert_standings") {
      upsertCount += 1;
      return { data: { ok: true, version: 10 }, error: null };
    }
    return { data: { ok: false }, error: null };
  });

  const repo = createCloudTeamTournamentRepository();
  const first = await repo.recalculateStandings("club-1", "tour-1", {
    expectedVersion: 9,
    idempotencyKey: "recalc-idem-1",
  });
  const second = await repo.recalculateStandings("club-1", "tour-1", {
    expectedVersion: 9,
    idempotencyKey: "recalc-idem-1",
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.replayed, true);
  assert.equal(second.version, first.version);
  assert.equal(upsertCount, 1);
});

test("recalculateStandings rejects malformed replay payload when guard deployed", async () => {
  __setTeamTournamentRpcGuardsForTests({ recalculateStandings: true });
  let includeResult = false;
  installRpc(async (name) => {
    if (name === "team_tournament_get_setup") {
      return {
        data: {
          ok: true,
          tournament: {
            id: "tour-1",
            version: 2,
            teamData: {
              teams: [
                { id: "team-a", name: "A", playerIds: [] },
                { id: "team-b", name: "B", playerIds: [] },
              ],
              matchups: includeResult
                ? [
                    {
                      id: "m1",
                      teamAId: "team-a",
                      teamBId: "team-b",
                      status: "completed",
                      result: { winnerTeamId: "team-a", teamAWins: 1, teamBWins: 0 },
                    },
                  ]
                : [],
              lineups: {},
              standings: [],
              disciplines: [],
              settings: {},
            },
          },
        },
        error: null,
      };
    }
    if (name === "team_tournament_upsert_standings") {
      return { data: { ok: true, version: 3 }, error: null };
    }
    return { data: { ok: false }, error: null };
  });

  const repo = createCloudTeamTournamentRepository();
  await repo.recalculateStandings("club-1", "tour-1", {
    expectedVersion: 2,
    idempotencyKey: "recalc-idem-mismatch",
  });

  includeResult = true;
  const replay = await repo.recalculateStandings("club-1", "tour-1", {
    expectedVersion: 2,
    idempotencyKey: "recalc-idem-mismatch",
  });

  assert.equal(replay.ok, false);
  assert.equal(replay.code, "idempotency_payload_mismatch");
});

test("blob recalculateStandings validates command options without cloud RPC guard", async () => {
  const blob = createBlobTeamTournamentRepository();
  const missingKey = await blob.recalculateStandings("club-1", "tour-1", { expectedVersion: 1 });
  assert.equal(missingKey.code, REPOSITORY_ERROR_CODES.MISSING_IDEMPOTENCY_KEY);
});

test("repository read/mutation results expose shared contract fields", async () => {
  const blob = createBlobTeamTournamentRepository();
  const fail = await blob.submitLineup("missing-club", "missing", { matchupId: "m1", teamId: "t1", selections: {} }, COMMAND);
  assertRepositoryResultShape(fail);

  const notReady = await notImplemented("randomizeLineup");
  assertRepositoryResultShape(notReady);
});
