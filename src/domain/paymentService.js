import { guardPermission } from "../auth/guardAction.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { isRbacEnabled } from "../auth/authService.js";
import {
  SUBSCRIPTION_PLANS,
  normalizeSubscription,
} from "../models/subscription.js";
import { loadSubscriptions } from "../data/venue.js";
import { upgradeSubscription } from "./venueService.js";
import { renewSubscriptionPeriod } from "../features/subscription/index.js";

const PAYMENTS_KEY = "pickleball-payments-v1";

const PAYMENT_MODE =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_PAYMENT_MODE || "dev"
    : "dev";

const STRIPE_LINKS = {
  starter:
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_STRIPE_LINK_STARTER ||
        import.meta.env.VITE_STRIPE_LINK_BASIC ||
        ""
      : "",
  professional:
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_STRIPE_LINK_PROFESSIONAL ||
        import.meta.env.VITE_STRIPE_LINK_PRO ||
        ""
      : "",
  enterprise:
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_STRIPE_LINK_ENTERPRISE || ""
      : "",
  basic:
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_STRIPE_LINK_STARTER ||
        import.meta.env.VITE_STRIPE_LINK_BASIC ||
        ""
      : "",
  pro:
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_STRIPE_LINK_PROFESSIONAL ||
        import.meta.env.VITE_STRIPE_LINK_PRO ||
        ""
      : "",
};

function loadPaymentLedger() {
  try {
    const raw = localStorage.getItem(PAYMENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePaymentLedger(entries) {
  localStorage.setItem(PAYMENTS_KEY, JSON.stringify(entries || []));
}

export function getPaymentMode() {
  return PAYMENT_MODE;
}

export function isStripePaymentConfigured() {
  return (
    PAYMENT_MODE === "stripe" &&
    (STRIPE_LINKS.starter || STRIPE_LINKS.professional || STRIPE_LINKS.enterprise)
  );
}

function canManageSubscription(venueId) {
  if (!isRbacEnabled()) {
    return { ok: true };
  }

  const sysCheck = guardPermission(PERMISSIONS.SUBSCRIPTION_UPDATE);
  const ownerCheck = guardPermission(PERMISSIONS.SUBSCRIPTION_VIEW, { venueId });
  const manageCheck = guardPermission(PERMISSIONS.VENUE_UPDATE, { venueId });

  if (!sysCheck.ok && !ownerCheck.ok && !manageCheck.ok) {
    return {
      ok: false,
      error: "Không có quyền nâng cấp gói thuê.",
      code: "FORBIDDEN",
    };
  }

  return { ok: true };
}

function recordPaymentEvent(event) {
  const ledger = loadPaymentLedger();
  ledger.unshift({
    id: `pay-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...event,
  });
  savePaymentLedger(ledger.slice(0, 100));
}

/**
 * Bắt đầu nâng cấp gói — dev: áp dụng ngay; stripe: redirect payment link.
 */
export function requestPlanUpgrade(venueId, planId, options = {}) {
  const access = canManageSubscription(venueId);
  if (!access.ok) {
    return access;
  }

  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) {
    return { ok: false, error: "Gói không hợp lệ." };
  }

  if (plan.priceMonthly === 0 || options.skipPayment || PAYMENT_MODE === "dev") {
    const upgraded = upgradeSubscription(venueId, planId, { skipPayment: true });
    if (upgraded.ok) {
      recordPaymentEvent({
        venueId,
        planId,
        amount: plan.priceMonthly,
        provider: "dev",
        status: "completed",
      });
    }
    return upgraded;
  }

  const stripeUrl = STRIPE_LINKS[planId];
  if (PAYMENT_MODE === "stripe" && stripeUrl) {
    const pendingId = `pending-${venueId}-${planId}-${Date.now()}`;
    recordPaymentEvent({
      id: pendingId,
      venueId,
      planId,
      amount: plan.priceMonthly,
      provider: "stripe",
      status: "pending",
    });

    const url = new URL(stripeUrl);
    url.searchParams.set("client_reference_id", venueId);
    url.searchParams.set("metadata_plan_id", planId);

    return {
      ok: true,
      requiresRedirect: true,
      redirectUrl: url.toString(),
      pendingId,
      plan,
    };
  }

  return {
    ok: false,
    error: "Chưa cấu hình thanh toán. Đặt VITE_PAYMENT_MODE=dev hoặc Stripe payment links.",
    code: "PAYMENT_NOT_CONFIGURED",
  };
}

/**
 * Xử lý webhook / callback thanh toán (dev simulate hoặc Edge Function gọi logic tương tự).
 */
export function applyPaymentWebhook(payload = {}) {
  const venueId = String(payload.venueId || payload.venue_id || "").trim();
  const planId = String(payload.planId || payload.plan_id || "").trim();
  const status = String(payload.status || "completed").trim();

  if (!venueId || !planId) {
    return { ok: false, error: "Thiếu venueId hoặc planId.", code: "INVALID_PAYLOAD" };
  }

  if (status !== "completed" && status !== "paid") {
    recordPaymentEvent({ venueId, planId, provider: payload.provider || "webhook", status });
    return { ok: true, applied: false, status };
  }

  const upgraded = renewSubscriptionPeriod(venueId, { planId });
  if (!upgraded.ok) {
    return upgraded;
  }

  recordPaymentEvent({
    venueId,
    planId,
    amount: SUBSCRIPTION_PLANS[planId]?.priceMonthly || 0,
    provider: payload.provider || "webhook",
    status: "completed",
    externalId: payload.externalId || payload.id || null,
  });

  return { ok: true, applied: true, subscription: upgraded.subscription };
}

export function listRecentPayments(limit = 20) {
  return loadPaymentLedger().slice(0, limit);
}

export function getSubscriptionFromStore(venueId) {
  const map = loadSubscriptions();
  return map[venueId] ? normalizeSubscription(map[venueId]) : null;
}
