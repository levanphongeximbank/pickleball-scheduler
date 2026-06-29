export const SUBSCRIPTION_STATUS = Object.freeze({
  TRIAL: "trial",
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELLED: "cancelled",
});

export const BILLING_CYCLE = Object.freeze({
  MONTHLY: "monthly",
});

/**
 * Gói thuê — chuẩn bị cho billing theo tháng.
 * Giới hạn feature dùng permission/feature flags sau này.
 */
export const SUBSCRIPTION_PLANS = Object.freeze({
  trial: Object.freeze({
    id: "trial",
    name: "Dùng thử",
    billingCycle: BILLING_CYCLE.MONTHLY,
    priceMonthly: 0,
    maxCourts: 4,
    maxClubs: 2,
    maxUsers: 5,
    features: Object.freeze(["courts", "bookings", "club", "tournament"]),
  }),
  basic: Object.freeze({
    id: "basic",
    name: "Cơ bản",
    billingCycle: BILLING_CYCLE.MONTHLY,
    priceMonthly: 990000,
    maxCourts: 8,
    maxClubs: 5,
    maxUsers: 15,
    features: Object.freeze(["courts", "bookings", "club", "tournament", "statistics"]),
  }),
  pro: Object.freeze({
    id: "pro",
    name: "Chuyên nghiệp",
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
});

export function normalizeSubscription(subscription) {
  const planId = String(subscription?.planId || "trial").trim();
  const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.trial;

  return {
    id: String(subscription?.id || "").trim() || `sub-${Date.now()}`,
    venueId: String(subscription?.venueId || "").trim(),
    planId: plan.id,
    planName: plan.name,
    status: subscription?.status || SUBSCRIPTION_STATUS.TRIAL,
    billingCycle: subscription?.billingCycle || BILLING_CYCLE.MONTHLY,
    currentPeriodStart: subscription?.currentPeriodStart || new Date().toISOString(),
    currentPeriodEnd: subscription?.currentPeriodEnd || null,
    cancelledAt: subscription?.cancelledAt || null,
    createdAt: subscription?.createdAt || new Date().toISOString(),
    updatedAt: subscription?.updatedAt || new Date().toISOString(),
  };
}

export function createSubscriptionRecord(venueId, planId = "trial", options = {}) {
  const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.trial;
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  return normalizeSubscription({
    id: options.id || `sub-${venueId}-${Date.now()}`,
    venueId,
    planId: plan.id,
    status: planId === "trial" ? SUBSCRIPTION_STATUS.TRIAL : SUBSCRIPTION_STATUS.ACTIVE,
    billingCycle: BILLING_CYCLE.MONTHLY,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
}

export function isSubscriptionActive(subscription) {
  if (!subscription) return false;
  if (subscription.status === SUBSCRIPTION_STATUS.CANCELLED) return false;
  if (subscription.status === SUBSCRIPTION_STATUS.PAST_DUE) return false;
  if (!subscription.currentPeriodEnd) return true;
  return new Date(subscription.currentPeriodEnd) >= new Date();
}

export function planIncludesFeature(planId, feature) {
  const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.trial;
  return plan.features.includes(feature);
}
