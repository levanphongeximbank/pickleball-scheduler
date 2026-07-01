import { createId } from "../../../utils/id.js";
import { addToCollection } from "./billingStoreUtils.js";

export const BILLING_NOTIFICATION_EVENTS = Object.freeze([
  "TrialStarted",
  "TrialEndingSoon",
  "TrialExpired",
  "InvoiceIssued",
  "InvoiceOverdue",
  "PaymentReceived",
  "PaymentFailed",
  "SubscriptionActivated",
  "SubscriptionExpired",
  "SubscriptionSuspended",
  "SubscriptionRenewed",
  "PlanUpgraded",
  "PlanDowngraded",
  "TenantLocked",
  "TenantUnlocked",
  "PlanLimitExceeded",
]);

export class BillingNotificationService {
  constructor({ store } = {}) {
    this.store = store;
  }

  emit({ tenantId, eventType, userId = null, role = null, metadata = {}, now = new Date() } = {}) {
    const event = {
      id: `billing-event-${createId()}`,
      tenant_id: tenantId,
      event_type: eventType,
      user_id: userId,
      role,
      metadata,
      created_at: (now instanceof Date ? now : new Date(now)).toISOString(),
    };

    addToCollection(this.store, "billingEvents", event);
    return event;
  }

  list({ tenantId = null } = {}) {
    const events = this.store?.read?.("billingEvents") || [];
    if (!tenantId) {
      return events;
    }
    return events.filter((item) => item.tenant_id === tenantId);
  }
}
