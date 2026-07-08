import { PERMISSIONS } from "./permissions.js";
import { ROLES, CANONICAL_ROLES, normalizeRole } from "./roles.js";
import { getPermissionsForRole } from "../matrix/rolePermissions.js";
import { COURT_ENGINE_PERMISSIONS } from "../../court-engine/guards/courtEngineGuard.js";

/** Chức danh chủ sân được phép tùy chỉnh quyền trong phạm vi cơ sở. */
export const TENANT_CUSTOMIZABLE_ROLES = Object.freeze([
  ROLES.VENUE_MANAGER,
  ROLES.TOURNAMENT_MANAGER,
  ROLES.CASHIER,
  ROLES.ACCOUNTANT,
  ROLES.CLUB_MANAGER,
  ROLES.COACH,
  ROLES.REFEREE,
  ROLES.STAFF,
  ROLES.TEAM_CAPTAIN,
  ROLES.PLAYER,
  ROLES.CUSTOMER,
]);

/** Chức danh chỉ xem ma trận mặc định — không chỉnh tại cấp cơ sở. */
export const PLATFORM_READ_ONLY_ROLES = Object.freeze([
  ROLES.PLATFORM_ADMIN,
  ROLES.SYSTEM_TECHNICIAN,
  ROLES.TENANT_OWNER,
  ROLES.SUPPORT,
]);

/** Nhóm quyền hiển thị trên UI Vai trò & Quyền. */
export const ROLE_PERMISSION_UI_GROUPS = Object.freeze([
  {
    id: "venue-ops",
    label: "Vận hành sân",
    permissions: [
      PERMISSIONS.VENUE_VIEW,
      PERMISSIONS.COURT_VIEW,
      PERMISSIONS.COURT_CREATE,
      PERMISSIONS.COURT_UPDATE,
      PERMISSIONS.COURT_DELETE,
      PERMISSIONS.BOOKING_VIEW,
      PERMISSIONS.BOOKING_CREATE,
      PERMISSIONS.BOOKING_UPDATE,
      PERMISSIONS.BOOKING_DELETE,
      COURT_ENGINE_PERMISSIONS.USE,
      COURT_ENGINE_PERMISSIONS.MANAGE,
      COURT_ENGINE_PERMISSIONS.TRANSFER,
      PERMISSIONS.SCHEDULING_VIEW,
      PERMISSIONS.SCHEDULING_RUN,
      PERMISSIONS.DIRECTOR_USE,
      PERMISSIONS.SETTINGS_VIEW,
    ],
  },
  {
    id: "customer-finance",
    label: "Khách hàng & Thanh toán",
    permissions: [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_UPDATE,
      PERMISSIONS.CUSTOMER_DELETE,
      PERMISSIONS.FINANCE_VIEW,
      PERMISSIONS.FINANCE_EDIT,
      PERMISSIONS.BILLING_VIEW,
      PERMISSIONS.BILLING_INVOICE_VIEW,
      PERMISSIONS.BILLING_PAYMENT_VIEW,
    ],
  },
  {
    id: "tournament",
    label: "Giải đấu",
    permissions: [
      PERMISSIONS.TOURNAMENT_VIEW,
      PERMISSIONS.TOURNAMENT_CREATE,
      PERMISSIONS.TOURNAMENT_UPDATE,
      PERMISSIONS.TOURNAMENT_DELETE,
      PERMISSIONS.MATCH_UPDATE,
    ],
  },
  {
    id: "club-player",
    label: "CLB & VĐV",
    permissions: [
      PERMISSIONS.CLUB_VIEW,
      PERMISSIONS.CLUB_CREATE,
      PERMISSIONS.CLUB_UPDATE,
      PERMISSIONS.CLUB_DELETE,
      PERMISSIONS.SEASON_UPDATE,
      PERMISSIONS.LEAGUE_UPDATE,
      PERMISSIONS.PLAYER_VIEW,
      PERMISSIONS.PLAYER_VIEW_SUMMARY,
      PERMISSIONS.PLAYER_CREATE,
      PERMISSIONS.PLAYER_UPDATE,
      PERMISSIONS.PLAYER_DELETE,
      PERMISSIONS.SKILL_LEVEL_VIEW_PRIVATE,
      PERMISSIONS.SKILL_LEVEL_APPROVE,
      PERMISSIONS.SKILL_LEVEL_VERIFY_CLUB,
      PERMISSIONS.SKILL_LEVEL_VERIFY_TOURNAMENT,
    ],
  },
  {
    id: "reports",
    label: "Báo cáo",
    permissions: [
      PERMISSIONS.STATISTICS_VIEW,
      PERMISSIONS.STATISTICS_EXPORT,
      PERMISSIONS.SUBSCRIPTION_VIEW,
    ],
  },
  {
    id: "admin",
    label: "Quản trị cơ sở",
    permissions: [
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.USER_MANAGE,
      PERMISSIONS.ROLE_VIEW,
      PERMISSIONS.ROLE_MANAGE,
      PERMISSIONS.VENUE_UPDATE,
      PERMISSIONS.INTEGRATION_VIEW,
      PERMISSIONS.INTEGRATION_MANAGE,
      PERMISSIONS.MARKETPLACE_VIEW,
      PERMISSIONS.MARKETPLACE_MANAGE,
    ],
  },
]);

const TENANT_ASSIGNABLE_POOL = new Set(getPermissionsForRole(ROLES.TENANT_OWNER));

export function listRolesForPermissionUi(actorRole) {
  const actor = normalizeRole(actorRole);
  if (actor === ROLES.TENANT_OWNER) {
    return [...TENANT_CUSTOMIZABLE_ROLES];
  }
  return [...CANONICAL_ROLES];
}

export function isRoleTenantCustomizable(role) {
  return TENANT_CUSTOMIZABLE_ROLES.includes(role);
}

export function isRolePlatformReadOnly(role) {
  return PLATFORM_READ_ONLY_ROLES.includes(role);
}

/** Quyền có thể hiển thị / chỉnh cho chức danh trong phạm vi tenant. */
export function getPermissionCatalogForRole(role) {
  const defaults = new Set(getPermissionsForRole(role));
  const catalog = new Set(defaults);

  if (isRoleTenantCustomizable(role)) {
    TENANT_ASSIGNABLE_POOL.forEach((permission) => catalog.add(permission));
  }

  if (role === ROLES.PLATFORM_ADMIN) {
    Object.values(PERMISSIONS).forEach((permission) => catalog.add(permission));
  }

  if (role === ROLES.SYSTEM_TECHNICIAN) {
    getPermissionsForRole(ROLES.SYSTEM_TECHNICIAN).forEach((permission) => catalog.add(permission));
  }

  return Array.from(catalog);
}

export function getUiGroupsForRole(role) {
  const catalog = new Set(getPermissionCatalogForRole(role));

  return ROLE_PERMISSION_UI_GROUPS.map((group) => ({
    ...group,
    permissions: group.permissions.filter((permission) => catalog.has(permission)),
  })).filter((group) => group.permissions.length > 0);
}

export function getDefaultPermissionsSet(role) {
  return new Set(getPermissionsForRole(role));
}

export function applyTenantOverrides(defaultPermissions, overrides = {}) {
  const effective = new Set(defaultPermissions);
  (overrides.removed || []).forEach((permission) => effective.delete(permission));
  (overrides.added || []).forEach((permission) => effective.add(permission));
  return effective;
}

/** @returns {"default" | "added" | "removed" | "off"} */
export function getPermissionUiState(permission, defaultSet, effectiveSet) {
  const inDefault = defaultSet.has(permission);
  const inEffective = effectiveSet.has(permission);

  if (inDefault && inEffective) {
    return "default";
  }
  if (!inDefault && inEffective) {
    return "added";
  }
  if (inDefault && !inEffective) {
    return "removed";
  }
  return "off";
}

export function diffOverridesFromEffective(defaultSet, effectiveSet) {
  const added = [];
  const removed = [];

  effectiveSet.forEach((permission) => {
    if (!defaultSet.has(permission)) {
      added.push(permission);
    }
  });

  defaultSet.forEach((permission) => {
    if (!effectiveSet.has(permission)) {
      removed.push(permission);
    }
  });

  return { added, removed };
}

export function hasTenantOverrides(overrides = {}) {
  return (overrides.added?.length || 0) > 0 || (overrides.removed?.length || 0) > 0;
}

export function canEditRoleForUser(userRole, targetRole) {
  if (!userRole || !targetRole) {
    return false;
  }

  const actor = normalizeRole(userRole);
  const target = normalizeRole(targetRole);
  if (actor === ROLES.PLATFORM_ADMIN || actor === ROLES.SYSTEM_TECHNICIAN) {
    return true;
  }

  if (actor === ROLES.TENANT_OWNER) {
    return isRoleTenantCustomizable(target);
  }

  return false;
}
