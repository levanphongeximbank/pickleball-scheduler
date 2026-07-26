import { createClubDataRepository } from "./clubDataRepository.js";
import { resolveCourtEngineStore } from "../../features/court-engine/storage/courtEngineStorage.js";
import { getCourtRuntimeWriter } from "../../features/court-engine/runtime/composition.js";

/**
 * Phase 22 / BM-FINAL-COURT-01 — central factory for tenant-scoped data repositories.
 * Court Engine store authority is resolved once via Court runtime composition.
 */
export function createRepositoryFactory({ tenantId = "", supabaseClient = null, authority = undefined, env = undefined } = {}) {
  const clubData = createClubDataRepository();

  const runtime = getCourtRuntimeWriter({
    authority,
    env,
    client: supabaseClient,
    forceNew: Boolean(authority || env),
  });

  const courtEngine = resolveCourtEngineStore(supabaseClient, {
    tenantId,
    authority: runtime.ok ? runtime.authority : authority,
    env,
    runtime: runtime.ok ? { forceNew: false } : undefined,
  });

  return {
    clubData,
    courtEngine,
    tenantId,
    courtRuntimeAuthority: runtime.ok ? runtime.authority : null,
  };
}

export { createClubDataRepository };
