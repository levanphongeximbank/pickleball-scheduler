/**
 * @deprecated Sprint 4 legacy lifecycle — use Phase 9 billing bridge
 * (`src/features/billing/bridges/subscriptionAccessBridge.js`) for tenant access.
 * Kept for subscription-sprint4 tests and subscriptionGuard plan limits until full migration.
 */
import { loadSubscriptions, saveSubscriptions, loadVenues, saveVenues } from "../../../data/venue.js";
import { normalizeVenue } from "../../../models/venue.js";
import {
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PLANS,
  computePeriodEnd,
  getDaysUntilPeriodEnd,
  isSubscriptionActive,
  normalizePlanId,
  normalizeSubscription,
  resolvePlan,
} from "../../../models/subscription.js";
import { TENANT_STATUS } from "../../../models/tenant.js";
import { GRACE_PERIOD_DAYS, PAYMENT_REMINDER_DAYS } from "../constants/subscriptionPolicy.js";

function touchSubscription(subscription, patch = {}) {
  return normalizeSubscription({
    ...subscription,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

function lockVenue(venueId) {
  const venues = loadVenues().map((item) =>
    item.id === venueId
      ? normalizeVenue({
          ...item,
          status: TENANT_STATUS.SUSPENDED,
          updatedAt: new Date().toISOString(),
        })
      : item
  );
  saveVenues(venues);
}

function unlockVenue(venueId, planId) {
  const venues = loadVenues().map((item) =>
    item.id === venueId
      ? normalizeVenue({
          ...item,
          status: planId === "trial" ? TENANT_STATUS.TRIAL : TENANT_STATUS.ACTIVE,
          updatedAt: new Date().toISOString(),
        })
      : item
  );
  saveVenues(venues);
}

export function getSubscriptionForTenant(tenantId) {
  const map = loadSubscriptions();
  const raw = map[tenantId];
  return raw ? normalizeSubscription(raw) : null;
}

export function saveSubscriptionForTenant(tenantId, subscription) {
  const map = loadSubscriptions();
  map[tenantId] = touchSubscription({ ...subscription, venueId: tenantId });
  saveSubscriptions(map);
  return map[tenantId];
}

export function renewSubscriptionPeriod(tenantId, options = {}) {
  const existing = getSubscriptionForTenant(tenantId);
  if (!existing) {
    return { ok: false, error: "Không tìm thấy subscription.", code: "SUBSCRIPTION_NOT_FOUND" };
  }

  const planId = normalizePlanId(options.planId || existing.planId);
  const plan = resolvePlan(planId);
  const now = new Date();
  const subscription = touchSubscription(existing, {
    planId: plan.id,
    status: plan.id === "trial" ? SUBSCRIPTION_STATUS.TRIAL : SUBSCRIPTION_STATUS.ACTIVE,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: computePeriodEnd(plan.id, now),
    autoRenew: plan.priceMonthly > 0,
    lockedAt: null,
    cancelledAt: null,
    lastRenewedAt: now.toISOString(),
  });

  saveSubscriptionForTenant(tenantId, subscription);
  unlockVenue(tenantId, plan.id);

  return { ok: true, subscription, plan, renewed: true };
}

export function tryAutoRenew(tenantId, options = {}) {
  const subscription = getSubscriptionForTenant(tenantId);
  if (!subscription) {
    return { ok: true, skipped: true, reason: "no_subscription" };
  }

  const plan = resolvePlan(subscription.planId);
  if (!subscription.autoRenew || plan.priceMonthly === 0) {
    return { ok: true, skipped: true, reason: "auto_renew_off" };
  }

  const daysLeft = getDaysUntilPeriodEnd(subscription);
  if (daysLeft !== null && daysLeft > 0) {
    return { ok: true, skipped: true, reason: "not_due" };
  }

  if (options.simulatePayment === false) {
    return { ok: true, skipped: true, reason: "awaiting_payment" };
  }

  return renewSubscriptionPeriod(tenantId, { planId: subscription.planId });
}

export function processSubscriptionExpiry(tenantId, options = {}) {
  const graceDays = options.graceDays ?? GRACE_PERIOD_DAYS;
  const subscription = getSubscriptionForTenant(tenantId);

  if (!subscription?.currentPeriodEnd) {
    return { ok: true, changed: false };
  }

  const daysLeft = getDaysUntilPeriodEnd(subscription);
  if (daysLeft === null || daysLeft > 0) {
    return { ok: true, changed: false, daysLeft };
  }

  const daysOverdue = Math.abs(daysLeft);

  if (
    subscription.status !== SUBSCRIPTION_STATUS.PAST_DUE &&
    subscription.status !== SUBSCRIPTION_STATUS.EXPIRED &&
    daysOverdue <= graceDays
  ) {
    const updated = saveSubscriptionForTenant(
      tenantId,
      touchSubscription(subscription, { status: SUBSCRIPTION_STATUS.PAST_DUE })
    );
    return { ok: true, changed: true, status: SUBSCRIPTION_STATUS.PAST_DUE, subscription: updated };
  }

  if (daysOverdue > graceDays && subscription.status !== SUBSCRIPTION_STATUS.EXPIRED) {
    const updated = saveSubscriptionForTenant(
      tenantId,
      touchSubscription(subscription, {
        status: SUBSCRIPTION_STATUS.EXPIRED,
        lockedAt: new Date().toISOString(),
        autoRenew: false,
      })
    );
    lockVenue(tenantId);
    return { ok: true, changed: true, status: SUBSCRIPTION_STATUS.EXPIRED, subscription: updated, locked: true };
  }

  return { ok: true, changed: false, daysOverdue };
}

export function getPaymentReminder(subscription, now = new Date()) {
  if (!subscription?.currentPeriodEnd) {
    return { show: false };
  }

  if (
    subscription.status === SUBSCRIPTION_STATUS.EXPIRED ||
    subscription.status === SUBSCRIPTION_STATUS.CANCELLED
  ) {
    return { show: false };
  }

  const daysLeft = getDaysUntilPeriodEnd(subscription, now);

  if (daysLeft === null) {
    return { show: false };
  }

  if (daysLeft < 0) {
    const daysOverdue = Math.abs(daysLeft);
    return {
      show: true,
      severity: daysOverdue > GRACE_PERIOD_DAYS ? "error" : "warning",
      code: daysOverdue > GRACE_PERIOD_DAYS ? "SUBSCRIPTION_LOCKED" : "SUBSCRIPTION_PAST_DUE",
      daysLeft,
      daysOverdue,
      message:
        daysOverdue > GRACE_PERIOD_DAYS
          ? `Gói ${subscription.planName} đã hết hạn. Gia hạn trong Cài đặt để mở khóa.`
          : `Gói ${subscription.planName} quá hạn ${daysOverdue} ngày. Gia hạn trong ${GRACE_PERIOD_DAYS - daysOverdue + 1} ngày để tránh bị khóa.`,
    };
  }

  const matchedDay = PAYMENT_REMINDER_DAYS.find((day) => daysLeft <= day);
  if (!matchedDay || daysLeft > PAYMENT_REMINDER_DAYS[0]) {
    return { show: false, daysLeft };
  }

  const severity = daysLeft <= 1 ? "error" : daysLeft <= 3 ? "warning" : "info";

  return {
    show: true,
    severity,
    code: "SUBSCRIPTION_REMINDER",
    daysLeft,
    message:
      daysLeft === 0
        ? `Gói ${subscription.planName} hết hạn hôm nay. Gia hạn ngay để tránh gián đoạn.`
        : `Gói ${subscription.planName} còn ${daysLeft} ngày. Gia hạn sớm để tránh bị khóa.`,
  };
}

export function assertSubscriptionOperational(tenantId, options = {}) {
  if (!tenantId) {
    return { ok: true };
  }

  const graceDays = options.graceDays ?? GRACE_PERIOD_DAYS;
  const subscription = getSubscriptionForTenant(tenantId);

  if (!subscription) {
    return { ok: true };
  }

  const active = isSubscriptionActive(subscription, { graceDays });

  if (!active) {
    const reminder = getPaymentReminder(subscription);
    const code =
      subscription.status === SUBSCRIPTION_STATUS.EXPIRED || subscription.lockedAt
        ? "SUBSCRIPTION_LOCKED"
        : reminder.code || "SUBSCRIPTION_INACTIVE";

    return {
      ok: false,
      error:
        reminder.message ||
        (code === "SUBSCRIPTION_LOCKED"
          ? `Gói ${subscription.planName} đã hết hạn. Gia hạn trong Cài đặt để mở khóa.`
          : "Gói thuê đã hết hạn. Gia hạn trong Cài đặt → Tenant."),
      code,
      subscription,
    };
  }

  return { ok: true, subscription };
}

export function runSubscriptionMaintenance(options = {}) {
  const map = loadSubscriptions();
  const results = [];

  for (const tenantId of Object.keys(map)) {
    const autoRenew = tryAutoRenew(tenantId, options);
    const expiry = processSubscriptionExpiry(tenantId, options);
    results.push({ tenantId, autoRenew, expiry });
  }

  return { ok: true, processed: results.length, results };
}

export function listSubscriptionPlans() {
  return Object.values(SUBSCRIPTION_PLANS);
}
