import { API_ERROR_CODES } from "../constants/apiErrors.js";
import { hasApiScope, parseScopes } from "../constants/apiScopes.js";
import {
  API_CLIENT_STATUS,
  API_KEY_STATUS,
  createApiClient,
  createApiKeyRecord,
} from "../models/apiModels.js";
import {
  loadApiClients,
  loadApiKeys,
  saveApiClients,
  saveApiKeys,
} from "../storage/apiStorage.js";
import { generateApiKey, hashApiKey, parseApiKeyPrefix, verifyApiKey } from "../utils/hashKey.js";
import {
  API_KEY_AUDIT_ACTIONS,
  recordApiKeyAudit,
} from "./apiKeyAuditService.js";

export { verifyApiKey, hashApiKey, parseApiKeyPrefix };

export function listApiClients({ tenantId = null } = {}) {
  const clients = loadApiClients();
  if (!tenantId) return clients;
  return clients.filter((c) => c.tenantId === tenantId);
}

export function getApiClient(clientId) {
  return loadApiClients().find((c) => c.id === clientId) || null;
}

export async function createApiClientWithKey(input = {}) {
  const name = String(input.name || "").trim();
  const tenantId = input.tenantId || null;
  const scopes = parseScopes(input.scopes);

  if (!name) {
    return { ok: false, error: "Tên API client không được để trống." };
  }
  if (!tenantId) {
    return { ok: false, error: "tenantId là bắt buộc." };
  }

  const client = createApiClient({
    name,
    tenantId,
    createdBy: input.createdBy || null,
    status: input.status || API_CLIENT_STATUS.ACTIVE,
  });

  const clients = loadApiClients();
  clients.push(client);
  saveApiClients(clients);

  return await createApiKeyForClient(client.id, {
    tenantId,
    scopes,
    createdBy: input.createdBy || null,
  });
}

export async function createApiKeyForClient(clientId, input = {}) {
  const client = getApiClient(clientId);
  if (!client) {
    return { ok: false, error: "API client không tồn tại." };
  }

  const { plainKey, prefix, hashedKey } = await generateApiKey();
  const keyRecord = createApiKeyRecord({
    clientId,
    tenantId: input.tenantId || client.tenantId,
    keyPrefix: prefix,
    hashedKey,
    scopes: parseScopes(input.scopes),
    createdBy: input.createdBy || null,
    status: API_KEY_STATUS.ACTIVE,
  });

  const keys = loadApiKeys();
  keys.push(keyRecord);
  saveApiKeys(keys);

  recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.CREATED, {
    tenantId: keyRecord.tenantId,
    clientId: keyRecord.clientId,
    keyId: keyRecord.id,
    actorId: input.createdBy || null,
    meta: { scopes: keyRecord.scopes, prefix: keyRecord.keyPrefix },
  });

  return {
    ok: true,
    client,
    apiKey: keyRecord,
    plainKey,
  };
}

export function updateApiClientStatus(clientId, status) {
  const clients = loadApiClients();
  const index = clients.findIndex((c) => c.id === clientId);
  if (index < 0) {
    return { ok: false, error: "API client không tồn tại." };
  }
  clients[index] = {
    ...clients[index],
    status,
    updatedAt: new Date().toISOString(),
  };
  saveApiClients(clients);
  return { ok: true, client: clients[index] };
}

export function revokeApiKey(keyId) {
  const keys = loadApiKeys();
  const index = keys.findIndex((k) => k.id === keyId);
  if (index < 0) {
    return { ok: false, error: "API key không tồn tại." };
  }
  keys[index] = {
    ...keys[index],
    status: API_KEY_STATUS.REVOKED,
  };
  saveApiKeys(keys);
  recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.REVOKED, {
    tenantId: keys[index].tenantId,
    clientId: keys[index].clientId,
    keyId: keys[index].id,
  });
  return { ok: true, apiKey: keys[index] };
}

export function setApiKeyStatus(keyId, status) {
  const keys = loadApiKeys();
  const index = keys.findIndex((k) => k.id === keyId);
  if (index < 0) {
    return { ok: false, error: "API key không tồn tại." };
  }
  keys[index] = { ...keys[index], status };
  saveApiKeys(keys);
  return { ok: true, apiKey: keys[index] };
}

export function listApiKeys({ tenantId = null, clientId = null } = {}) {
  let keys = loadApiKeys();
  if (tenantId) {
    keys = keys.filter((k) => k.tenantId === tenantId);
  }
  if (clientId) {
    keys = keys.filter((k) => k.clientId === clientId);
  }
  return keys.map((key) => {
    const { hashedKey, ...rest } = key;
    void hashedKey;
    return rest;
  });
}

function isKeyExpired(keyRecord, now = Date.now()) {
  if (keyRecord.status === API_KEY_STATUS.EXPIRED) return true;
  if (!keyRecord.expiresAt) return false;
  return new Date(keyRecord.expiresAt).getTime() <= now;
}

export async function authenticateApiKey(plainKey) {
  if (!plainKey || typeof plainKey !== "string") {
    return {
      ok: false,
      code: API_ERROR_CODES.UNAUTHORIZED,
      message: "API key không hợp lệ.",
    };
  }

  const prefix = parseApiKeyPrefix(plainKey);
  if (!prefix) {
    return {
      ok: false,
      code: API_ERROR_CODES.UNAUTHORIZED,
      message: "API key không hợp lệ.",
    };
  }

  const keys = loadApiKeys();
  const candidates = keys.filter((k) => k.keyPrefix === prefix);
  let keyRecord = null;
  for (const candidate of candidates) {
    if (await verifyApiKey(plainKey, candidate.hashedKey)) {
      keyRecord = candidate;
      break;
    }
  }

  if (!keyRecord) {
    recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.AUTH_FAILED, {
      meta: { reason: "not_found" },
    });
    return {
      ok: false,
      code: API_ERROR_CODES.UNAUTHORIZED,
      message: "API key không tồn tại.",
    };
  }

  if (keyRecord.status === API_KEY_STATUS.REVOKED) {
    recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.AUTH_FAILED, {
      tenantId: keyRecord.tenantId,
      keyId: keyRecord.id,
      clientId: keyRecord.clientId,
      meta: { reason: "revoked" },
    });
    return {
      ok: false,
      code: API_ERROR_CODES.UNAUTHORIZED,
      message: "API key đã bị thu hồi.",
    };
  }

  if (isKeyExpired(keyRecord)) {
    recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.AUTH_FAILED, {
      tenantId: keyRecord.tenantId,
      keyId: keyRecord.id,
      clientId: keyRecord.clientId,
      meta: { reason: "expired" },
    });
    return {
      ok: false,
      code: API_ERROR_CODES.UNAUTHORIZED,
      message: "API key đã hết hạn.",
    };
  }

  if (keyRecord.status === API_KEY_STATUS.INACTIVE) {
    return {
      ok: false,
      code: API_ERROR_CODES.UNAUTHORIZED,
      message: "API key đã bị tắt.",
    };
  }

  const client = getApiClient(keyRecord.clientId);
  if (!client || client.status !== API_CLIENT_STATUS.ACTIVE) {
    return {
      ok: false,
      code: API_ERROR_CODES.UNAUTHORIZED,
      message: "API client không hoạt động.",
    };
  }

  const updatedKeys = keys.map((k) =>
    k.id === keyRecord.id
      ? { ...k, lastUsedAt: new Date().toISOString() }
      : k
  );
  saveApiKeys(updatedKeys);

  recordApiKeyAudit(API_KEY_AUDIT_ACTIONS.AUTH_SUCCESS, {
    tenantId: keyRecord.tenantId,
    keyId: keyRecord.id,
    clientId: keyRecord.clientId,
  });

  return {
    ok: true,
    apiKey: keyRecord,
    client,
    tenantId: keyRecord.tenantId,
    scopes: keyRecord.scopes,
  };
}

export function assertApiScope(auth, requiredScope) {
  if (!auth?.ok) {
    return auth;
  }
  if (!hasApiScope(auth.scopes, requiredScope)) {
    return {
      ok: false,
      code: API_ERROR_CODES.INSUFFICIENT_SCOPE,
      message: `Thiếu scope: ${requiredScope}`,
    };
  }
  return { ok: true };
}

export function assertApiTenant(auth, tenantId) {
  if (!auth?.ok) return auth;
  if (tenantId && auth.tenantId && auth.tenantId !== tenantId) {
    return {
      ok: false,
      code: API_ERROR_CODES.TENANT_MISMATCH,
      message: "Tenant không khớp với API key.",
    };
  }
  return { ok: true };
}
