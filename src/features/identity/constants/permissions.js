/**
 * V5.2 permission catalog — source of truth.
 * Format: resource.action (view | create | update | delete | run | use | manage).
 */
export const PERMISSIONS = Object.freeze({
  // ─── Core Sprint 1 (spec) ───────────────────────────────────────
  PLAYER_VIEW: "player.view",
  PLAYER_CREATE: "player.create",
  PLAYER_UPDATE: "player.update",
  PLAYER_DELETE: "player.delete",

  SKILL_LEVEL_VIEW_PRIVATE: "skill_level.view_private",
  SKILL_LEVEL_REQUEST_CHANGE: "skill_level.request_change",
  SKILL_LEVEL_APPROVE: "skill_level.approve",
  SKILL_LEVEL_VERIFY_CLUB: "skill_level.verify_club",
  SKILL_LEVEL_VERIFY_TOURNAMENT: "skill_level.verify_tournament",

  COURT_VIEW: "court.view",
  COURT_CREATE: "court.create",
  COURT_UPDATE: "court.update",
  COURT_DELETE: "court.delete",

  CLUSTER_VIEW: "cluster.view",
  CLUSTER_MANAGE: "cluster.manage",

  TOURNAMENT_VIEW: "tournament.view",
  TOURNAMENT_CREATE: "tournament.create",
  TOURNAMENT_UPDATE: "tournament.update",
  TOURNAMENT_DELETE: "tournament.delete",

  MATCH_UPDATE: "match.update",
  DIRECTOR_USE: "director.use",

  FINANCE_VIEW: "finance.view",
  FINANCE_EDIT: "finance.edit",

  USER_MANAGE: "user.manage",
  ROLE_MANAGE: "role.manage",
  /** Chủ sân tùy chỉnh quyền nhân viên trong phạm vi tenant (không phải role.manage platform). */
  TENANT_ROLE_CUSTOMIZE: "tenant.role.customize",
  SYSTEM_SETTING: "system.setting",

  // ─── Domain extensions (CRUD, existing modules) ─────────────────
  CLUB_VIEW: "club.view",
  CLUB_CREATE: "club.create",
  CLUB_UPDATE: "club.update",
  CLUB_DELETE: "club.delete",
  CLUB_GOVERNANCE_ASSIGN_OWNER: "club.governance.assign_owner",
  CLUB_GOVERNANCE_APPROVE: "club.governance.approve",
  CLUB_MEMBERSHIP_REVIEW: "club.membership.review",

  PLAYER_VIEW_SUMMARY: "player.view_summary",
  PLAYER_VIEW_FOR_TOURNAMENT_INVITE: "player.view_for_tournament_invite",

  SEASON_UPDATE: "season.update",
  LEAGUE_UPDATE: "league.update",

  BOOKING_VIEW: "booking.view",
  BOOKING_CREATE: "booking.create",
  BOOKING_UPDATE: "booking.update",
  BOOKING_DELETE: "booking.delete",

  CUSTOMER_VIEW: "customer.view",
  CUSTOMER_CREATE: "customer.create",
  CUSTOMER_UPDATE: "customer.update",
  CUSTOMER_DELETE: "customer.delete",

  SCHEDULING_VIEW: "scheduling.view",
  SCHEDULING_RUN: "scheduling.run",

  STATISTICS_VIEW: "statistics.view",
  STATISTICS_EXPORT: "statistics.export",

  SETTINGS_VIEW: "settings.view",

  VENUE_VIEW: "venue.view",
  VENUE_UPDATE: "venue.update",

  SUBSCRIPTION_VIEW: "subscription.view",
  SUBSCRIPTION_UPDATE: "subscription.update",

  BILLING_VIEW: "billing.view",
  BILLING_MANAGE: "billing.manage",
  BILLING_INVOICE_VIEW: "billing.invoice.view",
  BILLING_INVOICE_CREATE: "billing.invoice.create",
  BILLING_INVOICE_MARK_PAID: "billing.invoice.mark_paid",
  BILLING_PAYMENT_VIEW: "billing.payment.view",
  BILLING_PAYMENT_MANAGE: "billing.payment.manage",
  BILLING_SUBSCRIPTION_VIEW: "billing.subscription.view",
  BILLING_SUBSCRIPTION_MANAGE: "billing.subscription.manage",
  BILLING_PLAN_VIEW: "billing.plan.view",
  BILLING_PLAN_MANAGE: "billing.plan.manage",
  BILLING_TENANT_LOCK: "billing.tenant.lock",
  BILLING_TENANT_UNLOCK: "billing.tenant.unlock",
  BILLING_AUDIT_VIEW: "billing.audit.view",

  INTEGRATION_VIEW: "integration.view",
  INTEGRATION_MANAGE: "integration.manage",

  MARKETPLACE_VIEW: "marketplace.view",
  MARKETPLACE_MANAGE: "marketplace.manage",

  API_MANAGE: "api.manage",

  // ─── Team tournament (v5 legacy keys) ─────────────────────────────
  TEAM_MANAGE: "team.manage",
  TEAM_VIEW: "team.view",
  TEAM_LINEUP_SUBMIT: "team.lineup.submit",
  TEAM_LINEUP_LOCK: "team.lineup.lock",
  TEAM_LINEUP_PUBLISH: "team.lineup.publish",
  TEAM_LINEUP_RANDOMIZE: "team.lineup.randomize",
  TEAM_MATCH_RESULT_MANAGE: "team.match.result.manage",
  TEAM_STANDINGS_VIEW: "team.standings.view",

  // ─── V5.1 — Kỹ thuật viên hệ thống ──────────────────────────────
  SYSTEM_HEALTH_VIEW: "system.health.view",
  SYSTEM_LOG_VIEW: "system.log.view",
  SYSTEM_CONFIG_VIEW: "system.config.view",
  SYSTEM_CONFIG_UPDATE_LIMITED: "system.config.update_limited",
  TENANT_VIEW: "tenant.view",
  USER_VIEW: "user.view",
  ROLE_VIEW: "role.view",
  PERMISSION_VIEW: "permission.view",
  ACTIVITY_LOG_VIEW: "activity_log.view",
  INTEGRATION_TEST: "integration.test",
  SUPPORT_TICKET_MANAGE: "support_ticket.manage",
  DATA_DIAGNOSTIC_VIEW: "data_diagnostic.view",
  MIGRATION_STATUS_VIEW: "migration_status.view",

  // ─── V5.2 — Trưởng nhóm / Đội trưởng ────────────────────────────
  TEAM_MEMBER_VIEW: "team_member.view",
  TEAM_MEMBER_PROPOSE: "team_member.propose",
  TEAM_MEMBER_MANAGE_LIMITED: "team_member.manage_limited",
  TEAM_LINEUP_VIEW: "team_lineup.view",
  TEAM_LINEUP_SUBMIT_V5: "team_lineup.submit",
  TEAM_LINEUP_UPDATE_BEFORE_LOCK: "team_lineup.update_before_lock",
  TEAM_SCHEDULE_VIEW: "team_schedule.view",
  TEAM_RESULT_VIEW: "team_result.view",
  TEAM_MESSAGE_SEND: "team_message.send",
  TEAM_CHECKIN_VIEW: "team_checkin.view",
  TEAM_CHECKIN_CONFIRM: "team_checkin.confirm",
  TEAM_ATTENDANCE_CONFIRM: "team_attendance.confirm",
  TEAM_SUBSTITUTION_REQUEST: "team_substitution.request",

  // ─── V5.2 — Giải đồng đội (BTC / quản lý giải) ──────────────────
  TEAM_EVENT_VIEW: "team_event.view",
  TEAM_EVENT_MANAGE: "team_event.manage",
  EXISTING_TEAM_VIEW: "existing_team.view",
  EXISTING_TEAM_SELECT: "existing_team.select",
  EXISTING_TEAM_MANAGE: "existing_team.manage",
  IN_TOURNAMENT_TEAM_VIEW: "in_tournament_team.view",
  IN_TOURNAMENT_TEAM_CREATE: "in_tournament_team.create",
  IN_TOURNAMENT_TEAM_UPDATE: "in_tournament_team.update",
  IN_TOURNAMENT_TEAM_DELETE: "in_tournament_team.delete",
  TEAM_MANUAL_SPLIT_VIEW: "team_manual_split.view",
  TEAM_MANUAL_SPLIT_MANAGE: "team_manual_split.manage",
  TEAM_AUTO_DRAW_VIEW: "team_auto_draw.view",
  TEAM_AUTO_DRAW_MANAGE: "team_auto_draw.manage",
  TEAM_DRAFT_VIEW: "team_draft.view",
  TEAM_DRAFT_MANAGE: "team_draft.manage",
  TEAM_CAPTAIN_ASSIGN: "team_captain.assign",
  TEAM_CAPTAIN_REMOVE: "team_captain.remove",
  TEAM_CAPTAIN_VIEW: "team_captain.view",
  TEAM_LINEUP_APPROVE: "team_lineup.approve",
  TEAM_LINEUP_LOCK_V5: "team_lineup.lock",
  TEAM_SUBSTITUTION_APPROVE: "team_substitution.approve",

  // ─── V5.0 Phase 29 — VPR Ranking ─────────────────────────────────
  RANKING_VIEW: "ranking.view",
  RANKING_MANAGE: "ranking.manage",
  TOURNAMENT_CERTIFY: "tournament.certify",

  /** Founder-only: can thiệp ghép cặp/chia bảng trong setup. */
  PLATFORM_PAIRING_OVERRIDE: "platform.pairing_override",
});

export function isValidPermission(permission) {
  return Object.values(PERMISSIONS).includes(permission);
}
