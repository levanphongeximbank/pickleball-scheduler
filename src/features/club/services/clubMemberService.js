import { guardClubAction } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { getCurrentUser } from "../../../auth/authService.js";
import { getClubById as getRegistryClubById } from "../../../domain/clubService.js";
import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import { guardClubTenant } from "../../tenant/guards/tenantGuard.js";
import { API_ERROR_CODES } from "../../api/constants/apiErrors.js";
import {
  CLUB_MEMBER_STATUSES,
  normalizeClubMemberStatus,
} from "../constants/clubMemberRoles.js";
import { canViewFullClubMembers, canDeleteClubMembers, canAddClubMembers } from "./clubGovernanceService.js";
import {
  createClubMemberRecord,
  normalizeClubMember,
} from "../models/clubMember.js";
import { loadClubExtension, saveClubExtension } from "../storage/clubExtensionStorage.js";
import { createDefaultClubRating } from "../models/clubPlayerRating.js";
import { getTenantPlayers } from "./clubTenantService.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import { findUserIdByPlayerId } from "../storage/athleteClubLinkStore.js";
import { invalidateAllClubRegistryCache } from "../registry/clubRegistryCache.js";
import { invalidateMyActiveClubMembershipCache } from "./clubActiveMembershipService.js";
import { mapClubCommandError } from "./clubCommandErrorMap.js";
import { assertLegacyMembershipRosterWriteAllowed } from "./clubLegacyWriteGuard.js";
import {
  rpcV2ClubAddMember,
  rpcV2ClubRemoveMember,
  rpcV2ClubRestoreMember,
  rpcV2ClubListMembers,
} from "./clubStorageV2RpcService.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Map a Phase 42 `club_list_members` RPC row → canonical member UI shape.
 * Pure mapper for the Club Storage V2 member contract (status via the shared
 * active rule). Fetching stays in `clubStorageV2RpcService.rpcV2ClubListMembers`.
 */
export function mapV2MemberRowToUi(row = {}) {
  const roles = Array.isArray(row.governance_roles)
    ? row.governance_roles.map((r) => String(r || "").trim()).filter(Boolean)
    : [];
  const status = normalizeClubMemberStatus(row.status);

  return {
    id: String(row.id || ""),
    playerId: String(row.user_id || row.player_id || ""),
    userId: String(row.user_id || "").trim() || null,
    displayName: String(row.display_name || "").trim(),
    email: String(row.email || "").trim() || null,
    status,
    role: "member",
    membershipType: row.membership_type || "regular",
    governanceRoles: roles,
    version: row.version ?? null,
    source: "v2-rpc",
  };
}

function guardClubMemberAccess(clubId, tenantId, permission) {
  if (tenantId) {
    const tenantCheck = guardClubTenant(clubId, tenantId);
    if (!tenantCheck.ok) {
      return tenantCheck;
    }
  }
  return guardClubAction(clubId, permission);
}

function invalidateAfterMemberCommand(userId = null) {
  invalidateAllClubRegistryCache();
  invalidateMyActiveClubMembershipCache(userId);
}

function mapMemberCommandError(result, fallbackError) {
  return mapClubCommandError(result, {
    fallbackCode: API_ERROR_CODES.INTERNAL_ERROR,
    fallbackError,
  });
}

/**
 * Resolve canonical auth user_id for add/remove RPCs.
 * Never pass blob playerId as user_id unless it is already a UUID.
 *
 * Priority:
 * 1. options.targetUserId / member.userId
 * 2. tenant player.authUserId for playerId
 * 3. athleteClubLinkStore findUserIdByPlayerId
 * 4. playerId if it is already a UUID (V2 row playerId === user_id)
 */
export function resolveTargetUserIdForMemberCommand({
  playerId = null,
  targetUserId = null,
  tenantId = null,
} = {}) {
  const direct = String(targetUserId || "").trim();
  if (direct) {
    if (!UUID_RE.test(direct)) {
      return {
        ok: false,
        code: API_ERROR_CODES.VALIDATION_ERROR,
        error: "target_user_id không hợp lệ.",
        serverCode: "VALIDATION",
      };
    }
    return { ok: true, userId: direct };
  }

  const trimmedPlayerId = String(playerId || "").trim();
  if (!trimmedPlayerId) {
    return {
      ok: false,
      code: API_ERROR_CODES.VALIDATION_ERROR,
      error: "Thiếu player hoặc user đích.",
      serverCode: "VALIDATION",
    };
  }

  if (tenantId) {
    const player = getTenantPlayers(tenantId).find((p) => p.id === trimmedPlayerId);
    const authUserId = String(player?.authUserId || "").trim();
    if (authUserId && UUID_RE.test(authUserId)) {
      return { ok: true, userId: authUserId };
    }
  }

  const linked = String(findUserIdByPlayerId(trimmedPlayerId) || "").trim();
  if (linked && UUID_RE.test(linked)) {
    return { ok: true, userId: linked };
  }

  if (UUID_RE.test(trimmedPlayerId)) {
    return { ok: true, userId: trimmedPlayerId };
  }

  return {
    ok: false,
    code: API_ERROR_CODES.VALIDATION_ERROR,
    error: "Player chưa liên kết tài khoản đăng nhập. Không thể thêm/gỡ qua cloud.",
    serverCode: "VALIDATION",
  };
}

/**
 * Probe whether cloud membership mutation RPCs are reachable.
 * Uses list-members as a non-mutating transport/deployment probe.
 */
/**
 * Soft probe for member mutation transport readiness.
 * Phase 1C: do NOT treat FORBIDDEN list access as write-ready.
 * Write button visibility must also use canManageClubGovernance / canDeleteClubMembers.
 */
export async function probeClubMemberMutationAccess(clubId) {
  const trimmed = String(clubId || "").trim();
  if (!trimmed) {
    return {
      ok: false,
      code: API_ERROR_CODES.VALIDATION_ERROR,
      error: "Thiếu club id.",
    };
  }
  if (!isClubStorageV2Enabled()) {
    return { ok: true, provider: "blob" };
  }
  const result = await rpcV2ClubListMembers(trimmed);
  if (!result.ok) {
    if (result.code === "RPC_NOT_DEPLOYED" || result.code === "NO_SUPABASE") {
      return mapMemberCommandError(result, "Lệnh thành viên cloud chưa sẵn sàng.");
    }
    if (result.code === "FORBIDDEN" || result.code === "NOT_AUTHENTICATED") {
      return mapMemberCommandError(result, "Bạn không có quyền thao tác thành viên CLB này.");
    }
    return mapMemberCommandError(result, "Không kiểm tra được lệnh thành viên cloud.");
  }
  return { ok: true, provider: "v2-rpc" };
}

/**
 * User-facing message for member command failures (no stack traces).
 */
export function formatMemberCommandUserError(result, fallback = "Không thực hiện được thao tác thành viên.") {
  if (!result || result.ok) {
    return null;
  }
  const serverCode = String(result.serverCode || "").trim();
  if (serverCode === "VERSION_CONFLICT") {
    return "Dữ liệu CLB đã thay đổi trên máy chủ. Vui lòng tải lại rồi thử lại.";
  }
  if (serverCode === "IDEMPOTENCY_CONFLICT") {
    return result.error || "Yêu cầu trùng khóa nhưng khác nội dung. Vui lòng thử lại với khóa mới.";
  }
  if (serverCode === "ALREADY_MEMBER") {
    return result.error || "Thành viên này đã có trong CLB.";
  }
  if (serverCode === "FORBIDDEN" || result.code === API_ERROR_CODES.FORBIDDEN) {
    return result.error || "Bạn không có quyền thực hiện thao tác này.";
  }
  return result.error || fallback;
}

function syncMembersFromBlob(clubId, tenantId) {
  const ext = loadClubExtension(clubId);
  if (ext.members.length > 0) {
    return ext;
  }

  // Phase 45A.4C.5 — never hydrate/write blob roster while Membership V2 is authoritative.
  // Cloud roster lives in public.club_members; empty local extension is not Membership authority.
  if (isClubStorageV2Enabled()) {
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

/**
 * LEGACY / OFFLINE ONLY — blob roster add via clubExtension.members.
 * Reachable only when Club Storage V2 is OFF (see addMemberToClub early-return).
 * Hard-blocked under V2 as defense-in-depth (Phase 45A.4C.5).
 */
function addMemberToClubLegacy(clubId, playerId, tenantId, options = {}) {
  const legacyGate = assertLegacyMembershipRosterWriteAllowed({
    operation: "addMemberToClubLegacy",
  });
  if (!legacyGate.ok) {
    return legacyGate;
  }

  if (!options.skipPermissionGuard) {
    const check = guardClubMemberAccess(clubId, tenantId, PERMISSIONS.PLAYER_UPDATE);
    if (!check.ok) {
      return check;
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

/**
 * LEGACY / OFFLINE ONLY — blob roster soft-remove via clubExtension.members.
 * Reachable only when Club Storage V2 is OFF.
 * Hard-blocked under V2 as defense-in-depth (Phase 45A.4C.5).
 */
function removeMemberFromClubLegacy(clubId, playerId, tenantId, options = {}) {
  const legacyGate = assertLegacyMembershipRosterWriteAllowed({
    operation: "removeMemberFromClubLegacy",
  });
  if (!legacyGate.ok) {
    return legacyGate;
  }

  if (!options.skipPermissionGuard) {
    const club = getRegistryClubById(clubId);
    const user = getCurrentUser();
    if (club && user && !canDeleteClubMembers(user, club)) {
      return { ok: false, error: "Không có quyền xóa thành viên CLB." };
    }

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
  const ext = syncMembersFromBlob(clubId, tenantId);
  const existing = ext.members.find((m) => m.playerId === trimmedPlayerId);
  if (!existing) {
    return { ok: false, error: "Không tìm thấy thành viên trong CLB." };
  }

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

/**
 * Phase 45A.4C.4 — V2: club_add_member via clubStorageV2RpcService.
 * V2-OFF: legacy blob roster write.
 *
 * @param {string} clubId
 * @param {string|null} playerId blob player id OR (under V2) may be omitted when targetUserId set
 * @param {string|null} tenantId
 * @param {{ skipPermissionGuard?: boolean, targetUserId?: string, membershipType?: string, expectedVersion?: number|null, idempotencyKey?: string, requestId?: string, role?: string }} [options]
 */
export async function addMemberToClub(clubId, playerId, tenantId, options = {}) {
  if (isClubStorageV2Enabled()) {
    if (!options.skipPermissionGuard) {
      const club = getRegistryClubById(clubId);
      const user = getCurrentUser();
      if (club && user && !canAddClubMembers(user, club)) {
        return {
          ok: false,
          code: API_ERROR_CODES.FORBIDDEN,
          error: "Không có quyền thêm thành viên CLB (Phó chủ tịch không được thêm trực tiếp).",
        };
      }

      const check = guardClubMemberAccess(clubId, tenantId, PERMISSIONS.PLAYER_UPDATE);
      if (!check.ok) {
        return check;
      }
    }

    const resolved = resolveTargetUserIdForMemberCommand({
      playerId,
      targetUserId: options.targetUserId,
      tenantId,
    });
    if (!resolved.ok) {
      return resolved;
    }

    const added = await rpcV2ClubAddMember({
      clubId,
      targetUserId: resolved.userId,
      membershipType: options.membershipType || "regular",
      expectedVersion: options.expectedVersion ?? null,
      requestId: options.idempotencyKey || options.requestId,
    });
    if (!added.ok) {
      return mapMemberCommandError(added, "Không thêm được thành viên trên cloud.");
    }

    invalidateAfterMemberCommand(resolved.userId);
    return {
      ok: true,
      member: added.member,
      version: added.version,
      provider: "v2-rpc",
      userId: resolved.userId,
    };
  }

  return addMemberToClubLegacy(clubId, playerId, tenantId, options);
}

/**
 * Phase 45A.4C.4 — V2: club_remove_member via clubStorageV2RpcService.
 * V2-OFF: legacy blob soft-inactive.
 */
export async function removeMemberFromClub(clubId, playerId, tenantId, options = {}) {
  if (isClubStorageV2Enabled()) {
    if (!options.skipPermissionGuard) {
      const club = getRegistryClubById(clubId);
      const user = getCurrentUser();
      if (club && user && !canDeleteClubMembers(user, club)) {
        return {
          ok: false,
          code: API_ERROR_CODES.FORBIDDEN,
          error: "Không có quyền xóa thành viên CLB.",
        };
      }

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

    const resolved = resolveTargetUserIdForMemberCommand({
      playerId,
      targetUserId: options.targetUserId,
      tenantId,
    });
    if (!resolved.ok) {
      return resolved;
    }

    const removed = await rpcV2ClubRemoveMember({
      clubId,
      targetUserId: resolved.userId,
      expectedVersion: options.expectedVersion ?? null,
      requestId: options.idempotencyKey || options.requestId,
    });
    if (!removed.ok) {
      return mapMemberCommandError(removed, "Không gỡ được thành viên trên cloud.");
    }

    invalidateAfterMemberCommand(resolved.userId);
    return {
      ok: true,
      member: removed.member,
      version: removed.version,
      provider: "v2-rpc",
      userId: resolved.userId,
    };
  }

  return removeMemberFromClubLegacy(clubId, playerId, tenantId, options);
}

/**
 * Phase 1B — V2: club_restore_member (removed → active).
 * V2-OFF: not supported (legacy used inactive toggle, not removed).
 */
export async function restoreMemberToClub(clubId, playerId, tenantId, options = {}) {
  if (!isClubStorageV2Enabled()) {
    return {
      ok: false,
      code: API_ERROR_CODES.FEATURE_DISABLED,
      error: "Khôi phục thành viên chỉ hỗ trợ khi Club Storage V2 bật.",
    };
  }

  if (!options.skipPermissionGuard) {
    const club = getRegistryClubById(clubId);
    const user = getCurrentUser();
    if (club && user && !canAddClubMembers(user, club)) {
      return {
        ok: false,
        code: API_ERROR_CODES.FORBIDDEN,
        error: "Không có quyền khôi phục thành viên CLB.",
      };
    }

    const check = guardClubMemberAccess(clubId, tenantId, PERMISSIONS.PLAYER_UPDATE);
    if (!check.ok) {
      return check;
    }
  }

  const resolved = resolveTargetUserIdForMemberCommand({
    playerId,
    targetUserId: options.targetUserId,
    tenantId,
  });
  if (!resolved.ok) {
    return resolved;
  }

  const restored = await rpcV2ClubRestoreMember({
    clubId,
    targetUserId: resolved.userId,
    expectedVersion: options.expectedVersion ?? null,
    requestId: options.idempotencyKey || options.requestId,
  });
  if (!restored.ok) {
    return mapMemberCommandError(restored, "Không khôi phục được thành viên trên cloud.");
  }

  invalidateAfterMemberCommand(resolved.userId);
  return {
    ok: true,
    member: restored.member,
    version: restored.version,
    provider: "v2-rpc",
    userId: resolved.userId,
  };
}

export function updateClubMemberRole(clubId, playerId, role, tenantId) {
  if (isClubStorageV2Enabled()) {
    return {
      ok: false,
      code: API_ERROR_CODES.FORBIDDEN,
      error: "Đổi vai trò thành viên chưa hỗ trợ trên cloud (chờ RPC role).",
    };
  }

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
  if (isClubStorageV2Enabled()) {
    return {
      ok: false,
      code: API_ERROR_CODES.FORBIDDEN,
      error: "Đổi trạng thái thành viên chưa hỗ trợ trên cloud (chờ RPC status).",
    };
  }

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

export function isProtectedGovernanceMember(member = {}) {
  const roles = Array.isArray(member.governanceRoles) ? member.governanceRoles : [];
  return roles.some((r) => r === "president" || r === "club_owner");
}
