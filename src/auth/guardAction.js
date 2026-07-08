import { loadClubs } from "../data/club.js";
import { bindClubVenueRegistry } from "../domain/clubService.js";
import { loadActiveTenantId } from "../data/tenantSession.js";
import { PERMISSIONS } from "./permissions.js";
import { getCurrentUser, isRbacEnabled } from "./authService.js";
import { assertCan, can, canAccessClub, isRbacEnforced } from "./rbac.js";
import { guardSubscriptionForClub } from "./subscriptionGuard.js";
import { isClubScopedRole, isGlobalRole, isVenueScopedRole } from "./roles.js";
import {
  guardClubTenant,
  resolveTenantIdForClub,
  getExplicitTenantIdForClub,
} from "../features/tenant/guards/tenantGuard.js";
import { resolveEffectiveTenantId } from "../features/tenant/services/tenantService.js";
import { canAccessCluster } from "./rbac.js";
import { getClusterById } from "../features/court-cluster/services/courtClusterService.js";

export function getAuthOptions() {
  return {
    user: getCurrentUser(),
    rbacEnabled: isRbacEnabled(),
  };
}

export function scopeForClubId(clubId, clusterId = null) {
  const club = loadClubs().find((item) => item.id === clubId);
  const tenantId = resolveTenantIdForClub(clubId);
  return {
    clubId: clubId || null,
    venueId: club?.venueId || tenantId || null,
    tenantId,
    clusterId: clusterId || null,
  };
}

function resolveCurrentTenantId(user) {
  if (!user) {
    return null;
  }

  if (isGlobalRole(user.role)) {
    return loadActiveTenantId() || resolveEffectiveTenantId(user);
  }

  return resolveEffectiveTenantId(user);
}

export function guardPermission(permission, scope = {}, options = {}) {
  const { user, rbacEnabled } = { ...getAuthOptions(), ...options };
  return assertCan(user, permission, scope, { rbacEnabled });
}

export function guardClubAccess(clubId, options = {}) {
  const { user, rbacEnabled } = { ...getAuthOptions(), ...options };

  if (!isRbacEnforced({ rbacEnabled, user })) {
    return { ok: true };
  }

  const club = loadClubs().find((item) => item.id === clubId);
  const profileVenueId =
    user && isVenueScopedRole(user.role) ? user.venueId || user.tenantId : null;
  const scope = scopeForClubId(clubId);
  const clubMeta = {
    venueId: profileVenueId || club?.venueId || scope.venueId || null,
  };

  if (profileVenueId && club && !club.isDefault && !club.venueId) {
    bindClubVenueRegistry(clubId, profileVenueId, { skipGuard: true });
    clubMeta.venueId = profileVenueId;
  }

  if (!canAccessClub(user, clubId, clubMeta, { rbacEnabled })) {
    if (isClubScopedRole(user?.role) && !user?.clubId) {
      return {
        ok: false,
        error: "Tài khoản chưa được gán CLB. Liên hệ quản trị viên.",
        code: "CLUB_UNASSIGNED",
      };
    }

    return {
      ok: false,
      error: "Không có quyền truy cập CLB này.",
      code: "FORBIDDEN",
    };
  }

  if (profileVenueId && club && !club.isDefault) {
    const explicitTenant = getExplicitTenantIdForClub(clubId);
    if (club.venueId === profileVenueId && explicitTenant !== profileVenueId) {
      bindClubVenueRegistry(clubId, profileVenueId, { skipGuard: true });
    }
  }

  const currentTenantId = resolveCurrentTenantId(user);
  if (currentTenantId) {
    const tenantCheck = guardClubTenant(clubId, currentTenantId, { user, rbacEnabled });
    if (!tenantCheck.ok) {
      return tenantCheck;
    }
  }

  return { ok: true };
}

/** Kiểm tra quyền + quyền truy cập CLB (nếu có clubId). */
export function guardClubAction(clubId, permission, extraScope = {}, options = {}) {
  const access = guardClubAccess(clubId, options);
  if (!access.ok) {
    return access;
  }

  const scope = {
    ...scopeForClubId(clubId),
    ...extraScope,
  };

  const authUser = options.user ?? getAuthOptions().user;
  if (authUser && isVenueScopedRole(authUser.role)) {
    const profileVenueId = authUser.venueId || authUser.tenantId;
    if (profileVenueId) {
      scope.venueId = profileVenueId;
      scope.tenantId = profileVenueId;
    }
  }

  return guardPermission(permission, scope, options);
}

/** Cho phép nếu user có ít nhất một permission trong danh sách. */
export function guardAnyClubAction(clubId, permissions = [], extraScope = {}, options = {}) {
  const access = guardClubAccess(clubId, options);
  if (!access.ok) {
    return access;
  }

  const { user, rbacEnabled } = { ...getAuthOptions(), ...options };

  if (!isRbacEnforced({ rbacEnabled, user })) {
    return { ok: true };
  }

  const scope = {
    ...scopeForClubId(clubId),
    ...extraScope,
  };

  const allowed = permissions.some((permission) => can(user, permission, scope, { rbacEnabled }));

  if (allowed) {
    return { ok: true };
  }

  return {
    ok: false,
    error: `Không có quyền thực hiện thao tác này.`,
    code: "FORBIDDEN",
  };
}

export function guardBookingSave(clubId, { isNew = false } = {}, options = {}) {
  if (isNew) {
    const createCheck = guardClubAction(clubId, PERMISSIONS.BOOKING_CREATE, {}, options);
    if (createCheck.ok) {
      return createCheck;
    }
    return guardClubAction(clubId, PERMISSIONS.BOOKING_UPDATE, {}, options);
  }

  return guardClubAction(clubId, PERMISSIONS.BOOKING_UPDATE, {}, options);
}

export function guardBookingPayment(clubId, options = {}) {
  return guardAnyClubAction(
    clubId,
    [PERMISSIONS.FINANCE_EDIT, PERMISSIONS.BOOKING_UPDATE],
    {},
    options
  );
}

export function guardDirectorAction(clubId, options = {}) {
  const permCheck = guardAnyClubAction(
    clubId,
    [PERMISSIONS.DIRECTOR_USE, PERMISSIONS.TOURNAMENT_UPDATE, PERMISSIONS.MATCH_UPDATE],
    {},
    options
  );

  if (!permCheck.ok) {
    return permCheck;
  }

  return guardSubscriptionForClub(clubId, "director_mode", options);
}

/** Director lock sân — cũng dùng trong module Xếp sân. */
export function guardCourtLockAction(clubId, options = {}) {
  return guardAnyClubAction(
    clubId,
    [PERMISSIONS.DIRECTOR_USE, PERMISSIONS.TOURNAMENT_UPDATE, PERMISSIONS.SCHEDULING_RUN],
    {},
    options
  );
}

export function guardClusterAccess(clusterId, options = {}) {
  const { user, rbacEnabled } = { ...getAuthOptions(), ...options };

  if (!isRbacEnforced({ rbacEnabled, user })) {
    return { ok: true };
  }

  const cluster = getClusterById(clusterId);
  if (!cluster) {
    return { ok: false, error: "Không tìm thấy cụm sân", code: "NOT_FOUND" };
  }

  if (!canAccessCluster(user, clusterId, { venueId: cluster.venueId }, { rbacEnabled })) {
    return {
      ok: false,
      error: "Không có quyền truy cập cụm sân này.",
      code: "FORBIDDEN",
    };
  }

  return { ok: true, cluster };
}
