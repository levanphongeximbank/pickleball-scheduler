import { loadClubs } from "../data/club.js";
import { PERMISSIONS } from "./permissions.js";
import { getCurrentUser, isRbacEnabled } from "./authService.js";
import { assertCan, can, canAccessClub, isRbacEnforced } from "./rbac.js";
import { guardSubscriptionForClub } from "./subscriptionGuard.js";

export function getAuthOptions() {
  return {
    user: getCurrentUser(),
    rbacEnabled: isRbacEnabled(),
  };
}

export function scopeForClubId(clubId) {
  const club = loadClubs().find((item) => item.id === clubId);
  return {
    clubId: clubId || null,
    venueId: club?.venueId || null,
  };
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
    const createCheck = guardClubAction(clubId, PERMISSIONS.BOOKINGS_CREATE, {}, options);
    if (createCheck.ok) {
      return createCheck;
    }
    return guardClubAction(clubId, PERMISSIONS.BOOKINGS_MANAGE, {}, options);
  }

  return guardClubAction(clubId, PERMISSIONS.BOOKINGS_MANAGE, {}, options);
}

export function guardBookingPayment(clubId, options = {}) {
  return guardAnyClubAction(
    clubId,
    [PERMISSIONS.PAYMENTS_COLLECT, PERMISSIONS.BOOKINGS_MANAGE, PERMISSIONS.REVENUE_MANAGE],
    {},
    options
  );
}

export function guardDirectorAction(clubId, options = {}) {
  const permCheck = guardAnyClubAction(
    clubId,
    [
      PERMISSIONS.TOURNAMENT_DIRECTOR,
      PERMISSIONS.TOURNAMENT_MANAGE,
      PERMISSIONS.TOURNAMENT_SCORE,
    ],
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
    [
      PERMISSIONS.TOURNAMENT_DIRECTOR,
      PERMISSIONS.TOURNAMENT_MANAGE,
      PERMISSIONS.SCHEDULING_RUN,
    ],
    {},
    options
  );
}
