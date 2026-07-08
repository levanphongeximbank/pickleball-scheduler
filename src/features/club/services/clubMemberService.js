import { guardClubAction } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { getCurrentUser } from "../../../auth/authService.js";
import { getClubById as getRegistryClubById } from "../../../domain/clubService.js";
import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import { guardClubTenant } from "../../tenant/guards/tenantGuard.js";
import { CLUB_MEMBER_STATUSES } from "../constants/clubMemberRoles.js";
import { canViewFullClubMembers, canDeleteClubMembers } from "./clubGovernanceService.js";
import {
  createClubMemberRecord,
  normalizeClubMember,
} from "../models/clubMember.js";
import { loadClubExtension, saveClubExtension } from "../storage/clubExtensionStorage.js";
import { createDefaultClubRating } from "../models/clubPlayerRating.js";
import { getTenantPlayers } from "./clubTenantService.js";

function guardClubMemberAccess(clubId, tenantId, permission) {
  if (tenantId) {
    const tenantCheck = guardClubTenant(clubId, tenantId);
    if (!tenantCheck.ok) {
      return tenantCheck;
    }
  }
  return guardClubAction(clubId, permission);
}

function syncMembersFromBlob(clubId, tenantId) {
  const ext = loadClubExtension(clubId);
  if (ext.members.length > 0) {
    return ext;
  }

  const players = loadPlayersForClub(clubId);
  if (!players.length) {
    return ext;
  }

  const members = players.map((player) =>
    createClubMemberRecord({
      tenantId,
      clubId,
      playerId: player.id,
      status: player.status === "inactive" ? CLUB_MEMBER_STATUSES.INACTIVE : CLUB_MEMBER_STATUSES.ACTIVE,
    })
  );

  const ratings = players.map((player) =>
    createDefaultClubRating({
      tenantId,
      clubId,
      playerId: player.id,
      level: player.level,
    })
  );

  const next = { ...ext, members, ratings };
  saveClubExtension(clubId, next);
  return loadClubExtension(clubId);
}

export function getClubMembers(clubId, tenantId, options = {}) {
  const { skipGovernanceGuard = false, user = getCurrentUser() } = options;
  const club = getRegistryClubById(clubId);

  if (!skipGovernanceGuard && club && user && !canViewFullClubMembers(user, club)) {
    return [];
  }

  const ext = syncMembersFromBlob(clubId, tenantId);
  return ext.members;
}

export function getClubMembersForTournamentInvite(clubId, tenantId) {
  return getClubMembers(clubId, tenantId, { skipGovernanceGuard: true });
}

export function addMemberToClub(clubId, playerId, tenantId, options = {}) {
  if (!options.skipPermissionGuard) {
    const check = guardClubMemberAccess(clubId, tenantId, PERMISSIONS.PLAYER_UPDATE);
    if (!check.ok) {
      return check;
    }
  } else if (tenantId) {
    const tenantCheck = guardClubTenant(clubId, tenantId);
    if (!tenantCheck.ok) {
      return tenantCheck;
    }
  }

  const trimmedPlayerId = String(playerId || "").trim();
  if (!trimmedPlayerId) {
    return { ok: false, error: "Player không hợp lệ." };
  }

  const tenantPlayers = getTenantPlayers(tenantId);
  const player = tenantPlayers.find((p) => p.id === trimmedPlayerId);
  if (!player) {
    return { ok: false, error: "Player không thuộc tenant này." };
  }

  const ext = loadClubExtension(clubId);
  const existing = ext.members.find((m) => m.playerId === trimmedPlayerId);
  if (existing && existing.status === CLUB_MEMBER_STATUSES.ACTIVE) {
    return { ok: false, error: "Player đã là thành viên CLB này." };
  }

  const now = new Date().toISOString();
  let members;

  if (existing) {
    members = ext.members.map((m) =>
      m.playerId === trimmedPlayerId
        ? normalizeClubMember({
            ...m,
            status: CLUB_MEMBER_STATUSES.ACTIVE,
            role: options.role || m.role,
            leftAt: null,
            updatedAt: now,
          })
        : m
    );
  } else {
    members = [
      ...ext.members,
      createClubMemberRecord({
        tenantId,
        clubId,
        playerId: trimmedPlayerId,
        role: options.role,
      }),
    ];
  }

  let ratings = ext.ratings;
  if (!ratings.some((r) => r.playerId === trimmedPlayerId)) {
    ratings = [
      ...ratings,
      createDefaultClubRating({
        tenantId,
        clubId,
        playerId: trimmedPlayerId,
        level: player.level,
      }),
    ];
  }

  saveClubExtension(clubId, { ...ext, members, ratings });
  return { ok: true, member: members.find((m) => m.playerId === trimmedPlayerId) };
}

export function removeMemberFromClub(clubId, playerId, tenantId) {
  const club = getRegistryClubById(clubId);
  const user = getCurrentUser();
  if (club && user && !canDeleteClubMembers(user, club)) {
    return { ok: false, error: "Không có quyền xóa thành viên CLB." };
  }

  const check = guardClubMemberAccess(clubId, tenantId, PERMISSIONS.PLAYER_UPDATE);
  if (!check.ok) {
    return check;
  }

  const trimmedPlayerId = String(playerId || "").trim();
  const ext = loadClubExtension(clubId);
  const now = new Date().toISOString();

  const members = ext.members.map((m) =>
    m.playerId === trimmedPlayerId
      ? normalizeClubMember({
          ...m,
          status: CLUB_MEMBER_STATUSES.INACTIVE,
          leftAt: now,
          updatedAt: now,
        })
      : m
  );

  saveClubExtension(clubId, { ...ext, members });
  return { ok: true };
}

export function updateClubMemberRole(clubId, playerId, role, tenantId) {
  const check = guardClubMemberAccess(clubId, tenantId, PERMISSIONS.PLAYER_UPDATE);
  if (!check.ok) {
    return check;
  }

  const trimmedPlayerId = String(playerId || "").trim();
  const ext = loadClubExtension(clubId);
  const index = ext.members.findIndex((m) => m.playerId === trimmedPlayerId);

  if (index < 0) {
    return { ok: false, error: "Không tìm thấy thành viên." };
  }

  const members = ext.members.map((m, i) =>
    i === index
      ? normalizeClubMember({ ...m, role, updatedAt: new Date().toISOString() })
      : m
  );

  saveClubExtension(clubId, { ...ext, members });
  return { ok: true, member: members[index] };
}

export function updateClubMemberStatus(clubId, playerId, status, tenantId) {
  const check = guardClubMemberAccess(clubId, tenantId, PERMISSIONS.PLAYER_UPDATE);
  if (!check.ok) {
    return check;
  }

  const trimmedPlayerId = String(playerId || "").trim();
  const ext = loadClubExtension(clubId);
  const index = ext.members.findIndex((m) => m.playerId === trimmedPlayerId);

  if (index < 0) {
    return { ok: false, error: "Không tìm thấy thành viên." };
  }

  const now = new Date().toISOString();
  const members = ext.members.map((m, i) =>
    i === index
      ? normalizeClubMember({
          ...m,
          status,
          leftAt: status === CLUB_MEMBER_STATUSES.INACTIVE ? now : null,
          updatedAt: now,
        })
      : m
  );

  saveClubExtension(clubId, { ...ext, members });
  return { ok: true, member: members[index] };
}
