import { loadClubData, saveClubData } from "../../../domain/clubStorage.js";
import { attachTeamDataToTournament, isTeamTournament } from "../engines/teamTournamentEngine.js";

/**
 * Mirror cloud-authoritative aggregate to local blob (compatibility backup only).
 * Failure is logged — does not rollback cloud success.
 * @param {string} clubId
 * @param {import('../repositories/teamTournamentRepositoryTypes.js').TournamentAggregate} aggregate
 * @param {{ logger?: Console }} [options]
 */
export function mirrorAggregateToBlob(clubId, aggregate, options = {}) {
  const logger = options.logger || console;

  if (!clubId || !aggregate?.id) {
    return { ok: false, warning: "mirror skipped: missing clubId or tournament id" };
  }

  try {
    const data = loadClubData(clubId);
    const tournaments = data.tournaments || [];
    const index = tournaments.findIndex((item) => String(item.id) === String(aggregate.id));

    const shell = attachTeamDataToTournament(
      {
        id: aggregate.id,
        clubId: aggregate.clubId || clubId,
        tenantId: aggregate.tenantId,
        mode: aggregate.mode,
        status: aggregate.status,
        version: aggregate.version,
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

    if (!isTeamTournament(shell)) {
      return { ok: false, warning: "mirror skipped: not a team tournament" };
    }

    if (index >= 0) {
      tournaments[index] = { ...tournaments[index], ...shell };
    } else {
      tournaments.push(shell);
    }

    data.tournaments = tournaments;
    saveClubData(clubId, data);
    return { ok: true };
  } catch (error) {
    logger.warn("[TT-1C] blob mirror failed (cloud remains authoritative):", error?.message || error);
    return { ok: false, warning: String(error?.message || error) };
  }
}
