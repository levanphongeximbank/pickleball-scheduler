import { createClubDataRepository } from "./clubDataRepository.js";
import { createSupabaseCourtEngineStore, isSupabaseCourtEngineStoreEnabled } from "../../features/court-engine/storage/SupabaseCourtEngineStore.js";
import { resolveCourtEngineStore } from "../../features/court-engine/storage/courtEngineStorage.js";

/**
 * Phase 22 — central factory for tenant-scoped data repositories.
 */
export function createRepositoryFactory({ tenantId = "", supabaseClient = null } = {}) {
  const clubData = createClubDataRepository();

  const courtEngine = isSupabaseCourtEngineStoreEnabled()
    ? createSupabaseCourtEngineStore(supabaseClient, { tenantId })
    : resolveCourtEngineStore(supabaseClient, { tenantId });

  return {
    clubData,
    courtEngine,
    tenantId,
  };
}

export { createClubDataRepository };
