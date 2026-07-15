import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import { can } from "../../../auth/rbac.js";
import {
  ROLES,
  isClubScopedRole,
  isGlobalRole,
  isVenueScopedRole,
  normalizeRole,
} from "../../../auth/roles.js";
import { getClubById as getRegistryClubById, updateClubMeta } from "../../../domain/clubService.js";
import { deleteClub as deleteClubRegistry } from "../../../domain/clubService.js";
import { loadClubs } from "../../../data/club.js";
import { guardClubAction, guardPermission } from "../../../auth/guardAction.js";
import { guardClubTenant, resolveTenantIdForClub } from "../../tenant/guards/tenantGuard.js";
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
  clearAthleteClubLink,
} from "../storage/athleteClubLinkStore.js";
import { purgeClubExtension } from "../storage/clubExtensionStorage.js";
import { writeAuditLog } from "../../identity/services/auditService.js";
import { rpcAdminUpdateUser } from "../../identity/services/identityRpcService.js";
import { fetchProfileByUserId, mapProfileRowToUser } from "../../../auth/profileService.js";
import { persistClubToCloud } from "./clubRegistryCloudService.js";
import { rpcClubClaimSelfRegistration } from "./clubRegistryRpcService.js";
import { assertLegacyClubEntityWriteAllowed } from "./clubLegacyWriteGuard.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import {
  rpcV2ClubAssignOwner,
  rpcV2ClubClearOwner,
  rpcV2ClubGet,
  rpcV2ClubTransferPresident,
} from "./clubStorageV2RpcService.js";
import { invalidateAllClubRegistryCache } from "../registry/clubRegistryCache.js";
import {
  getClusterById,
  listClustersForVenue,
} from "../../court-cluster/services/courtClusterService.js";
import {  demoteGovernanceAthleteRole,
  isClubPresident,
  isClubVicePresident,
  promoteGovernanceAthleteRole,
} from "./governanceRoleElevation.js";

export {
  hasClubGovernanceManagerAccess,
  resolveGovernanceElevatedRole,
  syncGovernanceAuthRoleFromClub,
} from "./governanceRoleElevation.js";

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

export { isClubPresident, isClubVicePresident };

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

/**
 * @param {object} user
 * @param {object} club
 * @param {{ activeMembershipClubId?: string|null }} [options]
 *   When Club Storage V2 is on, pass the caller's active membership club id
 *   (from club_get_my_active_membership). profiles.club_id is null under V2,
 *   so legacy user.clubId checks must not gate My Club member visibility.
 */
export function canViewFullClubMembers(user, club, options = {}) {
  if (!club) {
    return false;
  }

  if (!isRbacEnabled() || !user) {
    return true;
  }

  if (isGlobalRole(user.role)) {
    return true;
  }

  if (isClubStorageV2Enabled()) {
    const activeClubId = String(options.activeMembershipClubId || "").trim();
    if (activeClubId && sameUserId(activeClubId, club.id)) {
      return true;
    }
  }

  if (isClubPresident(user, club) || isClubVicePresident(user, club) || isClubOwner(user, club)) {
    return true;
  }

  if (!isClubStorageV2Enabled() && isClubScopedRole(user.role) && user.clubId === club.id) {
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

export function canRelinquishClubPresident(user, club) {
  if (!club) {
    return false;
  }

  if (!isRbacEnabled() || !user) {
    return true;
  }

  return isClubPresident(user, club);
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

  if (isGlobalRole(user.role)) {
    return (
      isClubPresident(user, club) ||
      isClubVicePresident(user, club) ||
      isClubOwner(user, club)
    );
  }

  if (
    isClubPresident(user, club) ||
    isClubVicePresident(user, club) ||
    isClubOwner(user, club)
  ) {
    return true;
  }

  if (!isRbacEnabled()) {
    return false;
  }

  const tenantId =
    club.tenantId || club.venueId || resolveTenantIdForClub(club.id);
  if (
    !can(user, PERMISSIONS.CLUB_MEMBERSHIP_REVIEW, {
      clubId: club.id,
      venueId: tenantId,
      tenantId,
    })
  ) {
    return false;
  }

  if (!tenantId) {
    return false;
  }

  return guardClubTenant(club.id, tenantId, { user }).ok;
}

/** Phase 42L — client guard; blocks bare global roles without governance assignment. */
export function canReviewMembershipForClub(user, club) {
  if (!user?.id || !club) {
    return false;
  }
  if (isGlobalRole(user.role)) {
    return (
      isClubPresident(user, club) ||
      isClubVicePresident(user, club) ||
      isClubOwner(user, club)
    );
  }
  return canApproveClubMembershipRequests(user, club);
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

/** VĐV / Quản lý CLB — tự đăng ký CLB (spec §6.1 B / Phase 42G). */
export function canSelfRegisterClub(user) {
  if (!user?.id) {
    return false;
  }

  const role = normalizeRole(user.role);
  if (role !== ROLES.CLUB_MANAGER && role !== ROLES.PLAYER) {
    return false;
  }

  // Phase 42 Cloud SSOT: membership không dựa profiles.club_id
  if (isClubStorageV2Enabled()) {
    return true;
  }

  const clubId = String(user.clubId || user.club_id || "").trim();
  if (!clubId) {
    return true;
  }

  // clubId local trỏ CLB đã mất / không còn trong registry → xóa link cũ, cho tạo lại
  try {
    const club = getRegistryClubById(clubId);
    if (!club || club.isDefault) {
      clearAthleteClubLink(user.id);
      return true;
    }
  } catch {
    return true;
  }

  return false;
}

async function resolveClubForGovernance(clubId) {
  if (isClubStorageV2Enabled()) {
    const result = await rpcV2ClubGet(clubId);
    if (!result.ok) {
      return null;
    }
    return result.club;
  }
  return getRegistryClubById(clubId);
}

function invalidateRegistryAfterGovernanceMutation() {
  if (isClubStorageV2Enabled()) {
    invalidateAllClubRegistryCache();
  }
}

function buildPlayerIdForAuthUser(userId) {
  const safe = String(userId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return `player-auth-${safe}`;
}

/** Sau tự đăng ký CLB: thêm VĐV vào roster, link session, promote CLUB_MANAGER.
 * Phase 45A.3E — V2-OFF companion only (canonical create ends after club_create).
 * Phase 45A.4C.5 — under V2, assertLegacyClubEntityWriteAllowed blocks this whole path;
 * Membership for the president is created by the canonical club_create / governance
 * transaction — never by blob addMemberToClub.
 */
export async function bootstrapSelfRegisteredPresident(clubId, user, tenantId) {
  const legacyGate = assertLegacyClubEntityWriteAllowed({
    operation: "bootstrapSelfRegisteredPresident",
  });
  if (!legacyGate.ok) return legacyGate;

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

  const memberResult = await addMemberToClub(trimmedClubId, player.id, effectiveTenantId, {
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

  return { ok: true, playerId: player.id, clubId: trimmedClubId };
}

/**
 * Đẩy CLB lên cloud rồi gắn profiles.club_id / venue_id / CLUB_MANAGER cho Chủ tịch.
 * Gọi sau bootstrapSelfRegisteredPresident (local) khi tạo CLB tự đăng ký.
 * Phase 45A.3E — V2-OFF / offline only (persistClubToCloud hard-blocks under V2).
 */
export async function finalizeSelfRegisteredClubCloud(clubId, user, tenantId) {
  const trimmedClubId = String(clubId || "").trim();
  const normalizedUser = normalizeUser(user);
  if (!trimmedClubId || !normalizedUser?.id) {
    return { ok: false, error: "Thiếu CLB hoặc user." };
  }

  const latestClub = getRegistryClubById(trimmedClubId);
  if (!latestClub) {
    return { ok: false, code: "CLUB_NOT_FOUND", error: "Không tìm thấy CLB." };
  }

  const effectiveTenantId =
    tenantId || latestClub.venueId || latestClub.tenantId || normalizedUser.venueId || null;

  const cloudResult = await persistClubToCloud(latestClub, {
    venueId: effectiveTenantId,
    actor: normalizedUser,
  });

  if (!cloudResult.ok) {
    return {
      ok: false,
      code: cloudResult.code || "CLOUD_SYNC_FAILED",
      error:
        cloudResult.error ||
        "Không lưu được CLB lên cloud. Kiểm tra cụm sân / tổ chức đã chọn.",
    };
  }

  if (cloudResult.provider === "local") {
    return {
      ok: true,
      clubId: trimmedClubId,
      venueId: cloudResult.venueId || effectiveTenantId,
      provider: "local",
    };
  }

  const claimResult = await rpcClubClaimSelfRegistration(trimmedClubId);
  if (!claimResult.ok) {
    if (claimResult.code === "RPC_NOT_DEPLOYED") {
      void rpcAdminUpdateUser(normalizedUser.id, {
        clubId: trimmedClubId,
        role: ROLES.CLUB_MANAGER,
      });
      return {
        ok: true,
        clubId: trimmedClubId,
        venueId: cloudResult.venueId || effectiveTenantId,
        warning: "Cloud claim RPC chưa sẵn sàng — đã thử cập nhật profile qua admin RPC.",
      };
    }
    return {
      ok: false,
      code: claimResult.code || "CLAIM_FAILED",
      error: claimResult.error || "Không gắn được CLB vào tài khoản trên cloud.",
    };
  }

  const claimedUser = claimResult.user
    ? mapProfileRowToUser(claimResult.user)
    : null;

  if (claimedUser?.id) {
    const session = loadAuthSession();
    if (session?.user?.id === claimedUser.id) {
      saveAuthSession(
        normalizeUser({
          ...session.user,
          ...claimedUser,
          playerId: session.user.playerId || claimedUser.playerId || null,
        }),
        { provider: session.provider || "supabase" }
      );
    }
  }

  return {
    ok: true,
    clubId: trimmedClubId,
    venueId: claimResult.venue_id || cloudResult.venueId || effectiveTenantId,
    role: claimResult.role || ROLES.CLUB_MANAGER,
    user: claimedUser,
  };
}

/** CLB local mà user đang là Chủ tịch (dùng để nhận lại khi profile.cloud chưa gắn club_id). */
export function listLocalPresidentClubsForUser(user) {
  if (!user?.id) {
    return [];
  }

  return loadClubs().filter((club) => {
    if (!club || club.isDefault) {
      return false;
    }
    return sameUserId(club.governance?.presidentUserId, user.id);
  });
}

/**
 * Nếu profile chưa có club_id nhưng máy này còn CLB do user làm Chủ tịch,
 * đẩy lên cloud + claim profiles.club_id để mọi máy đều thấy.
 */
export async function reclaimLocalPresidentClubForUser(user) {
  const normalizedUser = normalizeUser(user);
  if (!normalizedUser?.id) {
    return { ok: false, code: "NO_USER", error: "Thiếu user." };
  }

  if (normalizedUser.clubId || normalizedUser.club_id) {
    return { ok: true, skipped: true, reason: "ALREADY_HAS_CLUB" };
  }

  const owned = listLocalPresidentClubsForUser(normalizedUser);
  if (owned.length === 0) {
    return { ok: true, skipped: true, reason: "NO_LOCAL_PRESIDENT_CLUB" };
  }

  // Ưu tiên CLB ACCC / CLB mới nhất
  const preferred =
    owned.find((club) => /accc/i.test(String(club.name || ""))) ||
    [...owned].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
    )[0];

  const result = await finalizeSelfRegisteredClubCloud(
    preferred.id,
    normalizedUser,
    preferred.venueId || preferred.tenantId || null
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    reclaimed: true,
    clubId: preferred.id,
    clubName: preferred.name,
    venueId: result.venueId,
    user: result.user || loadAuthSession()?.user || null,
  };
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

  const promoted = promoteGovernanceAthleteRole(clubId, trimmed, candidate);
  if (!promoted) {
    return;
  }

  const session = loadAuthSession();
  if (session?.user?.id === trimmed) {
    saveAuthSession(
      normalizeUser({
        ...session.user,
        clubId: promoted.clubId,
        playerId: promoted.playerId,
        role: promoted.role,
      }),
      { provider: session.provider || "dev" }
    );
  }
}

function applyGovernanceAthleteDemote(clubId, userId, governance) {
  const demoted = demoteGovernanceAthleteRole(clubId, userId, governance);
  if (!demoted) {
    return;
  }

  const session = loadAuthSession();
  if (session?.user?.id === demoted.userId) {
    saveAuthSession(
      normalizeUser({
        ...session.user,
        role: demoted.role,
      }),
      { provider: session.provider || "dev" }
    );
  }
}

function isPlaceholderGovernanceLabel(label, userId) {
  const trimmedId = String(userId || "").trim();
  const text = String(label || "").trim();
  if (!text) {
    return true;
  }
  if (!trimmedId) {
    return false;
  }
  return text === `User ${trimmedId.slice(0, 8)}`;
}

function resolvePlayerNameForAuthUser(clubId, userId) {
  const trimmed = String(userId || "").trim();
  if (!trimmed || !clubId) {
    return null;
  }

  const players = loadPlayersForClub(clubId);
  const byAuth = players.find((item) => sameUserId(item.authUserId, trimmed));
  if (byAuth?.name) {
    return String(byAuth.name).trim() || null;
  }

  const link = loadAthleteClubLink(trimmed);
  if (link?.playerId) {
    const player = players.find((item) => item.id === link.playerId);
    if (player?.name) {
      return String(player.name).trim() || null;
    }
  }

  return null;
}

function resolveGovernanceUserLabel(userId, clubId, tenantId, nameHints = null) {
  const trimmed = String(userId || "").trim();
  if (!trimmed) {
    return null;
  }

  const hinted = nameHints?.[trimmed] || nameHints?.[String(trimmed).toLowerCase()];
  if (hinted && String(hinted).trim()) {
    return String(hinted).trim();
  }

  const current = getCurrentUser();
  if (sameUserId(current?.id, trimmed)) {
    const selfName = String(current.displayName || current.email || "").trim();
    if (selfName) {
      return selfName;
    }
  }

  const playerName = resolvePlayerNameForAuthUser(clubId, trimmed);
  if (playerName) {
    return playerName;
  }

  const candidates = listClubGovernanceCandidates(clubId, tenantId);
  const matched = candidates.find((item) => sameUserId(item.userId, trimmed));
  if (matched?.displayName && !isPlaceholderGovernanceLabel(matched.displayName, trimmed)) {
    return matched.displayName;
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

  const resolveDisplayName = (userId, playerId = null) => {
    const id = String(userId || "").trim();
    const player = playerId ? playerById.get(playerId) : null;
    if (player?.name) {
      return String(player.name).trim();
    }

    const byAuth = players.find((item) => sameUserId(item.authUserId, id));
    if (byAuth?.name) {
      return String(byAuth.name).trim();
    }

    const current = getCurrentUser();
    if (sameUserId(current?.id, id)) {
      const selfName = String(current.displayName || current.email || "").trim();
      if (selfName) {
        return selfName;
      }
    }

    return `User ${id.slice(0, 8)}`;
  };

  const addCandidate = (userId, playerId = null) => {
    const id = String(userId || "").trim();
    if (!id) {
      return;
    }

    const nextName = resolveDisplayName(id, playerId);
    const existing = candidateMap.get(id);
    if (existing) {
      if (
        isPlaceholderGovernanceLabel(existing.displayName, id) &&
        !isPlaceholderGovernanceLabel(nextName, id)
      ) {
        existing.displayName = nextName;
      }
      if (!existing.playerId && playerId) {
        existing.playerId = playerId;
      }
      return;
    }

    candidateMap.set(id, {
      userId: id,
      playerId: playerId || null,
      displayName: nextName,
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
    const player = playerById.get(member.playerId);
    if (player?.authUserId) {
      addCandidate(player.authUserId, member.playerId);
    }
  }

  for (const player of players) {
    if (player?.authUserId) {
      addCandidate(player.authUserId, player.id);
    }
  }

  const governance = club.governance || {};
  const governanceUserIds = [
    governance.presidentUserId,
    governance.ownerUserId,
    ...getVicePresidentUserIds(governance),
  ];
  for (const governanceUserId of governanceUserIds) {
    if (!governanceUserId) {
      continue;
    }
    const player =
      players.find((item) => sameUserId(item.authUserId, governanceUserId)) || null;
    addCandidate(governanceUserId, player?.id || null);
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
  const club = await resolveClubForGovernance(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  if (!canChangeClubPresident(user, club) && !canRelinquishClubPresident(user, club)) {
    return { ok: false, error: "Chỉ Chủ tịch, Chủ sở hữu CLB hoặc chủ sân được đổi Chủ tịch." };
  }

  const trimmed = String(nextPresidentUserId || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Chọn thành viên làm Chủ tịch." };
  }

  const currentPresident = club.governance?.presidentUserId || null;
  if (sameUserId(currentPresident, trimmed)) {
    return { ok: true, club, skipped: true };
  }

  if (isClubStorageV2Enabled()) {
    const transferred = await rpcV2ClubTransferPresident({
      clubId,
      nextUserId: trimmed,
      expectedClubVersion: club.version ?? 1,
    });
    if (!transferred.ok) {
      return transferred;
    }
    invalidateRegistryAfterGovernanceMutation();
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
    return { ok: true, club: transferred.club, provider: "v2-rpc" };
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

export async function assignClubOwner(clubId, ownerUserId, tenantId) {
  const user = getCurrentUser();
  if (!canAssignClubOwner(user)) {
    return { ok: false, error: "Chỉ chủ sân hoặc quản trị hệ thống được gán Chủ sở hữu CLB." };
  }

  const club = await resolveClubForGovernance(clubId);
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

  if (isClubStorageV2Enabled()) {
    if (!trimmed) {
      const cleared = await rpcV2ClubClearOwner({
        clubId,
        expectedClubVersion: club.version ?? 1,
      });
      if (!cleared.ok) {
        return cleared;
      }
      invalidateRegistryAfterGovernanceMutation();
      return { ok: true, club: cleared.club, provider: "v2-rpc" };
    }

    const assigned = await rpcV2ClubAssignOwner({
      clubId,
      memberUserId: trimmed,
      expectedClubVersion: club.version ?? 1,
    });
    if (!assigned.ok) {
      return assigned;
    }
    invalidateRegistryAfterGovernanceMutation();
    return { ok: true, club: assigned.club, provider: "v2-rpc" };
  }

  const governance = {
    ...club.governance,
    ownerUserId: trimmed,
  };

  const result = updateClubMeta(clubId, { governance });
  if (result.ok) {
    const effectiveTenantId = tenantId || club.venueId || club.tenantId || null;
    void persistClubToCloud(result.club || { ...club, governance }, {
      venueId: effectiveTenantId,
      actor: user,
    });
  }

  return result;
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

export function formatRegisteredClusterDisplay(cluster) {
  if (!cluster) {
    return null;
  }
  if (typeof cluster === "string") {
    return cluster;
  }
  return cluster.name || cluster.id || null;
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
    if (currentPresident && !sameUserId(currentPresident, nextPresident)) {
      applyGovernanceAthleteDemote(clubId, currentPresident, merged);
    }
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
    for (const currentVice of currentViceIds) {
      if (!nextViceIds.some((id) => sameUserId(id, currentVice))) {
        applyGovernanceAthleteDemote(clubId, currentVice, merged);
      }
    }
    for (const nextVice of nextViceIds) {
      if (!currentViceIds.some((id) => sameUserId(id, nextVice))) {
        const athleteCheck = assertClubAthleteUser(clubId, effectiveTenantId, nextVice);
        if (athleteCheck.ok) {
          applyGovernanceAthleteSync(clubId, nextVice, athleteCheck.candidate);
        }
      }
    }
  }

  void persistClubToCloud(result.club, { venueId: effectiveTenantId, actor: user });

  return result;
}

function resolvePreferredGovernanceLabel(userId, club, clubId, tenantId, nameHints, cloudLabel) {
  const trimmedCloud = String(cloudLabel || "").trim();
  if (trimmedCloud && !isPlaceholderGovernanceLabel(trimmedCloud, userId)) {
    return trimmedCloud;
  }
  return resolveGovernanceUserLabel(userId, clubId, tenantId, nameHints);
}

export function getGovernanceDisplayLabels(club, tenantId = null, nameHints = null) {
  const gov = club?.governance || {};
  const clubId = club?.id || null;
  const effectiveTenantId = tenantId || club?.tenantId || club?.venueId || null;

  const ownerLabel = gov.ownerUserId
    ? resolvePreferredGovernanceLabel(
        gov.ownerUserId,
        club,
        clubId,
        effectiveTenantId,
        nameHints,
        club?.ownerLabel
      )
    : "Chưa gán";
  const presidentLabel = gov.presidentUserId
    ? resolvePreferredGovernanceLabel(
        gov.presidentUserId,
        club,
        clubId,
        effectiveTenantId,
        nameHints,
        club?.presidentLabel
      )
    : "Chưa gán";
  const viceIds = getVicePresidentUserIds(gov);
  const viceLabels = viceIds.map((id) =>
    resolveGovernanceUserLabel(id, clubId, effectiveTenantId, nameHints)
  );
  const viceLabel = viceLabels.length ? viceLabels.join(", ") : "—";

  if (
    gov.ownerUserId &&
    gov.presidentUserId &&
    sameUserId(gov.ownerUserId, gov.presidentUserId)
  ) {
    const combinedBase =
      (!isPlaceholderGovernanceLabel(presidentLabel, gov.presidentUserId) && presidentLabel) ||
      (!isPlaceholderGovernanceLabel(ownerLabel, gov.ownerUserId) && ownerLabel) ||
      presidentLabel;
    return {
      ownerLabel: `${combinedBase} (Chủ sở hữu & Chủ tịch)`,
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

/** Lấy display_name từ profiles (Super Admin / venue staff / chính mình) để hiển thị Chủ tịch / Chủ sở hữu. */
export async function fetchGovernanceNameHints(userIds = []) {
  const uniqueIds = [
    ...new Set(
      (Array.isArray(userIds) ? userIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    ),
  ];

  if (uniqueIds.length === 0) {
    return {};
  }

  const hints = {};
  await Promise.all(
    uniqueIds.map(async (userId) => {
      try {
        const result = await fetchProfileByUserId(userId);
        if (!result.ok) {
          return;
        }
        const name = String(result.user?.displayName || result.profile?.display_name || "").trim();
        if (name) {
          hints[userId] = name;
        }
      } catch {
        // RLS có thể chặn — giữ fallback local
      }
    })
  );

  return hints;
}
