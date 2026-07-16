import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SETUP_MUTATION_GATE_ENV,
  buildSetupMutationPayload,
  executeSetupMutation,
  resolveSetupMutationRpcName,
  runSetupMutation,
  __resetSetupMutationFoundationStateForTests,
} from "../src/features/team-tournament/setup/index.js";
import {
  buildTeamTournamentDraftState,
  deriveDraftStatusLabel,
  deriveNextWorkflowAction,
  deriveWorkflowStage,
  WORKFLOW_STAGE,
} from "../src/features/team-tournament/engines/teamTournamentWorkflowStage.js";
import {
  addTeamToTournament,
  initializeTeamTournamentData,
} from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { assignTeamsToGroupsBySizes } from "../src/features/team-tournament/engines/teamRoundRobinScheduleEngine.js";
import { TEAM_AUDIT_ACTIONS } from "../src/features/team-tournament/constants.js";

const GATE_ON = { [SETUP_MUTATION_GATE_ENV]: "true" };
const RULES_VERSION = "rules@7";

function eightTeamsWithGroups() {
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
  return assignTeamsToGroupsBySizes(data, [4, 4]);
}

describe("TT-V6 tournament.save_draft real mutation", () => {
  it("8. save-draft is a real mutation mapped to team_tournament_save_draft", () => {
    assert.equal(
      resolveSetupMutationRpcName("tournament.save_draft"),
      "team_tournament_save_draft"
    );
    const draftState = buildTeamTournamentDraftState(eightTeamsWithGroups(), { id: "tt-1" }, {
      engineVersion: "team-tournament-engines@1.0.0",
      rulesVersion: RULES_VERSION,
      setupVersion: 5,
    });
    const built = buildSetupMutationPayload({
      method: "tournament.save_draft",
      tournamentId: "tt-1",
      expectedTournamentVersion: 5,
      idempotencyKey: "draft-1",
      rulesVersion: RULES_VERSION,
      payload: { draftState },
      engineInput: { command: "tournament.save_draft" },
      engineOutput: draftState,
    });
    assert.equal(built.ok, true);
    assert.equal(built.envelope.commandName, "tournament.save_draft");
    assert.equal(built.rpcName, "team_tournament_save_draft");
    // Default disciplines exist → stage advances to matchups; draft status reflects nội dung.
    assert.equal(built.envelope.payload.draftState.workflowStage, WORKFLOW_STAGE.MATCHUPS);
    assert.equal(built.envelope.payload.draftState.draftStatus, "Nháp — đã có nội dung");
  });

  it("9–11. save-draft increments version once, creates one snapshot, replay is idempotent", async () => {
    __resetSetupMutationFoundationStateForTests();
    const draftState = buildTeamTournamentDraftState(eightTeamsWithGroups(), { id: "tt-draft" }, {
      rulesVersion: RULES_VERSION,
      setupVersion: 3,
    });
    const calls = [];
    const repo = {
      async executeSetupMutation({ rpcName, envelope }) {
        calls.push({ rpcName, envelope });
        if (calls.length === 1) {
          return {
            ok: true,
            version: 4,
            snapshot: { snapshotId: "snap-1", snapshotVersion: 4 },
            replayed: false,
          };
        }
        return {
          ok: true,
          version: 4,
          snapshot: { snapshotId: "snap-1", snapshotVersion: 4 },
          replayed: true,
        };
      },
    };

    const first = await runSetupMutation({
      method: "tournament.save_draft",
      commandName: "tournament.save_draft",
      tournamentId: "tt-draft",
      expectedTournamentVersion: 3,
      rulesVersion: RULES_VERSION,
      payload: { draftState },
      engineInput: { command: "tournament.save_draft" },
      engineOutput: draftState,
      confirmed: true,
      repository: repo,
      envSource: GATE_ON,
      idempotencyKey: "idem-draft-same",
      reload: async () => ({
        ok: true,
        version: 4,
        teamData: eightTeamsWithGroups(),
        tournament: { id: "tt-draft", settings: { draftState } },
      }),
    });
    assert.equal(first.ok, true);
    assert.equal(first.version, 4);
    assert.equal(first.replayed, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].rpcName, "team_tournament_save_draft");

    const second = await runSetupMutation({
      method: "tournament.save_draft",
      commandName: "tournament.save_draft",
      tournamentId: "tt-draft",
      expectedTournamentVersion: 3,
      rulesVersion: RULES_VERSION,
      payload: { draftState },
      engineInput: { command: "tournament.save_draft" },
      engineOutput: draftState,
      confirmed: true,
      repository: repo,
      envSource: GATE_ON,
      idempotencyKey: "idem-draft-same",
      reload: async () => ({
        ok: true,
        version: 4,
        teamData: eightTeamsWithGroups(),
        tournament: { id: "tt-draft", settings: { draftState } },
      }),
    });
    assert.equal(second.ok, true);
    assert.equal(second.version, 4);
    assert.equal(second.replayed, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].envelope.idempotencyKey, calls[1].envelope.idempotencyKey);
  });

  it("12. version conflict does not overwrite", async () => {
    __resetSetupMutationFoundationStateForTests();
    let reloadCalls = 0;
    const result = await runSetupMutation({
      method: "tournament.save_draft",
      commandName: "tournament.save_draft",
      tournamentId: "tt-conflict",
      expectedTournamentVersion: 2,
      rulesVersion: RULES_VERSION,
      payload: { draftState: { draftStatus: "Nháp — đã có đội" } },
      engineInput: {},
      engineOutput: {},
      confirmed: true,
      envSource: GATE_ON,
      repository: {
        async executeSetupMutation() {
          return {
            ok: false,
            code: "version_conflict",
            error: "Phiên bản giải đã thay đổi.",
          };
        },
      },
      reload: async () => {
        reloadCalls += 1;
        return { ok: true, version: 5 };
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "VERSION_CONFLICT");
    assert.equal(reloadCalls, 1);
    assert.equal(result.autoResubmit, false);
  });

  it("13. resume restores workflow stage after groups saved", () => {
    const teamData = eightTeamsWithGroups();
    assert.equal(deriveWorkflowStage(teamData), WORKFLOW_STAGE.MATCHUPS);
    assert.equal(deriveDraftStatusLabel(teamData), "Nháp — đã có nội dung");
    const next = deriveNextWorkflowAction(teamData);
    assert.match(next.label, /cặp đấu|nội dung/i);

    const groupsOnly = { ...teamData, disciplines: [] };
    assert.equal(deriveWorkflowStage(groupsOnly), WORKFLOW_STAGE.DISCIPLINES);
    assert.equal(deriveDraftStatusLabel(groupsOnly), "Nháp — đã chia bảng");
    assert.match(deriveNextWorkflowAction(groupsOnly).label, /nội dung/i);

    const draft = buildTeamTournamentDraftState(groupsOnly, { id: "tt" }, {
      rulesVersion: RULES_VERSION,
      setupVersion: 8,
    });
    assert.equal(draft.workflowStage, WORKFLOW_STAGE.DISCIPLINES);
    assert.equal(draft.nextRequiredStage, WORKFLOW_STAGE.DISCIPLINES);
    assert.equal(draft.lastCompletedStage, WORKFLOW_STAGE.GROUPS);
  });

  it("14. no blob authority for save-draft", async () => {
    const built = buildSetupMutationPayload({
      method: "tournament.save_draft",
      tournamentId: "tt-blob",
      expectedTournamentVersion: 1,
      idempotencyKey: "blob-draft",
      payload: { draftState: {} },
      engineInput: {},
      engineOutput: {},
    });
    assert.equal(built.ok, true);
    const blob = await executeSetupMutation({
      provider: "blob",
      tournamentId: "tt-blob",
      envelope: built.envelope,
      envSource: GATE_ON,
    });
    assert.equal(blob.ok, false);
    assert.equal(blob.code, "BLOB_FALLBACK_FORBIDDEN");
  });

  it("15. audit-log whitelist rejection is independent of domain mutation success", async () => {
    // Staging audit_logs_action_check does not allow team.* actions — inserts 400.
    // writeAuditLog falls back to localStorage and must not gate group/draft success.
    assert.equal(TEAM_AUDIT_ACTIONS.TEAM_CREATE, "team.create");
    assert.ok(!["login", "create", "update"].includes(TEAM_AUDIT_ACTIONS.TEAM_CREATE));

    const built = buildSetupMutationPayload({
      method: "tournament.save_draft",
      tournamentId: "tt-audit",
      expectedTournamentVersion: 3,
      idempotencyKey: "audit-indep",
      rulesVersion: RULES_VERSION,
      payload: { draftState: buildTeamTournamentDraftState(eightTeamsWithGroups()) },
      engineInput: {},
      engineOutput: {},
    });
    const executed = await executeSetupMutation({
      provider: "cloud",
      tournamentId: "tt-audit",
      envelope: built.envelope,
      envSource: GATE_ON,
      callRpc: async () => ({
        ok: true,
        version: 4,
        snapshot: { snapshotId: "s1", snapshotVersion: 4 },
      }),
    });
    assert.equal(executed.ok, true);
    assert.equal(executed.version, 4);
  });

  it("draft status labels cover owner-locked set", () => {
    const empty = initializeTeamTournamentData();
    assert.equal(deriveDraftStatusLabel(empty), "Nháp — chưa có đội");

    let teamsOnly = empty;
    for (let i = 0; i < 8; i += 1) {
      teamsOnly = addTeamToTournament(teamsOnly, {
        id: `t${i}`,
        name: `T${i}`,
        playerIds: [],
      });
    }
    assert.equal(deriveDraftStatusLabel(teamsOnly), "Nháp — đã có đội");

    const grouped = assignTeamsToGroupsBySizes(teamsOnly, [4, 4]);
    assert.equal(deriveDraftStatusLabel(grouped), "Nháp — đã có nội dung");
    assert.equal(
      deriveDraftStatusLabel({ ...grouped, disciplines: [] }),
      "Nháp — đã chia bảng"
    );
  });
});
