import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  INTEGRATION_PROVIDER_IDS,
  listIntegrationProviders,
  getIntegrationProvider,
  INTEGRATION_STATUS,
  isIntegrationOperational,
  getIntegrationOverview,
  toggleIntegrationProvider,
  resolveProviderIntegrationStatus,
  buildProviderStatusMap,
  buildWebhookIdempotencyKey,
  WEBHOOK_EVENT_TYPES,
} from "../src/features/integrations/index.js";
import {
  createDefaultTenantSettings,
  clearIntegrationStorage,
  getTenantIntegrationSettings,
} from "../src/features/integrations/storage/integrationStorage.js";
import { createApiClientWithKey } from "../src/features/api/services/apiKeyService.js";
import { clearApiStorage, loadApiKeys } from "../src/features/api/storage/apiStorage.js";
import { DEFAULT_API_RATE_LIMITS } from "../src/features/api/constants/rateLimitDesign.js";
import { API_KEY_AUDIT_ACTIONS } from "../src/features/api/constants/apiKeyAudit.js";

const TENANT_A = "tenant-a-phase11a";
const TENANT_B = "tenant-b-phase11a";

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

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  clearIntegrationStorage();
  clearApiStorage();
});

afterEach(() => {
  clearIntegrationStorage();
  clearApiStorage();
});

describe("Phase 11A — integration registry", () => {
  it("lists six external providers plus mock payment without network", () => {
    const providers = listIntegrationProviders();
    assert.equal(providers.length, INTEGRATION_PROVIDER_IDS.length);
    assert.ok(providers.every((p) => p.defaultEnabled === false));
    assert.equal(getIntegrationProvider("vnpay")?.category, "payment");
    assert.equal(getIntegrationProvider("zalo")?.category, "notification");
    assert.equal(getIntegrationProvider("unknown"), null);
  });

  it("registry metadata is frozen — no fetch hooks", () => {
    const json = JSON.stringify(listIntegrationProviders());
    assert.ok(json.includes("VNPay"));
    assert.ok(!json.includes("fetch"));
  });
});

describe("Phase 11A — tenant integration defaults", () => {
  it("new tenant settings have all providers disabled", () => {
    const settings = createDefaultTenantSettings(TENANT_A);
    assert.equal(settings.zaloEnabled, false);
    assert.equal(settings.emailEnabled, false);
    assert.equal(settings.smsEnabled, false);
    assert.equal(settings.vnpayEnabled, false);
    assert.equal(settings.momoEnabled, false);
    assert.equal(settings.stripeEnabled, false);
    assert.equal(settings.mockPaymentEnabled, false);
  });

  it("overview reports disabled status for fresh tenant", () => {
    const overview = getIntegrationOverview(TENANT_A);
    assert.equal(overview.providers.zalo.status, INTEGRATION_STATUS.DISABLED);
    assert.equal(overview.providers.mockPayment.status, INTEGRATION_STATUS.DISABLED);
  });

  it("mock payment becomes mock_only when tenant enables", () => {
    toggleIntegrationProvider(TENANT_A, "mock", true);
    const overview = getIntegrationOverview(TENANT_A);
    assert.equal(overview.providers.mockPayment.status, INTEGRATION_STATUS.MOCK_ONLY);
    assert.equal(isIntegrationOperational(overview.providers.mockPayment.status), true);
  });

  it("tenant A settings isolated from tenant B", () => {
    toggleIntegrationProvider(TENANT_A, "zalo", true);
    toggleIntegrationProvider(TENANT_B, "email", true);
    const a = getTenantIntegrationSettings(TENANT_A);
    const b = getTenantIntegrationSettings(TENANT_B);
    assert.equal(a.zaloEnabled, true);
    assert.equal(b.zaloEnabled, false);
    assert.equal(b.emailEnabled, true);
    assert.equal(a.emailEnabled, false);
  });
});

describe("Phase 11A — status resolver", () => {
  it("maps env error to integration error status", () => {
    const status = resolveProviderIntegrationStatus("vnpay", {
      tenantEnabled: true,
      envConfig: { enabled: true, tmnCode: "" },
    });
    assert.equal(status, INTEGRATION_STATUS.ERROR);
  });

  it("buildProviderStatusMap covers all payment and notification providers", () => {
    const map = buildProviderStatusMap(createDefaultTenantSettings(TENANT_A), {});
    assert.ok(map.zalo);
    assert.ok(map.vnpay);
    assert.ok(map.mockPayment);
    assert.equal(map.vnpay.status, INTEGRATION_STATUS.DISABLED);
  });
});

describe("Phase 11A — API key foundation", () => {
  it("stores hashed key only, not plain secret", async () => {
    const result = await createApiClientWithKey({
      name: "Test Client",
      tenantId: TENANT_A,
      scopes: ["marketplace:read"],
    });
    assert.equal(result.ok, true);
    const stored = loadApiKeys()[0];
    assert.notEqual(stored.hashedKey, result.plainKey);
    assert.ok(stored.hashedKey.length >= 32);
    assert.equal(stored.hashedKey.includes("."), false);
  });

  it("rate limit design has positive defaults", () => {
    assert.ok(DEFAULT_API_RATE_LIMITS.requestsPerMinute > 0);
    assert.ok(DEFAULT_API_RATE_LIMITS.burstAllowance >= 0);
  });

  it("api key audit actions defined", () => {
    assert.ok(API_KEY_AUDIT_ACTIONS.CREATED);
    assert.ok(API_KEY_AUDIT_ACTIONS.REVOKED);
  });
});

describe("Phase 11A — webhook foundation", () => {
  it("builds stable idempotency keys", () => {
    const key = buildWebhookIdempotencyKey("stripe", WEBHOOK_EVENT_TYPES.PAYMENT_SUCCEEDED, "evt_1");
    assert.equal(key, "stripe:payment.succeeded:evt_1");
  });
});
