import { guardClubAction } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { getCurrentUser } from "../../../auth/authService.js";
import { loadClubData, saveClubData } from "../../../domain/clubStorage.js";
import { guardClubTenant } from "../../tenant/guards/tenantGuard.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import { normalizeTournaments } from "../../../models/tournament/index.js";
import { getClubMembers } from "./clubMemberService.js";
import { getTenantPlayers } from "./clubTenantService.js";
import { CLUB_MEMBER_STATUSES } from "../constants/clubMemberRoles.js";

export function getClubTournaments(clubId, tenantId) {
  if (tenantId) {
    const check = guardClubTenant(clubId, tenantId);
    if (!check.ok) {
      return [];
    }
  }

  const data = loadClubData(clubId);
  return (data.tournaments || []).filter(
    (t) =>
      t.clubId === clubId &&
      (t.type === "club_internal" || t.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT)
  );
}

export function createClubInternalTournament(clubId, data = {}, tenantId) {
  const check = guardClubAction(clubId, PERMISSIONS.TOURNAMENT_CREATE);
  if (!check.ok) {
    return check;
  }

  if (tenantId) {
    const tenantCheck = guardClubTenant(clubId, tenantId);
    if (!tenantCheck.ok) {
      return tenantCheck;
    }
  }

  const name = String(data.name || "").trim();
  if (!name) {
    return { ok: false, error: "Tên giải bắt buộc." };
  }

  const user = getCurrentUser();
  const now = new Date().toISOString();
  const tournamentId = data.id || `club-internal-${clubId}-${Date.now()}`;

  const tournament = {
    id: tournamentId,
    clubId,
    tenantId,
    seasonId: data.seasonId || null,
    leagueId: data.leagueId || null,
    name,
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    type: "club_internal",
    status: TOURNAMENT_STATUS.DRAFT,
    events: data.events || [],
    settings: data.settings || {},
    createdByUserId: user?.id || null,
    createdAt: now,
    updatedAt: now,
  };

  const clubData = loadClubData(clubId);
  const tournaments = normalizeTournaments([...(clubData.tournaments || []), tournament]);
  saveClubData(clubId, { ...clubData, tournaments });

  return { ok: true, tournament };
}

export function getClubInternalTournamentPlayerPool(clubId, tenantId) {
  const members = getClubMembers(clubId, tenantId).filter(
    (m) => m.status === CLUB_MEMBER_STATUSES.ACTIVE
  );
  return members.map((m) => m.playerId);
}

export function getClubInternalTournamentPlayers(clubId, tenantId) {
  const poolIds = new Set(getClubInternalTournamentPlayerPool(clubId, tenantId));
  return getTenantPlayers(tenantId).filter((p) => poolIds.has(p.id));
}
