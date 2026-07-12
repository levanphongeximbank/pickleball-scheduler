import { loadClubData } from "../../../domain/clubStorage.js";
import { getTeamData, isTeamTournament } from "../engines/teamTournamentEngine.js";
import { getVisibleLineup } from "../engines/lineupEngine.js";
import { computeTeamStandings } from "../engines/teamStandingsEngine.js";
import { hashTeamTournamentPayload } from "./teamTournamentIdempotency.js";
import { mapTournamentToAggregate } from "./teamTournamentRepositoryAggregate.js";
import {
  notImplemented,
  notImplementedSubscriptionResult,
  normalizeRepositoryResult,
  repositoryFailure,
  repositorySuccess,
  validateVersionedCommandOptions,
} from "./TeamTournamentRepository.interface.js";
import { REPOSITORY_ERROR_CODES } from "./teamTournamentRepositoryTypes.js";

function findBlobTournament(clubId, tournamentId) {
  const data = loadClubData(clubId);
  const tournament = (data.tournaments || []).find(
    (item) => String(item.id) === String(tournamentId)
  );
  if (!tournament || !isTeamTournament(tournament)) {
    return null;
  }
  return tournament;
}

async function guardedMutation(methodName, commandOptions) {
  const validationError = validateVersionedCommandOptions(commandOptions, methodName);
  if (validationError) {
    return validationError;
  }
  return notImplemented(methodName);
}

/**
 * Legacy blob adapter — read path + mutation contract validation.
 */
export function createBlobTeamTournamentRepository() {
  return {
    getProvider: () => "blob",

    async getTournament(clubId, tournamentId, readOptions = {}) {
      const tournament = findBlobTournament(clubId, tournamentId);
      if (!tournament) {
        return repositoryFailure(
          REPOSITORY_ERROR_CODES.NOT_FOUND,
          "Không tìm thấy giải đồng đội."
        );
      }

      const aggregate = mapTournamentToAggregate(
        {
          ...tournament,
          teamData: getTeamData(tournament),
        },
        "blob"
      );

      if (readOptions.includeSchedule === false) {
        aggregate.schedule = [];
      }

      return repositorySuccess(aggregate, { provider: "blob" });
    },

    async listTeams(clubId, tournamentId, readOptions) {
      const result = await this.getTournament(clubId, tournamentId, readOptions);
      if (!result.ok) {
        return result;
      }
      return repositorySuccess(result.data.teams, { provider: "blob" });
    },

    async getMatchups(clubId, tournamentId, readOptions) {
      const result = await this.getTournament(clubId, tournamentId, readOptions);
      if (!result.ok) {
        return result;
      }
      return repositorySuccess(result.data.matchups, { provider: "blob" });
    },

    async getVisibleLineups(clubId, tournamentId, options) {
      if (!options?.matchupId) {
        return repositoryFailure(
          REPOSITORY_ERROR_CODES.INVALID_COMMAND_OPTIONS,
          "getVisibleLineups requires options.matchupId."
        );
      }

      const result = await this.getTournament(clubId, tournamentId, options);
      if (!result.ok) {
        return result;
      }

      const visible = getVisibleLineup(result.data.teamData, {
        matchupId: options.matchupId,
        viewerTeamId: options.viewerTeamId || null,
        isOrganizer: false,
      });

      if (!visible.ok) {
        return normalizeRepositoryResult(visible, { provider: "blob" });
      }

      return repositorySuccess(
        {
          own: visible.ownLineup,
          opponent: visible.opponentLineup,
          submissionStatus: visible.submissionStatus,
        },
        { provider: "blob" }
      );
    },

    async saveDraftLineup(_clubId, _tournamentId, _payload, commandOptions) {
      return guardedMutation("saveDraftLineup", commandOptions);
    },
    async submitLineup(_clubId, _tournamentId, _payload, commandOptions) {
      return guardedMutation("submitLineup", commandOptions);
    },
    async lockLineup(_clubId, _tournamentId, _payload, commandOptions) {
      return guardedMutation("lockLineup", commandOptions);
    },
    async publishLineups(_clubId, _tournamentId, _payload, commandOptions) {
      return guardedMutation("publishLineups", commandOptions);
    },
    async randomizeLineup(_clubId, _tournamentId, _payload, commandOptions) {
      return guardedMutation("randomizeLineup", commandOptions);
    },
    async confirmSubMatchResult(_clubId, _tournamentId, _payload, commandOptions) {
      return guardedMutation("confirmSubMatchResult", commandOptions);
    },
    async applyForfeit(_clubId, _tournamentId, _payload, commandOptions) {
      return guardedMutation("applyForfeit", commandOptions);
    },
    async completeMatchup(_clubId, _tournamentId, _payload, commandOptions) {
      return guardedMutation("completeMatchup", commandOptions);
    },

    async getStandings(clubId, tournamentId, readOptions) {
      const result = await this.getTournament(clubId, tournamentId, readOptions);
      if (!result.ok) {
        return result;
      }
      return repositorySuccess(result.data.standings, { provider: "blob" });
    },

    async recalculateStandings(clubId, tournamentId, commandOptions) {
      const validationError = validateVersionedCommandOptions(
        commandOptions,
        "recalculateStandings"
      );
      if (validationError) {
        return validationError;
      }

      const result = await this.getTournament(clubId, tournamentId);
      if (!result.ok) {
        return result;
      }

      const computed = computeTeamStandings(result.data.teamData);
      const standings = computed.standings || [];
      const calculationVersion = hashTeamTournamentPayload(standings);

      return repositorySuccess(
        { standings, calculationVersion },
        { provider: "blob", version: result.data.version }
      );
    },

    async subscribeTournament() {
      return notImplementedSubscriptionResult();
    },
  };
}
