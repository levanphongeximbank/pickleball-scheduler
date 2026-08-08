/**
 * Canonical Tournament read model — async cloud reader authority.
 */
import { getTournamentRepository } from "../repositories/tournamentRepositoryFactory.js";
import { modeLabelVi, statusLabelVi } from "../constants/tournamentLabels.js";
import { TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import { resolveTournamentTenantScope } from "../guards/tournamentTenant.js";

function toReadModel(tournament) {
  if (!tournament) return null;
  return {
    ...tournament,
    modeLabel: modeLabelVi(tournament.mode),
    statusLabel: statusLabelVi(tournament.status),
  };
}

function withTenantOptions(clubIdOrScope, options = {}) {
  const scope = resolveTournamentTenantScope(clubIdOrScope, options);
  if (!scope.ok) {
    return { ok: false, scope, repoOptions: options };
  }
  return {
    ok: true,
    scope,
    repoOptions: { ...options, tenantId: scope.tenantId },
    clubId: scope.clubId,
  };
}

export async function listTournamentsQuery(clubIdOrScope, filters = {}, options = {}) {
  const prepared = withTenantOptions(clubIdOrScope, options);
  if (!prepared.ok) {
    return { ok: false, ...prepared.scope, tournaments: [] };
  }
  const repo = options.repository || getTournamentRepository();
  const result = await repo.list(prepared.clubId, filters, prepared.repoOptions);
  if (!result.ok) {
    return { ok: false, ...result, tournaments: [] };
  }
  return {
    ok: true,
    tournaments: (result.tournaments || []).map(toReadModel),
  };
}

export async function listMyTournamentsQuery(clubIdOrScope, filters = {}, options = {}) {
  const prepared = withTenantOptions(clubIdOrScope, options);
  if (!prepared.ok) {
    return { ok: false, ...prepared.scope, tournaments: [] };
  }
  const repo = options.repository || getTournamentRepository();
  const result = await repo.listMine(prepared.clubId, filters, prepared.repoOptions);
  if (!result.ok) {
    return { ok: false, ...result, tournaments: [] };
  }
  return {
    ok: true,
    tournaments: (result.tournaments || []).map(toReadModel),
  };
}

export async function getTournamentQuery(clubIdOrScope, tournamentId, options = {}) {
  const prepared = withTenantOptions(clubIdOrScope, options);
  if (!prepared.ok) {
    return { ok: false, ...prepared.scope, tournament: null };
  }
  const repo = options.repository || getTournamentRepository();
  const result = await repo.get(prepared.clubId, tournamentId, prepared.repoOptions);
  if (!result.ok) {
    return { ok: false, ...result, tournament: null };
  }
  return { ok: true, tournament: toReadModel(result.tournament) };
}

export async function listOpenTournamentsQuery(clubIdOrScope, options = {}) {
  const result = await listTournamentsQuery(clubIdOrScope, {}, options);
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

export async function buildTournamentHubStats(clubIdOrScope, options = {}) {
  const result = await listTournamentsQuery(clubIdOrScope, {}, options);
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
