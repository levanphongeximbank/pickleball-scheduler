import { createId } from "../../../utils/id.js";
import {
  DEFAULT_PLANS,
  GRACE_PERIOD_DAYS,
  SUBSCRIPTION_STATUS,
  TRIAL_DAYS,
  getPlanByCode,
  getPlanCatalog,
} from "../constants/billingConstants.js";
import { BillingAuditService } from "./billingAuditService.js";
import { BillingNotificationService } from "./billingNotificationService.js";
import {
  addDays,
  addToCollection,
  ensureCollection,
  resolveNow,
  updateInCollection,
  writeCollection,
} from "./billingStoreUtils.js";
import { shouldSeedBillingDefaults } from "../repositories/billingStoreRuntime.js";
import { TenantAccessService } from "./tenantAccessService.js";

export { getPlanCatalog, getPlanByCode };

function normalizeSubscriptionInput(input = {}) {
  const now = resolveNow(input.now || new Date());
  const trialEnd = input.trial_end_date || addDays(now, TRIAL_DAYS).toISOString();
  return {
    id: input.id || `sub-${createId()}`,
    tenant_id: input.tenantId,
    plan_code: input.planCode || "TRIAL",
    plan_id: input.planId || input.planCode || "TRIAL",
    status: input.status || SUBSCRIPTION_STATUS.TRIALING,
    billing_cycle: input.billingCycle || "monthly",
    start_date: input.start_date || now.toISOString(),
    end_date: input.end_date || null,
    trial_start_date: input.trial_start_date || now.toISOString(),
    trial_end_date: trialEnd,
    cancel_at: input.cancel_at || null,
    cancelled_at: input.cancelled_at || null,
    grace_period_until: input.grace_period_until || null,
    auto_renew: input.auto_renew !== false,
    created_at: input.created_at || now.toISOString(),
    updated_at: input.updated_at || now.toISOString(),
  };
}

export class BillingEngine {
  constructor({ store, now = () => new Date(), subscriptionService, invoiceService, paymentService } = {}) {
    this.store = store;
    this.now = now;
    this.subscriptionService = subscriptionService;
    this.invoiceService = invoiceService;
    this.paymentService = paymentService;
    this.audit = new BillingAuditService({ store });
    this.notifications = new BillingNotificationService({ store });
    this.tenantAccess = new TenantAccessService({ store, now });
  }

  seedDefaults() {
    if (!shouldSeedBillingDefaults(this.store)) {
      return;
    }

    const plans = ensureCollection(this.store, "plans", []);
    if (plans.length === 0) {
      writeCollection(
        this.store,
        "plans",
        Object.values(DEFAULT_PLANS).map((plan) => ({
          id: `plan-${plan.code}`,
          code: plan.code,
          name: plan.name,
          description: plan.description,
          price_monthly: plan.price_monthly,
          price_yearly: plan.price_yearly,
          currency: plan.currency,
          is_active: plan.is_active,
          sort_order: plan.sort_order,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
      );
    }

    const limits = ensureCollection(this.store, "planLimits", []);
    if (limits.length === 0) {
      writeCollection(
        this.store,
        "planLimits",
        Object.values(DEFAULT_PLANS).map((plan) => ({
          id: `limit-${plan.code}`,
          plan_id: `plan-${plan.code}`,
          plan_code: plan.code,
          ...plan.limits,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
      );
    }
  }

  createTrialSubscription({ tenantId, ownerUserId, planCode = "TRIAL", now } = {}) {
    this.seedDefaults();
    const resolvedNow = resolveNow(now || this.now());
    const subscription = normalizeSubscriptionInput({
      tenantId,
      ownerUserId,
      planCode,
      now: resolvedNow,
      status: SUBSCRIPTION_STATUS.TRIALING,
    });

    addToCollection(this.store, "subscriptions", subscription);
    this.audit.log({
      tenantId,
      actorUserId: ownerUserId,
      eventType: "SubscriptionCreated",
      entityType: "tenant_subscription",
      entityId: subscription.id,
      after: { status: SUBSCRIPTION_STATUS.TRIALING, planCode },
      now: resolvedNow,
    });
    this.notifications.emit({
      tenantId,
      eventType: "TrialStarted",
      userId: ownerUserId,
      metadata: { planCode },
      now: resolvedNow,
    });

    return subscription;
  }

  evaluateTenantAccess({ tenantId, now } = {}) {
    this.seedDefaults();
    return this.tenantAccess.evaluateAccess({ tenantId, now });
  }

  canPerformAction({ tenantId, action, now } = {}) {
    return this.tenantAccess.canPerformAction({ tenantId, action, now });
  }

  createInvoiceFromSubscription({ tenantId, subscriptionId, actorUserId } = {}) {
    const subscription = ensureCollection(this.store, "subscriptions", []).find((item) => item.id === subscriptionId);
    const plan = getPlanByCode(subscription?.plan_code || "STARTER");
    const amount = plan?.price_monthly || 0;
    const invoice = this.invoiceService?.createInvoice({
      tenantId,
      subscriptionId,
      amount,
      currency: plan?.currency || "VND",
      status: "issued",
    });
    if (invoice) {
      this.audit.log({
        tenantId,
        actorUserId,
        eventType: "InvoiceCreated",
        entityType: "invoice",
        entityId: invoice.id,
        after: { amount, status: invoice.status },
      });
      this.notifications.emit({ tenantId, eventType: "InvoiceIssued", userId: actorUserId, metadata: { invoiceId: invoice.id } });
    }
    return invoice;
  }

  handlePaymentSuccess({ tenantId, paymentId, invoiceId, actorUserId } = {}) {
    const payment = this.paymentService?.getById?.(paymentId);
    const invoice = this.invoiceService?.markPaid(invoiceId, { actorUserId });
    const subscription = this.subscriptionService?.getByTenant(tenantId);
    if (subscription) {
      this.activateSubscription(subscription.id, { actorUserId });
    }
    this.audit.log({
      tenantId,
      actorUserId,
      eventType: "PaymentReceived",
      entityType: "payment",
      entityId: paymentId,
      after: { status: "succeeded", invoiceId },
    });
    this.notifications.emit({ tenantId, eventType: "PaymentReceived", userId: actorUserId, metadata: { paymentId, invoiceId } });
    return { payment, invoice, subscription };
  }

  handlePaymentFailure({ tenantId, paymentId, actorUserId, reason = "payment_failed" } = {}) {
    this.audit.log({
      tenantId,
      actorUserId,
      eventType: "PaymentFailed",
      entityType: "payment",
      entityId: paymentId,
      metadata: { reason },
    });
    this.notifications.emit({ tenantId, eventType: "PaymentFailed", userId: actorUserId, metadata: { paymentId, reason } });
    const subscription = this.subscriptionService?.getByTenant(tenantId);
    if (subscription?.status === SUBSCRIPTION_STATUS.ACTIVE) {
      this.tenantAccess.applyGracePeriod(subscription.id, { days: GRACE_PERIOD_DAYS });
    }
    return { ok: true };
  }

  activateSubscription(subscriptionId, { actorUserId, now } = {}) {
    const before = this.subscriptionService?.getById(subscriptionId);
    const activated = this.subscriptionService?.activateSubscription(subscriptionId, { now });
    this.audit.log({
      tenantId: activated?.tenant_id,
      actorUserId,
      eventType: "SubscriptionActivated",
      entityType: "tenant_subscription",
      entityId: subscriptionId,
      before: before ? { status: before.status } : null,
      after: { status: activated?.status },
    });
    this.notifications.emit({
      tenantId: activated?.tenant_id,
      eventType: "SubscriptionActivated",
      userId: actorUserId,
    });
    return activated;
  }

  renewSubscription(subscriptionId, { actorUserId, now } = {}) {
    const resolvedNow = resolveNow(now || this.now());
    const subscription = updateInCollection(this.store, "subscriptions", subscriptionId, (item) => ({
      ...item,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      end_date: addDays(resolvedNow, 30).toISOString(),
      grace_period_until: null,
      updated_at: resolvedNow.toISOString(),
    }));
    this.audit.log({
      tenantId: subscription?.tenant_id,
      actorUserId,
      eventType: "SubscriptionRenewed",
      entityType: "tenant_subscription",
      entityId: subscriptionId,
      after: { end_date: subscription?.end_date },
      now: resolvedNow,
    });
    this.notifications.emit({
      tenantId: subscription?.tenant_id,
      eventType: "SubscriptionRenewed",
      userId: actorUserId,
    });
    return subscription;
  }

  cancelSubscription(subscriptionId, { actorUserId, now } = {}) {
    const cancelled = this.subscriptionService?.cancelSubscription(subscriptionId, { now });
    this.audit.log({
      tenantId: cancelled?.tenant_id,
      actorUserId,
      eventType: "SubscriptionCancelled",
      entityType: "tenant_subscription",
      entityId: subscriptionId,
      after: { status: cancelled?.status },
    });
    return cancelled;
  }

  suspendSubscription(subscriptionId, { actorUserId, now } = {}) {
    const suspended = this.subscriptionService?.suspendSubscription(subscriptionId, { now });
    this.audit.log({
      tenantId: suspended?.tenant_id,
      actorUserId,
      eventType: "SubscriptionSuspended",
      entityType: "tenant_subscription",
      entityId: subscriptionId,
      after: { status: suspended?.status },
    });
    this.notifications.emit({
      tenantId: suspended?.tenant_id,
      eventType: "SubscriptionSuspended",
      userId: actorUserId,
    });
    this.tenantAccess.lockTenant(suspended?.tenant_id, { reason: "suspended", now });
    this.notifications.emit({ tenantId: suspended?.tenant_id, eventType: "TenantLocked", userId: actorUserId });
    return suspended;
  }

  unlockTenant(tenantId, { actorUserId, now } = {}) {
    const unlocked = this.tenantAccess.unlockTenant(tenantId, { now });
    this.audit.log({
      tenantId,
      actorUserId,
      eventType: "TenantUnlocked",
      entityType: "tenant",
      entityId: tenantId,
      after: { status: unlocked?.status },
    });
    this.notifications.emit({ tenantId, eventType: "TenantUnlocked", userId: actorUserId });
    return unlocked;
  }

  changePlan(subscriptionId, planCode, { actorUserId, now } = {}) {
    const before = this.subscriptionService?.getById(subscriptionId);
    const updated = this.subscriptionService?.changePlan(subscriptionId, planCode, { now });
    const eventType =
      (getPlanByCode(planCode)?.sort_order || 0) > (getPlanByCode(before?.plan_code)?.sort_order || 0)
        ? "PlanUpgraded"
        : "PlanDowngraded";
    this.audit.log({
      tenantId: updated?.tenant_id,
      actorUserId,
      eventType,
      entityType: "tenant_subscription",
      entityId: subscriptionId,
      before: { plan_code: before?.plan_code },
      after: { plan_code: updated?.plan_code },
    });
    this.notifications.emit({
      tenantId: updated?.tenant_id,
      eventType,
      userId: actorUserId,
      metadata: { planCode },
    });
    return updated;
  }

  expireSubscription(subscriptionId, { actorUserId, now } = {}) {
    const expired = this.subscriptionService?.expireSubscription(subscriptionId, { now });
    this.audit.log({
      tenantId: expired?.tenant_id,
      actorUserId,
      eventType: "SubscriptionExpired",
      entityType: "tenant_subscription",
      entityId: subscriptionId,
      after: { status: expired?.status },
    });
    this.notifications.emit({ tenantId: expired?.tenant_id, eventType: "SubscriptionExpired", userId: actorUserId });
    this.tenantAccess.lockTenant(expired?.tenant_id, { reason: "expired", now });
    this.notifications.emit({ tenantId: expired?.tenant_id, eventType: "TenantLocked", userId: actorUserId });
    return expired;
  }
}
