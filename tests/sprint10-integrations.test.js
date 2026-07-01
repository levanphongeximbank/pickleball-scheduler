import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  createApiClientWithKey,
  authenticateApiKey,
  revokeApiKey,
  assertApiScope,
} from "../src/features/api/services/apiKeyService.js";
import { clearApiStorage } from "../src/features/api/storage/apiStorage.js";
import { invokeApi } from "../src/features/api/router/apiRouter.js";
import { API_SCOPES } from "../src/features/api/constants/apiScopes.js";
import {
  seedDefaultProducts,
  createProduct,
  listProducts,
} from "../src/features/marketplace/services/marketplaceProductService.js";
import {
  createOrder,
  listOrders,
} from "../src/features/marketplace/services/marketplaceOrderService.js";
import { clearMarketplaceStorage } from "../src/features/marketplace/storage/marketplaceStorage.js";
import {
  createPayment,
  handlePaymentCallback,
  simulateMockPayment,
  listPaymentTransactions,
} from "../src/features/payments/services/paymentGatewayService.js";
import { clearPaymentStorage } from "../src/features/payments/storage/paymentStorage.js";
import {
  sendNotification,
  seedDefaultTemplates,
} from "../src/features/notifications/services/notificationService.js";
import { renderTemplate } from "../src/features/notifications/models/notificationModels.js";
import { clearNotificationStorage } from "../src/features/notifications/storage/notificationStorage.js";
import {
  canManageIntegrations,
  toggleIntegrationProvider,
} from "../src/features/integrations/services/integrationSettingsService.js";
import { clearIntegrationStorage } from "../src/features/integrations/storage/integrationStorage.js";
import { recordWebhookEvent, markWebhookProcessed } from "../src/features/integrations/services/webhookEventService.js";
import { enableRbac, signInAs } from "../src/auth/authService.js";
import { ROLES } from "../src/auth/roles.js";

const TENANT_A = "tenant-a-sprint10";
const TENANT_B = "tenant-b-sprint10";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function resetAll() {
  clearApiStorage();
  clearMarketplaceStorage();
  clearPaymentStorage();
  clearNotificationStorage();
  clearIntegrationStorage();
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  process.env.VITE_API_ENABLED = "true";
  process.env.VITE_MARKETPLACE_ENABLED = "true";
  process.env.VITE_PAYMENT_DEFAULT_PROVIDER = "mock";
  resetAll();
});

afterEach(() => {
  delete globalThis.localStorage;
  delete process.env.VITE_API_ENABLED;
  delete process.env.VITE_MARKETPLACE_ENABLED;
});

describe("Sprint 10 — API keys", () => {
  it("valid API key authenticates", async () => {
    const created = await createApiClientWithKey({
      name: "Partner A",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.PLAYERS_READ],
    });
    assert.equal(created.ok, true);

    const auth = await authenticateApiKey(created.plainKey);
    assert.equal(auth.ok, true);
    assert.equal(auth.tenantId, TENANT_A);
  });

  it("invalid API key rejected", async () => {
    const auth = await authenticateApiKey("pk_invalid.secret");
    assert.equal(auth.ok, false);
  });

  it("revoked API key rejected", async () => {
    const created = await createApiClientWithKey({
      name: "Revoke test",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.PLAYERS_READ],
    });
    revokeApiKey(created.apiKey.id);
    const auth = await authenticateApiKey(created.plainKey);
    assert.equal(auth.ok, false);
  });

  it("insufficient scope blocked", async () => {
    const created = await createApiClientWithKey({
      name: "Read only",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.PLAYERS_READ],
    });
    const auth = await authenticateApiKey(created.plainKey);
    const scopeCheck = assertApiScope(auth, API_SCOPES.MARKETPLACE_WRITE);
    assert.equal(scopeCheck.ok, false);
  });

  it("tenant isolation via API key", async () => {
    const keyA = await createApiClientWithKey({
      name: "Tenant A",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.CLUBS_READ],
    });
    const auth = await authenticateApiKey(keyA.plainKey);
    assert.equal(auth.tenantId, TENANT_A);
    assert.notEqual(auth.tenantId, TENANT_B);
  });
});

describe("Sprint 10 — API router", () => {
  it("feature flag off returns 503", async () => {
    process.env.VITE_API_ENABLED = "false";
    const result = await invokeApi({ method: "GET", path: "/api/v1/health" });
    assert.equal(result.statusCode, 503);
  });

  it("health endpoint works", async () => {
    const result = await invokeApi({ method: "GET", path: "/api/v1/health" });
    assert.equal(result.statusCode, 200);
    assert.equal(result.response.success, true);
    assert.equal(result.response.data.status, "ok");
  });
});

describe("Sprint 10 — Marketplace", () => {
  it("create product and list", () => {
    const result = createProduct({
      name: "Test Product",
      price: 100000,
      category: "club_management",
      status: "active",
    });
    assert.equal(result.ok, true);
    assert.ok(listProducts({ activeOnly: true }).length >= 1);
  });

  it("order flow pending to paid", async () => {
    seedDefaultProducts();
    const product = listProducts({ activeOnly: true })[0];
    const orderResult = await createOrder({
      tenantId: TENANT_A,
      productId: product.id,
      provider: "mock",
    });
    assert.equal(orderResult.ok, true);
    assert.equal(orderResult.order.status, "pending");

    const pay = await simulateMockPayment(orderResult.payment.id, "success");
    assert.equal(pay.ok, true);

    const paid = listOrders({ tenantId: TENANT_A }).find((o) => o.id === orderResult.order.id);
    assert.equal(paid.status, "paid");
  });

  it("order failed on bad payment", async () => {
    seedDefaultProducts();
    const product = listProducts({ activeOnly: true })[0];
    const orderResult = await createOrder({
      tenantId: TENANT_A,
      productId: product.id,
    });
    const pay = await simulateMockPayment(orderResult.payment.id, "failed");
    assert.equal(pay.ok, false);
  });
});

describe("Sprint 10 — Payments", () => {
  it("mock payment success", async () => {
    const payment = await createPayment({
      tenantId: TENANT_A,
      orderId: "order-test-1",
      amount: 50000,
      provider: "mock",
    });
    assert.equal(payment.ok, true);
    const cb = await simulateMockPayment(payment.transaction.id, "success");
    assert.equal(cb.ok, true);
    const tx = listPaymentTransactions({ tenantId: TENANT_A })[0];
    assert.equal(tx.status, "success");
  });

  it("callback idempotency", async () => {
    const payment = await createPayment({
      tenantId: TENANT_A,
      orderId: "order-test-2",
      amount: 10000,
      provider: "mock",
    });
    await simulateMockPayment(payment.transaction.id, "success");
    const second = await handlePaymentCallback("mock", {
      transactionId: payment.transaction.id,
      payload: { status: "success" },
    });
    assert.equal(second.ok, true);
    assert.equal(second.idempotent, true);
  });

  it("callback invalid signature fails", async () => {
    const payment = await createPayment({
      tenantId: TENANT_A,
      orderId: "order-test-3",
      amount: 20000,
      provider: "vnpay",
    });
    const cb = await handlePaymentCallback("vnpay", {
      transactionId: payment.transaction.id,
      payload: {
        vnp_SecureHash: "bad",
        expectedSignature: "good",
        vnp_Amount: 2000000,
      },
    });
    assert.equal(cb.ok, false);
  });

  it("callback wrong amount fails", async () => {
    const payment = await createPayment({
      tenantId: TENANT_A,
      orderId: "order-test-4",
      amount: 30000,
      provider: "momo",
    });
    const cb = await handlePaymentCallback("momo", {
      transactionId: payment.transaction.id,
      payload: { amount: 99999, resultCode: 0 },
    });
    assert.equal(cb.ok, false);
  });
});

describe("Sprint 10 — Notifications", () => {
  it("mock email send", async () => {
    seedDefaultTemplates();
    const result = await sendNotification({
      tenantId: TENANT_A,
      channel: "email",
      templateKey: "payment_success",
      recipientId: "user-1",
      variables: { name: "A", message: "OK" },
      forceMock: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.log.status, "sent");
  });

  it("mock send failure logged", async () => {
    seedDefaultTemplates();
    const result = await sendNotification({
      tenantId: TENANT_A,
      channel: "email",
      templateKey: "payment_failed",
      recipientId: "user@test.com",
      simulateFailure: true,
      forceMock: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.log.status, "failed");
  });

  it("template render variables", () => {
    const rendered = renderTemplate(
      { title: "Hi {{name}}", subject: "S", body: "Msg: {{message}}" },
      { name: "Lan", message: "Done" }
    );
    assert.equal(rendered.title, "Hi Lan");
    assert.equal(rendered.body, "Msg: Done");
  });
});

describe("Sprint 10 — Integration settings", () => {
  it("toggle provider", () => {
    const result = toggleIntegrationProvider(TENANT_A, "mock", true);
    assert.equal(result.ok, true);
    assert.equal(result.settings.mockPaymentEnabled, true);
  });

  it("role without permission blocked when RBAC on", () => {
    enableRbac();
    signInAs({ id: "player-1", role: ROLES.PLAYER, tenantId: TENANT_A });
    const access = canManageIntegrations();
    assert.equal(access.ok, false);
  });

  it("tenant only sees own config", () => {
    toggleIntegrationProvider(TENANT_A, "zalo", true);
    toggleIntegrationProvider(TENANT_B, "zalo", false);
    const a = toggleIntegrationProvider(TENANT_A, "email", true);
    const b = toggleIntegrationProvider(TENANT_B, "email", false);
    assert.equal(a.settings.tenantId, TENANT_A);
    assert.equal(b.settings.tenantId, TENANT_B);
    assert.notEqual(a.settings.zaloEnabled, b.settings.zaloEnabled);
  });
});

describe("Sprint 10 — Webhooks", () => {
  it("webhook idempotent", () => {
    const first = recordWebhookEvent({
      provider: "stripe",
      eventType: "payment",
      idempotencyKey: "evt_1",
      payload: { id: 1 },
    });
    markWebhookProcessed(first.event.id, { status: "processed" });
    const second = recordWebhookEvent({
      provider: "stripe",
      eventType: "payment",
      idempotencyKey: "evt_1",
      payload: { id: 1 },
    });
    assert.equal(second.idempotent, true);
  });
});
