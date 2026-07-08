import { hasSupabaseConfig, getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { createLocalStorageBillingStore } from "../services/billingStorage.js";
import { ensureCollection, writeCollection } from "../services/billingStoreUtils.js";
import { createMemoryBillingStore } from "./memoryBillingStore.js";
import { createSupabaseBillingStore } from "./supabaseBillingStore.js";
import { isSupabaseBillingStore } from "./billingStoreRuntime.js";

export const BILLING_STORE_MODES = Object.freeze({
  MEMORY: "memory",
  LOCAL: "local",
  SUPABASE: "supabase",
});

function readEnvFlag(name) {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[name];
  }
  return undefined;
}

/** Resolve billing persistence mode: memory (test), supabase (production), local (dev fallback). */
export function resolveBillingStoreMode() {
  const forced = readEnvFlag("VITE_BILLING_STORE_MODE");
  if (forced && Object.values(BILLING_STORE_MODES).includes(forced)) {
    return forced;
  }

  if (readEnvFlag("NODE_ENV") === "test" || readEnvFlag("VITEST") === "true") {
    return BILLING_STORE_MODES.MEMORY;
  }

  if (hasSupabaseConfig() && readEnvFlag("VITE_BILLING_SUPABASE") !== "false") {
    return BILLING_STORE_MODES.SUPABASE;
  }

  return BILLING_STORE_MODES.LOCAL;
}

let sharedStore = null;

export function createBillingStore({ mode, storage, client, seed } = {}) {
  const resolvedMode = mode || resolveBillingStoreMode();

  switch (resolvedMode) {
    case BILLING_STORE_MODES.MEMORY:
      return createMemoryBillingStore(seed);
    case BILLING_STORE_MODES.SUPABASE: {
      const supabaseClient = client || getSupabaseAuthClient();
      if (!supabaseClient) {
        return createLocalStorageBillingStore(storage);
      }
      return createSupabaseBillingStore(supabaseClient, { cache: seed });
    }
    case BILLING_STORE_MODES.LOCAL:
    default:
      return createLocalStorageBillingStore(storage);
  }
}

/** Singleton store for app runtime (dev local / staging supabase). */
export function getBillingStore(options = {}) {
  if (!sharedStore || options.forceNew) {
    sharedStore = createBillingStore(options);
  }
  return sharedStore;
}

export function resetBillingStore() {
  sharedStore = null;
}

class CollectionRepository {
  constructor(store, collection, fallback = []) {
    this.store = store;
    this.collection = collection;
    this.fallback = fallback;
  }

  list() {
    return ensureCollection(this.store, this.collection, this.fallback);
  }

  find(predicate) {
    return this.list().find(predicate) || null;
  }

  saveAll(items) {
    return writeCollection(this.store, this.collection, items);
  }

  upsert(item) {
    const current = this.list();
    const index = current.findIndex((row) => row.id === item.id);
    const next =
      index === -1
        ? [...current, item]
        : current.map((row) => (row.id === item.id ? item : row));
    return writeCollection(this.store, this.collection, next);
  }
}

export class PlanRepository extends CollectionRepository {
  constructor(store) {
    super(store, "plans", []);
  }

  getByCode(code) {
    return this.find((plan) => plan.code === code);
  }
}

export class PlanLimitRepository extends CollectionRepository {
  constructor(store) {
    super(store, "planLimits", []);
  }

  getByPlanId(planId) {
    return this.find((limit) => limit.plan_id === planId || limit.plan_code === planId);
  }
}

export class SubscriptionRepository extends CollectionRepository {
  constructor(store) {
    super(store, "subscriptions", []);
  }

  getByTenant(tenantId) {
    return this.find((item) => item.tenant_id === tenantId);
  }
}

export class InvoiceRepository extends CollectionRepository {
  constructor(store) {
    super(store, "invoices", []);
  }

  listByTenant(tenantId) {
    return this.list().filter((item) => item.tenant_id === tenantId);
  }
}

export class PaymentRepository extends CollectionRepository {
  constructor(store) {
    super(store, "payments", []);
  }

  listByTenant(tenantId) {
    return this.list().filter((item) => item.tenant_id === tenantId);
  }
}

export class BillingAuditRepository extends CollectionRepository {
  constructor(store) {
    super(store, "billingAuditLogs", []);
  }

  listByTenant(tenantId) {
    return this.list().filter((item) => item.tenant_id === tenantId);
  }
}

export function createBillingRepositories(store = getBillingStore()) {
  return {
    store,
    plans: new PlanRepository(store),
    planLimits: new PlanLimitRepository(store),
    subscriptions: new SubscriptionRepository(store),
    invoices: new InvoiceRepository(store),
    payments: new PaymentRepository(store),
    billingAudit: new BillingAuditRepository(store),
  };
}
