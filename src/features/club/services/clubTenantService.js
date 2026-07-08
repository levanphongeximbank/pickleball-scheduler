import { loadClubs, saveClubs } from "../../../data/club.js";
import { loadClubData, loadClubData as initClubData } from "../../../domain/clubStorage.js";
import { getClubById as getRegistryClubById, updateClubMeta } from "../../../domain/clubService.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { guardClubAction, guardPermission } from "../../../auth/guardAction.js";
import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import { ROLES, isGlobalRole, isVenueScopedRole } from "../../../auth/roles.js";
import { loadActiveTenantId } from "../../../data/tenantSession.js";
import { resolveEffectiveTenantId } from "../../tenant/services/tenantService.js";
import { guardMaxClubs } from "../../../auth/subscriptionGuard.js";
import { guardClubTenant, listClubsForTenant } from "../../tenant/guards/tenantGuard.js";
import { createClubRecord } from "../../../models/club.js";
import { loadClubExtension, purgeClubExtension } from "../storage/clubExtensionStorage.js";
import { CLUB_STATUSES } from "../constants/clubStatus.js";
import { canUserViewClub } from "./clubAccessService.js";
import { resolveGovernanceForCreate, canSelfRegisterClub } from "./clubGovernanceService.js";

function resolveTenantIdForCreate(user) {
  if (!isRbacEnabled() || !user) {
    return null;
  }

  if (isGlobalRole(user.role)) {
    return loadActiveTenantId() || resolveEffectiveTenantId(user);
  }

  if (
    user.venueId ||
    user.tenantId ||
    isVenueScopedRole(user.role) ||
    user.role === ROLES.SUPER_ADMIN
  ) {
    return resolveEffectiveTenantId(user);
  }

  return null;
}

function assertTenantForMutation(tenantId) {
  const trimmed = String(tenantId || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Chưa xác định được tenant hiện tại." };
  }
  return { ok: true, tenantId: trimmed };
}

function findDuplicateName(clubs, name, excludeId) {
  const normalized = String(name || "").trim().toLowerCase();
  return clubs.some(
    (club) =>
      club.id !== excludeId &&
      String(club.name || "").trim().toLowerCase() === normalized
  );
}

function findDuplicateCode(clubs, code, excludeId) {
  const normalized = String(code || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return clubs.some(
    (club) =>
      club.id !== excludeId &&
      String(club.code || "").trim().toLowerCase() === normalized
  );
}

export function getClubsByTenant(tenantId) {
  if (!tenantId) {
    return loadClubs();
  }
  return listClubsForTenant(tenantId);
}

export function getClubById(clubId, tenantId) {
  const club = getRegistryClubById(clubId);
  if (!club) {
    return null;
  }

  if (tenantId) {
    const check = guardClubTenant(clubId, tenantId);
    if (!check.ok) {
      return null;
    }
  }

  if (isRbacEnabled()) {
    const user = getCurrentUser();
    if (user && !canUserViewClub(user, clubId, tenantId)) {
      return null;
    }
  }

  return club;
}

export function getClubStats(clubId, tenantId) {
  const club = getClubById(clubId, tenantId);
  if (!club) {
    return null;
  }

  const ext = loadClubExtension(clubId);
  const activeMembers = ext.members.filter((m) => m.status === "active");
  const ratings = ext.ratings;
  const elos = ratings.map((r) => r.elo).filter(Number.isFinite);
  const avgElo = elos.length
    ? Math.round(elos.reduce((sum, v) => sum + v, 0) / elos.length)
    : 0;

  const clubData = loadClubData(clubId);
  const internalTournaments = (clubData.tournaments || []).filter(
    (t) => t.clubId === clubId && (t.type === "club_internal" || t.mode === "internal_tournament")
  );

  return {
    memberCount: ext.members.length,
    activeMemberCount: activeMembers.length,
    avgElo,
    maxElo: elos.length ? Math.max(...elos) : 0,
    minElo: elos.length ? Math.min(...elos) : 0,
    tournamentCount: internalTournaments.length,
    matchCount: ext.matches.length,
    totalMatchesPlayed: ratings.reduce((sum, r) => sum + (r.matchesPlayed || 0), 0),
  };
}

export function createClub(data = {}) {
  const name = String(data.name || "").trim();
  if (!name) {
    return { ok: false, error: "Tên CLB bắt buộc." };
  }

  const user = getCurrentUser();
  const tenantId = data.tenantId || resolveTenantIdForCreate(user);
  if (isRbacEnabled()) {
    const tenantCheck = assertTenantForMutation(tenantId);
    if (!tenantCheck.ok) {
      return tenantCheck;
    }
  }

  const check = guardPermission(
    PERMISSIONS.CLUB_CREATE,
    tenantId ? { venueId: tenantId, tenantId } : {}
  );
  if (!check.ok && !(user && canSelfRegisterClub(user))) {
    return check;
  }

  if (tenantId) {
    const limitCheck = guardMaxClubs(tenantId);
    if (!limitCheck.ok) {
      return limitCheck;
    }
  }

  const tenantClubs = getClubsByTenant(tenantId);
  if (findDuplicateName(tenantClubs, name)) {
    return { ok: false, error: "Tên CLB đã tồn tại trong tenant này." };
  }

  if (data.code && findDuplicateCode(tenantClubs, data.code)) {
    return { ok: false, error: "Mã CLB đã tồn tại trong tenant này." };
  }

  const clubs = loadClubs();
  const { governance, status } = resolveGovernanceForCreate(data, user);

  if (!governance.presidentUserId) {
    return { ok: false, error: "Chủ tịch CLB bắt buộc (presidentUserId)." };
  }

  const club = createClubRecord(name, {
    id: data.id,
    code: data.code,
    description: data.description,
    status: data.status || status,
    governance,
    venueId: tenantId,
    tenantId,
    createdByUserId: user?.id || null,
  });

  saveClubs([...clubs, club]);
  initClubData(club.id);
  loadClubExtension(club.id);

  return { ok: true, club };
}

export function updateClub(clubId, data = {}, tenantId) {
  const club = getClubById(clubId, tenantId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  const check = guardClubAction(clubId, PERMISSIONS.CLUB_UPDATE);
  if (!check.ok) {
    return check;
  }

  const effectiveTenantId = tenantId || club.tenantId || club.venueId;
  const tenantClubs = getClubsByTenant(effectiveTenantId);

  if (data.name && findDuplicateName(tenantClubs, data.name, clubId)) {
    return { ok: false, error: "Tên CLB đã tồn tại trong tenant này." };
  }

  if (data.code && findDuplicateCode(tenantClubs, data.code, clubId)) {
    return { ok: false, error: "Mã CLB đã tồn tại trong tenant này." };
  }

  const patch = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.code !== undefined) patch.code = data.code;
  if (data.description !== undefined) patch.description = data.description;
  if (data.status !== undefined) patch.status = data.status;
  if (data.governance !== undefined) patch.governance = data.governance;

  return updateClubMeta(clubId, patch);
}

export function deactivateClub(clubId, tenantId) {
  return updateClub(clubId, { status: CLUB_STATUSES.INACTIVE }, tenantId);
}

export function deleteClubSoft(clubId, tenantId) {
  return deactivateClub(clubId, tenantId);
}

export function getTenantPlayers(tenantId) {
  const clubs = getClubsByTenant(tenantId);
  const byId = new Map();

  for (const club of clubs) {
    const data = loadClubData(club.id);
    for (const player of data.players || []) {
      if (!byId.has(player.id)) {
        byId.set(player.id, {
          ...player,
          sourceClubId: club.id,
          clubName: player.clubName || club.name,
        });
      }
    }
  }

  return Array.from(byId.values());
}

export function purgeClubManagementData(clubId) {
  purgeClubExtension(clubId);
}
