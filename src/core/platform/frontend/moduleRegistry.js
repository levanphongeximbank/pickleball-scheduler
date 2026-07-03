export const PLATFORM_MODULES = [
  {
    id: "tenants",
    title: "Tenants",
    path: "/tenants",
    requiredPermission: "tenant.manage",
    component: "TenantManagement",
  },
  {
    id: "users",
    title: "Người dùng",
    path: "/users",
    requiredPermission: "user.manage",
    component: "UserManagementPage",
  },
  {
    id: "audit",
    title: "Audit",
    path: "/audit",
    requiredPermission: "audit.read",
    component: "AuditLogPage",
  },
  {
    id: "settings",
    title: "Settings",
    path: "/settings",
    requiredPermission: "system.setting",
    component: "Settings",
  },
];

export function getPlatformModulesForUser(user, accessService) {
  if (!user) {
    return [];
  }

  return PLATFORM_MODULES.filter((module) => {
    if (!module.requiredPermission) {
      return true;
    }

    if (!accessService?.authorize) {
      return false;
    }

    return accessService.authorize(user, { tenant_id: user.tenant_id }, module.requiredPermission).allowed;
  });
}
