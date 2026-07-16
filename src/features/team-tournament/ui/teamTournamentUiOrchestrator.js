import {
  getTeamTournamentRepository,
  resolveUiTeamTournamentDataMode,
  TEAM_TOURNAMENT_DATA_MODES,
} from "../repositories/teamTournamentRepositoryFactory.js";
import { REPOSITORY_ERROR_CODES, REPOSITORY_REALTIME_FALLBACK } from "../repositories/teamTournamentRepositoryTypes.js";
import { attachTeamDataToTournament, getTeamData } from "../engines/teamTournamentEngine.js";
import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import { mirrorAggregateToBlob } from "./teamTournamentBlobMirror.js";
import {
  legacyApplyForfeit,
  legacyConfirmSubMatch,
  legacyLockLineup,
  legacyPatchTeamData,
  legacyPublishLineups,
  legacySaveDraftLineup,
  legacySaveSubMatchDraft,
  legacySubmitLineup,
} from "./teamTournamentLegacyMutationAdapter.js";
import {
  beginUiCommandKey,
  buildUiCommandScope,
  endUiCommandKey,
} from "./teamTournamentUiCommandKeys.js";
import {
  attachSnapshotPackageToPayload,
  buildSetupMutationFromTeamDataDiff,
  buildSetupMutationSnapshotPackageAsync,
  isSetupMutationFoundationEnabled,
  runSetupMutation,
  SETUP_MUTATION_CODES,
} from "../setup/index.js";

export const UI_MUTATION_ERROR = Object.freeze({
  VERSION_CONFLICT: "version_conflict",
  ACCESS_DENIED: "access_denied",
  NOT_FOUND: "REPOSITORY_NOT_FOUND",
  NETWORK: "network_error",
  NOT_IMPLEMENTED: "REPOSITORY_NOT_IMPLEMENTED",
});

export function aggregateToTournamentView(aggregate) {
  if (!aggregate) {
    return null;
  }

  const settings = aggregate.settings || aggregate.teamData?.settings || {};

  return attachTeamDataToTournament(
    {
      id: aggregate.id,
      clubId: aggregate.clubId,
      tenantId: aggregate.tenantId,
      mode: aggregate.mode || TOURNAMENT_MODE.TEAM_TOURNAMENT,
      status: aggregate.status,
      version: aggregate.version,
      name: settings?.name || aggregate.teamData?.settings?.name,
      tournamentLevel:
        aggregate.tournamentLevel || settings.tournamentLevel || undefined,
      certificationStatus:
        aggregate.certificationStatus ||
        settings.certificationStatus ||
        undefined,
      rankingEnabled:
        aggregate.rankingEnabled ?? settings.rankingEnabled ?? undefined,
    },
    aggregate.teamData || {
      teams: aggregate.teams,
      matchups: aggregate.matchups,
      lineups: aggregate.lineups,
      standings: aggregate.standings,
      disciplines: aggregate.disciplines,
      groups: aggregate.groups,
      settings: aggregate.settings,
    }
  );
}

export function mapRepositoryResultToUi(result) {
  if (result?.ok) {
    return { ok: true, data: result.data, version: result.version, replayed: result.replayed };
  }

  const code = result?.code || "unknown";
  let userMessage = result?.error || "Không thực hiện được thao tác.";

  if (code === UI_MUTATION_ERROR.VERSION_CONFLICT || code === "version_conflict") {
    userMessage =
      "Dữ liệu đã được người khác cập nhật. Hệ thống đã tải lại phiên bản mới — vui lòng kiểm tra trước khi gửi lại.";
  } else if (code === "FORBIDDEN" || code === UI_MUTATION_ERROR.ACCESS_DENIED) {
    userMessage = result?.error || "Bạn không có quyền thực hiện thao tác này.";
  } else if (code === REPOSITORY_ERROR_CODES.NOT_FOUND) {
    userMessage = "Không tìm thấy giải đấu.";
  } else if (code === REPOSITORY_ERROR_CODES.NOT_IMPLEMENTED) {
    userMessage = "Chức năng chưa được triển khai trên môi trường này.";
  }

  return {
    ok: false,
    code,
    error: userMessage,
    raw: result,
    isVersionConflict: code === UI_MUTATION_ERROR.VERSION_CONFLICT || code === "version_conflict",
  };
}

function isLegacyProvider(provider) {
  return provider === "blob";
}

async function maybeMirrorAfterCloudSuccess(clubId, mode, repo, tournamentId) {
  if (
    mode !== TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY &&
    mode !== TEAM_TOURNAMENT_DATA_MODES.CLOUD_ONLY
  ) {
    return null;
  }

  const fresh = await repo.getTournament(clubId, tournamentId);
  if (!fresh.ok) {
    return { mirrorWarning: fresh.error };
  }

  const mirror = mirrorAggregateToBlob(clubId, fresh.data);
  return mirror.ok ? null : { mirrorWarning: mirror.warning };
}

async function delegateLegacyMutation(method, clubId, tournamentId, payload, commandOptions) {
  switch (method) {
    case "saveDraftLineup":
      return legacySaveDraftLineup(clubId, tournamentId, { ...payload, ...commandOptions });
    case "submitLineup":
      return legacySubmitLineup(clubId, tournamentId, { ...payload, ...commandOptions });
    case "lockLineup":
      return legacyLockLineup(clubId, tournamentId, { ...payload, ...commandOptions });
    case "randomizeLineup":
      return {
        ok: false,
        code: REPOSITORY_ERROR_CODES.NOT_IMPLEMENTED,
        error: "randomizeLineup chỉ khả dụng trên cloud repository.",
      };
    case "publishLineups":
      return legacyPublishLineups(clubId, tournamentId, { ...payload, ...commandOptions });
    case "confirmSubMatchResult":
      return legacyConfirmSubMatch(clubId, tournamentId, { ...payload, ...commandOptions });
    case "saveSubMatchDraft":
      return legacySaveSubMatchDraft(clubId, tournamentId, { ...payload, ...commandOptions });
    case "applyForfeit":
      return legacyApplyForfeit(clubId, tournamentId, { ...payload, ...commandOptions });
    case "overrideLineup":
      return {
        ok: false,
        code: REPOSITORY_ERROR_CODES.NOT_IMPLEMENTED,
        error: "overrideLineup chỉ khả dụng trên cloud repository.",
      };
    default:
      return {
        ok: false,
        code: REPOSITORY_ERROR_CODES.NOT_IMPLEMENTED,
        error: `${method} chưa hỗ trợ legacy adapter.`,
      };
  }
}

/**
 * @param {import('../repositories/TeamTournamentRepository.interface.js').TeamTournamentRepository} repo
 * @param {string} method
 */
async function runRepositoryMutation(repo, method, clubId, tournamentId, payload, commandOptions) {
  const fn = repo[method];
  if (typeof fn !== "function") {
    return {
      ok: false,
      code: REPOSITORY_ERROR_CODES.NOT_IMPLEMENTED,
      error: `Repository.${method} không tồn tại.`,
    };
  }

  const result = await fn.call(repo, clubId, tournamentId, payload, commandOptions);

  if (
    !result.ok &&
    result.code === REPOSITORY_ERROR_CODES.NOT_IMPLEMENTED &&
    isLegacyProvider(repo.getProvider())
  ) {
    return delegateLegacyMutation(method, clubId, tournamentId, payload, commandOptions);
  }

  return result;
}

export function createTeamTournamentUiOrchestrator(options = {}) {
  const repo = options.repository || getTeamTournamentRepository({ forceNew: options.forceNew });
  const mode = options.mode || resolveUiTeamTournamentDataMode();
  const logger = options.logger || console;

  return {
    getMode: () => mode,
    getProvider: () => repo.getProvider(),
    getPollingConfig: () => ({ ...REPOSITORY_REALTIME_FALLBACK }),

    async loadTournament(clubId, tournamentId, readOptions = {}) {
      const isCloudPrimary =
        mode === TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY ||
        mode === TEAM_TOURNAMENT_DATA_MODES.CLOUD_ONLY;

      try {
        const setupReadOptions = { ...readOptions };
        if (
          isCloudPrimary &&
          isSetupMutationFoundationEnabled() &&
          setupReadOptions.schemaVersion == null
        ) {
          setupReadOptions.schemaVersion = 7;
        }
        const result = await repo.getTournament(clubId, tournamentId, setupReadOptions);

        if (!result.ok) {
          return mapRepositoryResultToUi(result);
        }

        const tournament = aggregateToTournamentView(result.data);
        const teamData = getTeamData(tournament);

        if (isCloudPrimary && mode === TEAM_TOURNAMENT_DATA_MODES.SHADOW) {
          // shadow never renders cloud for primary display
        }

        return {
          ok: true,
          tournament,
          aggregate: result.data,
          teamData,
          version: result.version ?? result.data?.version ?? 1,
          provider: result.provider || repo.getProvider(),
          isCloudPrimary,
          serverTime: result.serverTime ?? null,
          lineupDeadline: result.lineupDeadline ?? null,
          canSaveDraft: result.canSaveDraft ?? null,
          canSubmit: result.canSubmit ?? null,
          deadlineStatus: result.deadlineStatus ?? null,
          viewerTeamId: result.viewerTeamId ?? null,
          schemaVersion: result.schemaVersion ?? null,
          snapshotMeta: result.snapshot ?? null,
          diagnostic: result.diagnostic ?? null,
          driftDetected: result.driftDetected === true,
          setupBlocked: result.setupBlocked === true,
          setupBlockCode: result.diagnostic?.driftCode || null,
          latestTournamentVersion: result.version ?? result.data?.version ?? 1,
          viewer: result.viewer ?? null,
          permissions: result.permissions ?? null,
          operations: result.operations ?? null,
        };
      } catch (error) {
        logger.error("[TT-1C] loadTournament failed", error);
        return {
          ok: false,
          code: UI_MUTATION_ERROR.NETWORK,
          error: error?.message || "Không tải được dữ liệu giải.",
        };
      }
    },

    async getVisibleLineups(clubId, tournamentId, options) {
      try {
        const result = await repo.getVisibleLineups(clubId, tournamentId, options);
        return mapRepositoryResultToUi(result);
      } catch (error) {
        return {
          ok: false,
          code: UI_MUTATION_ERROR.NETWORK,
          error: error?.message || "Không tải được đội hình.",
        };
      }
    },

    async getLineupOverrideOps(clubId, tournamentId, payload) {
      const fn = repo.getLineupOverrideOps;
      if (typeof fn !== "function") {
        return mapRepositoryResultToUi({
          ok: false,
          code: REPOSITORY_ERROR_CODES.NOT_IMPLEMENTED,
          error: "getLineupOverrideOps không khả dụng trên repository này.",
        });
      }
      try {
        const result = await fn.call(repo, clubId, tournamentId, payload);
        return mapRepositoryResultToUi(result);
      } catch (error) {
        return {
          ok: false,
          code: UI_MUTATION_ERROR.NETWORK,
          error: error?.message || "Không tải được quyền override.",
        };
      }
    },

    async runMutation({
      method,
      clubId,
      tournamentId,
      payload = {},
      commandOptions,
      actionScope,
      expectedVersion,
    }) {
      const scope = actionScope || buildUiCommandScope(method, tournamentId, payload.matchupId || "");
      const idempotencyKey =
        commandOptions?.idempotencyKey || beginUiCommandKey(scope);
      const version = commandOptions?.expectedVersion ?? expectedVersion;

      if (version == null || !idempotencyKey) {
        return {
          ok: false,
          code: REPOSITORY_ERROR_CODES.MISSING_EXPECTED_VERSION,
          error: "Thiếu expectedVersion hoặc idempotencyKey.",
        };
      }

      const opts = {
        expectedVersion: Number(version),
        idempotencyKey: String(idempotencyKey),
        ...(commandOptions || {}),
      };

      try {
        let result = await runRepositoryMutation(
          repo,
          method,
          clubId,
          tournamentId,
          payload,
          opts
        );

        if (!result.ok) {
          endUiCommandKey(scope);
          return mapRepositoryResultToUi(result);
        }

        const mirrorMeta = await maybeMirrorAfterCloudSuccess(clubId, mode, repo, tournamentId);
        endUiCommandKey(scope);

        const reload = await this.loadTournament(clubId, tournamentId);
        return {
          ok: true,
          version: result.version ?? reload.version,
          replayed: result.replayed,
          tournament: reload.tournament,
          teamData: reload.teamData,
          aggregate: reload.aggregate,
          mirrorWarning: mirrorMeta?.mirrorWarning,
        };
      } catch (error) {
        endUiCommandKey(scope);
        return {
          ok: false,
          code: UI_MUTATION_ERROR.NETWORK,
          error: error?.message || "Lỗi mạng khi gửi thao tác.",
        };
      }
    },

    patchTeamData(clubId, tournamentId, patch) {
      if (
        mode === TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY ||
        mode === TEAM_TOURNAMENT_DATA_MODES.CLOUD_ONLY
      ) {
        const gateHint = isSetupMutationFoundationEnabled()
          ? "Dùng persistSetupTeamData để ghi bằng P1.3 domain RPC."
          : "Bật VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7 sau khi P1.3 được Staging-certified.";
        return {
          ok: false,
          code: isSetupMutationFoundationEnabled()
            ? "SETUP_MUTATION_REQUIRED"
            : REPOSITORY_ERROR_CODES.NOT_IMPLEMENTED,
          error:
            `Cloud setup không ghi blob/localStorage. ${gateHint}`,
        };
      }

      const result = legacyPatchTeamData(clubId, tournamentId, patch);
      const uiResult = mapRepositoryResultToUi(result);
      if (uiResult.ok && result.reloadResult?.ok) {
        return {
          ...uiResult,
          version: result.version ?? result.reloadResult.version,
          tournament: result.reloadResult.tournament,
          teamData: result.reloadResult.teamData,
          aggregate: result.reloadResult.aggregate,
        };
      }
      return uiResult;
    },

    async persistSetupTeamData(clubId, tournamentId, nextTeamData, options = {}) {
      const isCloud =
        mode === TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY ||
        mode === TEAM_TOURNAMENT_DATA_MODES.CLOUD_ONLY;
      if (!isCloud) {
        return this.patchTeamData(clubId, tournamentId, { teamData: nextTeamData });
      }
      if (!isSetupMutationFoundationEnabled(options.envSource)) {
        return mapRepositoryResultToUi({
          ok: false,
          code: "GATE_OFF",
          error:
            "Setup mutation v7 đang tắt. Bật VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7 sau khi P1.3 được Staging-certified.",
        });
      }

      const current =
        options.aggregate ||
        (await repo.getTournament(clubId, tournamentId, { schemaVersion: 7 }));
      const aggregate = current?.data || current?.aggregate || current;
      if (!aggregate?.id && !aggregate?.teamData) {
        return mapRepositoryResultToUi(current);
      }

      const previousTeamData = options.previousTeamData || aggregate.teamData || {};
      const expectedTournamentVersion = Number(
        options.expectedTournamentVersion ?? aggregate.version ?? 1
      );
      const inferred = buildSetupMutationFromTeamDataDiff({
        previous: previousTeamData,
        next: nextTeamData,
        tournamentId,
        expectedTournamentVersion,
        rulesVersion: options.rulesVersion || aggregate.rulesVersion || "",
      });
      if (!inferred.commandName) {
        return mapRepositoryResultToUi({
          ok: false,
          code: inferred.error || "SETUP_MUTATION_REQUIRED",
          error: "Không tìm thấy thay đổi setup domain có thể ghi bằng P1.3.",
        });
      }

      const matchups = nextTeamData.matchups || [];
      let snapshot;
      try {
        snapshot = await buildSetupMutationSnapshotPackageAsync({
          tournament: options.tournament || aggregateToTournamentView(aggregate) || { id: tournamentId },
          teams: nextTeamData.teams || aggregate.teams || [],
          disciplines: nextTeamData.disciplines || [],
          groups: nextTeamData.groups || [],
          matchups,
          subMatches: matchups.flatMap((matchup) => matchup.subMatches || []),
          schedule: nextTeamData.schedule || matchups,
          schedulePublish: nextTeamData.schedulePublish || aggregate.schedulePublish || {},
          settings: nextTeamData.settings || aggregate.settings || {},
          formatPreset: nextTeamData.settings?.formatPreset || aggregate.formatPreset,
          rosterRules: nextTeamData.settings?.rosterRules || aggregate.rosterRules,
          engineInput: inferred.engineInput,
          engineOutput: inferred.engineOutput,
          expectedTournamentVersion,
          generatedAt: options.generatedAt,
        });
      } catch (error) {
        return mapRepositoryResultToUi({
          ok: false,
          code: SETUP_MUTATION_CODES.HASH_RUNTIME_ERROR,
          error:
            error?.message ||
            "Không tính được hash snapshot setup. Không ghi discipline/groups/matchups/schedule.",
        });
      }

      const result = await runSetupMutation({
        method: inferred.commandName,
        commandName: inferred.commandName,
        tournamentId,
        expectedTournamentVersion,
        latestTournamentVersion: expectedTournamentVersion,
        payload: attachSnapshotPackageToPayload(inferred.payload, snapshot),
        engineInput: inferred.engineInput,
        engineOutput: inferred.engineOutput,
        rulesVersion: inferred.rulesVersion,
        confirmDestructive:
          options.confirmDestructive === true || inferred.confirmDestructive === true,
        confirmed: true,
        repository: repo,
        dataMode: mode,
        envSource: options.envSource,
        reload: (reloadOptions) => this.loadTournament(clubId, tournamentId, reloadOptions),
        driftDetected: options.driftDetected,
        diagnostic: options.diagnostic,
        reloadAcknowledged: options.reloadAcknowledged,
      });
      const uiResult = mapRepositoryResultToUi(result);
      if (uiResult.ok && result.reloadResult?.ok) {
        return {
          ...uiResult,
          version: result.version ?? result.reloadResult.version,
          tournament: result.reloadResult.tournament,
          teamData: result.reloadResult.teamData,
          aggregate: result.reloadResult.aggregate,
        };
      }
      return uiResult;
    },

    /** Referee draft score — legacy adapter until cloud RPC exists. */
    async saveSubMatchDraft(clubId, tournamentId, payload, commandOptions) {
      const scope = buildUiCommandScope("ref-draft", tournamentId, payload.subMatchId || "");
      const opts = {
        expectedVersion: Number(commandOptions?.expectedVersion ?? payload.expectedVersion),
        idempotencyKey:
          commandOptions?.idempotencyKey || beginUiCommandKey(scope),
      };

      if (opts.expectedVersion == null || !opts.idempotencyKey) {
        return {
          ok: false,
          error: "Thiếu expectedVersion hoặc idempotencyKey.",
        };
      }

      try {
        const result = await legacySaveSubMatchDraft(clubId, tournamentId, {
          ...payload,
          ...opts,
        });
        endUiCommandKey(scope);
        if (!result.ok) {
          return mapRepositoryResultToUi(result);
        }
        const reload = await this.loadTournament(clubId, tournamentId);
        return { ok: true, tournament: reload.tournament, teamData: reload.teamData };
      } catch (error) {
        endUiCommandKey(scope);
        return { ok: false, error: error?.message || "Lỗi lưu nháp." };
      }
    },
  };
}

let defaultOrchestrator = null;

export function getTeamTournamentUiOrchestrator(options = {}) {
  if (!defaultOrchestrator || options.forceNew) {
    defaultOrchestrator = createTeamTournamentUiOrchestrator(options);
  }
  return defaultOrchestrator;
}

export function __resetTeamTournamentUiOrchestratorForTests() {
  defaultOrchestrator = null;
}
