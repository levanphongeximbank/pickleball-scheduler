/**
 * Canonical Tournament read model — single reader authority for list/my/hub.
 */
import { getTournamentRepository } from "../repositories/tournamentRepositoryFactory.js";
import { modeLabelVi, statusLabelVi } from "../constants/tournamentLabels.js";
import { TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";

function toReadModel(tournament) {
  if (!tournament) return null;
  return {
    ...tournament,
    modeLabel: modeLabelVi(tournament.mode),
    statusLabel: statusLabelVi(tournament.status),
  };
}

/**
 * @param {string} clubId
 * @param {object} [filters]
 * @param {{ repository?: object }} [options]
 */
export function listTournamentsQuery(clubId, filters = {}, options = {}) {
  const repo = options.repository || getTournamentRepository();
  return (repo.list(clubId, filters) || []).map(toReadModel);
}

/**
 * Same reader authority as list — filtered to "mine".
 */
export function listMyTournamentsQuery(clubId, filters = {}, options = {}) {
  const repo = options.repository || getTournamentRepository();
  return (repo.listMine(clubId, filters) || []).map(toReadModel);
}

export function getTournamentQuery(clubId, tournamentId, options = {}) {
  const repo = options.repository || getTournamentRepository();
  return toReadModel(repo.get(clubId, tournamentId));
}

export function listOpenTournamentsQuery(clubId, options = {}) {
  const open = new Set([
    TOURNAMENT_STATUS.ACTIVE,
    TOURNAMENT_STATUS.READY,
    TOURNAMENT_STATUS.REGISTRATION,
  ]);
  return listTournamentsQuery(clubId, {}, options).filter((item) => open.has(item.status));
}

export function buildTournamentHubStats(clubId, options = {}) {
  const all = listTournamentsQuery(clubId, {}, options);
  const open = all.filter((item) =>
    [TOURNAMENT_STATUS.ACTIVE, TOURNAMENT_STATUS.READY, TOURNAMENT_STATUS.REGISTRATION].includes(
      item.status
    )
  );
  return {
    total: all.length,
    open: open.length,
    draft: all.filter((item) => item.status === TOURNAMENT_STATUS.DRAFT).length,
    completed: all.filter((item) => item.status === TOURNAMENT_STATUS.COMPLETED).length,
  };
}
