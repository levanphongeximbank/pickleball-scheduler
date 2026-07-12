import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  __resetTeamTournamentRpcClientForTests,
  buildTt1bCommandRpcArgs,
  TT1B_COMMAND_RPCS,
} from "../src/features/team-tournament/services/teamTournamentRpcService.js";

afterEach(() => {
  __resetTeamTournamentRpcClientForTests();
});

test("TT1B_COMMAND_RPCS export remains stable", () => {
  assert.equal(TT1B_COMMAND_RPCS.length, 7);
  assert.ok(TT1B_COMMAND_RPCS.includes("team_tournament_randomize_lineup"));
  assert.ok(TT1B_COMMAND_RPCS.includes("team_tournament_withdraw_team"));
});

test("buildTt1bCommandRpcArgs null disambiguators for overload resolution", () => {
  const args = buildTt1bCommandRpcArgs(
    { p_tournament_id: "t1", p_matchup_id: "m1" },
    { expectedVersion: null, idempotencyKey: null }
  );
  assert.equal(args.p_expected_version, null);
  assert.equal(args.p_idempotency_key, null);
});
