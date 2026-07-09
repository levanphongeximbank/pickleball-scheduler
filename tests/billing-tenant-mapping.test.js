import test from "node:test";
import assert from "node:assert/strict";

import {
  INVALID_BILLING_TENANT_IDS,
  formatBillingTenantError,
  resolveBillingTenantId,
  sanitizeBillingTenantId,
} from "../src/features/billing/services/billingTenantResolver.js";
import { validateBillingTenantOnSupabase } from "../src/features/billing/services/billingVenueService.js";
import { assertSubscriptionOperational } from "../src/features/billing/bridges/subscriptionAccessBridge.js";
import { createMemoryBillingStore } from "../src/features/billing/repositories/memoryBillingStore.js";
import { BillingEngine } from "../src/features/billing/services/billingEngine.js";

test("sanitizeBillingTenantId rejects empty and blocklisted ids", () => {
  assert.equal(sanitizeBillingTenantId(""), null);
  assert.equal(sanitizeBillingTenantId("   "), null);
  assert.equal(sanitizeBillingTenantId("tenant-demo"), null);
  assert.equal(sanitizeBillingTenantId("TENANT-DEMO"), null);
  assert.equal(sanitizeBillingTenantId("tenant-future-arena"), null);
  assert.equal(sanitizeBillingTenantId("venue-staging-a"), "venue-staging-a");
});

test("resolveBillingTenantId never returns tenant-demo from any source", () => {
  const user = { role: "COURT_OWNER", tenantId: "tenant-demo", venueId: "tenant-demo" };
  assert.equal(resolveBillingTenantId({ user }), null);
  assert.equal(resolveBillingTenantId({ user, currentTenantId: "tenant-demo" }), null);
  assert.equal(resolveBillingTenantId({ user, tenantIdOverride: "tenant-demo" }), null);
  assert.notEqual(resolveBillingTenantId({ user: { role: "PLAYER" } }), "tenant-demo");
  assert.ok(INVALID_BILLING_TENANT_IDS.includes("tenant-demo"));
});

test("resolveBillingTenantId maps profile venue_id via user tenantId", () => {
  const user = { role: "COURT_OWNER", tenantId: "venue-staging-a", venueId: "venue-staging-a" };
  assert.equal(resolveBillingTenantId({ user }), "venue-staging-a");
  assert.equal(
    resolveBillingTenantId({ user, tenantIdOverride: "venue-override" }),
    "venue-override"
  );
});

test("validateBillingTenantOnSupabase returns TENANT_NOT_FOUND when venue missing", async () => {
  const client = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: null, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await validateBillingTenantOnSupabase(client, "missing-venue");
  assert.equal(result.ok, false);
  assert.equal(result.code, "TENANT_NOT_FOUND");
  assert.match(result.error, /profiles\.venue_id khớp venues\.id/);
});

test("validateBillingTenantOnSupabase passes when venue exists", async () => {
  const client = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: { id: "venue-staging-a", name: "Staging A", status: "trial" }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await validateBillingTenantOnSupabase(client, "venue-staging-a");
  assert.equal(result.ok, true);
  assert.equal(result.tenantId, "venue-staging-a");
  assert.equal(result.venue.name, "Staging A");
});

test("validateBillingTenantOnSupabase rejects blocklisted tenant id", async () => {
  const client = {
    from() {
      throw new Error("should not query venues for blocklisted id");
    },
  };

  const result = await validateBillingTenantOnSupabase(client, "tenant-demo");
  assert.equal(result.ok, false);
  assert.equal(result.code, "TENANT_MISSING");
});

test("assertSubscriptionOperational blocks when subscription missing (no_subscription)", () => {
  const store = createMemoryBillingStore();
  const engine = new BillingEngine({ store });
  engine.seedDefaults();

  const result = assertSubscriptionOperational("venue-no-sub", { store });
  assert.equal(result.ok, false);
  assert.equal(result.code, "NO_SUBSCRIPTION");
});

test("assertSubscriptionOperational blocks when subscription expired", () => {
  const store = createMemoryBillingStore();
  const engine = new BillingEngine({ store });
  engine.seedDefaults();
  const subscription = engine.createTrialSubscription({ tenantId: "venue-expired", ownerUserId: "u1" });
  engine.expireSubscription(subscription.id, { now: new Date("2099-01-01T00:00:00.000Z") });

  const result = assertSubscriptionOperational("venue-expired", {
    store,
    now: new Date("2099-01-01T00:00:00.000Z"),
  });
  assert.equal(result.ok, false);
  assert.ok(result.error);
});

test("assertSubscriptionOperational allows active trialing subscription", () => {
  const store = createMemoryBillingStore();
  const engine = new BillingEngine({ store });
  engine.seedDefaults();
  engine.createTrialSubscription({ tenantId: "venue-trial", ownerUserId: "u1" });

  const result = assertSubscriptionOperational("venue-trial", { store });
  assert.equal(result.ok, true);
  assert.ok(result.subscription);
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
