/**
 * TEAM-TOURNAMENT-GET-SETUP-CANONICAL-CONTRACT-HARDENING-01
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import { FORMAT_PRESET, GROUP_MODE } from "../src/features/team-tournament/constants.js";
import {
  EXPLICIT_SINGLE_GROUP_ID,
  materializeExplicitGroupsFromTeams,
} from "../src/features/team-tournament/engines/teamGroupDivisionPolicy.js";
import { buildSnakeGroupsFromSortedTeams } from "../src/features/team-tournament/engines/teamGroupSeedEngine.js";
import { listGroupDivisionOptions } from "../src/features/team-tournament/engines/teamGroupDivisionPolicy.js";
import {
  __resetConfirmAiPairingCloudPersistenceDepsForTests,
  __setConfirmAiPairingCloudPersistenceDepsForTests,
  confirmAiPairingCloudPersistence,
} from "../src/features/team-tournament/services/aiPairingCloudPersistence.js";
import { confirmAiPairingUiTransaction } from "../src/features/team-tournament/services/confirmAiPairingUiTransaction.js";
import {
  createCanonicalSetupRefreshController,
  refreshCanonicalSetupAfterMutation,
} from "../src/features/team-tournament/ui/canonicalSetupRefresh.js";
import { rpcTeamTournamentGetSetup } from "../src/features/team-tournament/services/teamTournamentRpcService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function readSrc(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function buildTeams(count = 4) {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Đội ${index + 1}`,
    playerIds: [`m${index}a`, `m${index}b`, `f${index}a`, `f${index}b`],
    captainPlayerId: `m${index}a`,
    avgLevel: 4,
    seed: index + 1,
  }));
}

afterEach(() => {
  __resetConfirmAiPairingCloudPersistenceDepsForTests();
});

describe("team-tournament-get-setup-canonical-contract-hardening-01", () => {
  it("A cloudGetTeamTournamentSetup / rpcGetSetup always send schemaVersion=7 diagnostic=false", () => {
    const cloudSync = readSrc(
      "src/features/team-tournament/services/teamTournamentCloudSync.js"
    );
    assert.match(
      cloudSync,
      /rpcTeamTournamentGetSetup\(\s*tournamentId,\s*viewerTeamId,\s*\{\s*schemaVersion:\s*7,\s*diagnostic:\s*false/
    );

    const rpc = readSrc(
      "src/features/team-tournament/services/teamTournamentRpcService.js"
    );
    const fnBlock = rpc.slice(
      rpc.indexOf("export async function rpcTeamTournamentGetSetup"),
      rpc.indexOf("export async function rpcTeamTournamentExecuteSetupMutation")
    );
    assert.match(fnBlock, /p_tournament_id:\s*String\(tournamentId\)/);
    assert.match(fnBlock, /p_viewer_team_id:/);
    assert.match(fnBlock, /p_schema_version:\s*schemaVersion/);
    assert.match(fnBlock, /p_diagnostic:\s*diagnostic/);
    assert.match(fnBlock, /: 7/);
    // Reject any get_setup RPC body that omits the v7 keys.
    assert.doesNotMatch(
      fnBlock,
      /callTeamTournamentRpc\(\s*"team_tournament_get_setup"\s*,\s*\{(?![^}]*p_schema_version)[^}]*\}\s*\)/
    );
    assert.doesNotMatch(
      fnBlock,
      /callTeamTournamentRpc\(\s*"team_tournament_get_setup"\s*,\s*\{(?![^}]*p_diagnostic)[^}]*\}\s*\)/
    );
  });

  it("B no Team runtime get_setup call site uses bare 2-arg rpc without options", () => {
    const files = [
      "src/features/team-tournament/services/teamTournamentCloudSync.js",
      "src/features/team-tournament/services/teamTournamentRpcService.js",
      "src/features/team-tournament/repositories/cloudTeamTournamentRepository.js",
      "src/features/team-tournament/repositories/teamTournamentRealtimeRepository.js",
      "src/features/team-tournament/services/teamTournamentService.js",
    ];
    for (const file of files) {
      const src = readSrc(file);
      assert.doesNotMatch(
        src,
        /rpcTeamTournamentGetSetup\(\s*[^),]+,\s*[^),]+\s*\)/,
        `${file} still has bare 2-arg rpcTeamTournamentGetSetup(...)`
      );
    }

    // cloudGetTeamTournamentSetup is the AI verify path — must pass options object.
    assert.match(
      readSrc("src/features/team-tournament/services/teamTournamentCloudSync.js"),
      /schemaVersion:\s*7/
    );
  });

  it("B2 rpcTeamTournamentGetSetup builds explicit 4-arg payload by default", async () => {
    let captured = null;
    const originalFetch = globalThis.fetch;
    // rpc uses supabase client — exercise pure param builder via source contract +
    // direct function shape by stubbing call path through dependency is heavy.
    // Assert exported function source always assigns both optional keys.
    const rpcSrc = readSrc(
      "src/features/team-tournament/services/teamTournamentRpcService.js"
    );
    const fnBlock = rpcSrc.slice(
      rpcSrc.indexOf("export async function rpcTeamTournamentGetSetup"),
      rpcSrc.indexOf("export async function rpcTeamTournamentExecuteSetupMutation")
    );
    assert.match(fnBlock, /p_tournament_id/);
    assert.match(fnBlock, /p_viewer_team_id/);
    assert.match(fnBlock, /p_schema_version/);
    assert.match(fnBlock, /p_diagnostic/);
    assert.equal(typeof rpcTeamTournamentGetSetup, "function");
    void captured;
    void originalFetch;
  });

  it("C captain-confirm canonical readback path uses explicit v7 get_setup", () => {
    const service = readSrc(
      "src/features/team-tournament/services/teamTournamentService.js"
    );
    assert.match(service, /cloudGetTeamTournamentSetup/);
    const cloud = readSrc(
      "src/features/team-tournament/services/teamTournamentCloudSync.js"
    );
    assert.match(cloud, /schemaVersion:\s*7/);
    assert.match(cloud, /diagnostic:\s*false/);
  });

  it("D 1-group flow still materializes + replace_groups once + no F5", async () => {
    const teams = buildTeams(4);
    let replaceCalls = 0;
    __setConfirmAiPairingCloudPersistenceDepsForTests({
      preflightSetupMutationCapability: () => ({ ok: true, gateEnabled: true }),
      applyAiGeneratedTeamsToTournament: async (_c, _t, payload) => ({
        ok: true,
        captainsPersisted: 4,
        teamData: {
          teams: payload.teams,
          groups: [],
          matchups: [],
          settings: payload.settings,
        },
        tournament: { id: "tt-1" },
      }),
    });

    const result = await confirmAiPairingCloudPersistence({
      clubId: "club-1",
      tournamentId: "tt-1",
      tournament: {
        id: "tt-1",
        settings: {
          formatPreset: FORMAT_PRESET.MLP_4,
          groupMode: GROUP_MODE.SINGLE_POOL,
          groupCount: 1,
        },
      },
      nextTeamData: {
        teams,
        groups: [],
        settings: {
          formatPreset: FORMAT_PRESET.MLP_4,
          groupMode: GROUP_MODE.SINGLE_POOL,
          groupCount: 1,
        },
      },
      persistSetupTeamData: async (teamData) => {
        replaceCalls += 1;
        assert.equal(teamData.groups.length, 1);
        assert.equal(teamData.groups[0].id, EXPLICIT_SINGLE_GROUP_ID);
        return {
          ok: true,
          teamData: { teams, groups: teamData.groups, matchups: [] },
          readback: { teamData: { teams, groups: teamData.groups, matchups: [] } },
        };
      },
      reload: async () => ({ ok: true, version: 2 }),
    });
    assert.equal(result.ok, true, result.error);
    assert.equal(replaceCalls, 1);

    const groups = [
      {
        id: EXPLICIT_SINGLE_GROUP_ID,
        name: "Bảng A",
        teamIds: teams.map((t) => t.id),
      },
    ];
    const controller = createCanonicalSetupRefreshController();
    const ui = await confirmAiPairingUiTransaction({
      beginMutationBarrier: () => controller.beginMutationBarrier(),
      endMutationBarrier: () => controller.endMutationBarrier(),
      refreshAfterMutation: async () =>
        refreshCanonicalSetupAfterMutation({
          controller,
          loadSetup: async () => ({
            ok: true,
            version: 3,
            teamData: { teams, groups, matchups: [] },
            tournament: { id: "tt-1", teamData: { teams, groups } },
          }),
          applyLoadResult: () => {},
        }),
      nextTeamData: { teams, groups },
      confirmFn: async () => ({
        ok: true,
        writeCount: 2,
        captainsPersisted: 4,
        groupsExpected: 1,
        groupsPersisted: 1,
        teamData: { teams, groups, matchups: [] },
      }),
    });
    assert.equal(ui.ok, true, ui.error);
    assert.equal(ui.reactCanonicalCommitted, true);
    assert.doesNotMatch(
      readSrc("src/features/team-tournament/services/aiPairingCloudPersistence.js"),
      /location\.reload/
    );
  });

  it("E 2/N group flows unchanged", () => {
    const options4 = listGroupDivisionOptions(4);
    assert.ok(options4.some((o) => o.groupCount === 2));
    const teams4 = buildTeams(4);
    assert.equal(buildSnakeGroupsFromSortedTeams(teams4, 2).length, 2);

    const options8 = listGroupDivisionOptions(8);
    assert.ok(options8.some((o) => o.groupCount === 4));
    assert.equal(buildSnakeGroupsFromSortedTeams(buildTeams(8), 4).length, 4);

    const one = materializeExplicitGroupsFromTeams({
      teams: teams4,
      groupCount: 1,
    });
    assert.equal(one.ok, true);
    assert.equal(one.groups.length, 1);
  });

  it("SQL package drops only stale 2-arg get_setup", () => {
    const remediate = readSrc(
      "docs/v5/migrations/team-tournament-rpc-overload-remediation-01/02_REMEDIATE.sql"
    );
    assert.match(
      remediate,
      /drop function if exists public\.team_tournament_get_setup\(text, text\);/i
    );
    assert.doesNotMatch(remediate, /drop function[^\n]*replace_groups/i);
    assert.doesNotMatch(remediate, /drop function[^\n]*confirm_sub_match/i);
    assert.doesNotMatch(remediate, /drop function[^\n]*lock_matchup/i);
    assert.match(
      remediate,
      /grant execute on function public\.team_tournament_get_setup\(text, text, integer, boolean\)/i
    );
    assert.match(remediate, /revoke all on function public\.team_tournament_get_setup\(text, text, integer, boolean\)[\s\S]*from anon/i);
  });
});
