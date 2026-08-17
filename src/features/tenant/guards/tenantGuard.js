import { loadClubs } from "../../../data/club.js";
import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import { isGlobalRole } from "../../../auth/roles.js";
import { DEFAULT_TENANT_ID, tenantIdFromRecord } from "../../../models/tenant.js";
import { getTenantById } from "../services/tenantService.js";
import {
  buildProfileBackedTenant,
  canTrustProfileVenue,
} from "../services/profileVenueService.js";
import { decideTenantAccess } from "../services/tenantAccessDecision.js";

export function resolveTenantIdFromUser(user) {
  if (!user) {
    return null;
  }

  return tenantIdFromRecord(user);
}

export function resolveTenantIdForClub(clubId) {
  const club = loadClubs().find((item) => item.id === clubId);
  return tenantIdFromRecord(club) || DEFAULT_TENANT_ID;
}

/** Tenant đã gán rõ trên CLB — null nếu CLB chưa onboarding tenant. */
export function getExplicitTenantIdForClub(clubId) {
  const club = loadClubs().find((item) => item.id === clubId);
  return tenantIdFromRecord(club);
}

export function assertSameTenant(recordTenantId, currentTenantId) {
  const recordId = String(recordTenantId || "").trim();
  const currentId = String(currentTenantId || "").trim();

  if (!recordId || !currentId || recordId !== currentId) {
    return {
      ok: false,
      error: "Access denied: cross-tenant access is not allowed",
      code: "TENANT_FORBIDDEN",
    };
  }

  return { ok: true };
}

export function guardTenantAccess(tenantId, options = {}) {
  const { user = getCurrentUser(), rbacEnabled = isRbacEnabled() } = options;

  if (!rbacEnabled || !user) {
    return { ok: true };
  }

  if (!tenantId) {
    return {
      ok: false,
      error: "Thiếu tenant mục tiêu.",
      code: "TARGET_REQUIRED",
    };
  }

  if (isGlobalRole(user.role)) {
    return { ok: true };
  }

  const decision = decideTenantAccess(user, tenantId, { requireTarget: true });
  if (!decision.allowed) {
    return {
      ok: false,
      error: decision.reason || "Không có quyền truy cập tenant này.",
      code: decision.code || "TENANT_FORBIDDEN",
    };
  }

  return { ok: true };
}

export function guardClubTenant(clubId, currentTenantId, options = {}) {
  const { user = getCurrentUser(), rbacEnabled = isRbacEnabled() } = options;

  if (rbacEnabled && user && isGlobalRole(user.role)) {
    return { ok: true };
  }

  const clubTenantId = options.clubTenantId || getExplicitTenantIdForClub(clubId);

  if (!clubTenantId || !currentTenantId) {
    if (rbacEnabled && user) {
      return {
        ok: false,
        error: "Thiếu định danh tenant cho CLB hoặc ngữ cảnh hiện tại.",
        code: "TARGET_REQUIRED",
      };
    }
    return { ok: true };
  }

  const check = assertSameTenant(clubTenantId, currentTenantId);

  if (!check.ok) {
    return {
      ...check,
      error: "Không có quyền truy cập dữ liệu tenant này.",
    };
  }

  // Club-tenant identity match only. Actor entitlement for the Club is decided
  // by canAccessClub / club membership+governance evidence, not tenant_members
  // and not profiles.club_id.
  return { ok: true };
}

export function guardRecordTenant(record, currentTenantId, options = {}) {
  const { user = getCurrentUser(), rbacEnabled = isRbacEnabled() } = options;

  if (rbacEnabled && user && isGlobalRole(user.role)) {
    return { ok: true };
  }

  const recordTenantId = tenantIdFromRecord(record);

  if (!recordTenantId) {
    if (rbacEnabled && user) {
      return {
        ok: false,
        error: "Bản ghi thiếu tenant id.",
        code: "TARGET_REQUIRED",
      };
    }
    return { ok: true };
  }

  if (!currentTenantId) {
    if (rbacEnabled && user) {
      return {
        ok: false,
        error: "Thiếu tenant mục tiêu.",
        code: "TARGET_REQUIRED",
      };
    }
    return { ok: true };
  }

  const check = assertSameTenant(recordTenantId, currentTenantId);
  if (!check.ok) {
    return {
      ...check,
      error: "Không có quyền truy cập bản ghi này.",
    };
  }

  // Record-tenant identity match only. Tenant membership is decided by
  // decideTenantAccess / guardTenantAccess for Tenant operations, not every
  // tenant-scoped record read.
  return { ok: true };
}

export function filterByTenant(items = [], tenantId) {
  if (!tenantId) {
    return items;
  }

  return items.filter((item) => {
    const itemTenantId = tenantIdFromRecord(item);
    return !itemTenantId || itemTenantId === tenantId;
  });
}

export function filterByCluster(items = [], clusterId) {
  if (!clusterId) {
    return items;
  }

  return items.filter((item) => {
    const itemClusterId = item?.clusterId || item?.cluster_id || null;
    return !itemClusterId || itemClusterId === clusterId;
  });
}

export function listClubsForTenant(tenantId) {
  if (!tenantId) {
    return [];
  }

  return loadClubs().filter((club) => getExplicitTenantIdForClub(club.id) === tenantId);
}

export function assertTenantOperational(tenantId, options = {}) {
  const { user = null } = options;
  const tenant = getTenantById(tenantId);

  if (tenant) {
    if (tenant.status === "inactive" || tenant.status === "suspended") {
      return {
        ok: false,
        error: "Tenant đang bị khóa hoặc tạm ngưng.",
        code: "TENANT_INACTIVE",
        tenant,
      };
    }

    return { ok: true, tenant };
  }

  if (canTrustProfileVenue(user, tenantId)) {
    const profileTenant = buildProfileBackedTenant(tenantId, user);
    return { ok: true, tenant: profileTenant, source: "profile" };
  }

  return {
    ok: false,
    error: "Không tìm thấy tenant.",
    code: "TENANT_NOT_FOUND",
  };
}

export function stampWithTenantId(entity, tenantId) {
  if (!entity || !tenantId) {
    return entity;
  }

  return {
    ...entity,
    tenantId,
  };
}
