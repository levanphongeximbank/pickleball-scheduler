import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  createApiClientWithKey,
} from "../src/features/api/services/apiKeyService.js";
import { clearApiStorage } from "../src/features/api/storage/apiStorage.js";
import { API_SCOPES } from "../src/features/api/constants/apiScopes.js";
import { EDGE_API_ERROR_CODES } from "../src/features/api/constants/edgeApiErrors.js";
import { guardApiKey } from "../src/features/api/guards/apiKeyGuard.js";
import { invokeEdgeApi } from "../src/features/api/router/edgeApiRouter.js";
import { clearApiKeyAuditStorage } from "../src/features/api/services/apiKeyAuditService.js";
import {
  clearIntegrationAuditStorage,
  listIntegrationAuditEvents,
  recordIntegrationAudit,
} from "../src/features/api/services/integrationAuditService.js";
import {
  buildIntegrationAuditEntry,
  resolveIntegrationAuditEventType,
  sanitizeAuditMetadata,
  serializeIntegrationAuditRow,
} from "../src/features/api/models/integrationAuditModels.js";
import { INTEGRATION_AUDIT_EVENTS } from "../src/features/api/constants/integrationAudit.js";
import {
  resetAuditStoreModeForTests,
  setAuditStoreModeForTests,
} from "../src/features/api/config/auditStoreConfig.js";
import { resetRuntimeStorage } from "../src/utils/runtimeStorage.js";
import { resetRateLimitCounters } from "../src/features/api/guards/rateLimitGuard.js";

const TENANT_A = "tenant-a-phase11e";

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
  process.env.NODE_ENV = "test";
  process.env.VITE_API_ENABLED = "true";
  process.env.AUDIT_STORE = "memory";
  resetAuditStoreModeForTests();
  setAuditStoreModeForTests("memory");
  clearApiStorage();
  clearApiKeyAuditStorage();
  clearIntegrationAuditStorage();
  resetRateLimitCounters();
});

afterEach(() => {
  delete globalThis.localStorage;
  delete process.env.VITE_API_ENABLED;
  delete process.env.AUDIT_STORE;
  resetAuditStoreModeForTests();
  resetRateLimitCounters();
});

describe("Phase 11E — audit sanitizer", () => {
  it("strips raw API key and hashed_key from metadata", () => {
    const plainKey = "pk_testkey1.deadbeefdeadbeefdeadbeefdeadbeef";
    const safe = sanitizeAuditMetadata({
      reason: "invalid_key",
      plainKey,
      hashed_key: "salt.digest",
      hashedKey: "salt.digest2",
      nested: { x_api_key: plainKey, ok: true },
    });
    const blob = JSON.stringify(safe);
    assert.equal(blob.includes(plainKey), false);
    assert.equal(blob.includes("hashed_key"), false);
    assert.equal(blob.includes("hashedKey"), false);
    assert.equal(safe.reason, "invalid_key");
    assert.equal(safe.nested.ok, true);
  });

  it("serializeIntegrationAuditRow uses event_type and metadata columns", () => {
    const entry = buildIntegrationAuditEntry({
      eventType: INTEGRATION_AUDIT_EVENTS.INTEGRATION_READ,
      requestId: "req_1",
      metadata: { reason: "probe" },
    });
    const row = serializeIntegrationAuditRow(entry);
    assert.equal(row.event_type, "integration.read");
    assert.equal(row.metadata.reason, "probe");
    assert.equal(row.action, undefined);
    assert.equal(row.meta, undefined);
  });
});

describe("Phase 11E — event_type mapping", () => {
  it("maps route outcomes to integration and webhook events", () => {
    assert.equal(
      resolveIntegrationAuditEventType({
        routePath: "/integrations",
        method: "GET",
        authOk: true,
      }),
      INTEGRATION_AUDIT_EVENTS.INTEGRATION_READ
    );
    assert.equal(
      resolveIntegrationAuditEventType({
        routePath: "/integrations/zalo/test-write",
        method: "POST",
        authOk: true,
      }),
      INTEGRATION_AUDIT_EVENTS.INTEGRATION_WRITE
    );
    assert.equal(
      resolveIntegrationAuditEventType({
        routePath: "/webhooks/test",
        method: "GET",
        authOk: true,
      }),
      INTEGRATION_AUDIT_EVENTS.WEBHOOK_READ
    );
    assert.equal(
      resolveIntegrationAuditEventType({
        routePath: "/webhooks/test",
        method: "POST",
        authOk: true,
      }),
      INTEGRATION_AUDIT_EVENTS.WEBHOOK_WRITE
    );
    assert.equal(
      resolveIntegrationAuditEventType({
        routePath: "/tenant",
        method: "GET",
        authOk: true,
      }),
      INTEGRATION_AUDIT_EVENTS.API_KEY_USED
    );
    assert.equal(
      resolveIntegrationAuditEventType({
        routePath: "/integrations",
        method: "GET",
        authOk: false,
        resultCode: EDGE_API_ERROR_CODES.SCOPE_DENIED,
      }),
      INTEGRATION_AUDIT_EVENTS.API_KEY_SCOPE_DENIED
    );
    assert.equal(
      resolveIntegrationAuditEventType({
        routePath: "/integrations",
        method: "GET",
        authOk: false,
        resultCode: EDGE_API_ERROR_CODES.UNAUTHORIZED,
      }),
      INTEGRATION_AUDIT_EVENTS.API_KEY_DENIED
    );
  });
});

describe("Phase 11E — best-effort audit insert", () => {
  it("does not throw when supabase insert fails", async () => {
    setAuditStoreModeForTests("supabase");
    process.env.AUDIT_STORE = "supabase";
    process.env.SUPABASE_URL = "https://invalid-example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key-not-real";

    await assert.doesNotReject(async () => {
      await recordIntegrationAudit({
        eventType: INTEGRATION_AUDIT_EVENTS.API_KEY_USED,
        requestId: "req_best_effort",
        metadata: { probe: true },
      });
    });

    const events = listIntegrationAuditEvents({ requestId: "req_best_effort" });
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, INTEGRATION_AUDIT_EVENTS.API_KEY_USED);
  });
});

describe("Phase 11E — edge router audit wiring", () => {
  it("records scope_denied audit event for integrations write without scope", async () => {
    const created = await createApiClientWithKey({
      name: "Integrations Read Only",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.INTEGRATIONS_READ],
    });

    const result = await invokeEdgeApi({
      method: "POST",
      path: "/api/v1/integrations/zalo/test-write",
      headers: { "x-api-key": created.plainKey },
      body: { probe: true },
    });

    assert.equal(result.statusCode, 403);
    assert.equal(result.body.code, EDGE_API_ERROR_CODES.SCOPE_DENIED);

    const events = listIntegrationAuditEvents({ requestId: result.body.requestId });
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, INTEGRATION_AUDIT_EVENTS.API_KEY_SCOPE_DENIED);
    assert.equal(events[0].scopeRequired, API_SCOPES.INTEGRATIONS_WRITE);
    assert.equal(JSON.stringify(events).includes(created.plainKey), false);
  });

  it("allows integrations:write and records integration.write event", async () => {
    const created = await createApiClientWithKey({
      name: "Integrations Write",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.INTEGRATIONS_READ, API_SCOPES.INTEGRATIONS_WRITE],
    });

    const result = await invokeEdgeApi({
      method: "POST",
      path: "/api/v1/integrations/zalo/test-write",
      headers: { "x-api-key": created.plainKey },
      body: { probe: true },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.code, "ok");
    assert.equal(result.body.data.accepted, true);

    const events = listIntegrationAuditEvents({ requestId: result.body.requestId });
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, INTEGRATION_AUDIT_EVENTS.INTEGRATION_WRITE);
    assert.equal(events[0].resultCode, "ok");
    assert.equal(events[0].statusCode, 200);
  });

  it("writes exactly one audit row per request", async () => {
    const created = await createApiClientWithKey({
      name: "Single Audit",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.INTEGRATIONS_READ],
    });

    const result = await invokeEdgeApi({
      method: "GET",
      path: "/api/v1/integrations",
      headers: { "x-api-key": created.plainKey },
    });

    assert.equal(result.statusCode, 200);
    const events = listIntegrationAuditEvents({ requestId: result.body.requestId });
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, INTEGRATION_AUDIT_EVENTS.INTEGRATION_READ);
  });

  it("guard does not write duplicate audit rows directly", async () => {
    const created = await createApiClientWithKey({
      name: "Guard Context",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.TENANT_READ],
    });

    clearIntegrationAuditStorage();
    await guardApiKey(created.plainKey, { requiredScope: API_SCOPES.TENANT_READ });
    assert.equal(listIntegrationAuditEvents().length, 0);
  });
});

describe("Phase 11E — serverless entry (no localStorage)", () => {
  beforeEach(() => {
    delete globalThis.localStorage;
    resetRuntimeStorage();
  });

  it("missing key returns 401 without localStorage crash", async () => {
    const result = await invokeEdgeApi({
      method: "GET",
      path: "/api/v1/integrations",
      headers: {},
    });
    assert.equal(result.statusCode, 401);
    assert.equal(result.body.code, EDGE_API_ERROR_CODES.UNAUTHORIZED);
  });
});
