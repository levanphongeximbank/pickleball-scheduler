import { createInteraction } from "../../models/interaction.js";
import { createScopedMemoryStore, resolveScope } from "./scopedMemoryStore.js";

export function createMemoryInteractionRepository() {
  const store = createScopedMemoryStore();

  return {
    save(scopeInput, interactionInput) {
      const scope = resolveScope(scopeInput);
      const interaction = createInteraction({
        ...interactionInput,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
      });
      return store.save(scope, interaction.interactionId, interaction);
    },
    getById(scopeInput, interactionId) {
      const scope = resolveScope(scopeInput);
      return store.getById(scope, String(interactionId || ""));
    },
    list(scopeInput, filters = {}) {
      const scope = resolveScope(scopeInput);
      return store.list(scope, (row) => {
        if (filters.contactRefId && row.contactRefId !== filters.contactRefId) return false;
        if (filters.type && row.type !== filters.type) return false;
        return true;
      });
    },
    delete(scopeInput, interactionId) {
      const scope = resolveScope(scopeInput);
      return store.delete(scope, String(interactionId || ""));
    },
  };
}
