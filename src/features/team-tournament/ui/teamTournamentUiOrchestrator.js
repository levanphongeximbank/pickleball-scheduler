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

  return attachTeamDataToTournament(
    {
      id: aggregate.id,
      clubId: aggregate.clubId,
      tenantId: aggregate.tenantId,
      mode: aggregate.mode || TOURNAMENT_MODE.TEAM_TOURNAMENT,
      status: aggregate.status,
      version: aggregate.version,
      name: aggregate.settings?.name || aggregate.teamData?.settings?.name,
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
        const result = await repo.getTournament(clubId, tournamentId, readOptions);

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
        return {
          ok: false,
          code: REPOSITORY_ERROR_CODES.NOT_IMPLEMENTED,
          error:
            "Chỉnh sửa cấu hình local (đội/lịch) không khả dụng khi cloud_primary. Dùng legacy/shadow để cấu hình hoặc migrate trước.",
        };
      }

      const result = legacyPatchTeamData(clubId, tournamentId, patch);
      return mapRepositoryResultToUi(result);
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
