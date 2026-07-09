import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import {
  ROLES,
  isClubScopedRole,
  isGlobalRole,
  isVenueScopedRole,
  normalizeRole,
} from "../../../auth/roles.js";
import { getClubById as getRegistryClubById, updateClubMeta } from "../../../domain/clubService.js";
import { deleteClub as deleteClubRegistry } from "../../../domain/clubService.js";
import { guardClubAction, guardPermission } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { CLUB_STATUSES } from "../constants/clubStatus.js";
import { hasClubPresident, normalizeClubGovernance, getVicePresidentUserIds, MAX_VICE_PRESIDENTS } from "../models/clubGovernance.js";
import { loadCourtsForVenueScoped } from "../../../domain/courtService.js";
import { loadClubData, loadPlayersForClub, saveClubData } from "../../../domain/clubStorage.js";
import { normalizePlayers } from "../../../models/player.js";
import { normalizeUser } from "../../../models/user.js";
import { saveAuthSession, loadAuthSession } from "../../../auth/authStorage.js";
import { getPickVnRatingByAuthUserId, syncRatingToClubPlayer } from "../../pick-vn-rating/services/pickVnRatingService.js";
import { getClubMembers, addMemberToClub } from "./clubMemberService.js";
import { CLUB_MEMBER_STATUSES } from "../constants/clubMemberRoles.js";
import {
  findUserIdByPlayerId,
  loadAthleteClubLink,
  saveAthleteClubLink,
} from "../storage/athleteClubLinkStore.js";
import { purgeClubExtension } from "../storage/clubExtensionStorage.js";
import { writeAuditLog } from "../../identity/services/auditService.js";
import { rpcAdminUpdateUser } from "../../identity/services/identityRpcService.js";
import {
  getClusterById,
  listClustersForVenue,
} from "../../court-cluster/services/courtClusterService.js";

function deriveRegisteredClusterIdFromLegacy(governance, tenantId) {
  if (governance?.registeredClusterId) {
    return governance.registeredClusterId;
  }

  const courtIds = governance?.registeredCourtIds || [];
  if (!courtIds.length || !tenantId) {
    return null;
  }

  const courts = loadCourtsForVenueScoped(tenantId, tenantId);
  const clusterCounts = new Map();

  for (const courtId of courtIds) {
    const court = courts.find((item) => item.id === courtId);
    const clusterId = court?.clusterId ? String(court.clusterId).trim() : "";
    if (!clusterId) {
      continue;
    }
    clusterCounts.set(clusterId, (clusterCounts.get(clusterId) || 0) + 1);
  }

  if (clusterCounts.size === 0) {
    return null;
  }

  if (clusterCounts.size === 1) {
    return [...clusterCounts.keys()][0];
  }

  let bestClusterId = null;
  let bestCount = 0;
  for (const [clusterId, count] of clusterCounts) {
    if (count > bestCount) {
      bestClusterId = clusterId;
      bestCount = count;
    }
  }

  if (import.meta.env?.DEV) {
    console.warn(
      "[clubGovernance] registeredCourtIds span multiple clusters — migrated to",
      bestClusterId
    );
  }

  return bestClusterId;
}

function sameUserId(a, b) {
  if (!a || !b) return false;
  return String(a) === String(b);
}

export function isClubOwner(user, club) {
  if (!user?.id || !club?.governance?.ownerUserId) {
    return false;
  }
  return sameUserId(user.id, club.governance.ownerUserId);
}

export function isClubPresident(user, club) {
  if (!user?.id || !club?.governance?.presidentUserId) {
    return false;
  }
  return sameUserId(user.id, club.governance.presidentUserId);
}

export function isClubVicePresident(user, club) {
  if (!user?.id) {
    return false;
  }
  return getVicePresidentUserIds(club?.governance).some((id) => sameUserId(user.id, id));
}

/** Chức danh nghiệp vụ CLB (khác auth role) — dùng trên hồ sơ VĐV. */
export function resolveClubGovernanceTitle(user, club) {
  if (!user?.id || !club) {
    return null;
  }
  if (isClubPresident(user, club)) {
    return "Chủ tịch CLB";
  }
  if (isClubVicePresident(user, club)) {
    return "Phó chủ tịch CLB";
  }
  return null;
}

export function canViewFullClubMembers(user, club) {
  if (!club) {
    return false;
  }

  if (!isRbacEnabled() || !user) {
    return true;
  }

  if (isGlobalRole(user.role)) {
    return true;
  }

  if (isClubPresident(user, club) || isClubVicePresident(user, club) || isClubOwner(user, club)) {
    return true;
  }

  if (isClubScopedRole(user.role) && user.clubId === club.id) {
    return true;
  }

  if (isVenueScopedRole(user.role)) {
    return isClubOwner(user, club);
  }

  return false;
}

export function canViewClubMemberSummary(user, club) {
  if (!club || !isRbacEnabled() || !user) {
    return false;
  }

  if (canViewFullClubMembers(user, club)) {
    return false;
  }

  if (isGlobalRole(user.role)) {
    return false;
  }

  return isVenueScopedRole(user.role);
}

export function canAssignClubOwner(user) {
  if (!isRbacEnabled() || !user) {
    return true;
  }

  if (isGlobalRole(user.role)) {
    return true;
  }

  return normalizeRole(user.role) === ROLES.TENANT_OWNER;
}

export function canChangeClubPresident(user, club) {
  if (!club) {
    return false;
  }

  if (!isRbacEnabled() || !user) {
    return true;
  }

  if (isGlobalRole(user.role)) {
    return true;
  }

  if (canAssignClubOwner(user)) {
    return true;
  }

  return isClubOwner(user, club);
}

export function canDeleteClub(user, club) {
  if (!club) {
    return false;
  }

  if (!isRbacEnabled() || !user) {
    return true;
  }

  if (isGlobalRole(user.role)) {
    return true;
  }

  if (canAssignClubOwner(user)) {
    return true;
  }

  return isClubOwner(user, club);
}

export function canDeleteClubMembers(user, club) {
  if (!canViewFullClubMembers(user, club)) {
    return false;
  }

  if (isClubVicePresident(user, club)) {
    return false;
  }

  return true;
}

export function canApproveClubMembershipRequests(user, club) {
  if (!club || !user?.id) {
    return false;
  }

  return (
    isClubPresident(user, club) ||
    isClubVicePresident(user, club) ||
    isClubOwner(user, club)
  );
}

export function canManageClubGovernance(user, club) {
  if (!club) {
    return false;
  }

  if (!isRbacEnabled() || !user) {
    return true;
  }

  if (isGlobalRole(user.role)) {
    return true;
  }

  return isClubPresident(user, club) || isClubOwner(user, club) || canAssignClubOwner(user);
}

export function canApproveClubRegistration(user, club) {
  if (!club || club.status !== CLUB_STATUSES.PENDING_APPROVAL) {
    return false;
  }

  if (!isRbacEnabled() || !user) {
    return true;
  }

  return canAssignClubOwner(user);
}

/** VĐV / Quản lý CLB chưa có clubId — tự đăng ký CLB (spec §6.1 B). */
export function canSelfRegisterClub(user) {
  if (!user?.id) {
    return false;
  }

  if (!isRbacEnabled()) {
    return isClubScopedRole(user.role) && !user.clubId;
  }

  const role = normalizeRole(user.role);
  return (
    isClubScopedRole(user.role) &&
    !user.clubId &&
    (role === ROLES.CLUB_MANAGER || role === ROLES.PLAYER)
  );
}

function buildPlayerIdForAuthUser(userId) {
  const safe = String(userId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return `player-auth-${safe}`;
}

/** Sau tự đăng ký CLB: thêm VĐV vào roster, link session, promote CLUB_MANAGER. */
export function bootstrapSelfRegisteredPresident(clubId, user, tenantId) {
  const trimmedClubId = String(clubId || "").trim();
  const normalizedUser = normalizeUser(user);
  if (!trimmedClubId || !normalizedUser?.id) {
    return { ok: false, error: "Thiếu CLB hoặc user." };
  }

  const club = getRegistryClubById(trimmedClubId);
  const effectiveTenantId =
    tenantId || club?.venueId || club?.tenantId || normalizedUser.tenantId || normalizedUser.venueId || null;

  const data = loadClubData(trimmedClubId);
  const players = [...(data.players || [])];
  let player =
    players.find((item) => String(item.authUserId || "") === String(normalizedUser.id)) ||
    players.find((item) => item.id === buildPlayerIdForAuthUser(normalizedUser.id)) ||
    null;

  if (!player) {
    const rating = getPickVnRatingByAuthUserId(normalizedUser.id)?.currentRating ?? 3.5;
    const basePlayer = normalizePlayers([
      {
        id: buildPlayerIdForAuthUser(normalizedUser.id),
        name: normalizedUser.displayName || normalizedUser.email || "VĐV",
        tenantId: effectiveTenantId,
        level: rating,
        status: "active",
        active: true,
        authUserId: normalizedUser.id,
        clubName: club?.name || "",
        phone: normalizedUser.phone || "",
      },
    ])[0];
    player = syncRatingToClubPlayer(basePlayer, normalizedUser.id);
    players.push(player);
    saveClubData(trimmedClubId, {
      ...data,
      players,
      tenantId: data.tenantId || effectiveTenantId,
    });
  }

  if (effectiveTenantId) {
    const session = loadAuthSession();
    if (session?.user?.id === normalizedUser.id) {
      saveAuthSession(
        normalizeUser({
          ...session.user,
          tenantId: effectiveTenantId,
          venueId: effectiveTenantId,
        }),
        { provider: session.provider || "dev" }
      );
    }
  }

  const memberResult = addMemberToClub(trimmedClubId, player.id, effectiveTenantId, {
    skipPermissionGuard: true,
  });
  if (!memberResult.ok) {
    return memberResult;
  }

  saveAthleteClubLink(normalizedUser.id, { clubId: trimmedClubId, playerId: player.id });

  const session = loadAuthSession();
  if (session?.user?.id === normalizedUser.id) {
    const nextUser = normalizeUser({
      ...session.user,
      clubId: trimmedClubId,
      playerId: player.id,
      role: ROLES.CLUB_MANAGER,
      tenantId: effectiveTenantId || session.user.tenantId || session.user.venueId || null,
      venueId: effectiveTenantId || session.user.venueId || session.user.tenantId || null,
    });
    saveAuthSession(nextUser, { provider: session.provider || "dev" });
  }

  void rpcAdminUpdateUser(normalizedUser.id, {
    clubId: trimmedClubId,
    role: ROLES.CLUB_MANAGER,
  });

  return { ok: true, playerId: player.id, clubId: trimmedClubId };
}

export function canTransferClubOwnership(user, club) {
  return isClubOwner(user, club);
}

function assertClubMemberUser(clubId, tenantId, userId) {
  const trimmed = String(userId || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Thiếu user thành viên." };
  }

  const candidates = listClubGovernanceCandidates(clubId, tenantId);
  const matched = candidates.find((item) => sameUserId(item.userId, trimmed));
  if (!matched) {
    return {
      ok: false,
      error: "Người nhận phải là vận động viên active của CLB (có tài khoản liên kết).",
      code: "NOT_CLUB_MEMBER",
    };
  }

  return { ok: true, candidate: matched };
}

/** Chủ tịch / Phó chủ tịch phải là VĐV trong roster CLB (VĐV có chức danh). */
function assertClubAthleteUser(clubId, tenantId, userId) {
  const memberCheck = assertClubMemberUser(clubId, tenantId, userId);
  if (!memberCheck.ok) {
    return memberCheck;
  }

  if (!memberCheck.candidate?.playerId) {
    return {
      ok: false,
      error: "Chủ tịch / Phó chủ tịch phải là vận động viên trong danh sách CLB.",
      code: "NOT_CLUB_ATHLETE",
    };
  }

  return memberCheck;
}

function applyGovernanceAthleteSync(clubId, userId, candidate) {
  const trimmed = String(userId || "").trim();
  if (!trimmed) {
    return;
  }

  saveAthleteClubLink(trimmed, {
    clubId,
    playerId: candidate?.playerId || null,
  });

  void rpcAdminUpdateUser(trimmed, {
    clubId,
    role: ROLES.CLUB_MANAGER,
  });
}

function resolveGovernanceUserLabel(userId, clubId, tenantId) {
  const trimmed = String(userId || "").trim();
  if (!trimmed) {
    return null;
  }

  const candidates = listClubGovernanceCandidates(clubId, tenantId);
  const matched = candidates.find((item) => sameUserId(item.userId, trimmed));
  if (matched?.displayName) {
    return matched.displayName;
  }

  const link = loadAthleteClubLink(trimmed);
  if (link?.playerId) {
    const players = loadPlayersForClub(clubId);
    const player = players.find((item) => item.id === link.playerId);
    if (player?.name) {
      return player.name;
    }
  }

  return `User ${trimmed.slice(0, 8)}`;
}

export function listClubGovernanceCandidates(clubId, tenantId) {
  const club = getRegistryClubById(clubId);
  if (!club) {
    return [];
  }

  const members = getClubMembers(clubId, tenantId, { skipGovernanceGuard: true });
  const players = loadPlayersForClub(clubId);
  const playerById = new Map(players.map((player) => [player.id, player]));
  const candidateMap = new Map();

  const addCandidate = (userId, playerId = null) => {
    const id = String(userId || "").trim();
    if (!id) {
      return;
    }

    if (candidateMap.has(id)) {
      return;
    }

    const player = playerId ? playerById.get(playerId) : null;
    candidateMap.set(id, {
      userId: id,
      playerId: playerId || null,
      displayName: player?.name || `User ${id.slice(0, 8)}`,
    });
  };

  for (const member of members) {
    if (member.status !== CLUB_MEMBER_STATUSES.ACTIVE || !member.playerId) {
      continue;
    }
    const linkedUserId = findUserIdByPlayerId(member.playerId);
    if (linkedUserId) {
      addCandidate(linkedUserId, member.playerId);
    }
  }

  return Array.from(candidateMap.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "vi")
  );
}

export function transferClubOwnership(clubId, nextOwnerUserId, tenantId) {
  const user = getCurrentUser();
  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  if (!canTransferClubOwnership(user, club)) {
    return { ok: false, error: "Chỉ Chủ sở hữu hiện tại được chuyển quyền sở hữu." };
  }

  const trimmed = String(nextOwnerUserId || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Chọn thành viên nhận quyền sở hữu." };
  }

  if (sameUserId(user.id, trimmed)) {
    return { ok: false, error: "Không thể chuyển quyền sở hữu cho chính mình." };
  }

  const memberCheck = assertClubMemberUser(clubId, tenantId, trimmed);
  if (!memberCheck.ok) {
    return memberCheck;
  }

  const access = guardClubAction(clubId, PERMISSIONS.CLUB_UPDATE);
  if (!access.ok) {
    return access;
  }

  const previousOwnerUserId = club.governance?.ownerUserId || null;
  const result = updateClubMeta(clubId, {
    governance: {
      ...club.governance,
      ownerUserId: trimmed,
    },
  });

  if (!result.ok) {
    return result;
  }

  void writeAuditLog({
    action: "club.owner.transfer",
    resourceType: "club",
    resourceId: clubId,
    venueId: tenantId || club.venueId || club.tenantId,
    clubId,
    metadata: {
      previousOwnerUserId,
      nextOwnerUserId: trimmed,
    },
  });

  return { ok: true, club: getRegistryClubById(clubId) };
}

export async function transferClubPresident(clubId, nextPresidentUserId, tenantId) {
  const user = getCurrentUser();
  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  if (!canChangeClubPresident(user, club)) {
    return { ok: false, error: "Chỉ Chủ sở hữu CLB hoặc chủ sân được đổi Chủ tịch." };
  }

  const trimmed = String(nextPresidentUserId || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Chọn thành viên làm Chủ tịch." };
  }

  const currentPresident = club.governance?.presidentUserId || null;
  if (sameUserId(currentPresident, trimmed)) {
    return { ok: true, club, skipped: true };
  }

  const memberCheck = assertClubAthleteUser(clubId, tenantId, trimmed);
  if (!memberCheck.ok) {
    return memberCheck;
  }

  const result = updateClubGovernance(clubId, { presidentUserId: trimmed }, tenantId);
  if (!result.ok) {
    return result;
  }

  void writeAuditLog({
    action: "club.president.transfer",
    resourceType: "club",
    resourceId: clubId,
    venueId: tenantId || club.venueId || club.tenantId,
    clubId,
    metadata: {
      previousPresidentUserId: currentPresident,
      nextPresidentUserId: trimmed,
    },
  });

  return { ok: true, club: getRegistryClubById(clubId) };
}

export async function setClubVicePresidents(clubId, userIds = [], tenantId) {
  const user = getCurrentUser();
  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  if (!canManageClubGovernance(user, club)) {
    return { ok: false, error: "Không có quyền cập nhật quản trị CLB." };
  }

  const trimmed = [...new Set(userIds.map((id) => String(id || "").trim()).filter(Boolean))].slice(
    0,
    MAX_VICE_PRESIDENTS
  );

  if (userIds.length > MAX_VICE_PRESIDENTS) {
    return { ok: false, error: `Tối đa ${MAX_VICE_PRESIDENTS} Phó chủ tịch.` };
  }

  const presidentId = club.governance?.presidentUserId || null;
  if (trimmed.some((id) => sameUserId(id, presidentId))) {
    return { ok: false, error: "Phó chủ tịch không thể trùng Chủ tịch." };
  }

  if (trimmed.length !== new Set(trimmed).size) {
    return { ok: false, error: "Không thể gán trùng Phó chủ tịch." };
  }

  for (const id of trimmed) {
    const memberCheck = assertClubAthleteUser(clubId, tenantId, id);
    if (!memberCheck.ok) {
      return memberCheck;
    }
  }

  const currentIds = getVicePresidentUserIds(club.governance);
  const unchanged =
    currentIds.length === trimmed.length && currentIds.every((id, index) => sameUserId(id, trimmed[index]));

  if (unchanged) {
    return { ok: true, club, skipped: true };
  }

  const result = updateClubGovernance(
    clubId,
    {
      vicePresidentUserIds: trimmed,
      vicePresidentUserId: trimmed[0] || null,
    },
    tenantId
  );

  if (!result.ok) {
    return result;
  }

  void writeAuditLog({
    action: "club.vice_president.assign",
    resourceType: "club",
    resourceId: clubId,
    venueId: tenantId || club.venueId || club.tenantId,
    clubId,
    metadata: {
      previousVicePresidentUserIds: currentIds,
      nextVicePresidentUserIds: trimmed,
    },
  });

  return { ok: true, club: getRegistryClubById(clubId) };
}

export async function assignClubVicePresident(clubId, nextVicePresidentUserId, tenantId) {
  const trimmed = String(nextVicePresidentUserId || "").trim();
  return setClubVicePresidents(clubId, trimmed ? [trimmed] : [], tenantId);
}

export function deleteClubAsOwner(clubId, tenantId) {
  const user = getCurrentUser();
  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  if (!canDeleteClub(user, club)) {
    return { ok: false, error: "Không có quyền xóa CLB này." };
  }

  const result = deleteClubRegistry(clubId);
  if (!result.ok) {
    return result;
  }

  purgeClubExtension(clubId);

  void writeAuditLog({
    action: "club.delete",
    resourceType: "club",
    resourceId: clubId,
    venueId: tenantId || club.venueId || club.tenantId,
    clubId,
    metadata: { clubName: club.name },
  });

  return { ok: true };
}

export function resolveGovernanceForCreate(data = {}, user = getCurrentUser()) {
  const governance = normalizeClubGovernance(data.governance || data, {});

  let presidentUserId = governance.presidentUserId;
  if (!presidentUserId && user && isClubScopedRole(user.role)) {
    presidentUserId = user.id;
  }

  let ownerUserId = governance.ownerUserId;
  const isCourtOwnerCreate =
    user && normalizeRole(user.role) === ROLES.TENANT_OWNER;
  if (ownerUserId == null && isCourtOwnerCreate) {
    if (data.assignOwnerToCreator !== false) {
      ownerUserId = user.id;
    }
  }

  const nextGovernance = {
    ...governance,
    presidentUserId: presidentUserId || null,
    ownerUserId: ownerUserId ?? null,
  };

  let status = CLUB_STATUSES.PENDING_SETUP;
  if (hasClubPresident(nextGovernance)) {
    if (data.submitForApproval) {
      status = CLUB_STATUSES.PENDING_APPROVAL;
    } else {
      status = CLUB_STATUSES.ACTIVE;
    }
  }

  return { governance: nextGovernance, status };
}

export function assignClubOwner(clubId, ownerUserId, tenantId) {
  const user = getCurrentUser();
  if (!canAssignClubOwner(user)) {
    return { ok: false, error: "Chỉ chủ sân hoặc quản trị hệ thống được gán Chủ sở hữu CLB." };
  }

  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  const check = guardPermission(PERMISSIONS.CLUB_GOVERNANCE_ASSIGN_OWNER, {
    venueId: tenantId || club.venueId,
    tenantId: tenantId || club.tenantId,
    clubId,
  });
  if (!check.ok) {
    return check;
  }

  const trimmed = ownerUserId ? String(ownerUserId).trim() : null;
  const governance = {
    ...club.governance,
    ownerUserId: trimmed,
  };

  return updateClubMeta(clubId, { governance });
}

export function approveClubRegistration(clubId, tenantId) {
  const user = getCurrentUser();
  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  if (!canApproveClubRegistration(user, club)) {
    return { ok: false, error: "Chỉ chủ sân được duyệt CLB đăng ký." };
  }

  const check = guardPermission(PERMISSIONS.CLUB_GOVERNANCE_APPROVE, {
    venueId: tenantId || club.venueId,
    tenantId: tenantId || club.tenantId,
    clubId,
  });
  if (!check.ok) {
    return check;
  }

  if (!hasClubPresident(club.governance)) {
    return { ok: false, error: "CLB chưa có Chủ tịch — không thể duyệt." };
  }

  const now = new Date().toISOString();
  return updateClubMeta(clubId, {
    status: CLUB_STATUSES.ACTIVE,
    governance: {
      ...club.governance,
      approvedByUserId: user?.id || null,
      approvedAt: now,
    },
  });
}

export function rejectClubRegistration(clubId, tenantId) {
  const user = getCurrentUser();
  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  if (!canApproveClubRegistration(user, club)) {
    return { ok: false, error: "Chỉ chủ sân được từ chối CLB đăng ký." };
  }

  return updateClubMeta(clubId, { status: CLUB_STATUSES.INACTIVE });
}

export function getRegisteredClusterLabel(club, tenantId) {
  const clusterId = deriveRegisteredClusterIdFromLegacy(club?.governance, tenantId);
  if (!clusterId) {
    return null;
  }

  const cluster =
    getClusterById(clusterId) ||
    listClustersForVenue(tenantId).find((item) => item.id === clusterId) ||
    null;

  if (!cluster) {
    return {
      id: clusterId,
      name: clusterId,
      address: "",
    };
  }

  return {
    id: cluster.id,
    name: cluster.name || cluster.id,
    address: cluster.address || "",
  };
}

/** @deprecated Use getRegisteredClusterLabel */
export function getRegisteredCourtsLabels(club, tenantId) {
  const label = getRegisteredClusterLabel(club, tenantId);
  return label ? [label] : [];
}

export function updateClubGovernance(clubId, patch = {}, tenantId = null) {
  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  const effectiveTenantId = tenantId || club.tenantId || club.venueId || null;
  const user = getCurrentUser();
  const canAssignOwner = canAssignClubOwner(user);
  const canManage = canManageClubGovernance(user, club);

  if (patch.ownerUserId !== undefined && !canAssignOwner) {
    return { ok: false, error: "Không có quyền gán Chủ sở hữu CLB." };
  }

  if (patch.presidentUserId !== undefined) {
    const currentPresident = club.governance?.presidentUserId || null;
    const nextPresident = patch.presidentUserId
      ? String(patch.presidentUserId).trim()
      : null;
    const presidentUnchanged =
      String(currentPresident || "") === String(nextPresident || "");

    if (!presidentUnchanged && !canChangeClubPresident(user, club)) {
      return {
        ok: false,
        error: "Chỉ Chủ sở hữu CLB hoặc chủ sân được đổi Chủ tịch.",
      };
    }

    if (!presidentUnchanged && nextPresident) {
      const patchViceIds =
        patch.vicePresidentUserIds !== undefined
          ? normalizeClubGovernance({ vicePresidentUserIds: patch.vicePresidentUserIds }).vicePresidentUserIds
          : patch.vicePresidentUserId !== undefined
            ? patch.vicePresidentUserId
              ? [String(patch.vicePresidentUserId).trim()]
              : []
            : getVicePresidentUserIds(club.governance);
      if (patchViceIds.some((id) => sameUserId(nextPresident, id))) {
        return { ok: false, error: "Chủ tịch không thể trùng Phó chủ tịch." };
      }

      const athleteCheck = assertClubAthleteUser(
        clubId,
        effectiveTenantId,
        nextPresident
      );
      if (!athleteCheck.ok) {
        return athleteCheck;
      }
    }
  }

  if (patch.vicePresidentUserIds !== undefined || patch.vicePresidentUserId !== undefined) {
    const currentViceIds = getVicePresidentUserIds(club.governance);
    const nextViceIds =
      patch.vicePresidentUserIds !== undefined
        ? normalizeClubGovernance({ vicePresidentUserIds: patch.vicePresidentUserIds }).vicePresidentUserIds
        : patch.vicePresidentUserId !== undefined
          ? patch.vicePresidentUserId
            ? [String(patch.vicePresidentUserId).trim()]
            : []
          : currentViceIds;
    const viceUnchanged =
      currentViceIds.length === nextViceIds.length &&
      currentViceIds.every((id, index) => sameUserId(id, nextViceIds[index]));

    if (!viceUnchanged) {
      if (nextViceIds.length > MAX_VICE_PRESIDENTS) {
        return { ok: false, error: `Tối đa ${MAX_VICE_PRESIDENTS} Phó chủ tịch.` };
      }

      const nextPresident =
        patch.presidentUserId !== undefined
          ? patch.presidentUserId
            ? String(patch.presidentUserId).trim()
            : null
          : club.governance?.presidentUserId || null;

      for (const nextVice of nextViceIds) {
        if (sameUserId(nextVice, nextPresident)) {
          return { ok: false, error: "Phó chủ tịch không thể trùng Chủ tịch." };
        }
        const athleteCheck = assertClubAthleteUser(clubId, effectiveTenantId, nextVice);
        if (!athleteCheck.ok) {
          return athleteCheck;
        }
      }
    }
  }

  if (
    (patch.vicePresidentUserId !== undefined ||
      patch.vicePresidentUserIds !== undefined ||
      patch.registeredClusterId !== undefined) &&
    !canManage
  ) {
    return { ok: false, error: "Không có quyền cập nhật quản trị CLB." };
  }

  const check = guardClubAction(clubId, PERMISSIONS.CLUB_UPDATE);
  if (!check.ok) {
    return check;
  }

  const merged = normalizeClubGovernance(
    {
      ...club.governance,
      ...patch,
    },
    club
  );

  let status = club.status;
  if (patch.presidentUserId !== undefined) {
    if (hasClubPresident(merged) && club.status === CLUB_STATUSES.PENDING_SETUP) {
      status = CLUB_STATUSES.ACTIVE;
    }
    if (!hasClubPresident(merged)) {
      status = CLUB_STATUSES.PENDING_SETUP;
    }
  }
  if (patch.status !== undefined) {
    status = patch.status;
  }

  const result = updateClubMeta(clubId, {
    governance: merged,
    status,
  });
  if (!result.ok) {
    return result;
  }

  if (patch.presidentUserId !== undefined) {
    const currentPresident = club.governance?.presidentUserId || null;
    const nextPresident = merged.presidentUserId || null;
    if (nextPresident && !sameUserId(currentPresident, nextPresident)) {
      const athleteCheck = assertClubAthleteUser(
        clubId,
        effectiveTenantId,
        nextPresident
      );
      if (athleteCheck.ok) {
        applyGovernanceAthleteSync(clubId, nextPresident, athleteCheck.candidate);
      }
    }
  }

  if (patch.vicePresidentUserIds !== undefined || patch.vicePresidentUserId !== undefined) {
    const currentViceIds = getVicePresidentUserIds(club.governance);
    const nextViceIds = getVicePresidentUserIds(merged);
    for (const nextVice of nextViceIds) {
      if (!currentViceIds.some((id) => sameUserId(id, nextVice))) {
        const athleteCheck = assertClubAthleteUser(clubId, effectiveTenantId, nextVice);
        if (athleteCheck.ok) {
          applyGovernanceAthleteSync(clubId, nextVice, athleteCheck.candidate);
        }
      }
    }
  }

  return result;
}

export function getGovernanceDisplayLabels(club, tenantId = null) {
  const gov = club?.governance || {};
  const clubId = club?.id || null;
  const effectiveTenantId = tenantId || club?.tenantId || club?.venueId || null;

  const ownerLabel = gov.ownerUserId
    ? resolveGovernanceUserLabel(gov.ownerUserId, clubId, effectiveTenantId)
    : "Chưa gán";
  const presidentLabel = gov.presidentUserId
    ? resolveGovernanceUserLabel(gov.presidentUserId, clubId, effectiveTenantId)
    : "Chưa gán";
  const viceIds = getVicePresidentUserIds(gov);
  const viceLabels = viceIds.map((id) => resolveGovernanceUserLabel(id, clubId, effectiveTenantId));
  const viceLabel = viceLabels.length ? viceLabels.join(", ") : "—";

  if (
    gov.ownerUserId &&
    gov.presidentUserId &&
    sameUserId(gov.ownerUserId, gov.presidentUserId)
  ) {
    return {
      ownerLabel: `${presidentLabel} (Chủ sở hữu & Chủ tịch)`,
      presidentLabel: null,
      vicePresidentLabel: viceLabel,
      vicePresidentLabels: viceLabels,
      combinedOwnerPresident: true,
    };
  }

  return {
    ownerLabel,
    presidentLabel,
    vicePresidentLabel: viceLabel,
    vicePresidentLabels: viceLabels,
    combinedOwnerPresident: false,
  };
}
