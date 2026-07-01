import { createId } from "../../../utils/id.js";
import { addToCollection } from "./billingStoreUtils.js";

export class BillingAuditService {
  constructor({ store } = {}) {
    this.store = store;
  }

  log({
    tenantId,
    actorUserId = null,
    eventType,
    entityType,
    entityId = null,
    before = null,
    after = null,
    metadata = {},
    now = new Date(),
  } = {}) {
    const entry = {
      id: `billing-audit-${createId()}`,
      tenant_id: tenantId,
      actor_user_id: actorUserId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      before,
      after,
      metadata,
      created_at: resolveIso(now),
    };

    addToCollection(this.store, "billingAuditLogs", entry);
    return entry;
  }

  list({ tenantId = null } = {}) {
    const logs = this.store?.read?.("billingAuditLogs") || [];
    if (!tenantId) {
      return logs;
    }
    return logs.filter((item) => item.tenant_id === tenantId);
  }
}

function resolveIso(now) {
  return (now instanceof Date ? now : new Date(now)).toISOString();
}
