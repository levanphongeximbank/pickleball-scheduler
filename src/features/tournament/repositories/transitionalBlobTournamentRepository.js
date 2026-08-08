/**
 * TEMPORARY transitional repository — wraps legacy club-blob tournamentService.
 *
 * REMOVAL PATH:
 * 1. Apply live SQL package: docs/v5/qa-evidence/tournament-canonical-runtime-cutover-01/
 *    migrations under docs/.../06_LIVE_CUTOVER_PACKAGE.md
 * 2. Set VITE_TOURNAMENT_CANONICAL_DATA_MODE=cloud
 * 3. Delete this file and factory transitional branch
 *
 * Canonical pages MUST import via tournamentQueries/Commands — not this module.
 */
import {
  createTournament,
  deleteTournament,
  getTournament,
  listTournaments,
  updateTournament,
} from "../../../domain/tournamentService.js";
import { getExplicitTenantIdForClub } from "../../tenant/guards/tenantGuard.js";
import {
  TOURNAMENT_REPO_ERROR,
  TOURNAMENT_REPOSITORY_KINDS,
} from "./TournamentRepository.interface.js";

function requireClubId(clubId) {
  const id = String(clubId || "").trim();
  if (!id) {
    return {
      ok: false,
      code: TOURNAMENT_REPO_ERROR.MISSING_CLUB,
      error: "Thiếu CLB — không thể thao tác giải đấu.",
    };
  }
  return { ok: true, clubId: id };
}

/**
 * Fail-closed tenant resolution for canonical writes.
 * Never invents default-tenant.
 */
export function requireExplicitTenantForClub(clubId) {
  const clubCheck = requireClubId(clubId);
  if (!clubCheck.ok) return clubCheck;

  const tenantId = getExplicitTenantIdForClub(clubCheck.clubId);
  if (!tenantId || tenantId === "default-tenant" || tenantId === "default") {
    return {
      ok: false,
      code: TOURNAMENT_REPO_ERROR.MISSING_TENANT,
      error: "CLB chưa có tenant hợp lệ — không dùng default-tenant.",
    };
  }
  return { ok: true, clubId: clubCheck.clubId, tenantId };
}

function matchesMine(tournament, playerId) {
  if (!playerId || !tournament) return false;
  const pid = String(playerId);
  if (String(tournament.createdBy || "") === pid) return true;
  if (String(tournament.ownerPlayerId || "") === pid) return true;

  const entries = tournament.events?.flatMap((event) => event.entries || []) || [];
  if (entries.some((entry) => String(entry.playerId || entry.id || "") === pid)) {
    return true;
  }

  const teamMembers =
    tournament.teamData?.teams?.flatMap((team) => team.members || []) || [];
  if (teamMembers.some((member) => String(member.playerId || member.id || "") === pid)) {
    return true;
  }

  return false;
}

export function createTransitionalBlobTournamentRepository() {
  return {
    kind: TOURNAMENT_REPOSITORY_KINDS.TRANSITIONAL_BLOB,

    list(clubId, filters = {}) {
      const clubCheck = requireClubId(clubId);
      if (!clubCheck.ok) return [];
      return listTournaments(clubCheck.clubId, filters);
    },

    get(clubId, tournamentId) {
      const clubCheck = requireClubId(clubId);
      if (!clubCheck.ok) return null;
      return getTournament(clubCheck.clubId, tournamentId);
    },

    listMine(clubId, filters = {}) {
      const playerId = String(filters.playerId || "").trim();
      const all = this.list(clubId, filters);
      if (!playerId) return all;
      return all.filter((tournament) => matchesMine(tournament, playerId));
    },

    create(clubId, options = {}) {
      const tenantCheck = requireExplicitTenantForClub(clubId);
      if (!tenantCheck.ok) return tenantCheck;

      return createTournament(tenantCheck.clubId, {
        ...options,
        tenantId: tenantCheck.tenantId,
      });
    },

    update(clubId, tournamentId, patch = {}, options = {}) {
      const clubCheck = requireClubId(clubId);
      if (!clubCheck.ok) return clubCheck;
      return updateTournament(clubCheck.clubId, tournamentId, patch, options);
    },

    delete(clubId, tournamentId) {
      const clubCheck = requireClubId(clubId);
      if (!clubCheck.ok) return clubCheck;
      return deleteTournament(clubCheck.clubId, tournamentId);
    },

    /**
     * Single explicit EngineV4 persist path into tournament authority.
     * Engine remains contextual computation; this is the only apply writer.
     */
    applyEngineState(clubId, tournamentId, engineState = {}, options = {}) {
      const clubCheck = requireClubId(clubId);
      if (!clubCheck.ok) return clubCheck;

      const current = getTournament(clubCheck.clubId, tournamentId);
      if (!current) {
        return {
          ok: false,
          code: TOURNAMENT_REPO_ERROR.NOT_FOUND,
          error: "Không tìm thấy giải.",
        };
      }

      const nextSettings = {
        ...(current.settings && typeof current.settings === "object" ? current.settings : {}),
        engineV4: engineState,
      };

      const patch = { settings: nextSettings };
      if (Array.isArray(engineState.events)) {
        patch.events = engineState.events;
      }

      return updateTournament(clubCheck.clubId, tournamentId, patch, {
        ...options,
        engineApply: true,
      });
    },
  };
}
