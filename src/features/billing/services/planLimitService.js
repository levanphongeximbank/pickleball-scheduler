import { createId } from "../../../utils/id.js";
import { getPlanByCode } from "../constants/billingConstants.js";
import { BillingAuditService } from "./billingAuditService.js";
import { ensureCollection } from "./billingStoreUtils.js";

const LIMIT_MAP = Object.freeze({
  venues: "max_venues",
  clubs: "max_clubs",
  players: "max_players",
  courts: "max_courts",
  tournaments: "max_tournaments_per_month",
  bookings: "max_bookings_per_month",
  staff_users: "max_staff_users",
  referees: "max_referees",
  ai_features: "allow_ai_features",
  mobile_app: "allow_mobile_app",
  advanced_dashboard: "allow_advanced_dashboard",
  payment_gateway: "allow_payment_gateway",
  api_access: "allow_api_access",
  custom_branding: "allow_custom_branding",
  multi_venue: "allow_multi_venue",
  offline_mode: "allow_offline_mode",
  push_notification: "allow_push_notification",
});

function getPlanLimit(store, planCode) {
  const limits = ensureCollection(store, "planLimits", []);
  const fromStore = limits.find((item) => item.plan_code === planCode);
  if (fromStore) {
    return fromStore;
  }
  return getPlanByCode(planCode)?.limits || null;
}

export class PlanLimitService {
  constructor({ store } = {}) {
    this.store = store;
    this.audit = new BillingAuditService({ store });
  }

  checkLimit({ resource, currentUsage = 0, planCode = "TRIAL" } = {}) {
    const limit = getPlanLimit(this.store, planCode);
    if (!limit) {
      return { allowed: true, reason: null };
    }

    const limitKey = LIMIT_MAP[resource];
    if (!limitKey) {
      return { allowed: true, reason: null };
    }

    if (limitKey.startsWith("allow_")) {
      const allowed = Boolean(limit[limitKey]);
      return allowed
        ? { allowed: true, reason: null }
        : { allowed: false, reason: `${resource}_not_allowed`, limitCode: limitKey };
    }

    const maxAllowed = Number(limit[limitKey] ?? 0);
    const allowed = currentUsage < maxAllowed;
    return allowed
      ? { allowed: true, reason: null }
      : {
          allowed: false,
          reason: "plan_limit_exceeded",
          limitCode: limitKey,
          currentUsage,
          maxAllowed,
        };
  }

  logExceeded({ tenantId, resource, currentUsage = 0, planCode = "TRIAL", actorUserId = null } = {}) {
    const result = this.checkLimit({ tenantId, resource, currentUsage, planCode });
    if (result.allowed) {
      return result;
    }

    const events = ensureCollection(this.store, "billingEvents", []);
    const audit = ensureCollection(this.store, "billingAuditLogs", []);
    const event = {
      id: `billing-event-${createId()}`,
      tenant_id: tenantId,
      event_type: "PlanLimitExceeded",
      entity_type: resource,
      entity_id: null,
      metadata: { planCode, resource, currentUsage },
      created_at: new Date().toISOString(),
    };
    const entry = {
      id: `billing-audit-${createId()}`,
      tenant_id: tenantId,
      actor_user_id: actorUserId,
      event_type: "PlanLimitExceeded",
      entity_type: resource,
      entity_id: null,
      before: null,
      after: { resource, currentUsage, planCode },
      metadata: {},
      created_at: new Date().toISOString(),
    };

    this.store?.write?.("billingEvents", [...events, event]);
    this.store?.write?.("billingAuditLogs", [...audit, entry]);
    return result;
  }

  getUsageSummary({ planCode = "TRIAL", usage = {} } = {}) {
    const limit = getPlanLimit(this.store, planCode);
    if (!limit) {
      return [];
    }

    return Object.entries(LIMIT_MAP)
      .filter(([, key]) => !key.startsWith("allow_"))
      .map(([resource, key]) => ({
        resource,
        limitCode: key,
        currentUsage: usage[resource] ?? 0,
        maxAllowed: Number(limit[key] ?? 0),
        allowed: (usage[resource] ?? 0) < Number(limit[key] ?? 0),
      }));
  }
}
