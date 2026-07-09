/**
 * Identity & Permission — v4.0 Sprint 1 (Phase A foundation).
 * Source of truth cho roles, permissions, role matrix.
 */
export { PERMISSIONS, isValidPermission } from "./constants/permissions.js";
export {
  PERMISSION_SCOPE,
  PERMISSION_META,
  PERMISSION_SCOPE_LIST,
  getPermissionScope,
  getPermissionScopes,
} from "./constants/permissionScope.js";
export {
  ROLES,
  LEGACY_ROLE_ALIASES,
  CANONICAL_ROLES,
  ROLE_LABELS,
  GLOBAL_ROLES,
  VENUE_SCOPED_ROLES,
  CLUB_SCOPED_ROLES,
  normalizeRole,
  denormalizeRoleForDb,
  rolesEqual,
  isValidRole,
  isGlobalRole,
  isPlatformWideRole,
  isVenueScopedRole,
  isClubScopedRole,
  isRefereeRole,
} from "./constants/roles.js";
export {
  ROLE_PERMISSIONS,
  getPermissionsForRole,
  roleHasPermission,
} from "./matrix/rolePermissions.js";
export {
  rpcListUsers,
  rpcAdminUpdateUser,
  rpcListAuditLogs,
} from "./services/identityRpcService.js";
export { writeAuditLog, listAuditLogs, AUDIT_ACTIONS } from "./services/auditService.js";
export {
  requestPasswordReset,
  completePasswordReset,
  changePassword,
  validateDevResetToken,
} from "./services/passwordService.js";
export {
  listUsers,
  createManagedUser,
  updateManagedUser,
  setManagedUserStatus,
  requestManagedPasswordReset,
  listManageableRoles,
} from "./services/userManagementService.js";
export { fetchSelfProfile, updateSelfProfile } from "./services/selfProfileService.js";
export {
  listRefereeAssignments,
  canAccessRefereeSession,
} from "./services/refereeSessionService.js";
