import test from "node:test";
import assert from "node:assert/strict";

import { BillingEngine } from "../src/features/billing/services/billingEngine.js";
import { SubscriptionService } from "../src/features/billing/services/subscriptionService.js";
import { TenantAccessService } from "../src/features/billing/services/tenantAccessService.js";
import {
  isTenantOperational,
  resolveTenantAccessStatus,
  TENANT_ACCESS_STATUS,
} from "../src/features/billing/services/tenantAccessResolver.js";
import { assertSubscriptionOperational } from "../src/features/billing/bridges/subscriptionAccessBridge.js";
import {
  DEFAULT_OPERATIONAL_ACTION,
  isBillingExemptPath,
  isClubOperationalPath,
  isOperationalRouteExempt,
  isSubscriptionOperationalExemptRole,
} from "../src/features/billing/guards/operationalRoutePolicy.js";
import { ROLES } from "../src/auth/roles.js";
import { createUserRecord } from "../src/models/user.js";

function createStore() {
  const state = {
    plans: [],
    planLimits: [],
    subscriptions: [],
    invoices: [],
    invoiceItems: [],
    payments: [],
    billingEvents: [],
    billingAuditLogs: [],
  };

  return {
    read(collection) {
      return state[collection] || [];
    },
    write(collection, value) {
      state[collection] = value;
      return value;
    },
  };
}

function seedTrial(store, tenantId) {
  const engine = new BillingEngine({ store });
  engine.seedDefaults();
  return engine.createTrialSubscription({ tenantId, ownerUserId: "owner-1" });
}

test("Phase 20 — no_subscription is blocked (regression)", () => {
  const store = createStore();
  const engine = new BillingEngine({ store });
  engine.seedDefaults();

  const tenantAccess = new TenantAccessService({ store });
  const access = tenantAccess.evaluateAccess({ tenantId: "tenant-missing" });
  assert.equal(access.allowed, false);
  assert.equal(access.reason, "no_subscription");

  const booking = tenantAccess.canPerformAction({
    tenantId: "tenant-missing",
    action: "create_booking",
  });
  assert.equal(booking.allowed, false);

  const billing = tenantAccess.canPerformAction({
    tenantId: "tenant-missing",
    action: "view_billing",
  });
  assert.equal(billing.allowed, true);
});

test("Phase 20 — trialing and active tenants are operational", () => {
  const store = createStore();
  seedTrial(store, "tenant-trial");

  assert.equal(isTenantOperational({ store, tenantId: "tenant-trial" }), true);

  const subscriptionService = new SubscriptionService({ store });
  const sub = subscriptionService.getByTenant("tenant-trial");
  subscriptionService.activateSubscription(sub.id);

  const status = resolveTenantAccessStatus({ store, tenantId: "tenant-trial" });
  assert.equal(status.allowed, true);
  assert.equal(status.status, TENANT_ACCESS_STATUS.ACTIVE);
});

test("Phase 20 — expired and suspended tenants are locked", () => {
  const store = createStore();
  const subscriptionService = new SubscriptionService({ store });
  const tenantAccess = new TenantAccessService({ store });

  const expiredSub = subscriptionService.createSubscription({
    tenantId: "tenant-exp",
    planCode: "TRIAL",
    status: "expired",
  });
  assert.ok(expiredSub);

  const expired = tenantAccess.evaluateAccess({ tenantId: "tenant-exp" });
  assert.equal(expired.allowed, false);
  assert.equal(resolveTenantAccessStatus({ store, tenantId: "tenant-exp" }).status, TENANT_ACCESS_STATUS.EXPIRED);

  subscriptionService.createSubscription({
    tenantId: "tenant-sus",
    planCode: "STARTER",
    status: "suspended",
  });

  const suspended = tenantAccess.evaluateAccess({ tenantId: "tenant-sus" });
  assert.equal(suspended.allowed, false);
  assert.equal(resolveTenantAccessStatus({ store, tenantId: "tenant-sus" }).status, TENANT_ACCESS_STATUS.SUSPENDED);
});

test("Phase 20 — assertSubscriptionOperational blocks no_subscription", () => {
  const store = createStore();
  const engine = new BillingEngine({ store });
  engine.seedDefaults();

  const result = assertSubscriptionOperational("venue-empty", { store });
  assert.equal(result.ok, false);
  assert.equal(result.code, "NO_SUBSCRIPTION");
});

test("Phase 20 — billing routes exempt from operational lock", () => {
  assert.equal(isBillingExemptPath("/billing"), true);
  assert.equal(isBillingExemptPath("/billing/invoices"), true);
  assert.equal(isBillingExemptPath("/billing/support"), true);
  assert.equal(isBillingExemptPath("/profile"), true);
  assert.equal(isBillingExemptPath("/403"), true);
  assert.equal(isBillingExemptPath("/mobile/player"), true);
  assert.equal(isBillingExemptPath("/mobile/notifications"), true);
  assert.equal(isBillingExemptPath("/court-engine"), false);
  assert.equal(isBillingExemptPath("/court-management"), false);
});

test("Phase 20 — PLAYER/CLB/CUSTOMER exempt from subscription operational lock", () => {
  const player = createUserRecord({ role: ROLES.PLAYER });
  const clubManager = createUserRecord({ role: ROLES.CLUB_MANAGER, clubId: "club-a" });
  const coach = createUserRecord({ role: ROLES.COACH, clubId: "club-a" });
  const cashier = createUserRecord({ role: ROLES.CASHIER, venueId: "venue-a" });

  assert.equal(isSubscriptionOperationalExemptRole(player), true);
  assert.equal(isSubscriptionOperationalExemptRole(clubManager), true);
  assert.equal(isSubscriptionOperationalExemptRole(coach), true);
  assert.equal(isSubscriptionOperationalExemptRole(createUserRecord({ role: ROLES.CUSTOMER })), true);
  assert.equal(isSubscriptionOperationalExemptRole(createUserRecord({ role: ROLES.TEAM_CAPTAIN })), true);
  assert.equal(isSubscriptionOperationalExemptRole(cashier), false);
});

test("Phase 20 — past_due grace allows then blocks after grace", () => {
  const store = createStore();
  const subscriptionService = new SubscriptionService({ store });
  const sub = subscriptionService.createSubscription({
    tenantId: "tenant-grace",
    planCode: "STARTER",
    status: "active",
  });
  subscriptionService.setPastDue(sub.id, {
    graceDays: 3,
    now: new Date("2026-01-01T00:00:00.000Z"),
  });

  const inGrace = resolveTenantAccessStatus({
    store,
    tenantId: "tenant-grace",
    now: new Date("2026-01-02T00:00:00.000Z"),
  });
  assert.equal(inGrace.allowed, true);
  assert.equal(inGrace.status, TENANT_ACCESS_STATUS.PAST_DUE_GRACE);

  const afterGrace = resolveTenantAccessStatus({
    store,
    tenantId: "tenant-grace",
    now: new Date("2026-02-01T00:00:00.000Z"),
  });
  assert.equal(afterGrace.allowed, false);
  assert.equal(afterGrace.status, TENANT_ACCESS_STATUS.PAST_DUE_LOCKED);
});

test("Phase 20 — tenant_not_found when tenant id missing", () => {
  const store = createStore();
  const status = resolveTenantAccessStatus({ store, tenantId: null });
  assert.equal(status.allowed, false);
  assert.equal(status.status, TENANT_ACCESS_STATUS.TENANT_NOT_FOUND);
});

test("Phase 20B — club module routes exempt from venue subscription gate", () => {
  const clubRoutes = [
    "/club",
    "/my-club",
    "/manage/clubs",
    "/players",
    "/players/skill",
    "/select-players",
    "/daily-play",
    "/coaching/coaches",
    "/statistics",
    "/tournament",
    "/tournament/internal/t-1",
  ];

  for (const path of clubRoutes) {
    assert.equal(isClubOperationalPath(path), true, `${path} should be club-exempt`);
    assert.equal(isOperationalRouteExempt(path), true, `${path} should bypass operational gate`);
  }

  assert.equal(isClubOperationalPath("/court-engine"), false);
  assert.equal(isClubOperationalPath("/tournaments/t-1/engine"), false);
});

test("Phase 20B — club-scoped users without venue tenant are subscription-exempt", () => {
  const playerWithClub = createUserRecord({
    id: "player-club",
    role: ROLES.PLAYER,
    clubId: "club-self-1",
    status: "active",
  });
  const clubManager = createUserRecord({
    id: "manager-1",
    role: ROLES.CLUB_MANAGER,
    clubId: "club-self-1",
    status: "active",
  });

  assert.equal(isSubscriptionOperationalExemptRole(playerWithClub), true);
  assert.equal(isSubscriptionOperationalExemptRole(clubManager), true);
});

test("Phase 20B — operational routes are not billing-exempt when tenant active", () => {
  const operationalRoutes = [
    "/dashboard",
    "/court-engine",
    "/tournaments/t-1/engine",
  ];

  for (const path of operationalRoutes) {
    assert.equal(isBillingExemptPath(path), false, `${path} should be gated`);
  }

  assert.equal(isBillingExemptPath("/billing"), true);
  assert.equal(isBillingExemptPath("/billing/support"), true);
  assert.equal(isBillingExemptPath("/profile"), true);
  assert.equal(isBillingExemptPath("/403"), true);
});

test("Phase 20B — blocked tenant locks court-engine and players via default action", () => {
  const store = createStore();
  const tenantAccess = new TenantAccessService({ store });

  const blockedCases = [
    { tenantId: "tenant-no-sub", label: "no_subscription" },
    { tenantId: "tenant-exp", label: "expired", status: "expired" },
    { tenantId: "tenant-sus", label: "suspended", status: "suspended" },
  ];

  const subscriptionService = new SubscriptionService({ store });
  subscriptionService.createSubscription({
    tenantId: "tenant-exp",
    planCode: "TRIAL",
    status: "expired",
  });
  subscriptionService.createSubscription({
    tenantId: "tenant-sus",
    planCode: "STARTER",
    status: "suspended",
  });

  for (const item of blockedCases) {
    const check = tenantAccess.canPerformAction({
      tenantId: item.tenantId,
      action: DEFAULT_OPERATIONAL_ACTION,
    });
    assert.equal(check.allowed, false, `${item.label} should block ${DEFAULT_OPERATIONAL_ACTION}`);
  }

  const billing = tenantAccess.canPerformAction({
    tenantId: "tenant-no-sub",
    action: "view_billing",
  });
  assert.equal(billing.allowed, true);

  const support = tenantAccess.canPerformAction({
    tenantId: "tenant-exp",
    action: "view_support",
  });
  assert.equal(support.allowed, true);
});

test("Phase 20B — trialing tenant allows operational routes", () => {
  const store = createStore();
  seedTrial(store, "tenant-pilot");

  const tenantAccess = new TenantAccessService({ store });
  const check = tenantAccess.canPerformAction({
    tenantId: "tenant-pilot",
    action: DEFAULT_OPERATIONAL_ACTION,
  });
  assert.equal(check.allowed, true);
  assert.equal(isTenantOperational({ store, tenantId: "tenant-pilot" }), true);
});
