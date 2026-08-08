/**
 * Canonical Tournament read model — async cloud reader authority.
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

export async function listTournamentsQuery(clubId, filters = {}, options = {}) {
  const repo = options.repository || getTournamentRepository();
  const result = await repo.list(clubId, filters);
  if (!result.ok) {
    return { ok: false, ...result, tournaments: [] };
  }
  return {
    ok: true,
    tournaments: (result.tournaments || []).map(toReadModel),
  };
}

export async function listMyTournamentsQuery(clubId, filters = {}, options = {}) {
  const repo = options.repository || getTournamentRepository();
  const result = await repo.listMine(clubId, filters);
  if (!result.ok) {
    return { ok: false, ...result, tournaments: [] };
  }
  return {
    ok: true,
    tournaments: (result.tournaments || []).map(toReadModel),
  };
}

export async function getTournamentQuery(clubId, tournamentId, options = {}) {
  const repo = options.repository || getTournamentRepository();
  const result = await repo.get(clubId, tournamentId);
  if (!result.ok) {
    return { ok: false, ...result, tournament: null };
  }
  return { ok: true, tournament: toReadModel(result.tournament) };
}

export async function listOpenTournamentsQuery(clubId, options = {}) {
  const result = await listTournamentsQuery(clubId, {}, options);
  if (!result.ok) return result;
  const open = new Set([
    TOURNAMENT_STATUS.ACTIVE,
    TOURNAMENT_STATUS.READY,
    TOURNAMENT_STATUS.REGISTRATION,
  ]);
  return {
    ok: true,
    tournaments: result.tournaments.filter((item) => open.has(item.status)),
  };
}

export async function buildTournamentHubStats(clubId, options = {}) {
  const result = await listTournamentsQuery(clubId, {}, options);
  if (!result.ok) {
    return { ok: false, ...result, total: 0, open: 0, draft: 0, completed: 0 };
  }
  const all = result.tournaments;
  return {
    ok: true,
    total: all.length,
    open: all.filter((item) =>
      [TOURNAMENT_STATUS.ACTIVE, TOURNAMENT_STATUS.READY, TOURNAMENT_STATUS.REGISTRATION].includes(
        item.status
      )
    ).length,
    draft: all.filter((item) => item.status === TOURNAMENT_STATUS.DRAFT).length,
    completed: all.filter((item) => item.status === TOURNAMENT_STATUS.COMPLETED).length,
  };
}
