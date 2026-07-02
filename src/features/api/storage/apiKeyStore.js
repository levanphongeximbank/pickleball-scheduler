import {
  ApiKeyStoreConfigError,
  resolveApiKeyStoreMode,
} from "../config/apiKeyStoreConfig.js";
import {
  findMemoryKeyCandidatesByPrefix,
  resolveMemoryApiClient,
  touchMemoryKeyLastUsed,
} from "../repositories/memoryApiKeyRepository.js";
import {
  findSupabaseKeyCandidatesByPrefix,
  touchSupabaseKeyLastUsed,
} from "../repositories/supabaseApiKeyRepository.js";
import { parseApiKeyPrefix, verifyApiKey } from "../utils/hashKey.js";

let cachedMode = null;

export function getApiKeyStoreMode() {
  if (cachedMode === null) {
    cachedMode = resolveApiKeyStoreMode();
  }
  return cachedMode;
}

export function resetApiKeyStoreModeForTests() {
  cachedMode = null;
}

/**
 * Find API key + client by plain key (prefix lookup + hash verify).
 * Never logs or persists the plain key.
 */
export async function findApiKeyByPlain(plainKey) {
  const prefix = parseApiKeyPrefix(plainKey);

  if (!prefix) {
    return null;
  }

  let mode;
  try {
    mode = getApiKeyStoreMode();
  } catch (error) {
    if (error instanceof ApiKeyStoreConfigError) {
      throw error;
    }
    throw error;
  }

  const candidates =
    mode === "supabase"
      ? await findSupabaseKeyCandidatesByPrefix(prefix)
      : (await findMemoryKeyCandidatesByPrefix(prefix)).map((keyRecord) => ({
          keyRecord,
          client: resolveMemoryApiClient(keyRecord.clientId),
        }));

  for (const candidate of candidates) {
    const { keyRecord } = candidate;
    if (!keyRecord?.hashedKey) continue;
    const match = await verifyApiKey(plainKey, keyRecord.hashedKey);
    if (match) {
      const client =
        candidate.client ||
        (mode === "memory" ? resolveMemoryApiClient(keyRecord.clientId) : null);
      return { keyRecord, client };
    }
  }

  return null;
}

/** Best-effort last_used_at — must not fail the request path. */
export function scheduleApiKeyLastUsedUpdate(keyId) {
  if (!keyId) return;

  let mode;
  try {
    mode = getApiKeyStoreMode();
  } catch {
    return;
  }

  const touch =
    mode === "supabase" ? () => touchSupabaseKeyLastUsed(keyId) : () => touchMemoryKeyLastUsed();

  Promise.resolve()
    .then(touch)
    .catch(() => {
      // Swallow — best-effort only.
    });
}

export { ApiKeyStoreConfigError };
