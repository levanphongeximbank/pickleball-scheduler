import { guardClubAction } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { getCurrentUser } from "../../../auth/authService.js";
import { loadClubData, saveClubData } from "../../../domain/clubStorage.js";
import { guardClubTenant } from "../../tenant/guards/tenantGuard.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import { normalizeTournaments } from "../../../models/tournament/index.js";
import { getClubMembers, getClubMembersForTournamentInvite } from "./clubMemberService.js";
import { getClubById as getRegistryClubById } from "../../../domain/clubService.js";
import { getTenantPlayers, getTenantPlayersAware } from "./clubTenantService.js";
import { CLUB_MEMBER_STATUSES } from "../constants/clubMemberRoles.js";
import { CLUB_STATUSES } from "../constants/clubStatus.js";
import { isCanonicalPlayerRepositoryEnabled } from "../config/canonicalRepositoryFlags.js";
import { listPlayersForClubAware } from "../repositories/canonicalPlayerPickerAdapter.js";

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
  const club = getRegistryClubById(clubId);
  if (club?.status === CLUB_STATUSES.PENDING_SETUP) {
    return { ok: false, error: "CLB chưa có Chủ tịch — không thể tạo giải nội bộ." };
  }
  if (club?.status === CLUB_STATUSES.PENDING_APPROVAL) {
    return { ok: false, error: "CLB chưa được chủ sân duyệt — không thể tạo giải nội bộ." };
  }

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

export function getClubInternalTournamentPlayerPool(clubId, tenantId, options = {}) {
  const useInviteBypass = options.forTournamentInvite === true;
  const members = (useInviteBypass
    ? getClubMembersForTournamentInvite(clubId, tenantId)
    : getClubMembers(clubId, tenantId)
  ).filter((m) => m.status === CLUB_MEMBER_STATUSES.ACTIVE);
  return members.map((m) => m.playerId);
}

export function getClubInternalTournamentPlayers(clubId, tenantId, options = {}) {
  const poolIds = new Set(getClubInternalTournamentPlayerPool(clubId, tenantId, options));
  return getTenantPlayers(tenantId).filter((p) => poolIds.has(p.id));
}

/**
 * Flag-aware club_internal participant pool.
 * Canonical ON: active membership SSOT for the club (no blob dependence).
 * Canonical OFF: legacy member ids ∩ tenant blob players.
 */
export async function getClubInternalTournamentPlayersAware(clubId, tenantId, options = {}) {
  if (!isCanonicalPlayerRepositoryEnabled(options.envSource)) {
    const legacy = getClubInternalTournamentPlayers(clubId, tenantId, options);
    return {
      ok: true,
      data: legacy,
      legacyPlayers: legacy,
      selectablePlayers: legacy,
      source: "legacy_blob",
      warnings: [],
      mappingSummary: {
        mappedPlayers: legacy.length,
        unmappedMembers: 0,
        activeMembers: legacy.length,
      },
    };
  }

  // Membership SSOT for the club — do not substitute tenantId for clubId
  const result = await listPlayersForClubAware(clubId, {
    tenantId,
    userContext: options.userContext,
    profilesByUserId: options.profilesByUserId,
  });
  if (!result.ok) return result;

  return {
    ...result,
    data: result.legacyPlayers || [],
  };
}

/** Tenant-wide official/open picker pool (async, flag-aware). */
export async function getTournamentParticipantPlayersAware(tenantId, options = {}) {
  return getTenantPlayersAware(tenantId, options);
}
