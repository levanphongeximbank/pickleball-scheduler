import { loadClubs, saveClubs } from "../../../data/club.js";
import { loadClubData, loadClubData as initClubData } from "../../../domain/clubStorage.js";
import { getClubById as getRegistryClubById, updateClubMeta } from "../../../domain/clubService.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { guardClubAction, guardPermission } from "../../../auth/guardAction.js";
import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import { ROLES, isGlobalRole, isPlatformWideRole, isVenueScopedRole } from "../../../auth/roles.js";
import { loadActiveTenantId } from "../../../data/tenantSession.js";
import { resolveEffectiveTenantId } from "../../tenant/services/tenantService.js";
import { guardMaxClubs } from "../../../auth/subscriptionGuard.js";
import { guardClubTenant, listClubsForTenant } from "../../tenant/guards/tenantGuard.js";
import { createClubRecord } from "../../../models/club.js";
import { loadClubExtension, purgeClubExtension } from "../storage/clubExtensionStorage.js";
import { CLUB_STATUSES } from "../constants/clubStatus.js";
import { canUserViewClub } from "./clubAccessService.js";
import {
  resolveGovernanceForCreate,
  canSelfRegisterClub,
  bootstrapSelfRegisteredPresident,
  finalizeSelfRegisteredClubCloud,
  updateClubGovernance,
} from "./clubGovernanceService.js";
import { persistClubToCloud } from "./clubRegistryCloudService.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import { isCanonicalPlayerRepositoryEnabled } from "../config/canonicalRepositoryFlags.js";
import { rpcV2ClubCreate, rpcV2ClubUpdate } from "./clubStorageV2RpcService.js";
import { mapClubCommandError } from "./clubCommandErrorMap.js";
import { invalidateAllClubRegistryCache } from "../registry/clubRegistryCache.js";
import { invalidateMyActiveClubMembershipCache } from "./clubActiveMembershipService.js";
import { API_ERROR_CODES } from "../../api/constants/apiErrors.js";
import { listPlayersForTenantAware } from "../repositories/canonicalPlayerPickerAdapter.js";

function invalidateAfterClubCommand(userId = null) {
  invalidateAllClubRegistryCache();
  invalidateMyActiveClubMembershipCache(userId);
}
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
    const user = getCurrentUser();
    const skipTenantGuard =
      isRbacEnabled() && user && isPlatformWideRole(user.role);
    if (!skipTenantGuard) {
      const check = guardClubTenant(clubId, tenantId);
      if (!check.ok) {
        return null;
      }
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

export async function createClub(data = {}) {
  const name = String(data.name || "").trim();
  if (!name) {
    return {
      ok: false,
      code: API_ERROR_CODES.VALIDATION_ERROR,
      error: "Tên CLB bắt buộc.",
    };
  }

  const user = getCurrentUser();
  const tenantId = data.tenantId || resolveTenantIdForCreate(user);
  if (isRbacEnabled()) {
    const tenantCheck = assertTenantForMutation(tenantId);
    if (!tenantCheck.ok) {
      return { ...tenantCheck, code: API_ERROR_CODES.TENANT_MISMATCH };
    }
  }

  const check = guardPermission(
    PERMISSIONS.CLUB_CREATE,
    tenantId ? { venueId: tenantId, tenantId } : {}
  );
  if (!check.ok && !(user && canSelfRegisterClub(user))) {
    return check;
  }

  if (!tenantId) {
    return {
      ok: false,
      code: API_ERROR_CODES.TENANT_MISMATCH,
      error: "Thiếu tenant/venue để tạo CLB.",
    };
  }

  // Phase 45A.3D/3E — Cloud SSOT create (authoritative). No blob dual-write,
  // no legacy bootstrap, no persistClubToCloud, no saveClubs. Failure = error.
  if (isClubStorageV2Enabled()) {
    const cloud = await rpcV2ClubCreate({
      tenantId,
      name,
      code: data.code || null,
      description: data.description || "",
      registeredClusterId:
        data.governance?.registeredClusterId || data.registeredClusterId || null,
    });
    if (!cloud.ok) {
      return mapClubCommandError(cloud, {
        fallbackCode: API_ERROR_CODES.INTERNAL_ERROR,
        fallbackError: "Không tạo được CLB trên cloud.",
      });
    }
    invalidateAfterClubCommand(user?.id || null);
    return {
      ok: true,
      club: cloud.club,
      provider: "v2-rpc",
      version: cloud.version,
    };
  }

  if (tenantId) {
    const limitCheck = guardMaxClubs(tenantId);
    if (!limitCheck.ok) {
      return limitCheck;
    }
  }

  const tenantClubs = getClubsByTenant(tenantId);
  if (findDuplicateName(tenantClubs, name)) {
    return {
      ok: false,
      code: API_ERROR_CODES.CONFLICT,
      error: "Tên CLB đã tồn tại trong tenant này.",
    };
  }

  if (data.code && findDuplicateCode(tenantClubs, data.code)) {
    return {
      ok: false,
      code: API_ERROR_CODES.CONFLICT,
      error: "Mã CLB đã tồn tại trong tenant này.",
    };
  }

  const clubs = loadClubs();
  const { governance, status } = resolveGovernanceForCreate(data, user);

  if (!governance.presidentUserId) {
    return {
      ok: false,
      code: API_ERROR_CODES.VALIDATION_ERROR,
      error: "Chủ tịch CLB bắt buộc (presidentUserId).",
    };
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

  const isSelfRegister =
    user &&
    canSelfRegisterClub(user) &&
    String(governance.presidentUserId || "") === String(user.id);

  if (isSelfRegister) {
    const boot = await bootstrapSelfRegisteredPresident(club.id, user, tenantId);
    if (!boot.ok) {
      saveClubs(loadClubs().filter((item) => item.id !== club.id));
      purgeClubExtension(club.id);
      const error =
        boot.code === "TENANT_FORBIDDEN" || /cross-tenant/i.test(String(boot.error || ""))
          ? "Không thể gán CLB vào tenant đã chọn. Vui lòng thử lại hoặc liên hệ hỗ trợ."
          : boot.error;
      return { ok: false, error, code: boot.code };
    }

    const cloudFinalize = await finalizeSelfRegisteredClubCloud(club.id, user, tenantId);
    if (!cloudFinalize.ok) {
      return {
        ok: false,
        code: cloudFinalize.code || "CLOUD_SYNC_FAILED",
        error:
          cloudFinalize.error ||
          "CLB đã tạo trên máy này nhưng chưa lưu lên cloud. Thử lại hoặc chọn đúng cụm sân Nam Long.",
        club: getRegistryClubById(club.id) || club,
      };
    }

    return {
      ok: true,
      club: getRegistryClubById(club.id) || club,
      cloudSynced: true,
      warning: cloudFinalize.warning || null,
    };
  }

  const cloudResult = await persistClubToCloud(club, { venueId: tenantId, actor: user });
  if (!cloudResult.ok && cloudResult.code !== "PRESIDENT_REQUIRED") {
    return {
      ok: true,
      club,
      cloudSynced: false,
      warning: cloudResult.error || "CLB đã tạo local nhưng chưa đồng bộ cloud.",
    };
  }

  return { ok: true, club, cloudSynced: cloudResult.ok };
}

/**
 * Canonical Club UPDATE orchestrator (Phase 45A.3D / 45A.3E).
 *
 * V2 ON: public.club_update via rpcV2ClubUpdate — no saveClubs / updateClubMeta /
 * persistClubToCloud / club_upsert_registry. Blob-only metadata (note/timezone/
 * slug/logo/…) is NOT accepted here.
 *
 * V2 OFF: legacy blob + optional cloud dual-write rollback adapter only.
 */
export async function updateClub(clubId, data = {}, tenantId) {
  const trimmedId = String(clubId || "").trim();
  if (!trimmedId) {
    return {
      ok: false,
      code: API_ERROR_CODES.CLUB_REQUIRED,
      error: "Thiếu id CLB.",
    };
  }

  const check = guardClubAction(trimmedId, PERMISSIONS.CLUB_UPDATE);
  if (!check.ok) {
    return check;
  }

  if (isClubStorageV2Enabled()) {
    const incoming = data.governance || {};
    const hasBlobOnlyMeta =
      data.note !== undefined ||
      data.timezone !== undefined ||
      data.slug !== undefined ||
      data.logo !== undefined ||
      data.address !== undefined ||
      data.phone !== undefined ||
      incoming.registeredCourtIds !== undefined;

    // Blob-only / deferred fields must not be silently applied under V2.
    void hasBlobOnlyMeta;

    const payload = {
      clubId: trimmedId,
      expectedClubVersion:
        data.expectedClubVersion ?? data.version ?? null,
    };

    if (payload.expectedClubVersion == null) {
      // Prefer caller-supplied version; fall back to a local registry tip if present.
      const tip = getRegistryClubById(trimmedId);
      payload.expectedClubVersion = tip?.version ?? 1;
    }

    if (data.name !== undefined) payload.name = data.name;
    if (data.code !== undefined) payload.code = data.code;
    if (data.description !== undefined) payload.description = data.description;
    if (data.status !== undefined) payload.status = data.status;

    const cluster =
      data.registeredClusterId !== undefined
        ? data.registeredClusterId
        : incoming.registeredClusterId !== undefined
          ? incoming.registeredClusterId
          : undefined;
    if (cluster !== undefined) {
      payload.registeredClusterId = cluster;
    }

    const hasEntityField =
      payload.name !== undefined ||
      payload.code !== undefined ||
      payload.description !== undefined ||
      payload.status !== undefined ||
      payload.registeredClusterId !== undefined;

    if (!hasEntityField) {
      // Governance-only patches (president/owner/VP) stay on the governance service.
      if (data.governance !== undefined) {
        const governancePatch = {};
        if (incoming.presidentUserId !== undefined) {
          governancePatch.presidentUserId = incoming.presidentUserId;
        }
        if (incoming.vicePresidentUserId !== undefined) {
          governancePatch.vicePresidentUserId = incoming.vicePresidentUserId;
        }
        if (incoming.ownerUserId !== undefined) {
          governancePatch.ownerUserId = incoming.ownerUserId;
        }
        if (Object.keys(governancePatch).length > 0) {
          return updateClubGovernance(trimmedId, governancePatch, tenantId);
        }
      }
      const tip = getRegistryClubById(trimmedId) || getClubById(trimmedId, tenantId);
      return { ok: true, club: tip };
    }

    const cloud = await rpcV2ClubUpdate(payload);
    if (!cloud.ok) {
      return mapClubCommandError(cloud, {
        fallbackCode: API_ERROR_CODES.INTERNAL_ERROR,
        fallbackError: "Không cập nhật được CLB trên cloud.",
      });
    }

    invalidateAfterClubCommand(getCurrentUser()?.id || null);
    return {
      ok: true,
      club: cloud.club,
      provider: "v2-rpc",
      version: cloud.version,
    };
  }

  const club = getClubById(trimmedId, tenantId);
  if (!club) {
    return {
      ok: false,
      code: API_ERROR_CODES.NOT_FOUND,
      error: "Không tìm thấy CLB.",
    };
  }

  const effectiveTenantId = tenantId || club.tenantId || club.venueId;
  const tenantClubs = getClubsByTenant(effectiveTenantId);

  if (data.name && findDuplicateName(tenantClubs, data.name, trimmedId)) {
    return {
      ok: false,
      code: API_ERROR_CODES.CONFLICT,
      error: "Tên CLB đã tồn tại trong tenant này.",
    };
  }

  if (data.code && findDuplicateCode(tenantClubs, data.code, trimmedId)) {
    return {
      ok: false,
      code: API_ERROR_CODES.CONFLICT,
      error: "Mã CLB đã tồn tại trong tenant này.",
    };
  }

  const patch = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.code !== undefined) patch.code = data.code;
  if (data.description !== undefined) patch.description = data.description;
  if (data.status !== undefined) patch.status = data.status;

  if (data.governance !== undefined) {
    const governancePatch = {};
    const incoming = data.governance || {};

    if (incoming.presidentUserId !== undefined) {
      governancePatch.presidentUserId = incoming.presidentUserId;
    }
    if (incoming.vicePresidentUserId !== undefined) {
      governancePatch.vicePresidentUserId = incoming.vicePresidentUserId;
    }
    if (incoming.ownerUserId !== undefined) {
      governancePatch.ownerUserId = incoming.ownerUserId;
    }
    if (incoming.registeredClusterId !== undefined) {
      governancePatch.registeredClusterId = incoming.registeredClusterId;
    }
    if (incoming.registeredCourtIds !== undefined) {
      governancePatch.registeredCourtIds = incoming.registeredCourtIds;
    }

    if (Object.keys(governancePatch).length > 0) {
      const governanceResult = updateClubGovernance(
        trimmedId,
        governancePatch,
        effectiveTenantId
      );
      if (!governanceResult.ok) {
        return governanceResult;
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    const unchanged = getRegistryClubById(trimmedId);
    void persistClubToCloud(unchanged, { venueId: effectiveTenantId });
    return { ok: true, club: unchanged };
  }

  const result = updateClubMeta(trimmedId, patch);
  if (result.ok) {
    void persistClubToCloud(result.club, { venueId: effectiveTenantId });
  }
  return result;
}

export async function deactivateClub(clubId, tenantId) {
  return updateClub(clubId, { status: CLUB_STATUSES.INACTIVE }, tenantId);
}

export async function deleteClubSoft(clubId, tenantId) {
  return deactivateClub(clubId, tenantId);
}

/** Synchronous legacy blob tenant player aggregate (flag OFF or sync callers). */
export function getTenantPlayersLegacy(tenantId) {
  const clubs = getClubsByTenant(tenantId);
  const byId = new Map();

  for (const club of clubs) {
    if (club?.isDefault || club?.id === "default-club") {
      continue;
    }
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

/**
 * Sync tenant players — always legacy blob aggregate for backward-compatible sync callers.
 * Migrated UIs should use getTenantPlayersAware / useTenantPlayerPool when canonical flags ON.
 */
export function getTenantPlayers(tenantId) {
  return getTenantPlayersLegacy(tenantId);
}

/**
 * Flag-aware async tenant player pool (legacy UI shape).
 * @param {string} tenantId
 * @param {object} [options]
 */
export async function getTenantPlayersAware(tenantId, options = {}) {
  if (!isCanonicalPlayerRepositoryEnabled(options.envSource)) {
    const legacy = getTenantPlayersLegacy(tenantId);
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

  return listPlayersForTenantAware(tenantId, options);
}

export function purgeClubManagementData(clubId) {
  purgeClubExtension(clubId);
}
