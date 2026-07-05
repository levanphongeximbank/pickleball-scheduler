import { PERMISSIONS } from "../auth/permissions.js";

/**
 * Permission tối thiểu cho menu key — tránh hard-code trong component.
 * Route guards dùng ROUTE_PERMISSIONS trong navigationConfig.js.
 */
export const NAVIGATION_PERMISSIONS = Object.freeze({
  "tech-overview": [PERMISSIONS.SYSTEM_HEALTH_VIEW],
  "tech-system-admin": [PERMISSIONS.SYSTEM_CONFIG_VIEW],
  "tech-tenants": [PERMISSIONS.TENANT_VIEW, PERMISSIONS.VENUE_VIEW],
  "tech-users": [PERMISSIONS.USER_VIEW],
  "tech-roles": [PERMISSIONS.ROLE_VIEW, PERMISSIONS.PERMISSION_VIEW],
  "tech-integrations": [PERMISSIONS.INTEGRATION_VIEW],
  "tech-activity-log": [PERMISSIONS.ACTIVITY_LOG_VIEW],
  "tech-error-log": [PERMISSIONS.SYSTEM_LOG_VIEW],
  "tech-config": [PERMISSIONS.SYSTEM_CONFIG_VIEW],
  "tech-support-tickets": [PERMISSIONS.SUPPORT_TICKET_MANAGE],
  "tech-diagnostics": [PERMISSIONS.DATA_DIAGNOSTIC_VIEW],
  "tech-support-history": [PERMISSIONS.MIGRATION_STATUS_VIEW],

  "captain-home": [PERMISSIONS.TEAM_VIEW],
  "captain-schedule": [PERMISSIONS.TEAM_SCHEDULE_VIEW],
  "captain-team-list": [PERMISSIONS.TEAM_VIEW],
  "captain-my-team": [PERMISSIONS.TEAM_MEMBER_VIEW],
  "captain-lineup": [PERMISSIONS.TEAM_LINEUP_VIEW],
  "captain-checkin": [PERMISSIONS.TEAM_CHECKIN_VIEW],
  "captain-results": [PERMISSIONS.TEAM_RESULT_VIEW],
  "captain-announcements": [PERMISSIONS.TOURNAMENT_VIEW],
  "captain-messages": [PERMISSIONS.TEAM_MESSAGE_SEND],
  "captain-support": [],
});

export function getNavigationPermissions(menuKey) {
  return NAVIGATION_PERMISSIONS[menuKey] || [];
}
