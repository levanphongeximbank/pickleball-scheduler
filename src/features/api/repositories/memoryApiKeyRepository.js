import { API_CLIENT_STATUS } from "../models/apiModels.js";
import { getApiClient } from "../services/apiKeyService.js";
import { loadApiKeys } from "../storage/apiStorage.js";

/**
 * Phase 11D — in-memory / localStorage API key lookup (tests + local dev).
 */
export async function findMemoryKeyCandidatesByPrefix(prefix) {
  if (!prefix) return [];
  return loadApiKeys().filter((k) => k.keyPrefix === prefix);
}

export function resolveMemoryApiClient(clientId) {
  const client = getApiClient(clientId);
  if (!client) return null;
  return {
    id: client.id,
    name: client.name,
    tenantId: client.tenantId,
    status: client.status || API_CLIENT_STATUS.ACTIVE,
  };
}

export async function touchMemoryKeyLastUsed() {
  // Memory store does not persist last_used_at in Phase 11D P0.
}
