import { GRACE_PERIOD_DAYS, SUBSCRIPTION_STATUS } from "../constants/billingConstants.js";
import { addDays, ensureCollection, resolveNow } from "./billingStoreUtils.js";

const BILLING_ALLOWED_ACTIONS = Object.freeze([
  "login",
  "view_billing",
  "view_invoice",
  "view_payment",
  "request_renewal",
  "make_payment",
  "view_tenant_info",
  "view_support",
]);

const EXPIRED_BLOCKED_ACTIONS = Object.freeze([
  "create_booking",
  "create_tournament",
  "create_player",
  "create_court",
  "use_ai",
  "mobile_advanced",
  "export_advanced_report",
  "bulk_notification",
]);

const SUSPENDED_BLOCKED_ACTIONS = Object.freeze([
  ...EXPIRED_BLOCKED_ACTIONS,
  "create_club",
  "update_settings",
  "manage_staff",
]);

export class TenantAccessService {
  constructor({ store, now = () => new Date() } = {}) {
    this.store = store;
    this.now = now;
  }

  getSubscription(tenantId) {
    return ensureCollection(this.store, "subscriptions", []).find((item) => item.tenant_id === tenantId) || null;
  }

  evaluateAccess({ tenantId, now } = {}) {
    const subscription = this.getSubscription(tenantId);
    const resolvedNow = resolveNow(now || this.now());

    if (!subscription) {
      return { allowed: false, reason: "no_subscription", lockLevel: "none", subscription: null };
    }

    if (subscription.status === SUBSCRIPTION_STATUS.SUSPENDED) {
      return {
        allowed: false,
        reason: "subscription_suspended",
        lockLevel: "suspended",
        subscription,
      };
    }

    if (subscription.status === SUBSCRIPTION_STATUS.CANCELLED) {
      return {
        allowed: false,
        reason: "subscription_cancelled",
        lockLevel: "cancelled",
        subscription,
      };
    }

    if (subscription.status === SUBSCRIPTION_STATUS.EXPIRED) {
      return {
        allowed: false,
        reason: "subscription_expired",
        lockLevel: "expired",
        subscription,
      };
    }

    if (subscription.status === SUBSCRIPTION_STATUS.PAST_DUE) {
      const graceUntil = subscription.grace_period_until ? new Date(subscription.grace_period_until) : null;
      if (graceUntil && resolvedNow <= graceUntil) {
        return { allowed: true, reason: "grace_period", lockLevel: "grace", subscription };
      }
      return {
        allowed: false,
        reason: "grace_period_ended",
        lockLevel: "expired",
        subscription,
      };
    }

    if (subscription.status === SUBSCRIPTION_STATUS.TRIALING) {
      const trialEnd = subscription.trial_end_date ? new Date(subscription.trial_end_date) : null;
      if (trialEnd && resolvedNow > trialEnd) {
        return {
          allowed: false,
          reason: "trial_expired",
          lockLevel: "expired",
          subscription,
        };
      }
      return { allowed: true, reason: "trialing", lockLevel: "none", subscription };
    }

    if (subscription.end_date) {
      const endDate = new Date(subscription.end_date);
      if (resolvedNow > endDate) {
        return {
          allowed: false,
          reason: "subscription_expired",
          lockLevel: "expired",
          subscription,
        };
      }
    }

    return { allowed: true, reason: "active", lockLevel: "none", subscription };
  }

  canPerformAction({ tenantId, action, now } = {}) {
    const access = this.evaluateAccess({ tenantId, now });
    const normalizedAction = String(action || "").trim();

    if (BILLING_ALLOWED_ACTIONS.includes(normalizedAction)) {
      return { allowed: true, reason: null, lockLevel: access.lockLevel };
    }

    if (access.allowed) {
      return { allowed: true, reason: null, lockLevel: access.lockLevel };
    }

    if (access.lockLevel === "suspended") {
      const blocked = SUSPENDED_BLOCKED_ACTIONS.includes(normalizedAction) || normalizedAction !== "view_billing";
      if (blocked && !BILLING_ALLOWED_ACTIONS.includes(normalizedAction)) {
        return { allowed: false, reason: "tenant_suspended", lockLevel: access.lockLevel };
      }
    }

    if (access.lockLevel === "expired" || access.lockLevel === "cancelled") {
      if (EXPIRED_BLOCKED_ACTIONS.includes(normalizedAction)) {
        return { allowed: false, reason: access.reason, lockLevel: access.lockLevel };
      }
    }

    if (!access.allowed && !BILLING_ALLOWED_ACTIONS.includes(normalizedAction)) {
      return { allowed: false, reason: access.reason, lockLevel: access.lockLevel };
    }

    return { allowed: true, reason: null, lockLevel: access.lockLevel };
  }

  applyGracePeriod(subscriptionId, { days = GRACE_PERIOD_DAYS, now } = {}) {
    const subscriptions = ensureCollection(this.store, "subscriptions", []);
    const resolvedNow = resolveNow(now || this.now());
    const next = subscriptions.map((item) =>
      item.id === subscriptionId
        ? {
            ...item,
            status: SUBSCRIPTION_STATUS.PAST_DUE,
            grace_period_until: addDays(resolvedNow, days).toISOString(),
            updated_at: resolvedNow.toISOString(),
          }
        : item
    );
    this.store?.write?.("subscriptions", next);
    return next.find((item) => item.id === subscriptionId) || null;
  }

  lockTenant(tenantId, { reason = "expired", now } = {}) {
    const subscriptions = ensureCollection(this.store, "subscriptions", []);
    const resolvedNow = resolveNow(now || this.now());
    const status = reason === "suspended" ? SUBSCRIPTION_STATUS.SUSPENDED : SUBSCRIPTION_STATUS.EXPIRED;
    const next = subscriptions.map((item) =>
      item.tenant_id === tenantId
        ? { ...item, status, updated_at: resolvedNow.toISOString() }
        : item
    );
    this.store?.write?.("subscriptions", next);
    return next.find((item) => item.tenant_id === tenantId) || null;
  }

  unlockTenant(tenantId, { now } = {}) {
    const subscriptions = ensureCollection(this.store, "subscriptions", []);
    const resolvedNow = resolveNow(now || this.now());
    const next = subscriptions.map((item) =>
      item.tenant_id === tenantId
        ? {
            ...item,
            status: SUBSCRIPTION_STATUS.ACTIVE,
            grace_period_until: null,
            updated_at: resolvedNow.toISOString(),
          }
        : item
    );
    this.store?.write?.("subscriptions", next);
    return next.find((item) => item.tenant_id === tenantId) || null;
  }
}

export function guardTenantOperational({ store, tenantId, action, now } = {}) {
  const service = new TenantAccessService({ store, now: () => resolveNow(now) });
  return service.canPerformAction({ tenantId, action, now });
}
