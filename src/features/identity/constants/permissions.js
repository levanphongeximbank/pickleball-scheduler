/**
 * v4.0 CRUD permission catalog — source of truth.
 * Format: resource.action (view | create | update | delete | run | use).
 */
export const PERMISSIONS = Object.freeze({
  // ─── Core Sprint 1 (spec) ───────────────────────────────────────
  PLAYER_VIEW: "player.view",
  PLAYER_CREATE: "player.create",
  PLAYER_UPDATE: "player.update",
  PLAYER_DELETE: "player.delete",

  COURT_VIEW: "court.view",
  COURT_CREATE: "court.create",
  COURT_UPDATE: "court.update",
  COURT_DELETE: "court.delete",

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
  SYSTEM_SETTING: "system.setting",

  // ─── Domain extensions (CRUD, existing modules) ─────────────────
  CLUB_VIEW: "club.view",
  CLUB_CREATE: "club.create",
  CLUB_UPDATE: "club.update",
  CLUB_DELETE: "club.delete",

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
});

export function isValidPermission(permission) {
  return Object.values(PERMISSIONS).includes(permission);
}
