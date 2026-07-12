import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  TT1B_COMMAND_RPCS,
  TT1B_IDEMPOTENCY_PREFIX_BY_RPC,
  TT1B_LEGACY_RPC_ARG_CONTRACTS,
  TT1B_RPC_ARG_CONTRACTS,
  __resetTeamTournamentRpcClientForTests,
  __setTeamTournamentRpcClientForTests,
  buildTt1bCommandRpcArgs,
  mapTeamTournamentRpcTransportError,
  prepareTt1bCommandRpcCall,
  rpcTeamTournamentConfirmSubMatch,
  rpcTeamTournamentLockMatchup,
  rpcTeamTournamentPublishMatchup,
  rpcTeamTournamentSubmitLineup,
} from "../src/features/team-tournament/services/teamTournamentRpcService.js";

let rpcCallCount = 0;

function installMockRpc(handler) {
  rpcCallCount = 0;
  __setTeamTournamentRpcClientForTests({
    rpc: async (name, args) => {
      rpcCallCount += 1;
      return handler(name, args);
    },
  });
}

afterEach(() => {
  __resetTeamTournamentRpcClientForTests();
  rpcCallCount = 0;
});

function assertExactArgContract(rpcName, args) {
  const expected = TT1B_RPC_ARG_CONTRACTS[rpcName];
  assert.ok(expected, `missing contract for ${rpcName}`);
  assert.deepEqual(Object.keys(args).sort(), [...expected].sort());
  assert.notDeepEqual(
    Object.keys(args).sort(),
    [...(TT1B_LEGACY_RPC_ARG_CONTRACTS[rpcName] || [])].sort(),
    `must not use legacy-only ${rpcName} contract`
  );
}

test("TT1B_COMMAND_RPCS lists overloaded mutation RPCs", () => {
  assert.ok(TT1B_COMMAND_RPCS.includes("team_tournament_submit_lineup"));
  assert.ok(TT1B_COMMAND_RPCS.includes("team_tournament_confirm_sub_match"));
});

test("buildTt1bCommandRpcArgs always includes TT-1B overload disambiguators", () => {
  const args = buildTt1bCommandRpcArgs({ p_tournament_id: "t1", p_matchup_id: "m1" }, {});
  assert.equal("p_expected_version" in args, true);
  assert.equal("p_idempotency_key" in args, true);
  assert.equal(args.p_expected_version, null);
  assert.equal(args.p_idempotency_key, null);
});

test("submit_lineup without expectedVersion fails client-side without RPC", async () => {
  installMockRpc(async () => ({ data: { ok: true }, error: null }));

  const result = await rpcTeamTournamentSubmitLineup({
    tournamentId: "t1",
    matchupId: "m1",
    teamId: "team-a",
    selections: { d1: ["p1"] },
    idempotencyKey: "idem-1",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "MISSING_EXPECTED_VERSION");
  assert.equal(result.provider, "client");
  assert.equal(rpcCallCount, 0);
});

test("confirm_sub_match without expectedVersion fails client-side without RPC", async () => {
  installMockRpc(async () => ({ data: { ok: true }, error: null }));

  const result = await rpcTeamTournamentConfirmSubMatch({
    tournamentId: "t1",
    matchupId: "m1",
    subMatchId: "sm1",
    score: { teamA: 21, teamB: 10 },
    idempotencyKey: "idem-confirm",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "MISSING_EXPECTED_VERSION");
  assert.equal(rpcCallCount, 0);
});

test("missing idempotencyKey auto-generates with documented prefix", async () => {
  let captured = null;
  installMockRpc(async (name, args) => {
    captured = { name, args };
    return { data: { ok: true, version: 2 }, error: null };
  });

  await rpcTeamTournamentSubmitLineup({
    tournamentId: "t1",
    matchupId: "m1",
    teamId: "team-a",
    selections: { d1: ["p1"] },
    expectedVersion: 1,
  });

  assert.equal(captured.name, "team_tournament_submit_lineup");
  assert.match(
    captured.args.p_idempotency_key,
    new RegExp(`^${TT1B_IDEMPOTENCY_PREFIX_BY_RPC.team_tournament_submit_lineup}-`)
  );
  assertExactArgContract("team_tournament_submit_lineup", captured.args);
});

test("prepareTt1bCommandRpcCall rejects legacy-only argument sets", () => {
  const legacy = prepareTt1bCommandRpcCall(
    "team_tournament_submit_lineup",
    {
      p_tournament_id: "t1",
      p_matchup_id: "m1",
      p_team_id: "team-a",
      p_selections: {},
    },
    {
      expectedVersion: 1,
      idempotencyKey: "k1",
    }
  );
  assert.equal(legacy.ok, true);

  const broken = prepareTt1bCommandRpcCall(
    "team_tournament_lock_matchup",
    { p_tournament_id: "t1", p_matchup_id: "m1" },
    { idempotencyKey: "k2" }
  );
  assert.equal(broken.ok, true);
  assertExactArgContract("team_tournament_lock_matchup", broken.args);
});

test("PGRST202 maps to rpc_signature_mismatch", () => {
  const mapped = mapTeamTournamentRpcTransportError({
    code: "PGRST202",
    message: "Could not find the function without parameters in the schema cache",
  });
  assert.equal(mapped.code, "rpc_signature_mismatch");
  assert.equal(mapped.provider, "rpc");
});

test("function not found maps to rpc_not_deployed with legacy alias", () => {
  const mapped = mapTeamTournamentRpcTransportError({
    code: "42883",
    message: "function team_tournament_submit_lineup does not exist",
  });
  assert.equal(mapped.code, "rpc_not_deployed");
  assert.equal(mapped.legacyCode, "RPC_NOT_DEPLOYED");
});

test("submit_lineup RPC uses exact TT-1B argument names", async () => {
  let captured = null;
  installMockRpc(async (name, args) => {
    captured = { name, args };
    return { data: { ok: true, version: 2 }, error: null };
  });

  await rpcTeamTournamentSubmitLineup({
    tournamentId: "t1",
    matchupId: "m1",
    teamId: "team-a",
    selections: { d1: ["p1"] },
    expectedVersion: 1,
    idempotencyKey: "idem-1",
  });

  assert.equal(captured.name, "team_tournament_submit_lineup");
  assert.equal(captured.args.p_expected_version, 1);
  assert.equal(captured.args.p_idempotency_key, "idem-1");
  assertExactArgContract("team_tournament_submit_lineup", captured.args);
});

test("lock_matchup and publish_matchup never use legacy 2-param contract", async () => {
  const captured = [];

  installMockRpc(async (name, args) => {
    captured.push({ name, args });
    return { data: { ok: true, version: 3 }, error: null };
  });

  await rpcTeamTournamentLockMatchup({ tournamentId: "t1", matchupId: "m1" });
  await rpcTeamTournamentPublishMatchup("t1", "m1");

  assert.equal(captured.length, 2);
  assertExactArgContract("team_tournament_lock_matchup", captured[0].args);
  assertExactArgContract("team_tournament_publish_matchup", captured[1].args);
  assert.match(captured[0].args.p_idempotency_key, /^lock-/);
  assert.match(captured[1].args.p_idempotency_key, /^publish-/);
});

test("version conflict preserves entity and version fields", async () => {
  installMockRpc(async (name) => {
    if (name === "team_tournament_submit_lineup") {
      return {
        data: {
          ok: false,
          code: "version_conflict",
          entity: "team_tournament_lineups",
          expected_version: 3,
          actual_version: 4,
        },
        error: null,
      };
    }
    return { data: null, error: { code: "PGRST202" } };
  });

  const result = await rpcTeamTournamentSubmitLineup({
    tournamentId: "t1",
    matchupId: "m1",
    teamId: "team-a",
    selections: {},
    expectedVersion: 3,
    idempotencyKey: "idem-vc",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "version_conflict");
  assert.equal(result.entity, "team_tournament_lineups");
  assert.equal(result.expected_version, 3);
  assert.equal(result.actual_version, 4);
});

test("idempotency replay returns stored result without bumping version", async () => {
  installMockRpc(async () => ({
    data: {
      ok: true,
      replay: true,
      result: { ok: true, version: 7 },
    },
    error: null,
  }));

  const result = await rpcTeamTournamentSubmitLineup({
    tournamentId: "t1",
    matchupId: "m1",
    teamId: "team-a",
    selections: { d1: ["p1"] },
    expectedVersion: 7,
    idempotencyKey: "retry-1",
  });

  assert.equal(result.ok, true);
  assert.equal(result.replay, true);
  assert.equal(result.version, 7);
});

test("malformed idempotency replay payload is rejected", async () => {
  installMockRpc(async () => ({
    data: {
      ok: false,
      code: "idempotency_payload_mismatch",
      error: "Idempotency key đã dùng với payload khác.",
    },
    error: null,
  }));

  const result = await rpcTeamTournamentSubmitLineup({
    tournamentId: "t1",
    matchupId: "m1",
    teamId: "team-a",
    selections: { d1: ["p2"] },
    expectedVersion: 2,
    idempotencyKey: "retry-1",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "idempotency_payload_mismatch");
});

test("confirm sub-match passes expected_version and idempotency_key in TT-1B contract", async () => {
  let captured = null;
  installMockRpc(async (name, args) => {
    captured = { name, args };
    return { data: { ok: true, version: 5 }, error: null };
  });

  await rpcTeamTournamentConfirmSubMatch({
    tournamentId: "t1",
    matchupId: "m1",
    subMatchId: "sm1",
    score: { teamA: 21, teamB: 10 },
    expectedVersion: 2,
    idempotencyKey: "idem-abc",
  });

  assert.equal(captured.name, "team_tournament_confirm_sub_match");
  assert.equal(captured.args.p_expected_version, 2);
  assert.equal(captured.args.p_idempotency_key, "idem-abc");
  assertExactArgContract("team_tournament_confirm_sub_match", captured.args);
});

test("live RPC PGRST202 surfaces rpc_signature_mismatch", async () => {
  installMockRpc(async () => ({
    data: null,
    error: {
      code: "PGRST202",
      message: "Could not find the function public.team_tournament_submit_lineup matching args",
    },
  }));

  const result = await rpcTeamTournamentSubmitLineup({
    tournamentId: "t1",
    matchupId: "m1",
    teamId: "team-a",
    selections: {},
    expectedVersion: 1,
    idempotencyKey: "k1",
  });

  assert.equal(result.code, "rpc_signature_mismatch");
  assert.equal(rpcCallCount, 1);
});
