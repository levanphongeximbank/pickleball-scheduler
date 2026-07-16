import {
  rpcTeamTournamentConfirmSubMatch,
  rpcTeamTournamentGetSetup,
  rpcTeamTournamentGetStandings,
  rpcTeamTournamentGetVisibleLineups,
  rpcTeamTournamentApplyForfeit,
  rpcTeamTournamentWithdrawTeam,
  rpcTeamTournamentProvisionRefereeMatch,
  rpcTeamTournamentRevokeRefereeLink,
  rpcTeamTournamentResyncRefereeLink,
  rpcTeamTournamentLockMatchup,
  rpcTeamTournamentPublishMatchup,
  rpcTeamTournamentRandomizeLineup,
  rpcTeamTournamentOverrideLineup,
  rpcTeamTournamentGetLineupOverrideOps,
  rpcTeamTournamentSaveLineupDraft,
  rpcTeamTournamentSubmitLineup,
  rpcTeamTournamentUpsertStandings,
} from "../services/teamTournamentRpcService.js";
import { computeTeamStandings } from "../engines/teamStandingsEngine.js";
import {
  hashTeamTournamentPayload,
  resolveIdempotencyReplay,
} from "./teamTournamentIdempotency.js";
import { mapSetupDeadlineMeta } from "../services/lineupDeadlineService.js";
import { mapTournamentToAggregate } from "./teamTournamentRepositoryAggregate.js";
import {
  notImplemented,
  normalizeRepositoryResult,
  rejectClientViewerTeamIdForCloud,
  repositoryFailure,
  repositorySuccess,
  validateVersionedCommandOptions,
  validatePublishCommandOptions,
  validateOverrideCommandOptions,
} from "./TeamTournamentRepository.interface.js";
import {
  describeTeamTournamentRpcGuard,
  isTeamTournamentRpcGuardDeployed,
} from "./teamTournamentRpcGuards.js";
import { REPOSITORY_ERROR_CODES } from "./teamTournamentRepositoryTypes.js";
import { subscribeCloudTournament } from "./teamTournamentRealtimeRepository.js";
import { loadClubData } from "../../../domain/clubStorage.js";
import { isTeamTournament } from "../engines/teamTournamentEngine.js";

const replayCache = new Map();

function readLocalTournamentFallback(clubId, tournamentId) {
  const resolvedClubId = String(clubId || "").trim();
  const id = String(tournamentId || "").trim();
  if (!resolvedClubId || !id) {
    return null;
  }
  try {
    const data = loadClubData(resolvedClubId);
    const found = (data.tournaments || []).find((item) => String(item?.id) === id);
    return found && isTeamTournament(found) ? found : null;
  } catch {
    return null;
  }
}

function rejectUndeployedRpcGuard(methodName) {
  if (isTeamTournamentRpcGuardDeployed(methodName)) {
    return null;
  }

  const guard = describeTeamTournamentRpcGuard(methodName);
  return repositoryFailure(
    REPOSITORY_ERROR_CODES.RPC_GUARD_NOT_DEPLOYED,
    `${methodName} requires server-side TT-1B version/idempotency enforcement before cloud mutation.`,
    {
      methodName,
      rpcName: guard.rpcName,
      sqlSection: guard.sqlSection,
    }
  );
}

export function __resetCloudRepositoryReplayCacheForTests() {
  replayCache.clear();
}

function replayStoreKey(tournamentId, idempotencyKey) {
  return `${tournamentId}::${idempotencyKey}`;
}

function readReplay(tournamentId, commandOptions, payload) {
  const stored = replayCache.get(replayStoreKey(tournamentId, commandOptions.idempotencyKey));
  return resolveIdempotencyReplay(
    { idempotencyKey: commandOptions.idempotencyKey, payload },
    stored
  );
}

function writeReplay(tournamentId, commandOptions, payload, result) {
  replayCache.set(replayStoreKey(tournamentId, commandOptions.idempotencyKey), {
    payloadHash: hashTeamTournamentPayload(payload),
    result,
  });
}

function withCommandParams(baseArgs, commandOptions) {
  return {
    ...baseArgs,
    expectedVersion: Number(commandOptions.expectedVersion),
    expectedLineupAVersion: Number(commandOptions.expectedLineupAVersion),
    expectedLineupBVersion: Number(commandOptions.expectedLineupBVersion),
    idempotencyKey: String(commandOptions.idempotencyKey),
  };
}

function withOverrideCommandParams(baseArgs, commandOptions) {
  return {
    ...baseArgs,
    expectedMatchupVersion: Number(commandOptions.expectedMatchupVersion),
    expectedLineupVersion: Number(commandOptions.expectedLineupVersion),
    idempotencyKey: String(commandOptions.idempotencyKey),
  };
}

async function runOverrideMutation(methodName, commandOptions, executor) {
  const validationError = validateOverrideCommandOptions(commandOptions, methodName);
  if (validationError) {
    return validationError;
  }
  const result = await executor(commandOptions);
  return normalizeRepositoryResult(result, { provider: "cloud" });
}

async function runVersionedMutation(methodName, commandOptions, executor) {
  const validationError = validateVersionedCommandOptions(commandOptions, methodName);
  if (validationError) {
    return validationError;
  }
  const result = await executor(commandOptions);
  return normalizeRepositoryResult(result, { provider: "cloud" });
}

/**
 * Cloud repository — target SSOT implementation.
 */
export function createCloudTeamTournamentRepository() {
  return {
    getProvider: () => "cloud",

    async getTournament(clubId, tournamentId, readOptions = {}) {
      const viewerError = rejectClientViewerTeamIdForCloud(readOptions, "cloud");
      if (viewerError) {
        return viewerError;
      }

      const result = await rpcTeamTournamentGetSetup(tournamentId, null);
      if (!result.ok) {
        // Create→detail / refresh safety: if cloud header is missing but the
        // hosting club blob already has the draft, serve local copy instead of
        // a hard NOT_FOUND (still cloud-primary; local is temporary fallback).
        const local = readLocalTournamentFallback(clubId, tournamentId);
        if (local) {
          const aggregate = mapTournamentToAggregate(local, "cloud");
          if (readOptions.includeSchedule === false) {
            aggregate.schedule = [];
          }
          return repositorySuccess(aggregate, {
            provider: "cloud",
            version: aggregate.version,
            serverTime: null,
            warnings: [
              {
                code: "CLOUD_SETUP_FALLBACK_BLOB",
                message:
                  result.error ||
                  "Cloud setup chưa có bản ghi — đang mở nháp local vừa tạo.",
              },
            ],
          });
        }
        return normalizeRepositoryResult(result, { provider: "cloud" });
      }

      const aggregate = mapTournamentToAggregate(result.tournament, "cloud");
      if (readOptions.includeSchedule === false) {
        aggregate.schedule = [];
      }

      const deadlineMeta = mapSetupDeadlineMeta(result);

      return repositorySuccess(aggregate, {
        provider: "cloud",
        version: aggregate.version,
        serverTime: result.serverTime ?? deadlineMeta?.serverTime ?? null,
        lineupDeadline: result.lineupDeadline ?? deadlineMeta?.lineupDeadline ?? null,
        canSaveDraft: result.canSaveDraft ?? deadlineMeta?.canSaveDraft ?? null,
        canSubmit: result.canSubmit ?? deadlineMeta?.canSubmit ?? null,
        deadlineStatus: result.deadlineStatus ?? deadlineMeta?.deadlineStatus ?? null,
        viewerTeamId: result.viewerTeamId ?? deadlineMeta?.viewerTeamId ?? null,
      });
    },

    async listTeams(clubId, tournamentId, readOptions) {
      const result = await this.getTournament(clubId, tournamentId, readOptions);
      if (!result.ok) {
        return result;
      }
      return repositorySuccess(result.data.teams, {
        provider: "cloud",
        version: result.version,
      });
    },

    async getMatchups(clubId, tournamentId, readOptions) {
      const result = await this.getTournament(clubId, tournamentId, readOptions);
      if (!result.ok) {
        return result;
      }
      return repositorySuccess(result.data.matchups, {
        provider: "cloud",
        version: result.version,
      });
    },

    async getVisibleLineups(_clubId, tournamentId, options) {
      const viewerError = rejectClientViewerTeamIdForCloud(options, "cloud");
      if (viewerError) {
        return viewerError;
      }

      if (!options?.matchupId) {
        return repositoryFailure(
          REPOSITORY_ERROR_CODES.INVALID_COMMAND_OPTIONS,
          "getVisibleLineups requires options.matchupId."
        );
      }

      const result = await rpcTeamTournamentGetVisibleLineups(
        tournamentId,
        options.matchupId,
        null
      );
      if (!result.ok) {
        return normalizeRepositoryResult(result, { provider: "cloud" });
      }

      return repositorySuccess(
        {
          lineups: result.lineups,
          matchupStatus: result.matchupStatus,
          requiresRepublish: result.requiresRepublish === true,
          serverTime: result.serverTime,
        },
        { provider: "cloud" }
      );
    },

    async saveDraftLineup(_clubId, tournamentId, payload, commandOptions) {
      const guardError = rejectUndeployedRpcGuard("saveDraftLineup");
      if (guardError) {
        return guardError;
      }

      return runVersionedMutation("saveDraftLineup", commandOptions, async (options) =>
        rpcTeamTournamentSaveLineupDraft(
          withCommandParams(
            {
              tournamentId,
              matchupId: payload.matchupId,
              teamId: payload.teamId,
              selections: payload.selections || {},
            },
            options
          )
        )
      );
    },

    async submitLineup(_clubId, tournamentId, payload, commandOptions) {
      return runVersionedMutation("submitLineup", commandOptions, async (options) =>
        rpcTeamTournamentSubmitLineup(
          withCommandParams(
            {
              tournamentId,
              matchupId: payload.matchupId,
              teamId: payload.teamId,
              selections: payload.selections || {},
            },
            options
          )
        )
      );
    },

    async lockLineup(_clubId, tournamentId, payload, commandOptions) {
      return runVersionedMutation("lockLineup", commandOptions, async (options) =>
        rpcTeamTournamentLockMatchup(
          withCommandParams({ tournamentId, matchupId: payload.matchupId }, options)
        )
      );
    },

    async publishLineups(_clubId, tournamentId, payload, commandOptions) {
      const validationError = validatePublishCommandOptions(commandOptions, "publishLineups");
      if (validationError) {
        return validationError;
      }
      return runVersionedMutation("publishLineups", commandOptions, async (options) =>
        rpcTeamTournamentPublishMatchup(
          withCommandParams({ tournamentId, matchupId: payload.matchupId }, options)
        )
      );
    },

    async randomizeLineup(_clubId, tournamentId, payload, commandOptions) {
      return runVersionedMutation("randomizeLineup", commandOptions, async (options) =>
        rpcTeamTournamentRandomizeLineup(
          withCommandParams(
            {
              tournamentId,
              matchupId: payload.matchupId,
              teamId: payload.teamId,
            },
            options
          )
        )
      );
    },

    async overrideLineup(_clubId, tournamentId, payload, commandOptions) {
      return runOverrideMutation("overrideLineup", commandOptions, async (options) =>
        rpcTeamTournamentOverrideLineup(
          withOverrideCommandParams(
            {
              tournamentId,
              matchupId: payload.matchupId,
              teamId: payload.teamId,
              selections: payload.selections || {},
              reason: payload.reason || "",
            },
            options
          )
        )
      );
    },

    async getLineupOverrideOps(_clubId, tournamentId, payload) {
      const result = await rpcTeamTournamentGetLineupOverrideOps(
        tournamentId,
        payload.matchupId,
        payload.teamId
      );
      return normalizeRepositoryResult(result, { provider: "cloud" });
    },

    async confirmSubMatchResult(_clubId, tournamentId, payload, commandOptions) {
      return runVersionedMutation("confirmSubMatchResult", commandOptions, async (options) =>
        rpcTeamTournamentConfirmSubMatch(
          withCommandParams(
            {
              tournamentId,
              matchupId: payload.matchupId,
              subMatchId: payload.subMatchId,
              score: payload.score,
              winnerTeamId: payload.winnerTeamId || null,
            },
            options
          )
        )
      );
    },

    async applyForfeit(_clubId, tournamentId, payload, commandOptions) {
      return runVersionedMutation("applyForfeit", commandOptions, async (options) =>
        rpcTeamTournamentApplyForfeit(
          withCommandParams(
            {
              tournamentId,
              matchupId: payload.matchupId,
              subMatchId: payload.subMatchId || null,
              forfeitingTeamId: payload.forfeitingTeamId || null,
              scope: payload.scope || "sub_match",
              resultType: payload.resultType || "forfeit",
              forfeitReason: payload.reason || payload.forfeitReason || "",
              reasonCode: payload.reasonCode || "",
              requestId: payload.requestId || null,
              technicalScore: payload.technicalScore || {},
            },
            options
          )
        )
      );
    },

    async withdrawTeam(_clubId, tournamentId, payload, commandOptions) {
      return runVersionedMutation("withdrawTeam", commandOptions, async (options) =>
        rpcTeamTournamentWithdrawTeam(
          withCommandParams(
            {
              tournamentId,
              teamId: payload.teamId,
              reason: payload.reason || "",
              reasonCode: payload.reasonCode || "team_withdrawal",
              requestId: payload.requestId || null,
            },
            options
          )
        )
      );
    },

    async provisionRefereeMatch(_clubId, tournamentId, payload, commandOptions) {
      return runVersionedMutation("provisionRefereeMatch", commandOptions, async (options) =>
        rpcTeamTournamentProvisionRefereeMatch(
          withCommandParams(
            {
              tournamentId,
              matchupId: payload.matchupId,
              subMatchId: payload.subMatchId,
              refereeAssignmentId: payload.refereeAssignmentId,
              expectedSubMatchVersion: payload.expectedSubMatchVersion ?? payload.subMatchVersion ?? null,
              reason: payload.reason || "tt5b_provision",
              source: payload.source || "repository",
            },
            options
          )
        )
      );
    },

    async revokeRefereeLink(_clubId, tournamentId, payload, commandOptions) {
      return runVersionedMutation("revokeRefereeLink", commandOptions, async (options) =>
        rpcTeamTournamentRevokeRefereeLink(
          withCommandParams(
            {
              tournamentId,
              subMatchId: payload.subMatchId,
              reason: payload.reason || "",
              expectedLinkVersion: payload.expectedLinkVersion ?? payload.linkVersion ?? null,
            },
            options
          )
        )
      );
    },

    async resyncRefereeLink(_clubId, tournamentId, payload, commandOptions) {
      return runVersionedMutation("resyncRefereeLink", commandOptions, async (options) =>
        rpcTeamTournamentResyncRefereeLink(
          withCommandParams(
            {
              tournamentId,
              subMatchId: payload.subMatchId,
              reason: payload.reason || "tt5c_resync",
              expectedLinkVersion: payload.expectedLinkVersion ?? payload.linkVersion ?? null,
            },
            options
          )
        )
      );
    },

    async completeMatchup(_clubId, _tournamentId, _payload, commandOptions) {
      const validationError = validateVersionedCommandOptions(
        commandOptions,
        "completeMatchup"
      );
      if (validationError) {
        return validationError;
      }
      return notImplemented("completeMatchup");
    },

    async getStandings(_clubId, tournamentId) {
      const result = await rpcTeamTournamentGetStandings(tournamentId);
      if (!result.ok) {
        return normalizeRepositoryResult(result, { provider: "cloud" });
      }
      return repositorySuccess(result.standings || result.data || [], { provider: "cloud" });
    },

    async recalculateStandings(_clubId, tournamentId, commandOptions) {
      const guardError = rejectUndeployedRpcGuard("recalculateStandings");
      if (guardError) {
        return guardError;
      }

      const validationError = validateVersionedCommandOptions(
        commandOptions,
        "recalculateStandings"
      );
      if (validationError) {
        return validationError;
      }

      const setup = await rpcTeamTournamentGetSetup(tournamentId, null);
      if (!setup.ok || !setup.tournament) {
        return normalizeRepositoryResult(setup, { provider: "cloud" });
      }

      const computed = computeTeamStandings(setup.tournament.teamData || {});
      const standings = computed.standings || [];
      const calculationVersion = hashTeamTournamentPayload(standings);
      const replayPayload = { standings, calculationVersion };

      const replay = readReplay(tournamentId, commandOptions, replayPayload);
      if (replay.action === "reject") {
        return repositoryFailure(replay.code, replay.error, { provider: "cloud" });
      }
      if (replay.action === "replay") {
        return repositorySuccess(replay.result.data, {
          provider: "cloud",
          replayed: true,
          version: replay.result.version,
        });
      }

      const rpcResult = await rpcTeamTournamentUpsertStandings(
        withCommandParams({ tournamentId, standings }, commandOptions)
      );
      if (!rpcResult.ok) {
        return normalizeRepositoryResult(rpcResult, { provider: "cloud" });
      }

      const success = repositorySuccess(
        { standings, calculationVersion },
        {
          provider: "cloud",
          version: setup.tournament.version ?? rpcResult.version,
          replayed: rpcResult.replayed === true,
        }
      );

      writeReplay(tournamentId, commandOptions, replayPayload, success);
      return success;
    },

    async subscribeTournament(clubId, tournamentId, handlers = {}) {
      return subscribeCloudTournament(this, clubId, tournamentId, handlers);
    },
  };
}
