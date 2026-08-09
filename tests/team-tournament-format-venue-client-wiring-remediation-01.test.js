import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FORMAT_PRESET,
  GROUP_MODE,
  KNOCKOUT_FORMAT,
} from "../src/features/team-tournament/constants.js";
import {
  applyMlp4Preset,
  buildSetupConfigPayload,
  resolveFormatVenueDefaults,
  validateFormatVenueConfigForPersist,
} from "../src/features/team-tournament/engines/teamFormatVenueConfig.js";
import {
  SETUP_MUTATION_GATE_ENV,
  __resetSetupMutationFoundationStateForTests,
  executeSetupMutation,
  isSetupMutationRpcDeployed,
  resolveSetupMutationRpcName,
  buildSetupMutationPayload,
} from "../src/features/team-tournament/setup/index.js";
import { TEAM_TOURNAMENT_DATA_MODES } from "../src/features/team-tournament/repositories/teamTournamentRepositoryFactory.js";
import { REPOSITORY_ERROR_CODES } from "../src/features/team-tournament/repositories/teamTournamentRepositoryTypes.js";
import { createTeamTournamentUiOrchestrator } from "../src/features/team-tournament/ui/teamTournamentUiOrchestrator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const GATE_ON = { [SETUP_MUTATION_GATE_ENV]: "true" };
const GATE_OFF = { [SETUP_MUTATION_GATE_ENV]: "false" };

function readSrc(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function mlp4Config(overrides = {}) {
  return {
    ...applyMlp4Preset(),
    groupMode: GROUP_MODE.SINGLE_POOL,
    groupCount: 1,
    qualificationCount: 2,
    knockoutFormat: KNOCKOUT_FORMAT.FINAL_ONLY,
    selectedCourtIds: ["court-a", "court-b"],
    ...overrides,
  };
}

function customRosterConfig(overrides = {}) {
  return {
    formatPreset: FORMAT_PRESET.CUSTOM,
    rosterRules: {
      teamSize: 6,
      minPlayers: 4,
      maxPlayers: 8,
      requiredMales: 2,
      requiredFemales: 2,
    },
    dreambreakerEnabled: false,
    groupMode: GROUP_MODE.MANUAL,
    groupCount: 2,
    qualificationCount: 2,
    knockoutFormat: KNOCKOUT_FORMAT.TOP_N,
    selectedCourtIds: ["court-x"],
    ...overrides,
  };
}

function baseAggregate(settings = {}) {
  return {
    id: "tt-fv-1",
    version: 3,
    teams: [
      { id: "t1", name: "A" },
      { id: "t2", name: "B" },
      { id: "t3", name: "C" },
      { id: "t4", name: "D" },
    ],
    teamData: {
      teams: [
        { id: "t1", name: "A" },
        { id: "t2", name: "B" },
        { id: "t3", name: "C" },
        { id: "t4", name: "D" },
      ],
      disciplines: [],
      groups: [],
      matchups: [],
      settings,
    },
    settings,
  };
}

function createRepoHarness({
  settingsOnRead = null,
  executeResult = null,
  executeImpl = null,
} = {}) {
  const calls = [];
  const aggregate = baseAggregate(settingsOnRead || {});
  return {
    calls,
    repo: {
      getProvider: () => "cloud",
      getTournament: async () => ({
        ok: true,
        version: aggregate.version,
        data: {
          ...aggregate,
          settings: settingsOnRead || aggregate.settings,
          teamData: {
            ...aggregate.teamData,
            settings: settingsOnRead || aggregate.teamData.settings,
          },
        },
      }),
      executeSetupMutation: async (params) => {
        calls.push(params);
        if (typeof executeImpl === "function") {
          return executeImpl(params);
        }
        if (executeResult) {
          return executeResult;
        }
        const payload = params.envelope?.payload || {};
        const nextSettings = {
          ...(settingsOnRead || {}),
          formatPreset: payload.formatPreset,
          rosterRules: payload.rosterRules,
          dreambreakerEnabled: payload.dreambreakerEnabled,
          groupMode: payload.groupMode,
          groupCount: payload.groupCount,
          qualificationCount: payload.qualificationCount,
          knockoutFormat: payload.knockoutFormat,
          selectedCourtIds: payload.selectedCourtIds,
        };
        settingsOnRead = nextSettings;
        aggregate.version += 1;
        aggregate.settings = nextSettings;
        aggregate.teamData = { ...aggregate.teamData, settings: nextSettings };
        return {
          ok: true,
          version: aggregate.version,
          snapshot: { snapshotId: "snap-fv", snapshotVersion: aggregate.version },
        };
      },
    },
  };
}

describe("Format & Venue client wiring — PR #412 follow-up", () => {
  it("registers update_setup_config in deployment registry and command map", () => {
    assert.equal(
      resolveSetupMutationRpcName("tournament.update_setup_config"),
      "team_tournament_update_setup_config"
    );
    assert.equal(
      isSetupMutationRpcDeployed("team_tournament_update_setup_config"),
      true
    );
    assert.equal(
      isSetupMutationRpcDeployed(resolveSetupMutationRpcName("awards.update")),
      false
    );
    assert.equal(
      isSetupMutationRpcDeployed(resolveSetupMutationRpcName("deputies.set")),
      false
    );
  });

  it("executeSetupMutation contract includes p_tournament_id/p_envelope/p_expected_version/p_idempotency_key", async () => {
    __resetSetupMutationFoundationStateForTests();
    const config = mlp4Config();
    const built = buildSetupMutationPayload({
      method: "tournament.update_setup_config",
      commandName: "tournament.update_setup_config",
      tournamentId: "tt-fv-rpc",
      expectedTournamentVersion: 2,
      idempotencyKey: "fv-idem-1",
      payload: buildSetupConfigPayload(config),
      engineInput: { command: "tournament.update_setup_config" },
      engineOutput: { setupConfig: config },
    });
    assert.equal(built.ok, true);
    assert.equal(built.rpcName, "team_tournament_update_setup_config");

    let rpcArgs = null;
    const executed = await executeSetupMutation({
      provider: "cloud",
      tournamentId: "tt-fv-rpc",
      envelope: built.envelope,
      envSource: GATE_ON,
      callRpc: async (rpcName, args) => {
        rpcArgs = { rpcName, args };
        return { ok: true, version: 3, snapshot: { snapshotId: "s1", snapshotVersion: 3 } };
      },
    });
    assert.equal(executed.ok, true);
    assert.equal(rpcArgs.rpcName, "team_tournament_update_setup_config");
    assert.equal(rpcArgs.args.p_tournament_id, "tt-fv-rpc");
    assert.equal(typeof rpcArgs.args.p_envelope, "object");
    assert.equal(rpcArgs.args.p_expected_version, 2);
    assert.equal(rpcArgs.args.p_idempotency_key, "fv-idem-1");
  });

  it("A: MLP4 Format & Venue config → update_setup_config invoked", async () => {
    __resetSetupMutationFoundationStateForTests();
    const { repo, calls } = createRepoHarness();
    const orch = createTeamTournamentUiOrchestrator({
      repository: repo,
      mode: TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY,
    });
    const config = mlp4Config();
    const result = await orch.persistFormatVenueSetup("club-1", "tt-fv-1", config, {
      envSource: GATE_ON,
      expectedTournamentVersion: 3,
      aggregate: baseAggregate(),
      reloadAcknowledged: true,
      generatedAt: "2026-08-09T00:00:00.000Z",
    });
    assert.equal(result.ok, true, result.error || result.code);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].rpcName, "team_tournament_update_setup_config");
    assert.equal(calls[0].envelope.commandName, "tournament.update_setup_config");
    assert.equal(calls[0].envelope.payload.formatPreset, FORMAT_PRESET.MLP_4);
  });

  it("B: Custom roster config → update_setup_config invoked (no silent mlp_4)", async () => {
    __resetSetupMutationFoundationStateForTests();
    const { repo, calls } = createRepoHarness();
    const orch = createTeamTournamentUiOrchestrator({
      repository: repo,
      mode: TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY,
    });
    const config = customRosterConfig();
    const result = await orch.persistFormatVenueSetup("club-1", "tt-fv-1", config, {
      envSource: GATE_ON,
      expectedTournamentVersion: 3,
      aggregate: baseAggregate(),
      reloadAcknowledged: true,
      generatedAt: "2026-08-09T00:00:00.000Z",
    });
    assert.equal(result.ok, true, result.error || result.code);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].envelope.payload.formatPreset, FORMAT_PRESET.CUSTOM);
    assert.equal(calls[0].envelope.payload.rosterRules.teamSize, 6);
    assert.notEqual(calls[0].envelope.payload.formatPreset, FORMAT_PRESET.MLP_4);
  });

  it("C: 4 teams / 1 group → groupCount=1 persisted (not forced to 2)", async () => {
    __resetSetupMutationFoundationStateForTests();
    const { repo, calls } = createRepoHarness();
    const orch = createTeamTournamentUiOrchestrator({
      repository: repo,
      mode: TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY,
    });
    const config = mlp4Config({ groupCount: 1, groupMode: GROUP_MODE.SINGLE_POOL });
    const result = await orch.persistFormatVenueSetup("club-1", "tt-fv-1", config, {
      envSource: GATE_ON,
      expectedTournamentVersion: 3,
      aggregate: baseAggregate(),
      reloadAcknowledged: true,
      generatedAt: "2026-08-09T00:00:00.000Z",
    });
    assert.equal(result.ok, true, result.error || result.code);
    assert.equal(calls[0].envelope.payload.groupCount, 1);
  });

  it("D: selectedCourtIds persisted", async () => {
    __resetSetupMutationFoundationStateForTests();
    const { repo, calls } = createRepoHarness();
    const orch = createTeamTournamentUiOrchestrator({
      repository: repo,
      mode: TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY,
    });
    const config = mlp4Config({ selectedCourtIds: ["court-1", "court-2", "court-1", ""] });
    const result = await orch.persistFormatVenueSetup("club-1", "tt-fv-1", config, {
      envSource: GATE_ON,
      expectedTournamentVersion: 3,
      aggregate: baseAggregate(),
      reloadAcknowledged: true,
      generatedAt: "2026-08-09T00:00:00.000Z",
    });
    assert.equal(result.ok, true, result.error || result.code);
    assert.deepEqual(calls[0].envelope.payload.selectedCourtIds, ["court-1", "court-2"]);
  });

  it("E: canonical get_setup readback returns same config", async () => {
    __resetSetupMutationFoundationStateForTests();
    const config = mlp4Config({
      groupCount: 1,
      selectedCourtIds: ["court-a", "court-b"],
    });
    let readSettings = null;
    const { repo, calls } = createRepoHarness({
      executeImpl: async (params) => {
        calls.push(params);
        readSettings = {
          formatPreset: params.envelope.payload.formatPreset,
          rosterRules: params.envelope.payload.rosterRules,
          dreambreakerEnabled: params.envelope.payload.dreambreakerEnabled,
          groupMode: params.envelope.payload.groupMode,
          groupCount: params.envelope.payload.groupCount,
          qualificationCount: params.envelope.payload.qualificationCount,
          knockoutFormat: params.envelope.payload.knockoutFormat,
          selectedCourtIds: params.envelope.payload.selectedCourtIds,
        };
        return {
          ok: true,
          version: 4,
          snapshot: { snapshotId: "snap-rb", snapshotVersion: 4 },
        };
      },
    });
    repo.getTournament = async () => ({
      ok: true,
      version: readSettings ? 4 : 3,
      data: {
        ...baseAggregate(readSettings || {}),
        version: readSettings ? 4 : 3,
        settings: readSettings || {},
        teamData: {
          ...baseAggregate().teamData,
          settings: readSettings || {},
        },
      },
    });

    const orch = createTeamTournamentUiOrchestrator({
      repository: repo,
      mode: TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY,
    });
    const result = await orch.persistFormatVenueSetup("club-1", "tt-fv-1", config, {
      envSource: GATE_ON,
      expectedTournamentVersion: 3,
      aggregate: baseAggregate(),
      reloadAcknowledged: true,
      generatedAt: "2026-08-09T00:00:00.000Z",
    });
    assert.equal(result.ok, true, result.error || result.code);
    assert.equal(result.version, 4);
    assert.equal(result.teamData.settings.formatPreset, FORMAT_PRESET.MLP_4);
    assert.equal(result.teamData.settings.groupCount, 1);
    assert.deepEqual(result.teamData.settings.selectedCourtIds, ["court-a", "court-b"]);
  });

  it("F: V7 OFF → GATE_OFF → no false success / no RPC", async () => {
    __resetSetupMutationFoundationStateForTests();
    const { repo, calls } = createRepoHarness();
    const orch = createTeamTournamentUiOrchestrator({
      repository: repo,
      mode: TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY,
    });
    const result = await orch.persistFormatVenueSetup("club-1", "tt-fv-1", mlp4Config(), {
      envSource: GATE_OFF,
      expectedTournamentVersion: 3,
      aggregate: baseAggregate(),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "GATE_OFF");
    assert.equal(calls.length, 0);
  });

  it("G: RPC unavailable → fail closed", async () => {
    __resetSetupMutationFoundationStateForTests();
    const { repo, calls } = createRepoHarness({
      executeResult: {
        ok: false,
        code: REPOSITORY_ERROR_CODES.RPC_GUARD_NOT_DEPLOYED,
        error: "team_tournament_update_setup_config chưa deploy",
      },
    });
    const orch = createTeamTournamentUiOrchestrator({
      repository: repo,
      mode: TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY,
    });
    const result = await orch.persistFormatVenueSetup("club-1", "tt-fv-1", mlp4Config(), {
      envSource: GATE_ON,
      expectedTournamentVersion: 3,
      aggregate: baseAggregate(),
      reloadAcknowledged: true,
      generatedAt: "2026-08-09T00:00:00.000Z",
    });
    assert.equal(result.ok, false);
    assert.equal(calls.length, 1);
    assert.notEqual(result.code, undefined);
  });

  it("H: version conflict → visible error / no false success", async () => {
    __resetSetupMutationFoundationStateForTests();
    const { repo, calls } = createRepoHarness({
      executeResult: {
        ok: false,
        code: "version_conflict",
        error: "Phiên bản giải đã thay đổi.",
      },
    });
    const orch = createTeamTournamentUiOrchestrator({
      repository: repo,
      mode: TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY,
    });
    const result = await orch.persistFormatVenueSetup("club-1", "tt-fv-1", mlp4Config(), {
      envSource: GATE_ON,
      expectedTournamentVersion: 3,
      aggregate: baseAggregate(),
      reloadAcknowledged: true,
      generatedAt: "2026-08-09T00:00:00.000Z",
    });
    assert.equal(result.ok, false);
    assert.equal(result.isVersionConflict, true);
    assert.match(result.error || "", /cập nhật|phiên bản|kiểm tra/i);
    assert.equal(calls.length, 1);
  });

  it("I: legacy tournaments without fields load with backward-compatible defaults", () => {
    const defaults = resolveFormatVenueDefaults({ settings: {} }, { id: "legacy" });
    assert.equal(defaults.formatPreset, FORMAT_PRESET.MLP_4);
    assert.equal(defaults.groupCount, 1);
    assert.equal(defaults.groupMode, GROUP_MODE.SINGLE_POOL);
    assert.deepEqual(defaults.selectedCourtIds, []);
    assert.equal(defaults.rosterRules.teamSize, 4);

    const customKept = resolveFormatVenueDefaults({
      settings: { formatPreset: FORMAT_PRESET.CUSTOM, groupCount: 1 },
    });
    assert.equal(customKept.formatPreset, FORMAT_PRESET.CUSTOM);
    assert.equal(customKept.groupCount, 1);
  });

  it("validation rejects invalid roster / groupCount before RPC", () => {
    const badRoster = validateFormatVenueConfigForPersist({
      formatPreset: FORMAT_PRESET.CUSTOM,
      rosterRules: { minPlayers: 8, maxPlayers: 4, teamSize: 6, requiredMales: 0, requiredFemales: 0 },
      groupCount: 1,
      qualificationCount: 1,
      selectedCourtIds: [],
    });
    assert.equal(badRoster.ok, false);

    const badGroups = validateFormatVenueConfigForPersist({
      ...mlp4Config(),
      groupCount: 0,
    });
    assert.equal(badGroups.ok, false);
    assert.equal(badGroups.code, "INVALID_GROUP_COUNT");
  });

  it("source wiring: orchestrator + UI save path use persistFormatVenueSetup", () => {
    const registry = readSrc(
      "src/features/team-tournament/setup/setupMutationRpcRegistry.js"
    );
    assert.match(
      registry,
      /SETUP_MUTATION_RPC_BY_COMMAND\["tournament\.update_setup_config"\]/
    );

    const orch = readSrc(
      "src/features/team-tournament/ui/teamTournamentUiOrchestrator.js"
    );
    assert.match(orch, /async persistFormatVenueSetup\(/);
    assert.match(orch, /tournament\.update_setup_config/);

    const pageHook = readSrc(
      "src/features/team-tournament/ui/useTeamTournamentPage.js"
    );
    assert.match(pageHook, /persistFormatVenueSetup/);

    const setupPage = readSrc("src/pages/tournament/TeamTournamentSetup.jsx");
    assert.match(setupPage, /persistFormatVenueSetup/);
    const saveFn = setupPage.match(
      /async function saveFormatVenueConfig\([\s\S]*?\n {2}\}/
    )?.[0];
    assert.ok(saveFn, "saveFormatVenueConfig function not found");
    assert.match(saveFn, /persistFormatVenueSetup/);
    assert.doesNotMatch(saveFn, /patchTeamData/);
    assert.doesNotMatch(saveFn, /saveDraft\(/);
  });
});
