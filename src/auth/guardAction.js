import { loadClubs } from "../data/club.js";
import { loadActiveTenantId } from "../data/tenantSession.js";
import { PERMISSIONS } from "./permissions.js";
import { getCurrentUser, isRbacEnabled } from "./authService.js";
import { assertCan, can, canAccessClub, isRbacEnforced } from "./rbac.js";
import { guardSubscriptionForClub } from "./subscriptionGuard.js";
import { isGlobalRole } from "./roles.js";
import {
  guardClubTenant,
  resolveTenantIdForClub,
} from "../features/tenant/guards/tenantGuard.js";
import { resolveEffectiveTenantId } from "../features/tenant/services/tenantService.js";

export function getAuthOptions() {
  return {
    user: getCurrentUser(),
    rbacEnabled: isRbacEnabled(),
  };
}

export function scopeForClubId(clubId) {
  const club = loadClubs().find((item) => item.id === clubId);
  const tenantId = resolveTenantIdForClub(clubId);
  return {
    clubId: clubId || null,
    venueId: club?.venueId || tenantId || null,
    tenantId,
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

  const scope = scopeForClubId(clubId);

  if (!canAccessClub(user, clubId, { venueId: scope.venueId }, { rbacEnabled })) {
    return {
      ok: false,
      error: "Không có quyền truy cập CLB này.",
      code: "FORBIDDEN",
    };
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
