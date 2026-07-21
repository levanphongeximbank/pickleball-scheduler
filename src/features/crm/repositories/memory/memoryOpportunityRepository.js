import { createOpportunity } from "../../models/opportunity.js";
import { createScopedMemoryStore, resolveScope } from "./scopedMemoryStore.js";

/**
 * In-memory CrmOpportunityRepository — tenant/venue isolated per instance.
 * No localStorage, Supabase, SQL, or global singleton state.
 */
export function createMemoryOpportunityRepository() {
  const store = createScopedMemoryStore();

  return {
    save(scopeInput, opportunityInput) {
      const scope = resolveScope(scopeInput);
      const opportunity = createOpportunity({
        ...opportunityInput,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
      });
      return store.save(scope, opportunity.opportunityId, opportunity);
    },
    getById(scopeInput, opportunityId) {
      const scope = resolveScope(scopeInput);
      return store.getById(scope, String(opportunityId || ""));
    },
    list(scopeInput, filters = {}) {
      const scope = resolveScope(scopeInput);
      return store.list(scope, (row) => {
        if (filters.pipelineId && row.pipelineId !== String(filters.pipelineId)) return false;
        if (filters.stageCode && row.stageCode !== String(filters.stageCode)) return false;
        if (filters.ownerUserId && row.ownerUserId !== String(filters.ownerUserId)) return false;
        if (filters.stageCategory && row.stageCategory !== String(filters.stageCategory)) {
          return false;
        }
        if (filters.status && row.stageCategory !== String(filters.status)) return false;
        if (filters.leadId && row.leadId !== String(filters.leadId)) return false;
        return true;
      });
    },
    delete(scopeInput, opportunityId) {
      const scope = resolveScope(scopeInput);
      return store.delete(scope, String(opportunityId || ""));
    },
  };
}
