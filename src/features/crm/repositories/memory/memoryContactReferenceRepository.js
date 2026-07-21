import { createContactReference } from "../../models/contactReference.js";
import { createScopedMemoryStore, resolveScope } from "./scopedMemoryStore.js";

/**
 * In-memory CrmContactReferenceRepository — tenant/venue isolated per instance.
 */
export function createMemoryContactReferenceRepository() {
  const store = createScopedMemoryStore();

  return {
    save(scopeInput, contactInput) {
      const scope = resolveScope(scopeInput);
      const contactRef = createContactReference({
        ...contactInput,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
      });
      return store.save(scope, contactRef.contactRefId, contactRef);
    },
    getById(scopeInput, contactRefId) {
      const scope = resolveScope(scopeInput);
      return store.getById(scope, String(contactRefId || ""));
    },
    list(scopeInput, filters = {}) {
      const scope = resolveScope(scopeInput);
      return store.list(scope, (row) => {
        if (filters.customerId && row.customerId !== filters.customerId) return false;
        if (filters.playerId && row.playerId !== filters.playerId) return false;
        return true;
      });
    },
    delete(scopeInput, contactRefId) {
      const scope = resolveScope(scopeInput);
      return store.delete(scope, String(contactRefId || ""));
    },
  };
}
