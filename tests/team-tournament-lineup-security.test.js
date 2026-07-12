import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  __resetTeamTournamentRpcClientForTests,
  __setTeamTournamentRpcClientForTests,
  rpcTeamTournamentGetVisibleLineups,
} from "../src/features/team-tournament/services/teamTournamentRpcService.js";
import { MATCHUP_STATUS, LINEUP_STATUS } from "../src/features/team-tournament/constants.js";

afterEach(() => {
  __resetTeamTournamentRpcClientForTests();
});

test("RPC get_visible_lineups hides opponent selections pre-publish", async () => {
  __setTeamTournamentRpcClientForTests({
    rpc: async (name) => {
      if (name === "team_tournament_get_visible_lineups") {
        return {
          data: {
            ok: true,
            matchupStatus: MATCHUP_STATUS.LOCKED,
            lineups: {
              "team-a": {
                teamId: "team-a",
                status: LINEUP_STATUS.SUBMITTED,
                selections: { d1: ["p1"] },
              },
              "team-b": {
                teamId: "team-b",
                status: LINEUP_STATUS.SUBMITTED,
                selections: null,
              },
            },
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  });

  const result = await rpcTeamTournamentGetVisibleLineups("tour-1", "m1", "team-a");
  assert.equal(result.ok, true);
  assert.ok(result.lineups["team-a"].selections);
  assert.equal(result.lineups["team-b"].selections, null);
});

test("RPC get_visible_lineups exposes both teams after publish", async () => {
  __setTeamTournamentRpcClientForTests({
    rpc: async (name) => {
      if (name === "team_tournament_get_visible_lineups") {
        return {
          data: {
            ok: true,
            matchupStatus: MATCHUP_STATUS.PUBLISHED,
            lineups: {
              "team-a": { teamId: "team-a", selections: { d1: ["p1"] } },
              "team-b": { teamId: "team-b", selections: { d1: ["p2"] } },
            },
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  });

  const result = await rpcTeamTournamentGetVisibleLineups("tour-1", "m1", "team-a");
  assert.equal(result.ok, true);
  assert.ok(result.lineups["team-a"].selections);
  assert.ok(result.lineups["team-b"].selections);
});
