import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  createApiClientWithKey,
  revokeApiKey,
} from "../src/features/api/services/apiKeyService.js";
import { clearApiStorage, loadApiKeys, saveApiKeys } from "../src/features/api/storage/apiStorage.js";
import { API_SCOPES } from "../src/features/api/constants/apiScopes.js";
import { EDGE_API_ERROR_CODES } from "../src/features/api/constants/edgeApiErrors.js";
import { guardApiKey } from "../src/features/api/guards/apiKeyGuard.js";
import {
  ApiKeyStoreConfigError,
  findApiKeyByPlain,
  getApiKeyStoreMode,
  resetApiKeyStoreModeForTests,
} from "../src/features/api/storage/apiKeyStore.js";
import { resetSupabaseAdminClientForTests } from "../src/features/api/repositories/supabaseApiKeyRepository.js";
import { resolveApiKeyStoreMode } from "../src/features/api/config/apiKeyStoreConfig.js";
import { hashApiKey, verifyApiKey } from "../src/features/api/utils/hashKey.js";
import { clearApiKeyAuditStorage } from "../src/features/api/services/apiKeyAuditService.js";
import { resetRateLimitCounters, resolveMinuteRateLimit } from "../src/features/api/guards/rateLimitGuard.js";

const TENANT_A = "tenant-a-phase11d";
const TENANT_B = "tenant-b-phase11d";

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
  delete process.env.API_KEY_STORE;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  resetApiKeyStoreModeForTests();
  resetSupabaseAdminClientForTests();
  clearApiStorage();
  clearApiKeyAuditStorage();
  resetRateLimitCounters();
});

afterEach(() => {
  delete globalThis.localStorage;
  delete process.env.VITE_API_ENABLED;
  delete process.env.API_KEY_STORE;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  resetApiKeyStoreModeForTests();
  resetSupabaseAdminClientForTests();
  resetRateLimitCounters();
});

describe("Phase 11D — store selector", () => {
  it("defaults to memory mode", () => {
    assert.equal(getApiKeyStoreMode(), "memory");
    assert.equal(resolveApiKeyStoreMode(), "memory");
  });

  it("throws when supabase mode missing service role", () => {
    process.env.API_KEY_STORE = "supabase";
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    resetApiKeyStoreModeForTests();
    assert.throws(() => resolveApiKeyStoreMode(), ApiKeyStoreConfigError);
  });

  it("selects supabase when env is complete", () => {
    process.env.API_KEY_STORE = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    resetApiKeyStoreModeForTests();
    assert.equal(resolveApiKeyStoreMode(), "supabase");
    assert.equal(getApiKeyStoreMode(), "supabase");
  });
});

describe("Phase 11D — memory store guard", () => {
  it("hash compare finds valid key", async () => {
    const created = await createApiClientWithKey({
      name: "Memory Key",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.TENANT_READ],
    });
    const found = await findApiKeyByPlain(created.plainKey);
    assert.ok(found?.keyRecord);
    assert.equal(found.keyRecord.tenantId, TENANT_A);
    assert.ok(found.keyRecord.hashedKey);
  });

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

  it("blocks missing scope", async () => {
    const created = await createApiClientWithKey({
      name: "ReadOnly",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.TENANT_READ],
    });
    const guard = await guardApiKey(created.plainKey, {
      requiredScope: API_SCOPES.INTEGRATIONS_READ,
    });
    assert.equal(guard.ok, false);
    assert.equal(guard.code, EDGE_API_ERROR_CODES.SCOPE_DENIED);
  });

  it("blocks wrong tenant query", async () => {
    const created = await createApiClientWithKey({
      name: "Tenant A",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.TENANT_READ],
    });
    const guard = await guardApiKey(created.plainKey, {
      requiredScope: API_SCOPES.TENANT_READ,
      tenantId: TENANT_B,
    });
    assert.equal(guard.ok, false);
    assert.equal(guard.code, EDGE_API_ERROR_CODES.TENANT_NOT_FOUND);
  });

  it("does not return hashed_key in successful auth", async () => {
    const created = await createApiClientWithKey({
      name: "Sanitized",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.TENANT_READ],
    });
    const guard = await guardApiKey(created.plainKey, {
      requiredScope: API_SCOPES.TENANT_READ,
    });
    assert.equal(guard.ok, true);
    assert.equal(guard.apiKey?.hashedKey, undefined);
  });

  it("returns config error when supabase mode misconfigured", async () => {
    process.env.API_KEY_STORE = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    resetApiKeyStoreModeForTests();
    const guard = await guardApiKey("pk_test000.secretpart000000000000000000000000", {
      requiredScope: API_SCOPES.TENANT_READ,
    });
    assert.equal(guard.ok, false);
    assert.equal(guard.code, EDGE_API_ERROR_CODES.INTERNAL_ERROR);
    assert.equal(guard.statusCode, 503);
  });
});

describe("Phase 11D — hash utilities", () => {
  it("verifyApiKey matches digest", async () => {
    const plain = "pk_abc12345.secretpart000000000000000000000000";
    const hashed = await hashApiKey(plain);
    assert.equal(await verifyApiKey(plain, hashed), true);
    assert.equal(await verifyApiKey("pk_other.secret", hashed), false);
  });
});

describe("Phase 11D — rate limit env override", () => {
  it("applies API_RATE_LIMIT_REQUESTS_PER_MINUTE when limits empty", () => {
    globalThis.process = globalThis.process || {};
    globalThis.process.env = { ...globalThis.process.env, API_RATE_LIMIT_REQUESTS_PER_MINUTE: "1" };
    assert.equal(resolveMinuteRateLimit({}), 1);
    delete globalThis.process.env.API_RATE_LIMIT_REQUESTS_PER_MINUTE;
  });

  it("explicit limits override env", () => {
    globalThis.process = globalThis.process || {};
    globalThis.process.env = { ...globalThis.process.env, API_RATE_LIMIT_REQUESTS_PER_MINUTE: "1" };
    assert.equal(resolveMinuteRateLimit({ requestsPerMinute: 5 }), 5);
    delete globalThis.process.env.API_RATE_LIMIT_REQUESTS_PER_MINUTE;
  });

  it("defaults to 120 when no env and empty limits", () => {
    delete globalThis.process?.env?.API_RATE_LIMIT_REQUESTS_PER_MINUTE;
    assert.equal(resolveMinuteRateLimit({}), 120);
  });
});

describe("Phase 11D — output safety", () => {
  it("storage JSON does not include raw secret", async () => {
    const created = await createApiClientWithKey({
      name: "Safety",
      tenantId: TENANT_A,
      scopes: [API_SCOPES.TENANT_READ],
    });
    const blob = JSON.stringify(loadApiKeys());
    assert.equal(blob.includes(created.plainKey), false);
    assert.equal(blob.includes(created.plainKey.split(".")[1]), false);
  });
});
