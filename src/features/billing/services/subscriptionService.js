import { createId } from "../../../utils/id.js";
import { SUBSCRIPTION_STATUS, TRIAL_DAYS } from "../constants/billingConstants.js";
import {
  addDays,
  ensureCollection,
  resolveNow,
  updateInCollection,
  writeCollection,
} from "./billingStoreUtils.js";

export class SubscriptionService {
  constructor({ store } = {}) {
    this.store = store;
  }

  createSubscription({ tenantId, planCode = "TRIAL", status = SUBSCRIPTION_STATUS.TRIALING, now = new Date(), billingCycle = "monthly" } = {}) {
    const subscriptions = ensureCollection(this.store, "subscriptions", []);
    const resolvedNow = resolveNow(now);
    const created = {
      id: `sub-${createId()}`,
      tenant_id: tenantId,
      plan_code: planCode,
      plan_id: planCode,
      status,
      billing_cycle: billingCycle,
      start_date: resolvedNow.toISOString(),
      end_date: null,
      trial_start_date: resolvedNow.toISOString(),
      trial_end_date: addDays(resolvedNow, TRIAL_DAYS).toISOString(),
      cancel_at: null,
      cancelled_at: null,
      grace_period_until: null,
      auto_renew: true,
      created_at: resolvedNow.toISOString(),
      updated_at: resolvedNow.toISOString(),
    };

    writeCollection(this.store, "subscriptions", [...subscriptions, created]);
    return created;
  }

  getById(id) {
    return ensureCollection(this.store, "subscriptions", []).find((item) => item.id === id) || null;
  }

  getByTenant(tenantId) {
    return ensureCollection(this.store, "subscriptions", []).find((item) => item.tenant_id === tenantId) || null;
  }

  listAll() {
    return ensureCollection(this.store, "subscriptions", []);
  }

  activateSubscription(id, { now = new Date() } = {}) {
    const resolvedNow = resolveNow(now);
    return updateInCollection(this.store, "subscriptions", id, (item) => ({
      ...item,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      end_date: addDays(resolvedNow, 30).toISOString(),
      updated_at: resolvedNow.toISOString(),
    }));
  }

  expireSubscription(id, { now = new Date() } = {}) {
    const resolvedNow = resolveNow(now);
    return updateInCollection(this.store, "subscriptions", id, (item) => ({
      ...item,
      status: SUBSCRIPTION_STATUS.EXPIRED,
      updated_at: resolvedNow.toISOString(),
    }));
  }

  suspendSubscription(id, { now = new Date() } = {}) {
    const resolvedNow = resolveNow(now);
    return updateInCollection(this.store, "subscriptions", id, (item) => ({
      ...item,
      status: SUBSCRIPTION_STATUS.SUSPENDED,
      updated_at: resolvedNow.toISOString(),
    }));
  }

  cancelSubscription(id, { now = new Date() } = {}) {
    const resolvedNow = resolveNow(now);
    return updateInCollection(this.store, "subscriptions", id, (item) => ({
      ...item,
      status: SUBSCRIPTION_STATUS.CANCELLED,
      cancelled_at: resolvedNow.toISOString(),
      cancel_at: resolvedNow.toISOString(),
      auto_renew: false,
      updated_at: resolvedNow.toISOString(),
    }));
  }

  changePlan(id, planCode, { now = new Date() } = {}) {
    const resolvedNow = resolveNow(now);
    return updateInCollection(this.store, "subscriptions", id, (item) => ({
      ...item,
      plan_code: planCode,
      plan_id: planCode,
      updated_at: resolvedNow.toISOString(),
    }));
  }

  renewSubscription(id, { now = new Date(), days = 30 } = {}) {
    const resolvedNow = resolveNow(now);
    return updateInCollection(this.store, "subscriptions", id, (item) => ({
      ...item,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      end_date: addDays(resolvedNow, days).toISOString(),
      grace_period_until: null,
      updated_at: resolvedNow.toISOString(),
    }));
  }

  setPastDue(id, { graceDays = 3, now = new Date() } = {}) {
    const resolvedNow = resolveNow(now);
    return updateInCollection(this.store, "subscriptions", id, (item) => ({
      ...item,
      status: SUBSCRIPTION_STATUS.PAST_DUE,
      grace_period_until: addDays(resolvedNow, graceDays).toISOString(),
      updated_at: resolvedNow.toISOString(),
    }));
  }

  checkTenantAccess(tenantId, { now } = {}) {
    const subscription = this.getByTenant(tenantId);
    if (!subscription) {
      return { allowed: false, reason: "no_subscription" };
    }
    if ([SUBSCRIPTION_STATUS.EXPIRED, SUBSCRIPTION_STATUS.SUSPENDED, SUBSCRIPTION_STATUS.CANCELLED].includes(subscription.status)) {
      return { allowed: false, reason: subscription.status };
    }
    if (subscription.trial_end_date && resolveNow(now) > new Date(subscription.trial_end_date) && subscription.status === SUBSCRIPTION_STATUS.TRIALING) {
      return { allowed: false, reason: "trial_expired" };
    }
    return { allowed: true, subscription };
  }
}
