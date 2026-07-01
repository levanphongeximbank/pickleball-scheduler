/**
 * Phase 9 subscription access bridge — source of truth for TenantContext / SubscriptionGate.
 * Legacy subscriptionLifecycleService remains for Sprint 4 tests and subscriptionGuard plan limits.
 */
import { GRACE_PERIOD_DAYS } from "../constants/billingConstants.js";
import { BillingEngine } from "../services/billingEngine.js";
import { InvoiceService } from "../services/invoiceService.js";
import { PaymentService } from "../services/paymentService.js";
import { SubscriptionService } from "../services/subscriptionService.js";
import { ensureCollection } from "../services/billingStoreUtils.js";
import { getBillingStore } from "../repositories/billingRepository.js";
import {
  BILLING_PERSIST_SETS,
  flushBillingStoreDirty,
  isSupabaseBillingStore,
  shouldSeedBillingDefaults,
} from "../repositories/billingStoreRuntime.js";
import {
  SUBSCRIPTION_STATUS as LEGACY_STATUS,
  normalizeSubscription,
} from "../../../models/subscription.js";

const PHASE9_STATUS_TO_LEGACY = Object.freeze({
  trialing: LEGACY_STATUS.TRIAL,
  active: LEGACY_STATUS.ACTIVE,
  past_due: LEGACY_STATUS.PAST_DUE,
  expired: LEGACY_STATUS.EXPIRED,
  cancelled: LEGACY_STATUS.CANCELLED,
  suspended: LEGACY_STATUS.EXPIRED,
});

const PLAN_CODE_TO_LEGACY = Object.freeze({
  TRIAL: "trial",
  STARTER: "starter",
  PROFESSIONAL: "professional",
  ENTERPRISE: "enterprise",
});

const ACCESS_REASON_CODES = Object.freeze({
  trial_expired: "SUBSCRIPTION_LOCKED",
  subscription_expired: "SUBSCRIPTION_LOCKED",
  grace_period_ended: "SUBSCRIPTION_LOCKED",
  subscription_suspended: "SUBSCRIPTION_LOCKED",
  subscription_cancelled: "SUBSCRIPTION_INACTIVE",
});

function createEngine(store = getBillingStore()) {
  const subscriptionService = new SubscriptionService({ store });
  const invoiceService = new InvoiceService({ store });
  const paymentService = new PaymentService({ store, subscriptionService, invoiceService });
  const engine = new BillingEngine({
    store,
    subscriptionService,
    invoiceService,
    paymentService,
  });
  if (shouldSeedBillingDefaults(store)) {
    engine.seedDefaults();
  }
  return engine;
}

export function phase9SubscriptionToLegacy(phase9Sub) {
  if (!phase9Sub) {
    return null;
  }

  const planCode = String(phase9Sub.plan_code || "TRIAL").toUpperCase();
  const legacyPlanId = PLAN_CODE_TO_LEGACY[planCode] || "trial";
  const legacyStatus =
    PHASE9_STATUS_TO_LEGACY[phase9Sub.status] || phase9Sub.status || LEGACY_STATUS.TRIAL;

  return normalizeSubscription({
    id: phase9Sub.id,
    venueId: phase9Sub.tenant_id,
    planId: legacyPlanId,
    status: legacyStatus,
    currentPeriodStart: phase9Sub.start_date || phase9Sub.trial_start_date,
    currentPeriodEnd: phase9Sub.end_date || phase9Sub.trial_end_date,
    autoRenew: phase9Sub.auto_renew !== false,
    cancelledAt: phase9Sub.cancelled_at || null,
    lockedAt:
      legacyStatus === LEGACY_STATUS.EXPIRED
        ? phase9Sub.updated_at || new Date().toISOString()
        : null,
    createdAt: phase9Sub.created_at,
    updatedAt: phase9Sub.updated_at,
  });
}

function buildBlockedMessage(access) {
  const planName = access.subscription?.plan_code || "subscription";
  switch (access.reason) {
    case "trial_expired":
      return `Gói ${planName} hết hạn dùng thử. Gia hạn trong Billing để mở khóa.`;
    case "subscription_suspended":
      return `Gói ${planName} đã bị tạm dừng. Liên hệ quản trị viên.`;
    case "grace_period_ended":
    case "subscription_expired":
      return `Gói ${planName} đã hết hạn. Gia hạn trong Billing để mở khóa.`;
    case "subscription_cancelled":
      return `Gói ${planName} đã hủy. Gia hạn để kích hoạt lại.`;
    default:
      return "Gói thuê đã hết hạn. Gia hạn trong Billing.";
  }
}

/**
 * Tenant operational check for SubscriptionGate / MobileRouteGate.
 * Replaces legacy subscriptionLifecycleService for production paths.
 */
export function assertSubscriptionOperational(tenantId, options = {}) {
  if (!tenantId) {
    return { ok: true, code: "NO_TENANT" };
  }

  const engine = createEngine(options.store);
  const existing = engine.subscriptionService?.getByTenant?.(tenantId);

  if (!existing) {
    return { ok: true, code: "NO_SUBSCRIPTION" };
  }

  const access = engine.evaluateTenantAccess({ tenantId, now: options.now });

  if (access.allowed) {
    return {
      ok: true,
      code: "SUBSCRIPTION_OK",
      subscription: phase9SubscriptionToLegacy(access.subscription || existing),
    };
  }

  return {
    ok: false,
    error: buildBlockedMessage(access),
    code: ACCESS_REASON_CODES[access.reason] || "SUBSCRIPTION_INACTIVE",
    subscription: phase9SubscriptionToLegacy(access.subscription),
  };
}

/**
 * Evaluate expiry/grace for all Phase 9 subscriptions once per app bootstrap.
 */
export function runSubscriptionMaintenance(options = {}) {
  const store = options.store || getBillingStore();
  const engine = createEngine(store);
  const subscriptions = ensureCollection(store, "subscriptions", []);
  const results = [];

  for (const subscription of subscriptions) {
    const access = engine.evaluateTenantAccess({
      tenantId: subscription.tenant_id,
      now: options.now,
    });

    let changed = false;
    if (
      !access.allowed &&
      (access.lockLevel === "expired" || access.lockLevel === "cancelled") &&
      subscription.status !== "expired" &&
      subscription.status !== "cancelled"
    ) {
      engine.expireSubscription(subscription.id, { now: options.now });
      changed = true;
    } else if (
      access.reason === "grace_period_ended" &&
      subscription.status === "active"
    ) {
      engine.subscriptionService?.setPastDue?.(subscription.id, {
        graceDays: options.graceDays ?? GRACE_PERIOD_DAYS,
        now: options.now,
      });
      changed = true;
    }

    results.push({
      tenantId: subscription.tenant_id,
      access,
      changed,
    });
  }

  if (results.some((row) => row.changed) && isSupabaseBillingStore(store)) {
    void flushBillingStoreDirty(store, BILLING_PERSIST_SETS.SUBSCRIPTION);
  }

  return { ok: true, processed: results.length, results };
}
