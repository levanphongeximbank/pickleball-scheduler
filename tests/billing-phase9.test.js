import test from "node:test";
import assert from "node:assert/strict";

import { BillingEngine } from "../src/features/billing/services/billingEngine.js";
import { PlanLimitService } from "../src/features/billing/services/planLimitService.js";
import { SubscriptionService } from "../src/features/billing/services/subscriptionService.js";
import { InvoiceService } from "../src/features/billing/services/invoiceService.js";
import { PaymentService } from "../src/features/billing/services/paymentService.js";
import { TenantAccessService } from "../src/features/billing/services/tenantAccessService.js";
import { getPaymentProvider, listEnabledPaymentProviders } from "../src/features/billing/providers/index.js";
import { getPermissionsForRole, roleHasPermission } from "../src/features/identity/matrix/rolePermissions.js";
import { ROLES } from "../src/features/identity/constants/roles.js";
import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import { can } from "../src/auth/rbac.js";
import { canAccessRoute } from "../src/auth/menuAccess.js";
import { normalizeUser } from "../src/models/user.js";

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

test("BillingEngine creates a trial subscription and locks expired tenant", () => {
  const store = createStore();
  const engine = new BillingEngine({ store });
  const subscription = engine.createTrialSubscription({ tenantId: "tenant-a", ownerUserId: "owner-1" });

  assert.equal(subscription.status, "trialing");
  assert.equal(subscription.tenant_id, "tenant-a");

  const expired = engine.evaluateTenantAccess({ tenantId: "tenant-a", now: new Date("2099-01-01T00:00:00.000Z") });
  assert.equal(expired.allowed, false);
  assert.equal(expired.reason, "trial_expired");
});

test("PlanLimitService blocks exceeding monthly limits and allows allowed actions", () => {
  const store = createStore();
  const planLimitService = new PlanLimitService({ store });
  const result = planLimitService.checkLimit({ tenantId: "tenant-a", resource: "courts", currentUsage: 9, planCode: "TRIAL" });
  assert.equal(result.allowed, false);
  assert.equal(result.limitCode, "max_courts");

  const ok = planLimitService.checkLimit({ tenantId: "tenant-a", resource: "ai_features", currentUsage: 0, planCode: "PROFESSIONAL" });
  assert.equal(ok.allowed, true);
});

test("SubscriptionService can activate, suspend, renew and expire a subscription", () => {
  const store = createStore();
  const service = new SubscriptionService({ store });
  const created = service.createSubscription({ tenantId: "tenant-b", planCode: "STARTER", status: "trialing" });

  const activated = service.activateSubscription(created.id);
  assert.equal(activated.status, "active");

  const suspended = service.suspendSubscription(created.id);
  assert.equal(suspended.status, "suspended");

  const renewed = service.renewSubscription(created.id);
  assert.equal(renewed.status, "active");

  const expired = service.expireSubscription(created.id, { now: new Date("2099-01-01T00:00:00.000Z") });
  assert.equal(expired.status, "expired");
});

test("InvoiceService and PaymentService update invoice and subscription on payment", () => {
  const store = createStore();
  const subscriptionService = new SubscriptionService({ store });
  const invoiceService = new InvoiceService({ store });
  const paymentService = new PaymentService({ store, subscriptionService, invoiceService });

  const subscription = subscriptionService.createSubscription({ tenantId: "tenant-c", planCode: "PROFESSIONAL", status: "active" });
  const invoice = invoiceService.createInvoice({ tenantId: "tenant-c", subscriptionId: subscription.id, amount: 1000, currency: "VND" });

  const payment = paymentService.recordPayment({ tenantId: "tenant-c", invoiceId: invoice.id, provider: "manual", amount: 1000, currency: "VND", status: "succeeded" });

  assert.equal(payment.status, "succeeded");
  assert.equal(invoiceService.getById(invoice.id).status, "paid");
  assert.equal(subscriptionService.getById(subscription.id).status, "active");
});

test("TenantAccessService blocks operational actions when expired but allows billing", () => {
  const store = createStore();
  const subscriptionService = new SubscriptionService({ store });
  const tenantAccess = new TenantAccessService({ store });
  const sub = subscriptionService.createSubscription({ tenantId: "tenant-d", planCode: "TRIAL", status: "expired" });

  const booking = tenantAccess.canPerformAction({ tenantId: "tenant-d", action: "create_booking" });
  assert.equal(booking.allowed, false);

  const billing = tenantAccess.canPerformAction({ tenantId: "tenant-d", action: "view_billing" });
  assert.equal(billing.allowed, true);

  assert.ok(sub);
});

test("TenantAccessService grace period allows access then blocks", () => {
  const store = createStore();
  const subscriptionService = new SubscriptionService({ store });
  const tenantAccess = new TenantAccessService({ store });
  const sub = subscriptionService.createSubscription({ tenantId: "tenant-grace", planCode: "STARTER", status: "active" });
  subscriptionService.setPastDue(sub.id, { graceDays: 3, now: new Date("2026-01-01T00:00:00.000Z") });

  const inGrace = tenantAccess.evaluateAccess({ tenantId: "tenant-grace", now: new Date("2026-01-02T00:00:00.000Z") });
  assert.equal(inGrace.allowed, true);
  assert.equal(inGrace.lockLevel, "grace");

  const afterGrace = tenantAccess.evaluateAccess({ tenantId: "tenant-grace", now: new Date("2026-02-01T00:00:00.000Z") });
  assert.equal(afterGrace.allowed, false);
});

test("BillingEngine upgrade plan emits audit and notification", () => {
  const store = createStore();
  const subscriptionService = new SubscriptionService({ store });
  const invoiceService = new InvoiceService({ store });
  const paymentService = new PaymentService({ store, subscriptionService, invoiceService });
  const engine = new BillingEngine({ store, subscriptionService, invoiceService, paymentService });
  const sub = engine.createTrialSubscription({ tenantId: "tenant-up", ownerUserId: "admin" });
  engine.changePlan(sub.id, "PROFESSIONAL", { actorUserId: "admin" });

  const updated = subscriptionService.getById(sub.id);
  assert.equal(updated.plan_code, "PROFESSIONAL");
  const audits = store.read("billingAuditLogs");
  assert.ok(audits.some((item) => item.event_type === "PlanUpgraded"));
  const events = store.read("billingEvents");
  assert.ok(events.some((item) => item.event_type === "PlanUpgraded"));
});

test("Payment providers: manual enabled, vnpay disabled without credentials", async () => {
  const manual = getPaymentProvider("manual");
  assert.ok(manual.isEnabled({}));
  const intent = await manual.createPaymentIntent({ amount: 1000, currency: "VND", invoiceId: "inv-1" });
  assert.equal(intent.ok, true);

  const vnpay = getPaymentProvider("vnpay");
  const disabled = await vnpay.createPaymentIntent({ amount: 1000 });
  assert.equal(disabled.ok, false);
  assert.equal(disabled.code, "GATEWAY_DISABLED");

  const enabled = listEnabledPaymentProviders({ NODE_ENV: "test" });
  assert.ok(enabled.some((p) => p.name === "manual"));
  assert.ok(enabled.some((p) => p.name === "bank_transfer"));
});

test("RBAC: SUPER_ADMIN has full billing, COURT_OWNER view only", () => {
  assert.equal(roleHasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.BILLING_MANAGE), true);
  assert.equal(roleHasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.BILLING_INVOICE_MARK_PAID), true);
  assert.equal(roleHasPermission(ROLES.COURT_OWNER, PERMISSIONS.BILLING_VIEW), true);
  assert.equal(roleHasPermission(ROLES.COURT_OWNER, PERMISSIONS.BILLING_MANAGE), false);
  assert.equal(roleHasPermission(ROLES.COURT_OWNER, PERMISSIONS.BILLING_INVOICE_MARK_PAID), false);
  assert.equal(roleHasPermission(ROLES.COURT_MANAGER, PERMISSIONS.BILLING_VIEW), false);
  assert.equal(roleHasPermission(ROLES.REFEREE, PERMISSIONS.BILLING_VIEW), false);
  assert.equal(roleHasPermission(ROLES.PLAYER, PERMISSIONS.BILLING_VIEW), false);
});

test("RBAC: COURT_OWNER can access /billing route when RBAC enforced", () => {
  const owner = normalizeUser({
    id: "owner-1",
    email: "owner@staging.local",
    role: ROLES.VENUE_OWNER,
    venueId: "venue-staging-a",
    status: "active",
  });
  const rbac = { rbacEnabled: true };
  const scope = { venueId: "venue-staging-a", tenantId: "venue-staging-a" };

  assert.equal(can(owner, PERMISSIONS.BILLING_VIEW, scope, rbac), true);
  assert.equal(
    canAccessRoute((perm, routeScope) => can(owner, perm, routeScope, rbac), "/billing", scope),
    true
  );
  assert.equal(
    canAccessRoute((perm, routeScope) => can(owner, perm, routeScope, rbac), "/admin/billing", scope),
    false
  );
  assert.equal(
    canAccessRoute(
      (perm, routeScope) => can(normalizeUser({ role: ROLES.PLAYER, status: "active", playerId: "p1", clubId: "c1" }), perm, routeScope, rbac),
      "/billing",
      scope
    ),
    false
  );
});

test("RBAC: CASHIER cannot manage subscription", () => {
  const perms = getPermissionsForRole(ROLES.CASHIER);
  assert.equal(perms.includes(PERMISSIONS.BILLING_SUBSCRIPTION_MANAGE), false);
  assert.equal(perms.includes(PERMISSIONS.BILLING_VIEW), false);
});

test("Tenant isolation: invoices filtered by tenant in service layer", () => {
  const store = createStore();
  const invoiceService = new InvoiceService({ store });
  invoiceService.createInvoice({ tenantId: "tenant-a", subscriptionId: "sub-a", amount: 100 });
  invoiceService.createInvoice({ tenantId: "tenant-b", subscriptionId: "sub-b", amount: 200 });

  assert.equal(invoiceService.listByTenant("tenant-a").length, 1);
  assert.equal(invoiceService.listByTenant("tenant-b").length, 1);
  assert.equal(invoiceService.listByTenant("tenant-a")[0].tenant_id, "tenant-a");
});

test("Suspended tenant has stronger lock than expired", () => {
  const store = createStore();
  const subscriptionService = new SubscriptionService({ store });
  const tenantAccess = new TenantAccessService({ store });
  subscriptionService.createSubscription({ tenantId: "tenant-s", planCode: "STARTER", status: "suspended" });

  const access = tenantAccess.evaluateAccess({ tenantId: "tenant-s" });
  assert.equal(access.lockLevel, "suspended");
  assert.equal(access.allowed, false);
});

test("Payment failed does not deactivate active subscription", () => {
  const store = createStore();
  const subscriptionService = new SubscriptionService({ store });
  const invoiceService = new InvoiceService({ store });
  const paymentService = new PaymentService({ store, subscriptionService, invoiceService });
  const sub = subscriptionService.createSubscription({ tenantId: "tenant-f", planCode: "STARTER", status: "active" });
  const invoice = invoiceService.createInvoice({ tenantId: "tenant-f", subscriptionId: sub.id, amount: 500 });
  const payment = paymentService.recordPayment({ tenantId: "tenant-f", invoiceId: invoice.id, provider: "manual", amount: 500, status: "failed" });

  assert.equal(payment.status, "failed");
  assert.equal(subscriptionService.getById(sub.id).status, "active");
});

test("Admin unlock tenant restores active status", () => {
  const store = createStore();
  const engine = new BillingEngine({ store });
  const subscriptionService = new SubscriptionService({ store });
  const sub = engine.createTrialSubscription({ tenantId: "tenant-u", ownerUserId: "admin" });
  engine.suspendSubscription(sub.id, { actorUserId: "admin" });
  engine.unlockTenant("tenant-u", { actorUserId: "admin" });
  assert.equal(subscriptionService.getByTenant("tenant-u").status, "active");
});
