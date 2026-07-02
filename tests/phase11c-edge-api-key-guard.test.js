import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  createApiClientWithKey,
  revokeApiKey,
  listApiKeys,
  verifyApiKey,
  hashApiKey,
} from "../src/features/api/services/apiKeyService.js";
import { clearApiStorage, loadApiKeys, saveApiKeys } from "../src/features/api/storage/apiStorage.js";
import { API_SCOPES } from "../src/features/api/constants/apiScopes.js";
import { EDGE_API_ERROR_CODES } from "../src/features/api/constants/edgeApiErrors.js";
import { guardApiKey } from "../src/features/api/guards/apiKeyGuard.js";
import { checkRateLimit, resetRateLimitCounters } from "../src/features/api/guards/rateLimitGuard.js";
import { invokeEdgeApi, listEdgeApiRoutes } from "../src/features/api/router/edgeApiRouter.js";
import { canManageApiKeys } from "../src/features/api/services/apiKeyManagementService.js";
import {
  clearApiKeyAuditStorage,
  listApiKeyAuditEvents,
  API_KEY_AUDIT_ACTIONS,
} from "../src/features/api/services/apiKeyAuditService.js";
import { enableRbac } from "../src/auth/authService.js";
import { ROLES } from "../src/auth/roles.js";
import { normalizeUser } from "../src/models/user.js";
import { can } from "../src/auth/rbac.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { invokeApi } from "../src/features/api/router/apiRouter.js";

const TENANT_A = "tenant-a-phase11c";
const TENANT_B = "tenant-b-phase11c";

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
  clearApiStorage();
  clearApiKeyAuditStorage();
  resetRateLimitCounters();
});

afterEach(() => {
  delete globalThis.localStorage;
  delete process.env.VITE_API_ENABLED;
  resetRateLimitCounters();
});

describe("Phase 11C — API key storage security", () => {
  it("does not persist raw secret in storage", async () => {
    const created = await createApiClientWithKey({
      name: "Secure Client",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.TENANT_READ],
    });
    assert.equal(created.ok, true);
    const stored = loadApiKeys()[0];
    assert.notEqual(stored.hashedKey, created.plainKey);
    assert.equal(stored.hashedKey.includes("."), false);
    assert.equal(JSON.stringify(loadApiKeys()).includes(created.plainKey.split(".")[1]), false);
  });

  it("verifyApiKey matches hashed digest", async () => {
    const created = await createApiClientWithKey({
      name: "Verify",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.TENANT_READ],
    });
    const stored = loadApiKeys()[0];
    assert.equal(await verifyApiKey(created.plainKey, stored.hashedKey), true);
    assert.equal(await verifyApiKey("pk_bad.secret", stored.hashedKey), false);
    const hash = await hashApiKey(created.plainKey);
    assert.equal(hash, stored.hashedKey);
  });
});

describe("Phase 11C — API key guard states", () => {
  it("blocks revoked key", async () => {
    const created = await createApiClientWithKey({
      name: "Revoked",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.TENANT_READ],
    });
    revokeApiKey(created.apiKey.id);
    const guard = await guardApiKey(created.plainKey, {
      requiredScope: API_SCOPES.TENANT_READ,
    });
    assert.equal(guard.ok, false);
    assert.equal(guard.code, EDGE_API_ERROR_CODES.INVALID_API_KEY);
  });

  it("blocks expired key", async () => {
    const created = await createApiClientWithKey({
      name: "Expired",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.TENANT_READ],
    });
    const keys = loadApiKeys();
    keys[0] = {
      ...keys[0],
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    };
    saveApiKeys(keys);

    const guard = await guardApiKey(created.plainKey, {
      requiredScope: API_SCOPES.TENANT_READ,
    });
    assert.equal(guard.ok, false);
    assert.equal(guard.code, EDGE_API_ERROR_CODES.INVALID_API_KEY);
  });

  it("blocks missing key with unauthorized", async () => {
    const guard = await guardApiKey(null, { requiredScope: API_SCOPES.TENANT_READ });
    assert.equal(guard.ok, false);
    assert.equal(guard.code, EDGE_API_ERROR_CODES.UNAUTHORIZED);
    assert.equal(guard.statusCode, 401);
  });

  it("blocks wrong tenant key", async () => {
    const created = await createApiClientWithKey({
      name: "Tenant A only",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.TENANT_READ],
    });
    const guard = await guardApiKey(created.plainKey, {
      requiredScope: API_SCOPES.TENANT_READ,
      tenantId: TENANT_B,
    });
    assert.equal(guard.ok, false);
    assert.equal(guard.code, EDGE_API_ERROR_CODES.TENANT_NOT_FOUND);
    assert.equal(guard.statusCode, 403);
  });

  it("blocks missing scope", async () => {
    const created = await createApiClientWithKey({
      name: "Read integrations only",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.INTEGRATIONS_READ],
    });
    const guard = await guardApiKey(created.plainKey, {
      requiredScope: API_SCOPES.WEBHOOKS_WRITE,
    });
    assert.equal(guard.ok, false);
    assert.equal(guard.code, EDGE_API_ERROR_CODES.SCOPE_DENIED);
    assert.equal(guard.statusCode, 403);
  });

  it("allows valid key with required scope", async () => {
    const created = await createApiClientWithKey({
      name: "Full edge",
      tenantId: TENANT_A,
      scopes: [
        API_SCOPES.TENANT_READ,
        API_SCOPES.INTEGRATIONS_READ,
        API_SCOPES.WEBHOOKS_READ,
      ],
    });
    const guard = await guardApiKey(created.plainKey, {
      requiredScope: API_SCOPES.INTEGRATIONS_READ,
    });
    assert.equal(guard.ok, true);
    assert.equal(guard.tenantId, TENANT_A);
  });
});

describe("Phase 11C — rate limit guard", () => {
  it("returns rate_limited when threshold exceeded", () => {
    const limits = { requestsPerMinute: 2 };
    const ctx = { tenantId: TENANT_A, clientId: "client-1", limits };
    assert.equal(checkRateLimit(ctx).ok, true);
    assert.equal(checkRateLimit(ctx).ok, true);
    const blocked = checkRateLimit(ctx);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "rate_limited");
    assert.equal(blocked.statusCode, 429);
  });
});

describe("Phase 11C — edge API router", () => {
  it("registers foundation routes under /api/v1", () => {
    const routes = listEdgeApiRoutes();
    const paths = routes.map((r) => r.path);
    assert.ok(paths.includes("/api/v1/health"));
    assert.ok(paths.includes("/api/v1/tenant"));
    assert.ok(paths.includes("/api/v1/integrations"));
    assert.ok(paths.includes("/api/v1/webhooks/test"));
  });

  it("health is public with edge response envelope", async () => {
    const result = await invokeEdgeApi({ method: "GET", path: "/api/v1/health" });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.code, "ok");
    assert.ok(result.body.requestId);
    assert.equal(result.body.data.status, "ok");
  });

  it("missing key on protected route returns 401", async () => {
    const result = await invokeEdgeApi({ method: "GET", path: "/api/v1/tenant" });
    assert.equal(result.statusCode, 401);
    assert.equal(result.body.ok, false);
    assert.equal(result.body.code, EDGE_API_ERROR_CODES.UNAUTHORIZED);
  });

  it("valid key accesses tenant and integrations", async () => {
    const created = await createApiClientWithKey({
      name: "Edge",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.TENANT_READ, API_SCOPES.INTEGRATIONS_READ, API_SCOPES.WEBHOOKS_READ],
    });

    const tenant = await invokeEdgeApi({
      method: "GET",
      path: "/api/v1/tenant",
      headers: { "x-api-key": created.plainKey },
    });
    assert.equal(tenant.statusCode, 200);
    assert.equal(tenant.body.data.tenantId, TENANT_A);

    const integrations = await invokeEdgeApi({
      method: "GET",
      path: "/api/v1/integrations",
      headers: { "x-api-key": created.plainKey },
    });
    assert.equal(integrations.statusCode, 200);
    assert.ok(integrations.body.data.providers);
  });

  it("edge invoke returns 429 when rate limit exceeded", async () => {
    const created = await createApiClientWithKey({
      name: "Rate",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.TENANT_READ],
    });
    const headers = { "x-api-key": created.plainKey };
    const limits = { requestsPerMinute: 1 };

    const first = await invokeEdgeApi({
      method: "GET",
      path: "/api/v1/tenant",
      headers,
      rateLimits: limits,
    });
    assert.equal(first.statusCode, 200);

    const second = await invokeEdgeApi({
      method: "GET",
      path: "/api/v1/tenant",
      headers,
      rateLimits: limits,
    });
    assert.equal(second.statusCode, 429);
    assert.equal(second.body.code, EDGE_API_ERROR_CODES.RATE_LIMITED);
  });

  it("records audit events without raw key", async () => {
    const created = await createApiClientWithKey({
      name: "Audit",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.TENANT_READ],
    });
    await invokeEdgeApi({
      method: "GET",
      path: "/api/v1/tenant",
      headers: { "x-api-key": created.plainKey },
    });
    const events = listApiKeyAuditEvents({ tenantId: TENANT_A });
    assert.ok(events.some((e) => e.action === API_KEY_AUDIT_ACTIONS.CREATED));
    assert.ok(events.some((e) => e.action === API_KEY_AUDIT_ACTIONS.USED));
    const blob = JSON.stringify(events);
    assert.equal(blob.includes(created.plainKey), false);
  });
});

describe("Phase 11C — RBAC API key management", () => {
  const rbac = { rbacEnabled: true };
  const venueScope = { venueId: TENANT_A, tenantId: TENANT_A };

  it("PLAYER cannot manage API keys when RBAC enabled", () => {
    const player = normalizeUser({
      id: "player-1",
      email: "player@test.local",
      role: ROLES.PLAYER,
      venueId: TENANT_A,
      clubId: "club-1",
      playerId: "player-1",
      status: "active",
    });
    enableRbac();
    assert.equal(can(player, PERMISSIONS.API_MANAGE, venueScope, rbac), false);
    assert.equal(canManageApiKeys(player).ok, false);
  });

  it("venue owner can manage API keys when RBAC enabled", () => {
    const owner = normalizeUser({
      id: "owner-1",
      email: "owner@test.local",
      role: ROLES.COURT_OWNER,
      venueId: TENANT_A,
      status: "active",
    });
    enableRbac();
    assert.equal(can(owner, PERMISSIONS.API_MANAGE, venueScope, rbac), true);
    assert.equal(canManageApiKeys(owner).ok, true);
  });
});

describe("Phase 11C — legacy router compatibility", () => {
  it("existing marketplace invokeApi health still passes", async () => {
    const result = await invokeApi({ method: "GET", path: "/api/v1/health" });
    assert.equal(result.statusCode, 200);
    assert.equal(result.response.success, true);
  });

  it("listApiKeys never returns hashed secret", async () => {
    await createApiClientWithKey({
      name: "List",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.MARKETPLACE_READ],
    });
    const keys = listApiKeys({ tenantId: TENANT_A });
    assert.equal(keys.length, 1);
    assert.equal(keys[0].hashedKey, undefined);
  });
});
