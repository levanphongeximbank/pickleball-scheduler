export const SUBSCRIPTION_STATUS = Object.freeze({
  TRIAL: "trial",
  ACTIVE: "active",
  PAST_DUE: "past_due",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
});

export const BILLING_CYCLE = Object.freeze({
  MONTHLY: "monthly",
});

/** Legacy plan ids → Sprint 4 canonical ids */
export const PLAN_ALIASES = Object.freeze({
  basic: "starter",
  pro: "professional",
});

/**
 * Gói thuê — Sprint 4: Trial, Starter, Professional, Enterprise.
 * Giới hạn feature dùng permission/feature flags.
 */
export const SUBSCRIPTION_PLANS = Object.freeze({
  trial: Object.freeze({
    id: "trial",
    name: "Trial",
    billingCycle: BILLING_CYCLE.MONTHLY,
    priceMonthly: 0,
    maxCourts: 4,
    maxClubs: 2,
    maxUsers: 5,
    trialDays: 14,
    features: Object.freeze(["courts", "bookings", "club", "tournament"]),
  }),
  starter: Object.freeze({
    id: "starter",
    name: "Starter",
    billingCycle: BILLING_CYCLE.MONTHLY,
    priceMonthly: 990000,
    maxCourts: 8,
    maxClubs: 5,
    maxUsers: 15,
    features: Object.freeze(["courts", "bookings", "club", "tournament", "statistics"]),
  }),
  professional: Object.freeze({
    id: "professional",
    name: "Professional",
    billingCycle: BILLING_CYCLE.MONTHLY,
    priceMonthly: 1990000,
    maxCourts: 20,
    maxClubs: 20,
    maxUsers: 50,
    features: Object.freeze([
      "courts",
      "bookings",
      "club",
      "tournament",
      "statistics",
      "accounting",
      "cloud_sync",
      "director_mode",
    ]),
  }),
  enterprise: Object.freeze({
    id: "enterprise",
    name: "Enterprise",
    billingCycle: BILLING_CYCLE.MONTHLY,
    priceMonthly: 3990000,
    maxCourts: 50,
    maxClubs: 50,
    maxUsers: 200,
    features: Object.freeze([
      "courts",
      "bookings",
      "club",
      "tournament",
      "statistics",
      "accounting",
      "cloud_sync",
      "director_mode",
      "api_access",
      "custom_branding",
    ]),
  }),
});

export function normalizePlanId(planId) {
  const raw = String(planId || "trial").trim();
  return PLAN_ALIASES[raw] || raw;
}

export function resolvePlan(planId) {
  const canonical = normalizePlanId(planId);
  return SUBSCRIPTION_PLANS[canonical] || SUBSCRIPTION_PLANS.trial;
}

export function normalizeSubscription(subscription) {
  const plan = resolvePlan(subscription?.planId);

  return {
    id: String(subscription?.id || "").trim() || `sub-${Date.now()}`,
    venueId: String(subscription?.venueId || "").trim(),
    planId: plan.id,
    planName: plan.name,
    status: subscription?.status || SUBSCRIPTION_STATUS.TRIAL,
    billingCycle: subscription?.billingCycle || BILLING_CYCLE.MONTHLY,
    currentPeriodStart: subscription?.currentPeriodStart || new Date().toISOString(),
    currentPeriodEnd: subscription?.currentPeriodEnd || null,
    autoRenew: subscription?.autoRenew !== false && plan.priceMonthly > 0,
    cancelledAt: subscription?.cancelledAt || null,
    lockedAt: subscription?.lockedAt || null,
    lastRenewedAt: subscription?.lastRenewedAt || null,
    createdAt: subscription?.createdAt || new Date().toISOString(),
    updatedAt: subscription?.updatedAt || new Date().toISOString(),
  };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function computePeriodEnd(planId, startDate = new Date()) {
  const plan = resolvePlan(planId);
  const start = startDate instanceof Date ? startDate : new Date(startDate);

  if (plan.id === "trial") {
    return addDays(start, plan.trialDays || 14).toISOString();
  }

  return addMonths(start, 1).toISOString();
}

export function createSubscriptionRecord(venueId, planId = "trial", options = {}) {
  const plan = resolvePlan(planId);
  const now = new Date();
  const canonical = plan.id;
  const isTrial = canonical === "trial";

  return normalizeSubscription({
    id: options.id || `sub-${venueId}-${Date.now()}`,
    venueId,
    planId: canonical,
    status: isTrial ? SUBSCRIPTION_STATUS.TRIAL : SUBSCRIPTION_STATUS.ACTIVE,
    billingCycle: BILLING_CYCLE.MONTHLY,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: computePeriodEnd(canonical, now),
    autoRenew: !isTrial,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...options,
  });
}

export function getDaysUntilPeriodEnd(subscription, now = new Date()) {
  if (!subscription?.currentPeriodEnd) {
    return null;
  }

  const end = new Date(subscription.currentPeriodEnd);
  const ms = end.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function isSubscriptionActive(subscription, options = {}) {
  if (!subscription) {
    return false;
  }

  if (subscription.status === SUBSCRIPTION_STATUS.CANCELLED) {
    return false;
  }

  if (subscription.status === SUBSCRIPTION_STATUS.EXPIRED) {
    return false;
  }

  if (subscription.lockedAt) {
    return false;
  }

  if (!subscription.currentPeriodEnd) {
    return subscription.status !== SUBSCRIPTION_STATUS.PAST_DUE;
  }

  const graceDays = options.graceDays ?? 0;
  const end = new Date(subscription.currentPeriodEnd);
  end.setDate(end.getDate() + graceDays);

  return end >= new Date();
}

export function planIncludesFeature(planId, feature) {
  const plan = resolvePlan(planId);
  return plan.features.includes(feature);
}
