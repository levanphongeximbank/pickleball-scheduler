import { createLead } from "../../models/lead.js";
import { createScopedMemoryStore, resolveScope } from "./scopedMemoryStore.js";

/**
 * In-memory CrmLeadRepository — tenant/venue isolated per instance.
 */
export function createMemoryLeadRepository() {
  const store = createScopedMemoryStore();

  return {
    save(scopeInput, leadInput) {
      const scope = resolveScope(scopeInput);
      const lead = createLead({ ...leadInput, tenantId: scope.tenantId, venueId: scope.venueId });
      return store.save(scope, lead.leadId, lead);
    },
    getById(scopeInput, leadId) {
      const scope = resolveScope(scopeInput);
      return store.getById(scope, String(leadId || ""));
    },
    list(scopeInput, filters = {}) {
      const scope = resolveScope(scopeInput);
      return store.list(scope, (row) => {
        if (filters.status && row.status !== filters.status) return false;
        if (filters.ownerUserId && row.ownerUserId !== filters.ownerUserId) return false;
        return true;
      });
    },
    delete(scopeInput, leadId) {
      const scope = resolveScope(scopeInput);
      return store.delete(scope, String(leadId || ""));
    },
  };
}
