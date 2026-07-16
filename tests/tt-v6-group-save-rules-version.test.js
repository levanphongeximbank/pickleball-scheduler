import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SETUP_MUTATION_GATE_ENV,
  buildSetupMutationPayload,
  executeSetupMutation,
  resolveSetupMutationRpcName,
} from "../src/features/team-tournament/setup/index.js";
import { buildSetupMutationFromTeamDataDiff } from "../src/features/team-tournament/setup/inferSetupMutationCommand.js";
import { buildGroupDivisionPreviewPackage } from "../src/features/team-tournament/setup/buildGroupDivisionPreview.js";
import {
  prepareLivePrivatePairingOptions,
  resolveActivePrivatePairingRules,
} from "../src/features/private-pairing-rules/index.js";
import {
  addTeamToTournament,
  initializeTeamTournamentData,
} from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { assignTeamsToGroupsBySizes } from "../src/features/team-tournament/engines/teamRoundRobinScheduleEngine.js";

const GATE_ON = { [SETUP_MUTATION_GATE_ENV]: "true" };
const RULES_VERSION = "rules@7";

function eightTeams() {
  let data = initializeTeamTournamentData();
  for (let index = 0; index < 8; index += 1) {
    const label = String.fromCharCode(65 + index);
    data = addTeamToTournament(data, {
      id: `team-${label.toLowerCase()}`,
      name: `Đội ${label}`,
      playerIds: [],
      avgLevel: 3.5,
    });
  }
  return data;
}

function groupsReplaceEnvelope(rulesVersion) {
  const next = assignTeamsToGroupsBySizes(eightTeams(), [4, 4]);
  return buildSetupMutationPayload({
    method: "groups.replace",
    tournamentId: "tt-groups",
    expectedTournamentVersion: 3,
    idempotencyKey: `groups-${rulesVersion || "none"}`,
    rulesVersion,
    payload: {
      groups: next.groups,
      snapshot: { snapshotHash: "a".repeat(64), snapshotCanonicalText: "{}", snapshotJson: {} },
    },
    engineInput: { commandName: "groups.replace" },
    engineOutput: { groups: next.groups },
  });
}

describe("TT-V6 group save rules version", () => {
  it("1. group preview package includes the canonical rulesVersion", async () => {
    const next = assignTeamsToGroupsBySizes(eightTeams(), [4, 4]);
    const preview = await buildGroupDivisionPreviewPackage({
      nextTeamData: next,
      seedingMode: "avg_level",
      modeLabel: "manual",
      rulesVersion: RULES_VERSION,
    });
    assert.equal(preview.written, false);
    assert.equal(preview.rulesVersion, RULES_VERSION);
  });

  it("2. confirm envelope carries the same rulesVersion as the preview", async () => {
    const preview = await buildGroupDivisionPreviewPackage({
      nextTeamData: assignTeamsToGroupsBySizes(eightTeams(), [4, 4]),
      rulesVersion: RULES_VERSION,
    });
    const built = groupsReplaceEnvelope(preview.rulesVersion);
    assert.equal(built.ok, true);
    assert.equal(built.envelope.rulesVersion, RULES_VERSION);
    assert.equal(built.envelope.rulesVersion, preview.rulesVersion);
  });

  it("3. missing rulesVersion fails before the RPC with the exact diagnostic", async () => {
    const built = groupsReplaceEnvelope("");
    assert.equal(built.ok, false);
    assert.equal(built.code, "VALIDATION_ERROR");
    assert.equal(built.error, "Thiếu rulesVersion cho lệnh pairing.");

    // Fail-closed: even if a caller forced an empty-rulesVersion envelope through,
    // executeSetupMutation must reject before invoking the RPC transport.
    let rpcCalls = 0;
    const forced = {
      commandName: "groups.replace",
      tournamentId: "tt-groups",
      expectedTournamentVersion: 3,
      idempotencyKey: "forced",
      engineVersion: "team-tournament-engines@1.0.0",
      rulesVersion: "",
      engineInputHash: "a".repeat(64),
      engineOutputHash: "b".repeat(64),
      generatedAt: "2026-01-01T00:00:00.000Z",
      generationMetadata: {},
      confirmDestructive: false,
      payload: { groups: [] },
      payloadHash: "c".repeat(64),
    };
    const result = await executeSetupMutation({
      provider: "cloud",
      tournamentId: "tt-groups",
      envelope: forced,
      envSource: GATE_ON,
      callRpc: async () => {
        rpcCalls += 1;
        return { ok: true, version: 4 };
      },
    });
    assert.equal(result.ok, false);
    assert.equal(rpcCalls, 0);
  });

  it("4. valid rulesVersion reaches team_tournament_replace_groups", async () => {
    const built = groupsReplaceEnvelope(RULES_VERSION);
    assert.equal(built.ok, true);
    assert.equal(resolveSetupMutationRpcName("groups.replace"), "team_tournament_replace_groups");

    let seenRpc = null;
    const result = await executeSetupMutation({
      provider: "cloud",
      tournamentId: "tt-groups",
      envelope: built.envelope,
      envSource: GATE_ON,
      callRpc: async (rpcName) => {
        seenRpc = rpcName;
        return { ok: true, version: 4, snapshot: { snapshotId: "s1", snapshotVersion: 4 } };
      },
    });
    assert.equal(seenRpc, "team_tournament_replace_groups");
    assert.equal(result.ok, true);
    assert.equal(result.version, 4);
  });

  it("5. matchups.replace and groups.clear also require rulesVersion", () => {
    for (const method of ["matchups.replace", "groups.clear"]) {
      const built = buildSetupMutationPayload({
        method,
        tournamentId: "tt-groups",
        expectedTournamentVersion: 3,
        idempotencyKey: `${method}-none`,
        rulesVersion: "",
        payload: {
          matchups: [],
          snapshot: { snapshotHash: "a".repeat(64), snapshotCanonicalText: "{}", snapshotJson: {} },
        },
        engineInput: {},
        engineOutput: {},
      });
      assert.equal(built.ok, false, `${method} must require rulesVersion`);
      assert.equal(built.error, "Thiếu rulesVersion cho lệnh pairing.");
    }
  });

  it("6. canonical resolver yields a non-empty rulesVersion for an empty active rule set", () => {
    const resolved = resolveActivePrivatePairingRules({ rules: [], context: {} });
    assert.ok(resolved.ruleSetVersion);
    assert.equal(typeof resolved.ruleSetVersion, "string");
  });

  it("7. prepareLivePrivatePairingOptions surfaces canonical rulesVersion (runtime off)", async () => {
    const prepared = await prepareLivePrivatePairingOptions({
      clubId: "club-1",
      tournamentId: "tt-groups",
      tenantId: "tenant-1",
      eventId: "event-tt-groups",
    });
    assert.equal(prepared.ok, true);
    assert.ok(prepared.rulesVersion, "top-level rulesVersion present");
    assert.equal(prepared.rulesVersion, prepared.pairingOptions.rulesVersion);
  });

  it("8. no blob authority for group save", async () => {
    const built = groupsReplaceEnvelope(RULES_VERSION);
    const blob = await executeSetupMutation({
      provider: "blob",
      tournamentId: "tt-groups",
      envelope: built.envelope,
      envSource: GATE_ON,
    });
    assert.equal(blob.ok, false);
    assert.equal(blob.code, "BLOB_FALLBACK_FORBIDDEN");
  });

  it("9. group save success requires the RPC result (no fake success on RPC failure)", async () => {
    const built = groupsReplaceEnvelope(RULES_VERSION);
    const failed = await executeSetupMutation({
      provider: "cloud",
      tournamentId: "tt-groups",
      envelope: built.envelope,
      envSource: GATE_ON,
      callRpc: async () => ({ ok: false, code: "FORBIDDEN", error: "denied" }),
    });
    assert.equal(failed.ok, false);
    assert.equal(failed.code, "FORBIDDEN");
  });

  it("5–7. group save survives get_setup v7 reload / F5 retains groups / success needs read-back", async () => {
    const next = assignTeamsToGroupsBySizes(eightTeams(), [4, 4]);
    const preview = await buildGroupDivisionPreviewPackage({
      nextTeamData: next,
      rulesVersion: RULES_VERSION,
    });
    assert.equal(preview.rulesVersion, RULES_VERSION);
    assert.equal(preview.nextTeamData.groups.length, 2);

    // Simulate F5: rebuild UI from get_setup v7 payload (normalized groups).
    const readBack = {
      schemaVersion: 7,
      groups: preview.nextTeamData.groups,
      teams: preview.nextTeamData.teams,
      snapshot: {
        rulesVersion: RULES_VERSION,
        engineVersion: preview.engineVersion,
        commandName: "groups.replace",
      },
    };
    assert.equal(readBack.groups.length, 2);
    assert.equal(readBack.groups[0].teamIds.length, 4);
    assert.equal(readBack.snapshot.rulesVersion, preview.rulesVersion);

    // Confirm envelope uses the same preview rulesVersion (parity).
    const built = groupsReplaceEnvelope(preview.rulesVersion);
    assert.equal(built.ok, true);
    assert.equal(built.envelope.rulesVersion, preview.rulesVersion);

    const { createTeamTournamentUiOrchestrator } = await import(
      "../src/features/team-tournament/ui/teamTournamentUiOrchestrator.js"
    );
    const { TEAM_TOURNAMENT_DATA_MODES } = await import(
      "../src/features/team-tournament/repositories/teamTournamentRepositoryFactory.js"
    );

    let getCalls = 0;
    let failReload = true;
    const orch = createTeamTournamentUiOrchestrator({
      mode: TEAM_TOURNAMENT_DATA_MODES.CLOUD_ONLY,
      repository: {
        getProvider: () => "cloud",
        async getTournament() {
          getCalls += 1;
          // First call = load current aggregate before mutation.
          if (getCalls === 1 || !failReload) {
            const withGroups = failReload === false && getCalls > 1;
            return {
              ok: true,
              version: withGroups ? 4 : 3,
              data: {
                id: "tt-groups",
                version: withGroups ? 4 : 3,
                teamData: withGroups ? next : eightTeams(),
                rulesVersion: RULES_VERSION,
              },
              teamData: withGroups ? next : eightTeams(),
            };
          }
          // Post-mutation read-back failure
          return { ok: false, code: "NETWORK", error: "get_setup v7 failed" };
        },
        async executeSetupMutation() {
          return {
            ok: true,
            version: 4,
            snapshot: { snapshotId: "g1", snapshotVersion: 4 },
          };
        },
      },
    });

    const failReadback = await orch.persistSetupTeamData("club", "tt-groups", next, {
      rulesVersion: RULES_VERSION,
      envSource: GATE_ON,
      expectedTournamentVersion: 3,
      previousTeamData: eightTeams(),
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(failReadback.ok, false);
    assert.equal(failReadback.code, "READBACK_FAILED");

    getCalls = 0;
    failReload = false;
    const ok = await orch.persistSetupTeamData("club", "tt-groups", next, {
      rulesVersion: RULES_VERSION,
      envSource: GATE_ON,
      expectedTournamentVersion: 3,
      previousTeamData: eightTeams(),
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(ok.ok, true);
    assert.equal((ok.teamData?.groups || []).length, 2);
  });

  it("16. P0/P1.3 roster path remains unchanged (groups.replace only touches groups)", () => {
    const previous = eightTeams();
    const next = assignTeamsToGroupsBySizes(previous, [4, 4]);
    const inferred = buildSetupMutationFromTeamDataDiff({
      previous,
      next,
      tournamentId: "tt-groups",
      expectedTournamentVersion: 3,
      rulesVersion: RULES_VERSION,
    });
    assert.equal(inferred.commandName, "groups.replace");
    assert.equal(inferred.payload.groups.length, 2);
    assert.equal(previous.teams.length, next.teams.length);
    assert.deepEqual(
      previous.teams.map((t) => t.id),
      next.teams.map((t) => t.id)
    );
  });
});
