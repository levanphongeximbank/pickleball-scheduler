import { createBlobTeamTournamentRepository } from "./blobTeamTournamentRepository.js";
import { createCloudTeamTournamentRepository } from "./cloudTeamTournamentRepository.js";
import {
  compareTeamTournamentSnapshots,
  logShadowMismatches,
} from "./teamTournamentCompare.js";
import { mapTournamentToAggregate } from "./teamTournamentRepositoryAggregate.js";
import {
  normalizeRepositoryResult,
  rejectClientViewerTeamIdForCloud,
  repositorySuccess,
  validateVersionedCommandOptions,
} from "./TeamTournamentRepository.interface.js";

/**
 * Shadow repository: blob read for UI compat + cloud read for compare logging.
 */
export function createShadowTeamTournamentRepository(options = {}) {
  const blob = createBlobTeamTournamentRepository();
  const cloud = createCloudTeamTournamentRepository();
  const logger = options.logger || console;

  async function delegateMutation(methodName, clubId, tournamentId, payload, commandOptions) {
    const validationError = validateVersionedCommandOptions(commandOptions, methodName);
    if (validationError) {
      return validationError;
    }
    return cloud[methodName](clubId, tournamentId, payload, commandOptions);
  }

  return {
    getProvider: () => "shadow",

    async getTournament(clubId, tournamentId, readOptions = {}) {
      const viewerError = rejectClientViewerTeamIdForCloud(readOptions, "shadow");
      if (viewerError) {
        return viewerError;
      }

      const blobResult = await blob.getTournament(clubId, tournamentId, readOptions);
      const cloudResult = await cloud.getTournament(clubId, tournamentId, readOptions).catch(
        (error) => ({ ok: false, error: error.message })
      );

      if (blobResult.ok && cloudResult.ok) {
        const compare = compareTeamTournamentSnapshots(
          blobResult.data?.teamData,
          cloudResult.data?.teamData
        );
        if (!compare.ok) {
          logShadowMismatches(tournamentId, compare, logger);
        }
        return repositorySuccess(
          {
            ...blobResult.data,
            shadow: {
              compared: true,
              mismatchCount: compare.mismatches.length,
              mismatches: compare.mismatches,
            },
          },
          {
            provider: "shadow",
            version: blobResult.data.version,
            details: {
              cloudAggregate: mapTournamentToAggregate(cloudResult.data, "cloud"),
            },
          }
        );
      }

      if (blobResult.ok) {
        logger.warn?.(
          `[team-tournament shadow] cloud read failed tournament=${tournamentId}: ${cloudResult.error || cloudResult.code}`
        );
        return repositorySuccess(blobResult.data, { provider: "shadow" });
      }

      return blobResult;
    },

    async listTeams(clubId, tournamentId, readOptions) {
      return blob.listTeams(clubId, tournamentId, readOptions);
    },

    async getMatchups(clubId, tournamentId, readOptions) {
      return blob.getMatchups(clubId, tournamentId, readOptions);
    },

    async getVisibleLineups(clubId, tournamentId, options) {
      const viewerError = rejectClientViewerTeamIdForCloud(options, "shadow");
      if (viewerError) {
        return viewerError;
      }

      const cloudVisible = await cloud.getVisibleLineups(clubId, tournamentId, options);
      if (cloudVisible.ok) {
        return cloudVisible;
      }
      return blob.getVisibleLineups(clubId, tournamentId, options);
    },

    saveDraftLineup(clubId, tournamentId, payload, commandOptions) {
      return delegateMutation("saveDraftLineup", clubId, tournamentId, payload, commandOptions);
    },
    submitLineup(clubId, tournamentId, payload, commandOptions) {
      return delegateMutation("submitLineup", clubId, tournamentId, payload, commandOptions);
    },
    lockLineup(clubId, tournamentId, payload, commandOptions) {
      return delegateMutation("lockLineup", clubId, tournamentId, payload, commandOptions);
    },
    publishLineups(clubId, tournamentId, payload, commandOptions) {
      return delegateMutation("publishLineups", clubId, tournamentId, payload, commandOptions);
    },
    randomizeLineup(clubId, tournamentId, payload, commandOptions) {
      return delegateMutation("randomizeLineup", clubId, tournamentId, payload, commandOptions);
    },
    confirmSubMatchResult(clubId, tournamentId, payload, commandOptions) {
      return delegateMutation(
        "confirmSubMatchResult",
        clubId,
        tournamentId,
        payload,
        commandOptions
      );
    },
    applyForfeit(clubId, tournamentId, payload, commandOptions) {
      return delegateMutation("applyForfeit", clubId, tournamentId, payload, commandOptions);
    },
    withdrawTeam(clubId, tournamentId, payload, commandOptions) {
      return delegateMutation("withdrawTeam", clubId, tournamentId, payload, commandOptions);
    },
    provisionRefereeMatch(clubId, tournamentId, payload, commandOptions) {
      return delegateMutation("provisionRefereeMatch", clubId, tournamentId, payload, commandOptions);
    },
    revokeRefereeLink(clubId, tournamentId, payload, commandOptions) {
      return delegateMutation("revokeRefereeLink", clubId, tournamentId, payload, commandOptions);
    },
    resyncRefereeLink(clubId, tournamentId, payload, commandOptions) {
      return delegateMutation("resyncRefereeLink", clubId, tournamentId, payload, commandOptions);
    },
    completeMatchup(clubId, tournamentId, payload, commandOptions) {
      return delegateMutation("completeMatchup", clubId, tournamentId, payload, commandOptions);
    },

    async getStandings(clubId, tournamentId, readOptions) {
      const result = await cloud.getStandings(clubId, tournamentId, readOptions);
      return normalizeRepositoryResult(result, { provider: "shadow" });
    },

    recalculateStandings(clubId, tournamentId, commandOptions) {
      return cloud.recalculateStandings(clubId, tournamentId, commandOptions);
    },

    subscribeTournament(clubId, tournamentId, handlers) {
      return cloud.subscribeTournament(clubId, tournamentId, handlers);
    },

    executeSetupMutation(params = {}) {
      return cloud.executeSetupMutation(params);
    },
  };
}
