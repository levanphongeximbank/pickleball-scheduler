import { createPipeline } from "../../models/opportunity.js";
import { createScopedMemoryStore, resolveScope } from "./scopedMemoryStore.js";

/**
 * In-memory CrmPipelineRepository — tenant/venue isolated per instance.
 * No localStorage, Supabase, SQL, or global singleton state.
 */
export function createMemoryPipelineRepository() {
  const store = createScopedMemoryStore();

  return {
    save(scopeInput, pipelineInput) {
      const scope = resolveScope(scopeInput);
      const pipeline = createPipeline({
        ...pipelineInput,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
      });
      return store.save(scope, pipeline.pipelineId, pipeline);
    },
    getById(scopeInput, pipelineId) {
      const scope = resolveScope(scopeInput);
      return store.getById(scope, String(pipelineId || ""));
    },
    getByCode(scopeInput, code) {
      const scope = resolveScope(scopeInput);
      const normalized = String(code || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
      const rows = store.list(scope, (row) => row.code === normalized);
      return rows[0] || null;
    },
    list(scopeInput, filters = {}) {
      const scope = resolveScope(scopeInput);
      return store.list(scope, (row) => {
        if (filters.active != null && Boolean(row.active) !== Boolean(filters.active)) {
          return false;
        }
        if (filters.code && row.code !== String(filters.code).trim().toLowerCase()) {
          return false;
        }
        return true;
      });
    },
    delete(scopeInput, pipelineId) {
      const scope = resolveScope(scopeInput);
      return store.delete(scope, String(pipelineId || ""));
    },
  };
}
