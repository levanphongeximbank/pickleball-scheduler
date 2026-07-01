/** Phase 9 — Commercial SaaS billing constants. */

export const SUBSCRIPTION_STATUS = Object.freeze({
  TRIALING: "trialing",
  ACTIVE: "active",
  PAST_DUE: "past_due",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  SUSPENDED: "suspended",
});

export const BILLING_CYCLE = Object.freeze({
  MONTHLY: "monthly",
  YEARLY: "yearly",
  MANUAL: "manual",
});

export const INVOICE_STATUS = Object.freeze({
  DRAFT: "draft",
  ISSUED: "issued",
  PAID: "paid",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
});

export const PAYMENT_STATUS = Object.freeze({
  PENDING: "pending",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
});

export const PAYMENT_PROVIDERS = Object.freeze({
  MANUAL: "manual",
  BANK_TRANSFER: "bank_transfer",
  MOCK: "mock",
  VNPAY: "vnpay",
  MOMO: "momo",
  STRIPE: "stripe",
});

export const GRACE_PERIOD_DAYS = 3;
export const TRIAL_DAYS = 14;

export const DEFAULT_PLANS = Object.freeze({
  TRIAL: {
    code: "TRIAL",
    name: "Trial",
    description: "Dùng thử 14 ngày",
    price_monthly: 0,
    price_yearly: 0,
    currency: "VND",
    is_active: true,
    sort_order: 1,
    limits: {
      max_venues: 1,
      max_clubs: 1,
      max_players: 50,
      max_courts: 4,
      max_tournaments_per_month: 1,
      max_bookings_per_month: 50,
      max_staff_users: 2,
      max_referees: 1,
      allow_mobile_app: false,
      allow_ai_features: false,
      allow_advanced_dashboard: false,
      allow_payment_gateway: false,
      allow_api_access: false,
      allow_custom_branding: false,
      allow_multi_venue: false,
      allow_offline_mode: false,
      allow_push_notification: false,
    },
  },
  STARTER: {
    code: "STARTER",
    name: "Starter",
    description: "Gói khởi đầu cho sân nhỏ",
    price_monthly: 990000,
    price_yearly: 9900000,
    currency: "VND",
    is_active: true,
    sort_order: 2,
    limits: {
      max_venues: 1,
      max_clubs: 2,
      max_players: 200,
      max_courts: 8,
      max_tournaments_per_month: 5,
      max_bookings_per_month: 200,
      max_staff_users: 5,
      max_referees: 2,
      allow_mobile_app: true,
      allow_ai_features: false,
      allow_advanced_dashboard: false,
      allow_payment_gateway: true,
      allow_api_access: false,
      allow_custom_branding: false,
      allow_multi_venue: false,
      allow_offline_mode: false,
      allow_push_notification: true,
    },
  },
  PROFESSIONAL: {
    code: "PROFESSIONAL",
    name: "Professional",
    description: "Gói chuyên nghiệp đa sân",
    price_monthly: 1990000,
    price_yearly: 19900000,
    currency: "VND",
    is_active: true,
    sort_order: 3,
    limits: {
      max_venues: 3,
      max_clubs: 5,
      max_players: 1000,
      max_courts: 20,
      max_tournaments_per_month: 20,
      max_bookings_per_month: 1000,
      max_staff_users: 20,
      max_referees: 10,
      allow_mobile_app: true,
      allow_ai_features: true,
      allow_advanced_dashboard: true,
      allow_payment_gateway: true,
      allow_api_access: true,
      allow_custom_branding: false,
      allow_multi_venue: true,
      allow_offline_mode: true,
      allow_push_notification: true,
    },
  },
  ENTERPRISE: {
    code: "ENTERPRISE",
    name: "Enterprise",
    description: "Gói doanh nghiệp toàn quyền",
    price_monthly: 3990000,
    price_yearly: 39900000,
    currency: "VND",
    is_active: true,
    sort_order: 4,
    limits: {
      max_venues: 20,
      max_clubs: 20,
      max_players: 5000,
      max_courts: 100,
      max_tournaments_per_month: 100,
      max_bookings_per_month: 5000,
      max_staff_users: 100,
      max_referees: 50,
      allow_mobile_app: true,
      allow_ai_features: true,
      allow_advanced_dashboard: true,
      allow_payment_gateway: true,
      allow_api_access: true,
      allow_custom_branding: true,
      allow_multi_venue: true,
      allow_offline_mode: true,
      allow_push_notification: true,
    },
  },
});

export function getPlanCatalog() {
  return Object.values(DEFAULT_PLANS).map((plan) => ({ ...plan, limits: { ...plan.limits } }));
}

export function getPlanByCode(planCode) {
  return getPlanCatalog().find((plan) => plan.code === String(planCode || "").toUpperCase()) || null;
}
