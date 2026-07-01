import test from "node:test";
import assert from "node:assert/strict";

import { InvoiceService } from "../src/features/billing/services/invoiceService.js";
import { createMemoryBillingStore } from "../src/features/billing/repositories/memoryBillingStore.js";
import { createSupabaseBillingStore } from "../src/features/billing/repositories/supabaseBillingStore.js";
import {
  BILLING_PERSIST_SETS,
  ensureBillingStoreHydrated,
  isSupabaseBillingStore,
  persistBillingCollections,
  resetBillingStoreHydration,
  shouldSeedBillingDefaults,
} from "../src/features/billing/repositories/billingStoreRuntime.js";
import { serializeBillingRow } from "../src/features/billing/repositories/billingRowMap.js";
import { BillingEngine } from "../src/features/billing/services/billingEngine.js";
import { ensureTrialSubscriptionRpc } from "../src/features/billing/services/billingTrialRpc.js";
import {
  formatBillingTenantError,
  resolveBillingTenantId,
} from "../src/features/billing/services/billingTenantResolver.js";

function createMockSupabaseClient(tables = {}) {
  return {
    from(table) {
      return {
        async select() {
          return { data: tables[table] || [], error: null };
        },
        async upsert(rows) {
          tables[table] = rows;
          return { error: null };
        },
      };
    },
  };
}

test("isSupabaseBillingStore detects supabase mode only", () => {
  const memory = createMemoryBillingStore();
  const supabase = createSupabaseBillingStore(createMockSupabaseClient());
  assert.equal(isSupabaseBillingStore(memory), false);
  assert.equal(isSupabaseBillingStore(supabase), true);
  assert.equal(shouldSeedBillingDefaults(memory), true);
  assert.equal(shouldSeedBillingDefaults(supabase), false);
});

test("ensureBillingStoreHydrated calls hydrateAll once for supabase store", async () => {
  const tables = {
    plans: [{ id: "plan-TRIAL", code: "TRIAL", name: "Trial", is_active: true }],
    plan_limits: [],
    tenant_subscriptions: [],
    invoices: [],
    invoice_items: [],
    payments: [],
    billing_events: [],
    billing_audit_logs: [],
  };
  const client = createMockSupabaseClient(tables);
  const store = createSupabaseBillingStore(client);
  resetBillingStoreHydration(store);

  const first = await ensureBillingStoreHydrated(store);
  const second = await ensureBillingStoreHydrated(store);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(store.read("plans").length, 1);
  assert.equal(store.read("plans")[0].code, "TRIAL");
});

test("ensureBillingStoreHydrated returns error without throwing when hydrate fails", async () => {
  const client = {
    from() {
      return {
        async select() {
          return { data: null, error: { message: "network down" } };
        },
      };
    },
  };
  const store = createSupabaseBillingStore(client);
  resetBillingStoreHydration(store);

  const result = await ensureBillingStoreHydrated(store);
  assert.equal(result.ok, false);
  assert.match(result.error, /network down/);
});

test("persistBillingCollections upserts invoice rows for supabase store", async () => {
  const tables = {};
  const store = createSupabaseBillingStore(createMockSupabaseClient(tables));
  const invoiceService = new InvoiceService({ store });
  invoiceService.createInvoice({
    tenantId: "venue-a",
    subscriptionId: "sub-1",
    amount: 500,
    currency: "VND",
  });

  const result = await persistBillingCollections(store, BILLING_PERSIST_SETS.INVOICE);
  assert.equal(result.ok, true);
  assert.equal(tables.invoices?.length, 1);
  assert.equal(tables.invoices[0].tenant_id, "venue-a");
});

test("persistBillingCollections upserts payment and paid invoice collections", async () => {
  const tables = {
    tenant_subscriptions: [
      {
        id: "sub-1",
        tenant_id: "venue-a",
        plan_id: "plan-STARTER",
        status: "active",
        billing_cycle: "monthly",
        auto_renew: true,
      },
    ],
  };
  const store = createSupabaseBillingStore(createMockSupabaseClient(tables));
  const invoiceService = new InvoiceService({ store });

  const invoice = invoiceService.createInvoice({
    tenantId: "venue-a",
    subscriptionId: "sub-1",
    amount: 990000,
    currency: "VND",
  });
  invoiceService.markPaid(invoice.id, { actorUserId: "admin-1" });

  const result = await persistBillingCollections(store, ["invoices", "billingAuditLogs"]);
  assert.equal(result.ok, true);
  assert.equal(tables.invoices?.[0]?.status, "paid");
  assert.ok((tables.billing_audit_logs || []).length >= 1);
});

test("serializeBillingRow strips plan_code and normalizes plan_id for subscriptions", () => {
  const row = serializeBillingRow("subscriptions", {
    id: "sub-1",
    tenant_id: "venue-a",
    plan_code: "STARTER",
    plan_id: "STARTER",
    status: "active",
  });
  assert.equal(row.plan_id, "plan-STARTER");
  assert.equal(row.plan_code, undefined);
});

test("BillingEngine seedDefaults is skipped for supabase store", () => {
  const store = createSupabaseBillingStore(createMockSupabaseClient());
  const engine = new BillingEngine({ store });
  engine.seedDefaults();
  assert.equal(store.read("plans").length, 0);
});

test("ensureTrialSubscriptionRpc merges subscription from RPC response", async () => {
  const tables = { tenant_subscriptions: [] };
  const client = {
    async rpc(name, payload) {
      assert.equal(name, "billing_create_trial_subscription");
      assert.ok(payload.p_tenant_id);
      const row = {
        id: "sub-rpc-1",
        tenant_id: payload.p_tenant_id,
        plan_id: "plan-TRIAL",
        status: "trialing",
        billing_cycle: "monthly",
        auto_renew: true,
      };
      tables.tenant_subscriptions = [row];
      return { data: row, error: null };
    },
    from(table) {
      return {
        async select() {
          return { data: tables[table] || [], error: null };
        },
      };
    },
  };
  const store = createSupabaseBillingStore(client);
  const result = await ensureTrialSubscriptionRpc(store, { tenantId: "venue-a" });
  assert.equal(result.ok, true);
  assert.equal(store.read("subscriptions").length, 1);
  assert.equal(store.read("subscriptions")[0].plan_code, "TRIAL");
});

test("ensureTrialSubscriptionRpc returns RPC_NOT_APPLIED when function missing", async () => {
  const store = createSupabaseBillingStore({
    async rpc() {
      return {
        data: null,
        error: { message: "function billing_create_trial_subscription() does not exist" },
      };
    },
    from() {
      return { async select() { return { data: [], error: null }; } };
    },
  });
  const result = await ensureTrialSubscriptionRpc(store, { tenantId: "venue-a" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "RPC_NOT_APPLIED");
});

test("memory store fallback still seeds defaults and creates trial subscription", () => {
  const store = createMemoryBillingStore();
  const engine = new BillingEngine({ store });
  engine.seedDefaults();
  const subscription = engine.createTrialSubscription({ tenantId: "tenant-local", ownerUserId: "u1" });
  assert.equal(store.read("plans").length, 4);
  assert.equal(subscription.tenant_id, "tenant-local");
});

test("resolveBillingTenantId prefers override and never returns tenant-demo", () => {
  const user = { role: "COURT_OWNER", tenantId: "venue-real", venueId: "venue-real" };
  assert.equal(
    resolveBillingTenantId({ user, tenantIdOverride: "venue-override", currentTenantId: "venue-context" }),
    "venue-override"
  );
  assert.equal(resolveBillingTenantId({ user, currentTenantId: "venue-context" }), "venue-context");
  assert.equal(resolveBillingTenantId({ user }), "venue-real");
  assert.equal(resolveBillingTenantId({ user: { role: "PLAYER" } }), null);
  assert.notEqual(resolveBillingTenantId({ user: { role: "PLAYER" } }), "tenant-demo");
});

test("formatBillingTenantError maps tenant_not_found and TENANT_MISSING", () => {
  assert.match(
    formatBillingTenantError({ code: "TENANT_MISSING" }),
    /Không tìm thấy tenant\/venue hợp lệ/
  );
  assert.match(
    formatBillingTenantError({ message: "tenant_not_found" }),
    /profiles\.venue_id khớp venues\.id/
  );
});
