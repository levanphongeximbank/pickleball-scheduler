import { createOpportunity } from "../../models/opportunity.js";
import { createScopedMemoryStore, resolveScope } from "./scopedMemoryStore.js";

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
        if (filters.stageCode && row.stageCode !== filters.stageCode) return false;
        return true;
      });
    },
    delete(scopeInput, opportunityId) {
      const scope = resolveScope(scopeInput);
      return store.delete(scope, String(opportunityId || ""));
    },
  };
}
